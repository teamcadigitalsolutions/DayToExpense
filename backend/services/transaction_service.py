"""DayToExpense — Transaction Service + Transfer Service (atomic financial operations)."""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.account import Account
from backend.models.transaction import Transaction, TransactionType, TransactionStatus
from backend.models.all_models import Transfer
from backend.schemas.schemas import TransactionCreate, TransactionUpdate, TransferCreate, TransactionFilter
from backend.utils.decimal_utils import safe_decimal, round_money


class AccountBalanceManager:
    """Handles atomic account balance updates."""

    @staticmethod
    async def update_balance(
        db: AsyncSession,
        account_id: str,
        amount: Decimal,
        transaction_type: str,
        workspace_id: str,
    ) -> Account:
        """Update account balance based on transaction type. Raises if account not found."""
        result = await db.execute(
            select(Account).where(
                Account.id == account_id,
                Account.workspace_id == workspace_id,
                Account.is_deleted == False,
            )
        )
        account = result.scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=404, detail=f"Account {account_id} not found")

        amt = safe_decimal(amount)
        tx_type = transaction_type.upper()

        if tx_type in ("INCOME", "REFUND"):
            account.current_balance = account.current_balance + amt
        elif tx_type in ("EXPENSE", "LOAN_PAYMENT", "CREDIT_CARD_PAYMENT"):
            account.current_balance = account.current_balance - amt
        elif tx_type == "TRANSFER_OUT":
            account.current_balance = account.current_balance - amt
        elif tx_type == "TRANSFER_IN":
            account.current_balance = account.current_balance + amt
        # ADJUSTMENT handled by caller with signed amount

        return account

    @staticmethod
    async def reverse_balance(
        db: AsyncSession,
        account_id: str,
        amount: Decimal,
        transaction_type: str,
        workspace_id: str,
    ) -> Account:
        """Reverse a previously applied balance change (for edits/deletes)."""
        result = await db.execute(
            select(Account).where(
                Account.id == account_id,
                Account.workspace_id == workspace_id,
            )
        )
        account = result.scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=404, detail=f"Account {account_id} not found")

        amt = safe_decimal(amount)
        tx_type = transaction_type.upper()

        if tx_type in ("INCOME", "REFUND"):
            account.current_balance = account.current_balance - amt
        elif tx_type in ("EXPENSE", "LOAN_PAYMENT", "CREDIT_CARD_PAYMENT"):
            account.current_balance = account.current_balance + amt
        elif tx_type == "TRANSFER_OUT":
            account.current_balance = account.current_balance + amt
        elif tx_type == "TRANSFER_IN":
            account.current_balance = account.current_balance - amt

        return account


class TransactionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, workspace_id: str, data: TransactionCreate, user_id: str) -> Transaction:
        """Create a transaction and update the account balance atomically."""
        # Validate account belongs to workspace
        acc_result = await self.db.execute(
            select(Account).where(
                Account.id == data.account_id,
                Account.workspace_id == workspace_id,
                Account.is_deleted == False,
            )
        )
        account = acc_result.scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found in this workspace")

        amount = safe_decimal(data.amount)

        category_id = data.category_id if data.category_id and str(data.category_id).strip() else None
        subcategory_id = data.subcategory_id if data.subcategory_id and str(data.subcategory_id).strip() else None
        contact_id = data.contact_id if data.contact_id and str(data.contact_id).strip() else None

        from backend.models.all_models import TransactionCategory, Contact
        category_name = None

        if category_id:
            cat_res = await self.db.execute(
                select(TransactionCategory).where(
                    TransactionCategory.id == category_id,
                    TransactionCategory.is_active == True,
                )
            )
            cat_obj = cat_res.scalar_one_or_none()
            if cat_obj:
                category_name = cat_obj.name
            else:
                dummy_map = {
                    "cat-exp-1": "Housing & Rent", "cat-exp-01": "Housing & Rent",
                    "cat-exp-2": "Food & Groceries", "cat-exp-02": "Food & Groceries",
                    "cat-exp-3": "Utilities & Bills", "cat-exp-03": "Utilities & Bills",
                    "cat-exp-4": "Transportation & Fuel", "cat-exp-04": "Transportation & Fuel",
                    "cat-exp-5": "Health & Medical", "cat-exp-05": "Health & Medical",
                    "cat-exp-6": "Entertainment & Leisure", "cat-exp-06": "Entertainment & Leisure",
                    "cat-exp-7": "Shopping & Personal", "cat-exp-07": "Shopping & Personal",
                    "cat-exp-8": "Loans & EMI Repayments", "cat-exp-08": "Loans & EMI Repayments",
                    "cat-exp-9": "Other Expense", "cat-exp-09": "Other Expense",
                    "cat-inc-1": "Salary & Wages", "cat-inc-01": "Salary & Wages",
                    "cat-inc-2": "Business & Freelance", "cat-inc-02": "Business & Freelance",
                    "cat-inc-3": "Investments & Dividends", "cat-inc-03": "Investments & Dividends",
                    "cat-inc-4": "Rental & Real Estate", "cat-inc-04": "Rental & Real Estate",
                    "cat-inc-5": "Interest & Returns", "cat-inc-05": "Interest & Returns",
                    "cat-inc-6": "Refunds & Cashbacks", "cat-inc-06": "Refunds & Cashbacks",
                    "cat-inc-7": "Gifts & Allowance", "cat-inc-07": "Gifts & Allowance",
                    "cat-inc-8": "Other Income", "cat-inc-08": "Other Income",
                }
                search_name = dummy_map.get(category_id)
                if search_name:
                    find_cat = await self.db.execute(
                        select(TransactionCategory).where(
                            TransactionCategory.name == search_name,
                            TransactionCategory.is_active == True,
                        )
                    )
                    real_cat = find_cat.scalar_one_or_none()
                    if real_cat:
                        category_id = real_cat.id
                        category_name = real_cat.name
                    else:
                        category_id = None
                else:
                    category_id = None


        if contact_id:
            cnt_res = await self.db.execute(
                select(Contact.id).where(
                    Contact.id == contact_id,
                    Contact.workspace_id == workspace_id,
                    Contact.is_deleted == False,
                )
            )
            if not cnt_res.scalar_one_or_none():
                contact_id = None

        desc_text = (data.description or "").strip()
        if not desc_text:
            desc_text = category_name or data.type.capitalize()


        transaction = Transaction(
            id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            account_id=data.account_id,
            category_id=category_id,
            subcategory_id=subcategory_id,
            type=data.type,
            amount=amount,
            currency_code=data.currency_code or account.currency_code,
            exchange_rate=Decimal("1.000000"),
            base_amount=amount,
            date=data.date,
            description=desc_text,
            notes=data.notes,
            reference_number=data.reference_number,
            payment_method=data.payment_method,
            contact_id=contact_id,
            tags=data.tags,
            status=data.status or "COMPLETED",
            is_recurring=False,
            created_by=user_id,
        )

        self.db.add(transaction)

        # Update account balance
        await AccountBalanceManager.update_balance(
            self.db, data.account_id, amount, data.type, workspace_id
        )

        await self.db.commit()
        await self.db.refresh(transaction)
        return transaction

    async def get_list(
        self, workspace_id: str, filters: TransactionFilter
    ) -> tuple[list[Transaction], int]:
        """Get paginated, filtered transactions with total count."""
        query = select(Transaction).where(
            Transaction.workspace_id == workspace_id,
            Transaction.is_deleted == False,
        )

        if filters.type:
            query = query.where(Transaction.type == filters.type)
        if filters.account_id:
            query = query.where(Transaction.account_id == filters.account_id)
        if filters.category_id:
            query = query.where(Transaction.category_id == filters.category_id)
        if filters.start_date:
            query = query.where(Transaction.date >= filters.start_date)
        if filters.end_date:
            query = query.where(Transaction.date <= filters.end_date)
        if filters.min_amount:
            query = query.where(Transaction.amount >= safe_decimal(filters.min_amount))
        if filters.max_amount:
            query = query.where(Transaction.amount <= safe_decimal(filters.max_amount))
        if filters.search:
            search = f"%{filters.search}%"
            query = query.where(
                or_(
                    Transaction.description.ilike(search),
                    Transaction.notes.ilike(search),
                    Transaction.reference_number.ilike(search),
                )
            )
        if filters.status:
            query = query.where(Transaction.status == filters.status)

        # Count
        count_q = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_q)).scalar_one()

        # Paginate
        offset = (filters.page - 1) * filters.size
        query = query.order_by(desc(Transaction.date), desc(Transaction.created_at))
        query = query.offset(offset).limit(filters.size)

        result = await self.db.execute(query)
        transactions = result.scalars().all()
        return list(transactions), total

    async def get_by_id(self, workspace_id: str, transaction_id: str) -> Transaction:
        result = await self.db.execute(
            select(Transaction).where(
                Transaction.id == transaction_id,
                Transaction.workspace_id == workspace_id,
                Transaction.is_deleted == False,
            )
        )
        tx = result.scalar_one_or_none()
        if not tx:
            raise HTTPException(status_code=404, detail="Transaction not found")
        return tx

    async def update(
        self, workspace_id: str, transaction_id: str, data: TransactionUpdate, user_id: str
    ) -> Transaction:
        """Update transaction — reverses old balance effect, applies new."""
        tx = await self.get_by_id(workspace_id, transaction_id)

        # Transfer transactions cannot be edited directly
        if tx.type == "TRANSFER":
            raise HTTPException(
                status_code=400,
                detail="Transfer transactions cannot be edited directly. Edit the transfer record instead.",
            )

        old_amount = tx.amount
        old_type = tx.type
        old_account_id = tx.account_id

        # Apply updates
        if data.amount is not None:
            tx.amount = safe_decimal(data.amount)
            tx.base_amount = tx.amount
        if data.account_id is not None:
            tx.account_id = data.account_id
        if data.category_id is not None:
            tx.category_id = data.category_id
        if data.date is not None:
            tx.date = data.date
        if data.description is not None:
            tx.description = data.description
        if data.notes is not None:
            tx.notes = data.notes
        if data.payment_method is not None:
            tx.payment_method = data.payment_method
        if data.tags is not None:
            tx.tags = data.tags
        if data.status is not None:
            tx.status = data.status

        # Reverse old balance
        await AccountBalanceManager.reverse_balance(
            self.db, old_account_id, old_amount, old_type, workspace_id
        )
        # Apply new balance
        await AccountBalanceManager.update_balance(
            self.db, tx.account_id, tx.amount, tx.type, workspace_id
        )

        await self.db.commit()
        await self.db.refresh(tx)
        return tx

    async def soft_delete(self, workspace_id: str, transaction_id: str, user_id: str) -> None:
        """Soft delete transaction and reverse the balance effect."""
        tx = await self.get_by_id(workspace_id, transaction_id)

        if tx.type == "TRANSFER":
            raise HTTPException(
                status_code=400,
                detail="Delete the transfer record instead of individual transfer transactions.",
            )

        # Reverse balance
        await AccountBalanceManager.reverse_balance(
            self.db, tx.account_id, tx.amount, tx.type, workspace_id
        )

        tx.soft_delete(user_id)
        await self.db.commit()

    async def sum_by_type(
        self,
        workspace_id: str,
        tx_type: str,
        start_date: date,
        end_date: date,
        account_id: Optional[str] = None,
    ) -> Decimal:
        """Sum transactions of a given type within a date range."""
        query = select(func.sum(Transaction.amount)).where(
            Transaction.workspace_id == workspace_id,
            Transaction.type == tx_type,
            Transaction.is_deleted == False,
            Transaction.status != "CANCELLED",
            Transaction.date >= start_date,
            Transaction.date <= end_date,
        )
        if account_id:
            query = query.where(Transaction.account_id == account_id)

        result = await self.db.execute(query)
        total = result.scalar_one_or_none()
        return safe_decimal(total)

    async def get_monthly_trend(self, workspace_id: str, months: int = 12) -> list[dict]:
        """Get income + expense totals for last N months."""
        from backend.utils.date_utils import get_last_n_months
        today = date.today()
        periods = get_last_n_months(months, today)
        trend = []
        for start, end, label in periods:
            income = await self.sum_by_type(workspace_id, "INCOME", start, end)
            expense = await self.sum_by_type(workspace_id, "EXPENSE", start, end)
            trend.append({
                "month": label,
                "income": income,
                "expense": expense,
                "net": income - expense,
            })
        return trend

    async def get_category_breakdown(
        self, workspace_id: str, tx_type: str, start_date: date, end_date: date
    ) -> list[dict]:
        """Get spending/income breakdown by category."""
        from backend.models.all_models import TransactionCategory
        query = (
            select(
                Transaction.category_id,
                TransactionCategory.name,
                TransactionCategory.color,
                TransactionCategory.icon,
                func.sum(Transaction.amount).label("total"),
                func.count(Transaction.id).label("count"),
            )
            .join(TransactionCategory, Transaction.category_id == TransactionCategory.id, isouter=True)
            .where(
                Transaction.workspace_id == workspace_id,
                Transaction.type == tx_type,
                Transaction.is_deleted == False,
                Transaction.status != "CANCELLED",
                Transaction.date >= start_date,
                Transaction.date <= end_date,
            )
            .group_by(Transaction.category_id, TransactionCategory.name, TransactionCategory.color, TransactionCategory.icon)
            .order_by(desc("total"))
        )
        result = await self.db.execute(query)
        rows = result.all()

        grand_total = sum(safe_decimal(r.total) for r in rows)
        breakdown = []
        for row in rows:
            amt = safe_decimal(row.total)
            pct = (amt / grand_total * 100) if grand_total > 0 else Decimal("0")
            breakdown.append({
                "category_id": row.category_id or "uncategorized",
                "category_name": row.name or "Uncategorized",
                "category_color": row.color,
                "category_icon": row.icon,
                "amount": round_money(amt),
                "percentage": round_money(pct),
                "transaction_count": row.count,
            })
        return breakdown


