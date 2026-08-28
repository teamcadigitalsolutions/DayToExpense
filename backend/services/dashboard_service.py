"""DayToExpense — Dashboard Service: aggregations, net worth, analytics insights."""
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.account import Account
from backend.models.transaction import Transaction
from backend.models.all_models import Investment, Loan, Invoice, InvoiceStatus, TransactionCategory
from backend.utils.decimal_utils import safe_decimal, round_money, calculate_percentage
from backend.utils.date_utils import get_period_dates, get_last_n_months
from backend.services.transaction_service import TransactionService


class DashboardService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.tx_service = TransactionService(db)

    async def get_summary(self, workspace_id: str, period: str = "THIS_MONTH",
                           start_date: Optional[date] = None, end_date: Optional[date] = None) -> dict:
        """Get the complete dashboard summary card data."""
        if start_date and end_date:
            p_start, p_end = start_date, end_date
        else:
            p_start, p_end = get_period_dates(period)

        # Previous period for % change
        period_len = (p_end - p_start).days
        prev_end = p_start
        from datetime import timedelta
        prev_start = p_start - timedelta(days=period_len + 1)

        # Core aggregates
        income = await self.tx_service.sum_by_type(workspace_id, "INCOME", p_start, p_end)
        expense = await self.tx_service.sum_by_type(workspace_id, "EXPENSE", p_start, p_end)
        prev_income = await self.tx_service.sum_by_type(workspace_id, "INCOME", prev_start, prev_end)
        prev_expense = await self.tx_service.sum_by_type(workspace_id, "EXPENSE", prev_start, prev_end)

        # Total balance = sum of all active account balances
        acc_result = await self.db.execute(
            select(func.sum(Account.current_balance)).where(
                Account.workspace_id == workspace_id,
                Account.is_active == True,
                Account.is_deleted == False,
                Account.account_type.notin_(["CREDIT_CARD", "LOAN"]),
            )
        )
        total_balance = safe_decimal(acc_result.scalar_one_or_none())

        # Credit card outstanding
        cc_result = await self.db.execute(
            select(func.sum(Account.credit_limit - Account.current_balance)).where(
                Account.workspace_id == workspace_id,
                Account.account_type == "CREDIT_CARD",
                Account.is_deleted == False,
            )
        )
        cc_outstanding = safe_decimal(cc_result.scalar_one_or_none())

        # Loan outstanding
        loan_result = await self.db.execute(
            select(func.sum(Loan.outstanding_balance)).where(
                Loan.workspace_id == workspace_id,
                Loan.status == "ACTIVE",
                Loan.is_deleted == False,
            )
        )
        loan_outstanding = safe_decimal(loan_result.scalar_one_or_none())

        # Investments
        inv_result = await self.db.execute(
            select(
                func.sum(Investment.invested_amount),
                func.sum(Investment.current_value),
            ).where(
                Investment.workspace_id == workspace_id,
                Investment.is_active == True,
                Investment.is_deleted == False,
            )
        )
        inv_row = inv_result.one_or_none()
        total_invested = safe_decimal(inv_row[0] if inv_row else None)
        current_value = safe_decimal(inv_row[1] if inv_row else None)
        inv_profit_loss = current_value - total_invested if current_value else Decimal("0")

        # Receivable (SENT/PARTIALLY_PAID invoices balance)
        recv_result = await self.db.execute(
            select(func.sum(Invoice.balance)).where(
                Invoice.workspace_id == workspace_id,
                Invoice.status.in_(["SENT", "PARTIALLY_PAID", "OVERDUE"]),
                Invoice.is_deleted == False,
            )
        )
        total_receivable = safe_decimal(recv_result.scalar_one_or_none())

        # % changes
        def pct_change(new_val: Decimal, old_val: Decimal) -> Decimal:
            if old_val == 0:
                return Decimal("0")
            return round_money((new_val - old_val) / old_val * 100)

        net_cash_flow = income - expense
        savings_rate = calculate_percentage(net_cash_flow, income) if income > 0 else Decimal("0")

        return {
            "total_balance": round_money(total_balance),
            "total_income": round_money(income),
            "total_expense": round_money(expense),
            "net_cash_flow": round_money(net_cash_flow),
            "total_investments": round_money(total_invested),
            "investment_profit_loss": round_money(inv_profit_loss),
            "total_receivable": round_money(total_receivable),
            "total_payable": Decimal("0"),
            "credit_card_outstanding": round_money(cc_outstanding),
            "loan_outstanding": round_money(loan_outstanding),
            "savings_rate": round_money(savings_rate),
            "income_change_pct": pct_change(income, prev_income),
            "expense_change_pct": pct_change(expense, prev_expense),
            "period_label": period.replace("_", " ").title(),
        }

    async def get_net_worth(self, workspace_id: str) -> dict:
        """Net Worth = Assets - Liabilities."""
        # Assets: savings + current + cash + wallet + investment accounts
        asset_result = await self.db.execute(
            select(func.sum(Account.current_balance)).where(
                Account.workspace_id == workspace_id,
                Account.is_deleted == False,
                Account.is_active == True,
                Account.account_type.in_(["SAVINGS", "CURRENT", "CASH", "WALLET", "INVESTMENT"]),
            )
        )
        bank_assets = safe_decimal(asset_result.scalar_one_or_none())

        # Investment current values
        inv_result = await self.db.execute(
            select(func.sum(Investment.current_value)).where(
                Investment.workspace_id == workspace_id,
                Investment.is_active == True,
                Investment.is_deleted == False,
                Investment.current_value.isnot(None),
            )
        )
        investment_assets = safe_decimal(inv_result.scalar_one_or_none())

        total_assets = bank_assets + investment_assets

        # Liabilities: credit cards + loans
        cc_result = await self.db.execute(
            select(func.sum(Account.current_balance)).where(
                Account.workspace_id == workspace_id,
                Account.account_type == "CREDIT_CARD",
                Account.is_deleted == False,
            )
        )
        cc_balance = safe_decimal(cc_result.scalar_one_or_none())

        loan_result = await self.db.execute(
            select(func.sum(Loan.outstanding_balance)).where(
                Loan.workspace_id == workspace_id,
                Loan.status == "ACTIVE",
                Loan.is_deleted == False,
            )
        )
        loan_balance = safe_decimal(loan_result.scalar_one_or_none())

        total_liabilities = cc_balance + loan_balance
        net_worth = total_assets - total_liabilities

        return {
            "total_assets": round_money(total_assets),
            "bank_assets": round_money(bank_assets),
            "investment_assets": round_money(investment_assets),
            "total_liabilities": round_money(total_liabilities),
            "credit_card_liabilities": round_money(cc_balance),
            "loan_liabilities": round_money(loan_balance),
            "net_worth": round_money(net_worth),
        }

    async def get_account_balances(self, workspace_id: str) -> list[dict]:
        """Get all active account balances for the bar chart."""
        result = await self.db.execute(
            select(Account).where(
                Account.workspace_id == workspace_id,
                Account.is_active == True,
                Account.is_deleted == False,
            ).order_by(desc(Account.current_balance))
        )
        accounts = result.scalars().all()
        return [
            {
                "account_id": a.id,
                "account_name": a.name,
                "account_type": a.account_type,
                "balance": round_money(a.current_balance),
                "currency_code": a.currency_code,
                "color": a.color,
            }
            for a in accounts
        ]

    async def get_monthly_cashflow(self, workspace_id: str, months: int = 12) -> list[dict]:
        """Monthly income vs expense trend."""
        return await self.tx_service.get_monthly_trend(workspace_id, months)

    async def get_income_expense_chart(
        self, workspace_id: str, period: str = "THIS_YEAR"
    ) -> list[dict]:
        """Get income/expense by month for the selected period."""
        return await self.tx_service.get_monthly_trend(workspace_id, 12)

    async def get_category_breakdown(
        self, workspace_id: str, tx_type: str = "EXPENSE",
        period: str = "THIS_MONTH",
        start_date: Optional[date] = None, end_date: Optional[date] = None,
    ) -> list[dict]:
        if start_date and end_date:
            p_start, p_end = start_date, end_date
        else:
            p_start, p_end = get_period_dates(period)
        return await self.tx_service.get_category_breakdown(workspace_id, tx_type, p_start, p_end)

    async def get_analytics_insights(
        self, workspace_id: str, period: str = "THIS_MONTH"
    ) -> list[dict]:
        """Rule-based financial insights derived from real transaction data."""
        p_start, p_end = get_period_dates(period)
        from datetime import timedelta
        period_len = (p_end - p_start).days or 30
        prev_end = p_start
        prev_start = p_start - timedelta(days=period_len + 1)

        income = await self.tx_service.sum_by_type(workspace_id, "INCOME", p_start, p_end)
        expense = await self.tx_service.sum_by_type(workspace_id, "EXPENSE", p_start, p_end)
        prev_expense = await self.tx_service.sum_by_type(workspace_id, "EXPENSE", prev_start, prev_end)

        insights = []

        if income > 0:
            savings_rate = calculate_percentage(income - expense, income)
            insights.append({
                "type": "info" if savings_rate >= 20 else "warning",
                "message": f"Your savings rate this period is {savings_rate:.1f}%.",
            })

        if prev_expense > 0 and expense > 0:
            change = ((expense - prev_expense) / prev_expense * 100)
            direction = "increased" if change > 0 else "decreased"
            insights.append({
                "type": "warning" if change > 10 else "success",
                "message": f"Expenses {direction} by {abs(change):.1f}% vs previous period.",
            })

        # Top spending category
        breakdown = await self.tx_service.get_category_breakdown(workspace_id, "EXPENSE", p_start, p_end)
        if breakdown:
            top = breakdown[0]
            insights.append({
                "type": "info",
                "message": f"Top spending: {top['category_name']} — ₹{top['amount']:,.2f} ({top['percentage']:.1f}%)",
            })

        if income == 0:
            insights.append({"type": "warning", "message": "No income recorded for this period."})

        return insights