class TransferService:
    """
    Handles transfers between accounts.
    A transfer creates TWO transactions (type=TRANSFER) and ONE transfer record.
    Transfers NEVER appear in income/expense reports.
    Both account balance updates happen atomically — rollback on any failure.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, workspace_id: str, data: TransferCreate, user_id: str) -> Transfer:
        """Create an atomic transfer between two accounts."""
        # Validate both accounts exist in workspace
        from_acc_result = await self.db.execute(
            select(Account).where(
                Account.id == data.from_account_id,
                Account.workspace_id == workspace_id,
                Account.is_deleted == False,
            )
        )
        from_account = from_acc_result.scalar_one_or_none()
        if not from_account:
            raise HTTPException(status_code=404, detail="Source account not found")

        to_acc_result = await self.db.execute(
            select(Account).where(
                Account.id == data.to_account_id,
                Account.workspace_id == workspace_id,
                Account.is_deleted == False,
            )
        )
        to_account = to_acc_result.scalar_one_or_none()
        if not to_account:
            raise HTTPException(status_code=404, detail="Destination account not found")

        amount = safe_decimal(data.amount)
        fee = safe_decimal(data.fee)
        transfer_id = str(uuid.uuid4())

        # Create DEBIT transaction on from_account (type=TRANSFER so it's excluded from expense reports)
        from_tx = Transaction(
            id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            account_id=data.from_account_id,
            type=TransactionType.TRANSFER,
            amount=amount,
            currency_code=from_account.currency_code,
            exchange_rate=Decimal("1.000000"),
            base_amount=amount,
            date=data.date,
            description=f"Transfer to {to_account.name}",
            notes=data.notes,
            reference_number=data.reference,
            payment_method="NEFT",
            status=TransactionStatus.COMPLETED,
            is_recurring=False,
            created_by=user_id,
        )
        self.db.add(from_tx)
        await self.db.flush()

        # Create CREDIT transaction on to_account
        to_tx = Transaction(
            id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            account_id=data.to_account_id,
            type=TransactionType.TRANSFER,
            amount=amount,
            currency_code=to_account.currency_code,
            exchange_rate=Decimal("1.000000"),
            base_amount=amount,
            date=data.date,
            description=f"Transfer from {from_account.name}",
            notes=data.notes,
            reference_number=data.reference,
            payment_method="NEFT",
            status=TransactionStatus.COMPLETED,
            is_recurring=False,
            created_by=user_id,
        )
        self.db.add(to_tx)
        await self.db.flush()

        # Create Transfer record linking both transactions
        transfer = Transfer(
            id=transfer_id,
            workspace_id=workspace_id,
            from_account_id=data.from_account_id,
            to_account_id=data.to_account_id,
            amount=amount,
            from_transaction_id=from_tx.id,
            to_transaction_id=to_tx.id,
            fee=fee,
            date=data.date,
            reference=data.reference,
            notes=data.notes,
            created_by=user_id,
        )
        self.db.add(transfer)

        # Update account balances atomically
        from_account.current_balance = from_account.current_balance - amount - fee
        to_account.current_balance = to_account.current_balance + amount

        # Commit everything at once — if anything fails, the whole transaction rolls back
        await self.db.commit()
        await self.db.refresh(transfer)
        return transfer

    async def delete(self, workspace_id: str, transfer_id: str, user_id: str) -> None:
        """Delete a transfer and reverse BOTH account balance changes."""
        result = await self.db.execute(
            select(Transfer).where(
                Transfer.id == transfer_id,
                Transfer.workspace_id == workspace_id,
            )
        )
        transfer = result.scalar_one_or_none()
        if not transfer:
            raise HTTPException(status_code=404, detail="Transfer not found")

        amount = transfer.amount
        fee = transfer.fee

        # Reverse from_account balance
        from_acc = await self.db.execute(select(Account).where(Account.id == transfer.from_account_id))
        from_account = from_acc.scalar_one()
        from_account.current_balance = from_account.current_balance + amount + fee

        # Reverse to_account balance
        to_acc = await self.db.execute(select(Account).where(Account.id == transfer.to_account_id))
        to_account = to_acc.scalar_one()
        to_account.current_balance = to_account.current_balance - amount

        # Soft-delete both transactions
        for tx_id in [transfer.from_transaction_id, transfer.to_transaction_id]:
            tx_result = await self.db.execute(select(Transaction).where(Transaction.id == tx_id))
            tx = tx_result.scalar_one_or_none()
            if tx:
                tx.soft_delete(user_id)

        # Delete transfer record
        await self.db.delete(transfer)
        await self.db.commit()

    async def get_list(self, workspace_id: str, page: int = 1, size: int = 50) -> tuple[list, int]:
        count_q = select(func.count()).where(
            Transfer.workspace_id == workspace_id
        )
        total = (await self.db.execute(count_q)).scalar_one()
        offset = (page - 1) * size
        result = await self.db.execute(
            select(Transfer)
            .where(Transfer.workspace_id == workspace_id)
            .order_by(desc(Transfer.date), desc(Transfer.created_at))
            .offset(offset).limit(size)
        )
        return list(result.scalars().all()), total
