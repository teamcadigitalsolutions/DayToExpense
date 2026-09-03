"""DayToExpense — All API routers (auth, workspace, accounts, transactions, transfers,
categories, dashboard, investments, budgets, loans, invoices, contacts, subscriptions,
reports, notifications, migration)."""
from __future__ import annotations
from sqlalchemy.orm import selectinload

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Body, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.dependencies import get_current_user, require_workspace_member
from backend.database.connection import get_db
from backend.models.user import User
from backend.models.workspace import Workspace, WorkspaceMember, WorkspaceRole
from backend.models.account import Account
from backend.models.transaction import Transaction
from backend.models.all_models import (
    Transfer, TransactionCategory, TransactionSubcategory,
    Investment, SIPPlan, Budget, BudgetCategory,
    Loan, LoanPayment, Invoice, InvoiceItem, InvoicePayment,
    Contact, Subscription, Notification, Setting, WishlistItem,
)
from backend.schemas.schemas import (
    RegisterRequest, LoginRequest, TokenResponse, RefreshRequest,
    ChangePasswordRequest, UserResponse, UserUpdate,
    WorkspaceCreate, WorkspaceUpdate, WorkspaceResponse, WorkspaceMemberInvite, WorkspaceMemberResponse,
    AccountCreate, AccountUpdate, AccountResponse, AccountSummary,
    CategoryCreate, CategoryUpdate, CategoryResponse, SubcategoryCreate, SubcategoryResponse,
    TransactionCreate, TransactionUpdate, TransactionResponse, TransactionFilter,
    TransferCreate, TransferResponse,
    DashboardSummary, MonthlyChartPoint, CategoryBreakdown, AccountBalance, AnalyticsInsight,
    InvestmentCreate, InvestmentUpdate, InvestmentResponse, SIPPlanCreate, SIPPlanResponse, PortfolioSummary,
    BudgetCreate, BudgetUpdate, BudgetResponse,
    LoanCreate, LoanUpdate, LoanResponse, LoanPaymentCreate, LoanPaymentResponse,
    InvoiceCreate, InvoiceUpdate, InvoiceResponse, InvoicePaymentCreate, InvoiceItemResponse,
    ContactCreate, ContactUpdate, ContactResponse,
    SubscriptionCreate, SubscriptionUpdate, SubscriptionResponse, SubscriptionAnalytics,
    NotificationResponse, WishlistItemCreate, WishlistItemUpdate, WishlistItemResponse,
    WishlistPurchaseRequest, WishlistAdvanceRequest,
)
from backend.services.auth_service import AuthService
from backend.services.transaction_service import TransactionService, TransferService
from backend.services.dashboard_service import DashboardService
from backend.utils.response import success_response, created_response, deleted_response
from backend.utils.decimal_utils import safe_decimal, round_money


# ═══════════════════════════════════════════════════════════════════════════════
# AUTH ROUTER
# ═══════════════════════════════════════════════════════════════════════════════
router = APIRouter()  # placeholder, each module exports its own router


# ─── Auth ────────────────────────────────────────────────────────────────────
auth_router = APIRouter()


@auth_router.post("/register", status_code=201)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    user = await svc.register(data)
    return created_response(UserResponse.model_validate(user), "Account created successfully")


@auth_router.post("/login")
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    result = await svc.login(data)
    user_resp = UserResponse.model_validate(result["user"])
    return success_response({
        "access_token": result["access_token"],
        "refresh_token": result["refresh_token"],
        "token_type": result["token_type"],
        "expires_in": result["expires_in"],
        "user": user_resp.model_dump(),
    }, "Login successful")


@auth_router.post("/refresh")
async def refresh(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    result = await svc.refresh_tokens(data.refresh_token)
    return success_response({
        "access_token": result["access_token"],
        "refresh_token": result["refresh_token"],
        "token_type": result["token_type"],
        "expires_in": result["expires_in"],
    })


@auth_router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    return success_response(None, "Logged out successfully")


@auth_router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return success_response(UserResponse.model_validate(current_user))


@auth_router.put("/me")
async def update_me(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.full_name:
        current_user.full_name = data.full_name
    if data.phone is not None:
        current_user.phone = data.phone
    await db.commit()
    await db.refresh(current_user)
    return success_response(UserResponse.model_validate(current_user), "Profile updated")


@auth_router.put("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = AuthService(db)
    await svc.change_password(current_user, data.current_password, data.new_password)
    return success_response(None, "Password changed successfully")


@auth_router.get("/workspaces")
async def get_my_workspaces(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    workspaces = await svc.get_user_workspaces(current_user.id)
    result = []
    for ws in workspaces:
        ws_dict = WorkspaceResponse.model_validate(ws).model_dump()
        ws_dict["member_role"] = getattr(ws, "member_role", None)
        result.append(ws_dict)
    return success_response(result)


# ─── Workspaces ───────────────────────────────────────────────────────────────
workspace_router = APIRouter()


@workspace_router.get("")
async def list_workspaces(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    workspaces = await svc.get_user_workspaces(current_user.id)
    result = [WorkspaceResponse.model_validate(ws).model_dump() for ws in workspaces]
    return success_response(result)


@workspace_router.post("", status_code=201)
async def create_workspace(
    data: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ws = Workspace(
        id=str(uuid.uuid4()),
        name=data.name,
        type=data.type,
        owner_id=current_user.id,
        base_currency=data.base_currency,
        description=data.description,
    )
    db.add(ws)
    await db.flush()
    member = WorkspaceMember(
        id=str(uuid.uuid4()),
        workspace_id=ws.id,
        user_id=current_user.id,
        role=WorkspaceRole.OWNER,
        is_active=True,
    )
    db.add(member)
    await db.commit()
    await db.refresh(ws)
    return created_response(WorkspaceResponse.model_validate(ws).model_dump(), "Workspace created")


@workspace_router.get("/{workspace_id}")
async def get_workspace(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.VIEWER)),
):
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return success_response(WorkspaceResponse.model_validate(ws))


@workspace_router.put("/{workspace_id}")
async def update_workspace(
    workspace_id: str,
    data: WorkspaceUpdate,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.ADMIN)),
):
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(ws, field, value)
    await db.commit()
    await db.refresh(ws)
    return success_response(WorkspaceResponse.model_validate(ws), "Workspace updated")


@workspace_router.delete("/{workspace_id}")
async def delete_workspace(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.OWNER)),
):
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    ws.is_active = False
    await db.commit()
    return deleted_response("Workspace deleted")



# ─── Accounts ─────────────────────────────────────────────────────────────────
account_router = APIRouter()


@account_router.get("/{workspace_id}/accounts")
async def list_accounts(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.VIEWER)),
):
    result = await db.execute(
        select(Account).where(
            Account.workspace_id == workspace_id,
            Account.is_deleted == False,
        ).order_by(Account.name)
    )
    accounts = result.scalars().all()
    return success_response([AccountResponse.model_validate(a).model_dump() for a in accounts])


@account_router.post("/{workspace_id}/accounts", status_code=201)
async def create_account(
    workspace_id: str,
    data: AccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    account = Account(
        id=str(uuid.uuid4()),
        workspace_id=workspace_id,
        name=data.name,
        account_type=data.account_type,
        bank_name=data.bank_name,
        account_number_masked=data.account_number_masked,
        currency_code=data.currency_code,
        opening_balance=safe_decimal(data.opening_balance),
        current_balance=safe_decimal(data.opening_balance),
        credit_limit=safe_decimal(data.credit_limit) if data.credit_limit else None,
        billing_date=data.billing_date,
        due_date=data.due_date,
        color=data.color,
        icon=data.icon,
        notes=data.notes,
        is_active=True,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return created_response(AccountResponse.model_validate(account).model_dump(), "Account created")


@account_router.put("/{workspace_id}/accounts/{account_id}")
async def update_account(
    workspace_id: str,
    account_id: str,
    data: AccountUpdate,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.workspace_id == workspace_id, Account.is_deleted == False)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    old_opening = account.opening_balance
    for field, value in data.model_dump(exclude_none=True).items():
        if field == "opening_balance":
            value = safe_decimal(value)
        setattr(account, field, value)
        
    if data.opening_balance is not None:
        diff = safe_decimal(data.opening_balance) - old_opening
        account.current_balance += diff
        
    await db.commit()
    await db.refresh(account)
    return success_response(AccountResponse.model_validate(account).model_dump(), "Account updated")


@account_router.delete("/{workspace_id}/accounts/{account_id}")
async def delete_account(
    workspace_id: str,
    account_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.ADMIN)),
):
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.workspace_id == workspace_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    account.soft_delete(current_user.id)
    await db.commit()
    return deleted_response("Account deleted")


@account_router.get("/{workspace_id}/accounts/{account_id}/statement")
async def account_statement(
    workspace_id: str,
    account_id: str,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    period: str = Query("THIS_MONTH"),
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.VIEWER)),
):
    from backend.utils.date_utils import get_period_dates
    if not (start_date and end_date):
        start_date, end_date = get_period_dates(period)

    acc_result = await db.execute(
        select(Account).where(Account.id == account_id, Account.workspace_id == workspace_id)
    )
    account = acc_result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    txns = await db.execute(
        select(Transaction).options(selectinload(Transaction.account), selectinload(Transaction.category), selectinload(Transaction.subcategory)).where(
            Transaction.account_id == account_id,
            Transaction.workspace_id == workspace_id,
            Transaction.is_deleted == False,
            Transaction.date >= start_date,
            Transaction.date <= end_date,
        ).order_by(Transaction.date, Transaction.created_at)
    )
    transactions = txns.scalars().all()

    # Build running balance
    running_balance = safe_decimal(account.opening_balance)
    entries = []
    for tx in transactions:
        if tx.type in ("INCOME", "REFUND", "TRANSFER") and tx.amount > 0:
            credit = tx.amount
            debit = Decimal("0")
            if tx.type != "TRANSFER":
                running_balance += credit
            else:
                # Transfer in = credit, transfer out = debit
                # Determine by description (simplistic)
                if "from" in tx.description.lower():
                    running_balance += tx.amount
                    credit = tx.amount
                    debit = Decimal("0")
                else:
                    running_balance -= tx.amount
                    debit = tx.amount
                    credit = Decimal("0")
        else:
            debit = tx.amount
            credit = Decimal("0")
            running_balance -= debit

        entries.append({
            "date": tx.date.isoformat(),
            "description": tx.description,
            "reference": tx.reference_number,
            "debit": round_money(debit),
            "credit": round_money(credit),
            "balance": round_money(running_balance),
            "type": tx.type,
        })

    return success_response({
        "account_name": account.name,
        "account_type": account.account_type,
        "currency_code": account.currency_code,
        "period_start": start_date.isoformat(),
        "period_end": end_date.isoformat(),
        "opening_balance": round_money(safe_decimal(account.opening_balance)),
        "closing_balance": round_money(safe_decimal(account.current_balance)),
        "transactions": entries,
    })


# ─── Transactions ────────────────────────────────────────────────────────────
transaction_router = APIRouter()


@transaction_router.get("/{workspace_id}/transactions")
async def list_transactions(
    workspace_id: str,
    type: Optional[str] = Query(None),
    account_id: Optional[str] = Query(None),
    category_id: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.VIEWER)),
):
    filters = TransactionFilter(
        type=type, account_id=account_id, category_id=category_id,
        start_date=start_date, end_date=end_date, search=search,
        status=status, page=page, size=size,
    )
    svc = TransactionService(db)
    items, total = await svc.get_list(workspace_id, filters)
    pages = (total + size - 1) // size
    return success_response({
        "items": items,
        "total": total, "page": page, "size": size, "pages": pages,
    })


@transaction_router.post("/{workspace_id}/transactions", status_code=201)
async def create_transaction(
    workspace_id: str,
    data: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    svc = TransactionService(db)
    tx = await svc.create(workspace_id, data, current_user.id)
    tx_dict = await svc.format_transaction_dict(tx)
    return created_response(tx_dict, "Transaction created")


@transaction_router.get("/{workspace_id}/transactions/{transaction_id}")
async def get_transaction(
    workspace_id: str,
    transaction_id: str,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.VIEWER)),
):
    svc = TransactionService(db)
    tx = await svc.get_by_id(workspace_id, transaction_id)
    tx_dict = await svc.format_transaction_dict(tx)
    return success_response(tx_dict)


@transaction_router.put("/{workspace_id}/transactions/{transaction_id}")
async def update_transaction(
    workspace_id: str,
    transaction_id: str,
    data: TransactionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    svc = TransactionService(db)
    tx = await svc.update(workspace_id, transaction_id, data, current_user.id)
    tx_dict = await svc.format_transaction_dict(tx)
    return success_response(tx_dict, "Transaction updated")


@transaction_router.delete("/{workspace_id}/transactions/{transaction_id}")
async def delete_transaction(
    workspace_id: str,
    transaction_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    svc = TransactionService(db)
    await svc.soft_delete(workspace_id, transaction_id, current_user.id)
    return deleted_response("Transaction deleted")


# ─── Transfers ────────────────────────────────────────────────────────────────
transfer_router = APIRouter()


@transfer_router.post("/{workspace_id}/transfers", status_code=201)
async def create_transfer(
    workspace_id: str,
    data: TransferCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    svc = TransferService(db)
    transfer = await svc.create(workspace_id, data, current_user.id)
    return created_response(TransferResponse.model_validate(transfer).model_dump(), "Transfer created")


@transfer_router.get("/{workspace_id}/transfers")
async def list_transfers(
    workspace_id: str,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.VIEWER)),
):
    svc = TransferService(db)
    transfers, total = await svc.get_list(workspace_id, page, size)
    pages = (total + size - 1) // size
    return success_response({
        "items": [TransferResponse.model_validate(t).model_dump() for t in transfers],
        "total": total, "page": page, "size": size, "pages": pages,
    })


@transfer_router.delete("/{workspace_id}/transfers/{transfer_id}")
async def delete_transfer(
    workspace_id: str,
    transfer_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    svc = TransferService(db)
    await svc.delete(workspace_id, transfer_id, current_user.id)
    return deleted_response("Transfer deleted and balances reversed")


# ─── Categories ───────────────────────────────────────────────────────────────
category_router = APIRouter()


@category_router.get("/categories")
async def list_system_categories(
    type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return system (built-in) categories."""
    query = select(TransactionCategory).options(selectinload(TransactionCategory.subcategories)).where(
        TransactionCategory.is_system == True,
        TransactionCategory.is_active == True,
    )
    if type:
        query = query.where(TransactionCategory.type == type)
    result = await db.execute(query.order_by(TransactionCategory.sort_order))
    cats = result.scalars().all()
    return success_response([CategoryResponse.model_validate(c).model_dump() for c in cats])


@category_router.get("/workspaces/{workspace_id}/categories")
async def list_workspace_categories(
    workspace_id: str,
    type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.VIEWER)),
):
    """Return both system + workspace-custom categories."""
    query = select(TransactionCategory).options(selectinload(TransactionCategory.subcategories)).where(
        and_(
            TransactionCategory.is_active == True,
            (TransactionCategory.is_system == True) | (TransactionCategory.workspace_id == workspace_id),
        )
    )
    if type:
        query = query.where(TransactionCategory.type == type)
    result = await db.execute(query.order_by(TransactionCategory.sort_order, TransactionCategory.name))
    cats = result.scalars().all()
    return success_response([CategoryResponse.model_validate(c).model_dump() for c in cats])


@category_router.post("/workspaces/{workspace_id}/categories", status_code=201)
async def create_category(
    workspace_id: str,
    data: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    cat = TransactionCategory(
        id=str(uuid.uuid4()),
        workspace_id=workspace_id,
        name=data.name,
        type=data.type,
        icon=data.icon,
        color=data.color,
        is_system=False,
        is_active=True,
    )
    db.add(cat)
    await db.commit()
    res = await db.execute(
        select(TransactionCategory).options(selectinload(TransactionCategory.subcategories)).where(TransactionCategory.id == cat.id)
    )
    cat_loaded = res.scalar_one()
    return created_response(CategoryResponse.model_validate(cat_loaded).model_dump(), "Category created")


@category_router.put("/workspaces/{workspace_id}/categories/{category_id}")
async def update_category(
    workspace_id: str,
    category_id: str,
    data: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    result = await db.execute(
        select(TransactionCategory).where(
            TransactionCategory.id == category_id,
            TransactionCategory.workspace_id == workspace_id,
        )
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(category, field, value)
    await db.commit()
    res = await db.execute(
        select(TransactionCategory).options(selectinload(TransactionCategory.subcategories)).where(TransactionCategory.id == category_id)
    )
    category_loaded = res.scalar_one()
    return success_response(CategoryResponse.model_validate(category_loaded).model_dump(), "Category updated")


@category_router.delete("/workspaces/{workspace_id}/categories/{category_id}")
async def delete_category(
    workspace_id: str,
    category_id: str,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.ADMIN)),
):
    result = await db.execute(
        select(TransactionCategory).where(
            TransactionCategory.id == category_id,
            TransactionCategory.workspace_id == workspace_id,
        )
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    from sqlalchemy import update, delete
    await db.execute(delete(TransactionSubcategory).where(TransactionSubcategory.category_id == category_id))
    await db.execute(delete(BudgetCategory).where(BudgetCategory.category_id == category_id))
    await db.execute(update(Transaction).where(Transaction.category_id == category_id).values(category_id=None))
    await db.execute(update(Subscription).where(Subscription.category_id == category_id).values(category_id=None))

    await db.delete(category)
    await db.commit()
    return deleted_response("Category deleted")



# ─── Dashboard ────────────────────────────────────────────────────────────────
dashboard_router = APIRouter()


@dashboard_router.get("/{workspace_id}/dashboard/summary")
async def dashboard_summary(
    workspace_id: str,
    period: str = Query("THIS_MONTH"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.VIEWER)),
):
    svc = DashboardService(db)
    summary = await svc.get_summary(workspace_id, period, start_date, end_date)
    return success_response(summary)


@dashboard_router.get("/{workspace_id}/dashboard/net-worth")
async def net_worth(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.VIEWER)),
):
    svc = DashboardService(db)
    data = await svc.get_net_worth(workspace_id)
    return success_response(data)


@dashboard_router.get("/{workspace_id}/dashboard/charts/income-expense")
async def income_expense_chart(
    workspace_id: str,
    period: str = Query("THIS_YEAR"),
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.VIEWER)),
):
    svc = DashboardService(db)
    data = await svc.get_income_expense_chart(workspace_id, period)
    return success_response(data)


@dashboard_router.get("/{workspace_id}/dashboard/charts/category-breakdown")
async def category_breakdown(
    workspace_id: str,
    type: str = Query("EXPENSE"),
    period: str = Query("THIS_MONTH"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.VIEWER)),
):
    svc = DashboardService(db)
    data = await svc.get_category_breakdown(workspace_id, type, period, start_date, end_date)
    return success_response(data)


@dashboard_router.get("/{workspace_id}/dashboard/charts/account-balances")
async def account_balances_chart(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.VIEWER)),
):
    svc = DashboardService(db)
    data = await svc.get_account_balances(workspace_id)
    return success_response(data)


@dashboard_router.get("/{workspace_id}/dashboard/charts/monthly-cashflow")
async def monthly_cashflow(
    workspace_id: str,
    months: int = Query(12, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.VIEWER)),
):
    svc = DashboardService(db)
    data = await svc.get_monthly_cashflow(workspace_id, months)
    return success_response(data)


@dashboard_router.get("/{workspace_id}/dashboard/analytics")
async def analytics_insights(
    workspace_id: str,
    period: str = Query("THIS_MONTH"),
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.VIEWER)),
):
    svc = DashboardService(db)
    data = await svc.get_analytics_insights(workspace_id, period)
    return success_response(data)


# ─── Investments ──────────────────────────────────────────────────────────────
investment_router = APIRouter()


@investment_router.get("/{workspace_id}/investments")
async def list_investments(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.VIEWER)),
):
    result = await db.execute(
        select(Investment).where(
            Investment.workspace_id == workspace_id,
            Investment.is_deleted == False,
        ).order_by(Investment.name)
    )
    investments = result.scalars().all()
    items = []
    for inv in investments:
        d = InvestmentResponse.model_validate(inv).model_dump()
        if inv.current_value and inv.invested_amount:
            d["profit_loss"] = round_money(safe_decimal(inv.current_value) - safe_decimal(inv.invested_amount))
            if inv.invested_amount > 0:
                d["return_pct"] = round_money(
                    (safe_decimal(inv.current_value) - safe_decimal(inv.invested_amount)) / safe_decimal(inv.invested_amount) * 100
                )
        items.append(d)
    return success_response(items)


@investment_router.post("/{workspace_id}/investments", status_code=201)
async def create_investment(
    workspace_id: str,
    data: InvestmentCreate,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    inv = Investment(
        id=str(uuid.uuid4()),
        workspace_id=workspace_id,
        name=data.name,
        type=data.type,
        institution=data.institution,
        account_id=data.account_id,
        purchase_date=data.purchase_date,
        quantity=data.quantity,
        purchase_price=data.purchase_price,
        invested_amount=safe_decimal(data.invested_amount),
        current_value=safe_decimal(data.current_value) if data.current_value else None,
        maturity_date=data.maturity_date,
        notes=data.notes,
    )
    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    return created_response(InvestmentResponse.model_validate(inv).model_dump(), "Investment created")


@investment_router.put("/{workspace_id}/investments/{investment_id}")
async def update_investment(
    workspace_id: str,
    investment_id: str,
    data: InvestmentUpdate,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    result = await db.execute(
        select(Investment).where(
            Investment.id == investment_id,
            Investment.workspace_id == workspace_id,
            Investment.is_deleted == False,
        )
    )
    investment = result.scalar_one_or_none()
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(investment, field, value)
    await db.commit()
    await db.refresh(investment)
    return success_response(InvestmentResponse.model_validate(investment).model_dump(), "Investment updated")


@investment_router.delete("/{workspace_id}/investments/{investment_id}")
async def delete_investment(
    workspace_id: str,
    investment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    result = await db.execute(
        select(Investment).where(
            Investment.id == investment_id,
            Investment.workspace_id == workspace_id,
            Investment.is_deleted == False,
        )
    )
    investment = result.scalar_one_or_none()
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")
    investment.soft_delete(current_user.id)
    await db.commit()
    return deleted_response("Investment deleted")



@investment_router.get("/{workspace_id}/investments/portfolio/summary")
async def portfolio_summary(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.VIEWER)),
):
    result = await db.execute(
        select(
            func.sum(Investment.invested_amount),
            func.sum(Investment.current_value),
            func.count(Investment.id),
        ).where(
            Investment.workspace_id == workspace_id,
            Investment.is_active == True,
            Investment.is_deleted == False,
        )
    )
    row = result.one()
    invested = safe_decimal(row[0])
    current = safe_decimal(row[1]) if row[1] else invested
    count = row[2] or 0
    pnl = current - invested
    roi = (pnl / invested * 100) if invested > 0 else Decimal("0")

    # Asset allocation by type
    alloc_result = await db.execute(
        select(Investment.type, func.sum(Investment.invested_amount))
        .where(Investment.workspace_id == workspace_id, Investment.is_deleted == False)
        .group_by(Investment.type)
    )
    allocation = [
        {"label": r[0], "value": round_money(safe_decimal(r[1])), "color": None}
        for r in alloc_result.all()
    ]

    return success_response({
        "total_invested": round_money(invested),
        "current_value": round_money(current),
        "total_profit_loss": round_money(pnl),
        "total_return_pct": round_money(roi),
        "investments_count": count,
        "asset_allocation": allocation,
    })


# ─── Budgets ──────────────────────────────────────────────────────────────────

async def format_budget_dict(budget: Budget, db: AsyncSession) -> dict:
    cat_ids = [bc.category_id for bc in (budget.categories or [])]
    cats_map = {}
    if cat_ids:
        c_res = await db.execute(select(TransactionCategory).where(TransactionCategory.id.in_(cat_ids)))
        cats_map = {c.id: c for c in c_res.scalars().all()}
    
    cat_statuses = []
    total_allocated = Decimal('0')
    total_spent = Decimal('0')

    for bc in (budget.categories or []):
        cat_info = cats_map.get(bc.category_id)
        alloc = Decimal(str(bc.allocated_amount or 0))
        spent = Decimal('0')
        remaining = max(Decimal('0'), alloc - spent)
        pct = (spent / alloc * 100) if alloc > 0 else Decimal('0')
        
        total_allocated += alloc
        total_spent += spent

        cat_statuses.append({
            'id': bc.id,
            'category_id': bc.category_id,
            'category_name': cat_info.name if cat_info else 'Category',
            'category_color': cat_info.color if cat_info else '#3b82f6',
            'category_icon': cat_info.icon if cat_info else 'folder',
            'allocated_amount': float(alloc),
            'spent_amount': float(spent),
            'remaining': float(remaining),
            'percentage_used': float(pct),
            'alert_at_75': bc.alert_at_75,
            'alert_at_90': bc.alert_at_90,
            'alert_at_100': bc.alert_at_100,
        })
    
    return {
        'id': budget.id,
        'workspace_id': budget.workspace_id,
        'name': budget.name,
        'period': budget.period,
        'start_date': str(budget.start_date),
        'end_date': str(budget.end_date) if budget.end_date else None,
        'is_active': budget.is_active,
        'total_allocated': float(total_allocated),
        'total_spent': float(total_spent),
        'categories': cat_statuses,
        'created_at': str(budget.created_at),
    }

budget_router = APIRouter()


@budget_router.get("/{workspace_id}/budgets")
async def list_budgets(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.VIEWER)),
):
    result = await db.execute(
        select(Budget).options(selectinload(Budget.categories)).where(
            Budget.workspace_id == workspace_id,
            Budget.is_deleted == False,
        ).order_by(Budget.start_date.desc())
    )
    budgets = result.scalars().all()
    formatted = [await format_budget_dict(b, db) for b in budgets]
    return success_response(formatted)


@budget_router.post("/{workspace_id}/budgets", status_code=201)
async def create_budget(
    workspace_id: str,
    data: BudgetCreate,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    budget = Budget(
        id=str(uuid.uuid4()),
        workspace_id=workspace_id,
        name=data.name,
        period=data.period,
        start_date=data.start_date,
        end_date=data.end_date,
        is_active=True,
    )
    db.add(budget)
    await db.flush()
    for cat_data in data.categories:
        bc = BudgetCategory(
            id=str(uuid.uuid4()),
            budget_id=budget.id,
            category_id=cat_data.category_id,
            allocated_amount=safe_decimal(cat_data.allocated_amount),
            alert_at_75=cat_data.alert_at_75,
            alert_at_90=cat_data.alert_at_90,
            alert_at_100=cat_data.alert_at_100,
        )
        db.add(bc)
    await db.commit()
    res = await db.execute(
        select(Budget).options(selectinload(Budget.categories)).where(Budget.id == budget.id)
    )
    budget_loaded = res.scalar_one()
    formatted = await format_budget_dict(budget_loaded, db)
    return created_response(formatted, "Budget created")


@budget_router.put("/{workspace_id}/budgets/{budget_id}")
async def update_budget(
    workspace_id: str,
    budget_id: str,
    data: BudgetUpdate,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    result = await db.execute(
        select(Budget).where(
            Budget.id == budget_id,
            Budget.workspace_id == workspace_id,
            Budget.is_deleted == False,
        )
    )
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(budget, field, value)
    await db.commit()
    res = await db.execute(
        select(Budget).options(selectinload(Budget.categories)).where(Budget.id == budget_id)
    )
    budget_loaded = res.scalar_one()
    formatted = await format_budget_dict(budget_loaded, db)
    return success_response(formatted, "Budget updated")


@budget_router.delete("/{workspace_id}/budgets/{budget_id}")
async def delete_budget(
    workspace_id: str,
    budget_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    result = await db.execute(
        select(Budget).where(
            Budget.id == budget_id,
            Budget.workspace_id == workspace_id,
            Budget.is_deleted == False,
        )
    )
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    budget.soft_delete(current_user.id)
    await db.commit()
    return deleted_response("Budget deleted")



# ─── Loans ────────────────────────────────────────────────────────────────────
loan_router = APIRouter()


@loan_router.get("/{workspace_id}/loans")
async def list_loans(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.VIEWER)),
):
    result = await db.execute(
        select(Loan).where(
            Loan.workspace_id == workspace_id,
            Loan.is_deleted == False,
        ).order_by(Loan.start_date.desc())
    )
    loans = result.scalars().all()
    return success_response([LoanResponse.model_validate(l).model_dump() for l in loans])


@loan_router.post("/{workspace_id}/loans", status_code=201)
async def create_loan(
    workspace_id: str,
    data: LoanCreate,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    principal = safe_decimal(data.principal)
    loan = Loan(
        id=str(uuid.uuid4()),
        workspace_id=workspace_id,
        name=data.name,
        type=data.type,
        institution=data.institution,
        principal=principal,
        interest_rate=safe_decimal(data.interest_rate),
        tenure_months=data.tenure_months,
        emi_amount=safe_decimal(data.emi_amount),
        start_date=data.start_date,
        account_id=data.account_id,
        outstanding_balance=principal,
        total_paid=Decimal("0"),
        interest_paid=Decimal("0"),
        status="ACTIVE",
        notes=data.notes,
    )
    db.add(loan)
    await db.commit()
    await db.refresh(loan)
    return created_response(LoanResponse.model_validate(loan).model_dump(), "Loan created")


@loan_router.post("/{workspace_id}/loans/{loan_id}/payments", status_code=201)
async def add_loan_payment(
    workspace_id: str,
    loan_id: str,
    data: LoanPaymentCreate,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    loan_result = await db.execute(
        select(Loan).where(Loan.id == loan_id, Loan.workspace_id == workspace_id)
    )
    loan = loan_result.scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    emi = safe_decimal(data.emi_amount)
    principal_comp = safe_decimal(data.principal_component)
    interest_comp = safe_decimal(data.interest_component)
    new_balance = safe_decimal(loan.outstanding_balance) - principal_comp

    payment = LoanPayment(
        id=str(uuid.uuid4()),
        loan_id=loan_id,
        workspace_id=workspace_id,
        date=data.date,
        emi_amount=emi,
        principal_component=principal_comp,
        interest_component=interest_comp,
        balance_after=new_balance,
        notes=data.notes,
    )
    db.add(payment)

    # Update loan
    loan.outstanding_balance = new_balance
    loan.total_paid = safe_decimal(loan.total_paid) + emi
    loan.interest_paid = safe_decimal(loan.interest_paid) + interest_comp
    if new_balance <= 0:
        loan.status = "CLOSED"

    await db.commit()
    await db.refresh(payment)
    return created_response(LoanPaymentResponse.model_validate(payment).model_dump(), "Payment recorded")


@loan_router.put("/{workspace_id}/loans/{loan_id}")
async def update_loan(
    workspace_id: str,
    loan_id: str,
    data: LoanUpdate,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    result = await db.execute(
        select(Loan).where(
            Loan.id == loan_id,
            Loan.workspace_id == workspace_id,
            Loan.is_deleted == False,
        )
    )
    loan = result.scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(loan, field, value)
    await db.commit()
    await db.refresh(loan)
    return success_response(LoanResponse.model_validate(loan).model_dump(), "Loan updated")


@loan_router.delete("/{workspace_id}/loans/{loan_id}")
async def delete_loan(
    workspace_id: str,
    loan_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    result = await db.execute(
        select(Loan).where(
            Loan.id == loan_id,
            Loan.workspace_id == workspace_id,
            Loan.is_deleted == False,
        )
    )
    loan = result.scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    loan.soft_delete(current_user.id)
    await db.commit()
    return deleted_response("Loan deleted")


@loan_router.get("/{workspace_id}/loans/{loan_id}/payments")
async def get_loan_payments(
    workspace_id: str,
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.VIEWER)),
):
    result = await db.execute(
        select(LoanPayment).where(
            LoanPayment.loan_id == loan_id,
            LoanPayment.workspace_id == workspace_id,
        ).order_by(LoanPayment.date)
    )
    payments = result.scalars().all()
    return success_response([LoanPaymentResponse.model_validate(p).model_dump() for p in payments])



# ─── Invoices ─────────────────────────────────────────────────────────────────
invoice_router = APIRouter()


@invoice_router.get("/{workspace_id}/invoices")
async def list_invoices(
    workspace_id: str,
    status: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.VIEWER)),
):
    # 1. Count invoices first with filters applied
    count_query = select(func.count()).select_from(Invoice).where(
        Invoice.workspace_id == workspace_id,
        Invoice.is_deleted == False,
    )
    if status:
        count_query = count_query.where(Invoice.status == status)
    if customer_id:
        count_query = count_query.where(Invoice.customer_id == customer_id)
    count = (await db.execute(count_query)).scalar_one()

    # 2. Fetch invoices with eager relationship loading
    query = select(Invoice).options(selectinload(Invoice.items)).where(
        Invoice.workspace_id == workspace_id,
        Invoice.is_deleted == False,
    )
    if status:
        query = query.where(Invoice.status == status)
    if customer_id:
        query = query.where(Invoice.customer_id == customer_id)
    result = await db.execute(query.order_by(Invoice.date.desc()).offset((page-1)*size).limit(size))
    invoices = result.scalars().all()

    # 3. Serialize immediately to prevent lazy loading session expiration
    items_list = [InvoiceResponse.model_validate(i).model_dump() for i in invoices]

    return success_response({
        "items": items_list,
        "total": count, "page": page, "size": size, "pages": (count + size - 1) // size,
    })


@invoice_router.post("/{workspace_id}/invoices", status_code=201)
async def create_invoice(
    workspace_id: str,
    data: InvoiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    # Compute totals using Decimal
    subtotal = Decimal("0")
    tax_total = Decimal("0")
    discount_total = Decimal("0")

    items_to_create = []
    for idx, item in enumerate(data.items):
        qty = safe_decimal(item.quantity)
        price = safe_decimal(item.unit_price)
        disc_pct = safe_decimal(item.discount_pct)
        tax_rate = safe_decimal(item.tax_rate)

        line_total = qty * price
        discount_amt = line_total * disc_pct / Decimal("100")
        after_discount = line_total - discount_amt
        tax_amt = after_discount * tax_rate / Decimal("100")
        line_amount = after_discount + tax_amt

        subtotal += line_total
        discount_total += discount_amt
        tax_total += tax_amt
        items_to_create.append((item, round_money(line_amount), idx))

    total = round_money(subtotal - discount_total + tax_total)

    # Get next invoice number from workspace
    ws_result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    ws = ws_result.scalar_one()
    invoice_number = f"{ws.invoice_prefix}-{ws.invoice_next_number:04d}"
    ws.invoice_next_number += 1

    invoice = Invoice(
        id=str(uuid.uuid4()),
        workspace_id=workspace_id,
        invoice_number=invoice_number,
        customer_id=data.customer_id,
        date=data.date,
        due_date=data.due_date,
        subtotal=round_money(subtotal),
        discount_amount=round_money(discount_total),
        tax_amount=round_money(tax_total),
        total=total,
        paid_amount=Decimal("0"),
        balance=total,
        status="DRAFT",
        gstin=data.gstin,
        currency_code=data.currency_code,
        notes=data.notes,
        terms=data.terms,
        created_by=current_user.id,
    )
    db.add(invoice)
    await db.flush()

    for item_data, amount, order in items_to_create:
        ii = InvoiceItem(
            id=str(uuid.uuid4()),
            invoice_id=invoice.id,
            description=item_data.description,
            quantity=safe_decimal(item_data.quantity),
            unit_price=safe_decimal(item_data.unit_price),
            discount_pct=safe_decimal(item_data.discount_pct),
            tax_rate=safe_decimal(item_data.tax_rate),
            amount=amount,
            sort_order=order,
        )
        db.add(ii)

    await db.commit()
    res = await db.execute(
        select(Invoice).options(selectinload(Invoice.items)).where(Invoice.id == invoice.id)
    )
    invoice_loaded = res.scalar_one()
    return created_response(InvoiceResponse.model_validate(invoice_loaded).model_dump(), "Invoice created")


@invoice_router.put("/{workspace_id}/invoices/{invoice_id}")
async def update_invoice(
    workspace_id: str,
    invoice_id: str,
    data: InvoiceUpdate,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    result = await db.execute(
        select(Invoice).where(
            Invoice.id == invoice_id,
            Invoice.workspace_id == workspace_id,
            Invoice.is_deleted == False,
        )
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(invoice, field, value)
    await db.commit()
    res = await db.execute(
        select(Invoice).options(selectinload(Invoice.items)).where(Invoice.id == invoice_id)
    )
    invoice_loaded = res.scalar_one()
    return success_response(InvoiceResponse.model_validate(invoice_loaded).model_dump(), "Invoice updated")


@invoice_router.delete("/{workspace_id}/invoices/{invoice_id}")
async def delete_invoice(
    workspace_id: str,
    invoice_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    result = await db.execute(
        select(Invoice).where(
            Invoice.id == invoice_id,
            Invoice.workspace_id == workspace_id,
            Invoice.is_deleted == False,
        )
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    invoice.soft_delete(current_user.id)
    await db.commit()
    return deleted_response("Invoice deleted")



# ─── Contacts ─────────────────────────────────────────────────────────────────
contact_router = APIRouter()


@contact_router.get("/{workspace_id}/contacts")
async def list_contacts(
    workspace_id: str,
    type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.VIEWER)),
):
    from sqlalchemy import or_
    query = select(Contact).where(
        Contact.workspace_id == workspace_id,
        Contact.is_deleted == False,
    )
    if type:
        query = query.where(Contact.type == type)
    if search:
        s = f"%{search}%"
        query = query.where(or_(Contact.name.ilike(s), Contact.email.ilike(s), Contact.company.ilike(s)))
    result = await db.execute(query.order_by(Contact.name).offset((page-1)*size).limit(size))
    contacts = result.scalars().all()
    return success_response([ContactResponse.model_validate(c).model_dump() for c in contacts])


@contact_router.post("/{workspace_id}/contacts", status_code=201)
async def create_contact(
    workspace_id: str,
    data: ContactCreate,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    contact = Contact(
        id=str(uuid.uuid4()),
        workspace_id=workspace_id,
        type=data.type,
        name=data.name,
        email=data.email,
        phone=data.phone,
        company=data.company,
        gstin=data.gstin,
        address=data.address,
        city=data.city,
        state=data.state,
        pincode=data.pincode,
        notes=data.notes,
    )
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return created_response(ContactResponse.model_validate(contact).model_dump(), "Contact created")


@contact_router.put("/{workspace_id}/contacts/{contact_id}")
async def update_contact(
    workspace_id: str,
    contact_id: str,
    data: ContactUpdate,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    result = await db.execute(select(Contact).where(Contact.id == contact_id, Contact.workspace_id == workspace_id))
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(contact, field, value)
    await db.commit()
    await db.refresh(contact)
    return success_response(ContactResponse.model_validate(contact).model_dump(), "Contact updated")


@contact_router.delete("/{workspace_id}/contacts/{contact_id}")
async def delete_contact(
    workspace_id: str,
    contact_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    result = await db.execute(
        select(Contact).where(
            Contact.id == contact_id,
            Contact.workspace_id == workspace_id,
            Contact.is_deleted == False,
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    contact.soft_delete(current_user.id)
    await db.commit()
    return deleted_response("Contact deleted")


# ─── Subscriptions ────────────────────────────────────────────────────────────
subscription_router = APIRouter()


@subscription_router.get("/{workspace_id}/subscriptions")
async def list_subscriptions(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.VIEWER)),
):
    result = await db.execute(
        select(Subscription).where(
            Subscription.workspace_id == workspace_id,
            Subscription.is_deleted == False,
        ).order_by(Subscription.next_billing_date)
    )
    subs = result.scalars().all()
    return success_response([SubscriptionResponse.model_validate(s).model_dump() for s in subs])


@subscription_router.post("/{workspace_id}/subscriptions", status_code=201)
async def create_subscription(
    workspace_id: str,
    data: SubscriptionCreate,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    sub = Subscription(
        id=str(uuid.uuid4()),
        workspace_id=workspace_id,
        name=data.name,
        amount=safe_decimal(data.amount),
        currency_code=data.currency_code,
        billing_cycle=data.billing_cycle,
        next_billing_date=data.next_billing_date,
        account_id=data.account_id,
        category_id=data.category_id,
        status="ACTIVE",
        reminder_days=data.reminder_days,
        notes=data.notes,
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return created_response(SubscriptionResponse.model_validate(sub).model_dump(), "Subscription added")


@subscription_router.put("/{workspace_id}/subscriptions/{subscription_id}")
async def update_subscription(
    workspace_id: str,
    subscription_id: str,
    data: SubscriptionUpdate,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    result = await db.execute(
        select(Subscription).where(
            Subscription.id == subscription_id,
            Subscription.workspace_id == workspace_id,
            Subscription.is_deleted == False,
        )
    )
    subscription = result.scalar_one_or_none()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(subscription, field, value)
    await db.commit()
    await db.refresh(subscription)
    return success_response(SubscriptionResponse.model_validate(subscription).model_dump(), "Subscription updated")


@subscription_router.delete("/{workspace_id}/subscriptions/{subscription_id}")
async def delete_subscription(
    workspace_id: str,
    subscription_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    result = await db.execute(
        select(Subscription).where(
            Subscription.id == subscription_id,
            Subscription.workspace_id == workspace_id,
            Subscription.is_deleted == False,
        )
    )
    subscription = result.scalar_one_or_none()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    subscription.soft_delete(current_user.id)
    await db.commit()
    return deleted_response("Subscription deleted")


# ─── Reports ──────────────────────────────────────────────────────────────────
report_router = APIRouter()


@report_router.get("/{workspace_id}/reports/income")
async def income_report(
    workspace_id: str,
    format: str = Query("json", enum=["json", "csv", "excel"]),
    period: str = Query("THIS_MONTH"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.VIEWER)),
):
    from backend.utils.date_utils import get_period_dates
    if not (start_date and end_date):
        start_date, end_date = get_period_dates(period)
    result = await db.execute(
        select(Transaction).where(
            Transaction.workspace_id == workspace_id,
            Transaction.type == "INCOME",
            Transaction.is_deleted == False,
            Transaction.date >= start_date,
            Transaction.date <= end_date,
        ).order_by(Transaction.date)
    )
    transactions = result.scalars().all()

    if format == "csv":
        import csv, io
        acc_map = {a.id: a.name for a in (await db.execute(select(Account).where(Account.workspace_id == workspace_id))).scalars().all()}
        cat_map = {c.id: c.name for c in (await db.execute(select(TransactionCategory).where(TransactionCategory.workspace_id == workspace_id))).scalars().all()}
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Date", "Description", "Category", "Account", "Amount", "Payment Method"])
        for tx in transactions:
            category_name = cat_map.get(tx.category_id, "")
            account_name = acc_map.get(tx.account_id, "")
            writer.writerow([tx.date, tx.description, category_name, account_name, tx.amount, tx.payment_method])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=income_report_{start_date}_{end_date}.csv"},
        )

    total = sum(safe_decimal(t.amount) for t in transactions)
    return success_response({
        "period_start": start_date.isoformat(),
        "period_end": end_date.isoformat(),
        "total_income": round_money(total),
        "transaction_count": len(transactions),
        "transactions": [TransactionResponse.model_validate(t).model_dump() for t in transactions],
    })


@report_router.get("/{workspace_id}/reports/expense")
async def expense_report(
    workspace_id: str,
    format: str = Query("json", enum=["json", "csv", "excel"]),
    period: str = Query("THIS_MONTH"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.VIEWER)),
):
    from backend.utils.date_utils import get_period_dates
    if not (start_date and end_date):
        start_date, end_date = get_period_dates(period)
    result = await db.execute(
        select(Transaction).where(
            Transaction.workspace_id == workspace_id,
            Transaction.type == "EXPENSE",
            Transaction.is_deleted == False,
            Transaction.date >= start_date,
            Transaction.date <= end_date,
        ).order_by(Transaction.date)
    )
    transactions = result.scalars().all()

    if format == "csv":
        import csv, io
        acc_map = {a.id: a.name for a in (await db.execute(select(Account).where(Account.workspace_id == workspace_id))).scalars().all()}
        cat_map = {c.id: c.name for c in (await db.execute(select(TransactionCategory).where(TransactionCategory.workspace_id == workspace_id))).scalars().all()}
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Date", "Description", "Category", "Account", "Amount", "Payment Method"])
        for tx in transactions:
            category_name = cat_map.get(tx.category_id, "")
            account_name = acc_map.get(tx.account_id, "")
            writer.writerow([tx.date, tx.description, category_name, account_name, tx.amount, tx.payment_method])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=expense_report_{start_date}_{end_date}.csv"},
        )

    total = sum(safe_decimal(t.amount) for t in transactions)
    return success_response({
        "period_start": start_date.isoformat(),
        "period_end": end_date.isoformat(),
        "total_expense": round_money(total),
        "transaction_count": len(transactions),
        "transactions": [TransactionResponse.model_validate(t).model_dump() for t in transactions],
    })


# ─── Notifications ────────────────────────────────────────────────────────────
notification_router = APIRouter()


@notification_router.get("")
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    unread_only: bool = Query(False),
):
    query = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        query = query.where(Notification.is_read == False)
    result = await db.execute(query.order_by(Notification.created_at.desc()).limit(50))
    notifs = result.scalars().all()
    return success_response([NotificationResponse.model_validate(n).model_dump() for n in notifs])


@notification_router.put("/{notification_id}/read")
async def mark_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    notif = result.scalar_one_or_none()
    if notif:
        notif.is_read = True
        await db.commit()
    return success_response(None, "Marked as read")


@notification_router.put("/read-all")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    )
    notifications = result.scalars().all()
    for n in notifications:
        n.is_read = True
    await db.commit()
    return success_response(None, "All notifications marked as read")


@notification_router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    await db.delete(notif)
    await db.commit()
    return deleted_response("Notification deleted")



# ─── Migration ────────────────────────────────────────────────────────────────
migration_router = APIRouter()


@migration_router.post("/preview")
async def migration_preview(
    host: str, port: int = 3306, database: str = "daytodayexpenses",
    username: str = "root", password: str = "",
    current_user: User = Depends(get_current_user),
):
    """Preview what would be migrated from the old C# MySQL database."""
    try:
        import pymysql
        conn = pymysql.connect(host=host, port=port, database=database, user=username, password=password)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM tblentrydetails WHERE Type='Expense'")
        expense_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM tblentrydetails WHERE Type='Income'")
        income_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM tblentrydetails WHERE Type='Loan'")
        loan_count = cursor.fetchone()[0]
        cursor.execute("SELECT DISTINCT Category FROM tblentrydetails ORDER BY Category")
        categories = [r[0] for r in cursor.fetchall()]
        conn.close()
        return success_response({
            "expenses_to_import": expense_count,
            "income_to_import": income_count,
            "loans_to_import": loan_count,
            "unique_categories": len(categories),
            "categories": categories,
            "note": "Loan records are deduplicated (old system stored loans twice as Loan + Expense)",
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot connect to old database: {str(e)}")


@migration_router.post("/import")
async def migration_import(
    workspace_id: str,
    host: str, port: int = 3306, database: str = "daytodayexpenses",
    username: str = "root", password: str = "",
    dry_run: bool = True,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.OWNER)),
):
    """Import transactions from old C# MySQL database into DayToExpense.
    Set dry_run=false to actually import. Old database is NEVER modified."""
    try:
        import pymysql
        conn = pymysql.connect(host=host, port=port, database=database, user=username, password=password)
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        cursor.execute("SELECT * FROM tblentrydetails ORDER BY Date, Time")
        rows = cursor.fetchall()
        conn.close()

        imported = 0
        skipped = 0
        errors = []
        seen_loan_dates = {}  # deduplicate loan+expense duplicates

        for row in rows:
            try:
                row_type = row.get("Type", "")
                amount = safe_decimal(row.get("Amount", 0))
                entry_date = row.get("Date")
                if hasattr(entry_date, "date"):
                    entry_date = entry_date.date()

                # Skip the duplicate expense record for loans (old system records both)
                if row_type == "Expense":
                    loan_key = f"{row['Category']}_{entry_date}_{amount}"
                    if loan_key in seen_loan_dates:
                        skipped += 1
                        continue

                if row_type == "Loan":
                    loan_key = f"{row['Category']}_{entry_date}_{amount}"
                    seen_loan_dates[loan_key] = True

                # Map type
                new_type = {"Income": "INCOME", "Expense": "EXPENSE", "Loan": "LOAN_PAYMENT"}.get(row_type, "EXPENSE")

                if not dry_run:
                    # Find or use first account in workspace
                    acc_result = await db.execute(
                        select(Account).where(Account.workspace_id == workspace_id).limit(1)
                    )
                    account = acc_result.scalar_one_or_none()
                    if not account:
                        errors.append(f"No account found in workspace — create an account first")
                        break

                    tx = Transaction(
                        id=str(uuid.uuid4()),
                        workspace_id=workspace_id,
                        account_id=account.id,
                        type=new_type,
                        amount=amount,
                        currency_code="INR",
                        exchange_rate=Decimal("1.000000"),
                        base_amount=amount,
                        date=entry_date,
                        description=str(row.get("EntryText", "Imported")),
                        notes=str(row.get("DescribeText", "") or ""),
                        payment_method="CASH",
                        status="COMPLETED",
                        is_recurring=False,
                        created_by=current_user.id,
                    )
                    db.add(tx)
                imported += 1
            except Exception as e:
                errors.append(f"Row {row.get('EntryID')}: {str(e)}")

        if not dry_run:
            await db.commit()

        return success_response({
            "dry_run": dry_run,
            "total_records": len(rows),
            "would_import" if dry_run else "imported": imported,
            "skipped_duplicates": skipped,
            "errors": errors[:20],
            "message": "Dry run complete. Set dry_run=false to import." if dry_run else f"Successfully imported {imported} transactions.",
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# SETTINGS / STATE ROUTER
# ═══════════════════════════════════════════════════════════════════════════════
settings_router = APIRouter()


@settings_router.get("/{workspace_id}/settings/{key}")
async def get_setting(
    workspace_id: str,
    key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.VIEWER)),
):
    result = await db.execute(
        select(Setting).where(
            Setting.workspace_id == workspace_id,
            Setting.key == key
        ).limit(1)
    )
    setting = result.scalar_one_or_none()
    if not setting:
        return success_response(None)
    return success_response(setting.value)


@settings_router.post("/{workspace_id}/settings/{key}")
async def save_setting(
    workspace_id: str,
    key: str,
    value: Any = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    result = await db.execute(
        select(Setting).where(
            Setting.workspace_id == workspace_id,
            Setting.key == key
        ).limit(1)
    )
    setting = result.scalar_one_or_none()
    if not setting:
        setting = Setting(
            id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            user_id=current_user.id,
            key=key,
            value=value,
        )
        db.add(setting)
    else:
        setting.value = value
        setting.user_id = current_user.id
        setting.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return success_response(setting.value, "Setting saved successfully")


@settings_router.post("/{workspace_id}/settings-action/truncate")
async def truncate_workspace(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.OWNER)),
):
    dialect_name = db.bind.dialect.name
    try:
        if dialect_name == "postgresql":
            await db.execute(text("SET session_replication_role = 'replica';"))
        else:
            await db.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
    except Exception:
        pass

    try:
        # Delete children tables (without workspace_id column) first
        await db.execute(
            text("DELETE FROM transaction_subcategories WHERE category_id IN (SELECT id FROM transaction_categories WHERE workspace_id = :ws_id)"),
            {"ws_id": workspace_id}
        )
        await db.execute(
            text("DELETE FROM budget_categories WHERE budget_id IN (SELECT id FROM budgets WHERE workspace_id = :ws_id)"),
            {"ws_id": workspace_id}
        )
        await db.execute(
            text("DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE workspace_id = :ws_id)"),
            {"ws_id": workspace_id}
        )

        # Delete operational tables (with workspace_id column)
        tables = [
            "transactions", "transfers", "accounts", "transaction_categories", 
            "budgets", "loans", "loan_payments", "invoices", "invoice_payments", 
            "subscriptions", "attachments", "investments", "investment_transactions", 
            "recurring_transactions", "sip_plans", "audit_logs", 
            "notifications", "contacts", "settings"
        ]
        
        for table in tables:
            await db.execute(
                text(f"DELETE FROM {table} WHERE workspace_id = :ws_id"),
                {"ws_id": workspace_id}
            )
            
        await db.commit()
        return success_response(None, "Workspace data truncated successfully")
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            if dialect_name == "postgresql":
                await db.execute(text("SET session_replication_role = 'origin';"))
            else:
                await db.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
        except Exception:
            pass


@settings_router.post("/{workspace_id}/settings-action/factory-reset")
async def factory_reset(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.OWNER)),
):
    if not current_user.is_superuser and current_user.username not in ["admin", "cva"]:
        raise HTTPException(status_code=403, detail="Superuser admin privileges required for factory reset")

    dialect_name = db.bind.dialect.name
    try:
        if dialect_name == "postgresql":
            await db.execute(text("SET session_replication_role = 'replica';"))
        else:
            await db.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
    except Exception:
        pass

    try:
        tables = [
            "transaction_subcategories", "budget_categories", "invoice_items",
            "transactions", "transfers", "accounts", "transaction_categories", 
            "budgets", "loans", "loan_payments", "invoices", "invoice_payments", 
            "subscriptions", "attachments", "investments", "investment_transactions", 
            "recurring_transactions", "settings", "sip_plans", "audit_logs", 
            "notifications", "contacts"
        ]
        
        for table in tables:
            await db.execute(text(f"DELETE FROM {table}"))
            
        await db.commit()
        
        # Re-seed default categories
        from backend.database.connection import seed_default_categories
        await seed_default_categories(db)
        
        return success_response(None, "Database factory reset complete, user logins preserved")
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            if dialect_name == "postgresql":
                await db.execute(text("SET session_replication_role = 'origin';"))
            else:
                await db.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
        except Exception:
            pass


wishlist_router = APIRouter()

@wishlist_router.get("/{workspace_id}/wishlist")
async def list_wishlist_items(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.VIEWER)),
):
    result = await db.execute(
        select(WishlistItem).where(
            WishlistItem.workspace_id == workspace_id,
            WishlistItem.is_deleted == False
        ).order_by(WishlistItem.is_purchased.asc(), WishlistItem.created_at.desc())
    )
    items = result.scalars().all()
    return success_response([WishlistItemResponse.model_validate(item).model_dump() for item in items])


@wishlist_router.post("/{workspace_id}/wishlist")
async def create_wishlist_item(
    workspace_id: str,
    data: WishlistItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    item = WishlistItem(
        id=str(uuid.uuid4()),
        workspace_id=workspace_id,
        name=data.name,
        quantity=data.quantity,
        unit=data.unit,
        price=data.price,
        notes=data.notes,
        created_by=current_user.id,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return created_response(WishlistItemResponse.model_validate(item).model_dump(), "Wishlist item created")


@wishlist_router.put("/{workspace_id}/wishlist/{item_id}")
async def update_wishlist_item(
    workspace_id: str,
    item_id: str,
    data: WishlistItemUpdate,
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    result = await db.execute(
        select(WishlistItem).where(
            WishlistItem.id == item_id,
            WishlistItem.workspace_id == workspace_id,
            WishlistItem.is_deleted == False
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Wishlist item not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(item, field, value)

    await db.commit()
    await db.refresh(item)
    return success_response(WishlistItemResponse.model_validate(item).model_dump(), "Wishlist item updated")


@wishlist_router.delete("/{workspace_id}/wishlist/{item_id}")
async def delete_wishlist_item(
    workspace_id: str,
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    result = await db.execute(
        select(WishlistItem).where(
            WishlistItem.id == item_id,
            WishlistItem.workspace_id == workspace_id,
            WishlistItem.is_deleted == False
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Wishlist item not found")

    item.soft_delete(current_user.id)
    await db.commit()
    return deleted_response("Wishlist item deleted")


@wishlist_router.post("/{workspace_id}/wishlist/{item_id}/purchase")
async def purchase_wishlist_item(
    workspace_id: str,
    item_id: str,
    req: WishlistPurchaseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    result = await db.execute(
        select(WishlistItem).where(
            WishlistItem.id == item_id,
            WishlistItem.workspace_id == workspace_id,
            WishlistItem.is_deleted == False
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Wishlist item not found")

    item.is_purchased = True
    if req.price is not None:
        item.price = req.price

    if req.record_expense:
        acc_result = await db.execute(
            select(Account).where(
                Account.id == req.account_id,
                Account.workspace_id == workspace_id,
                Account.is_deleted == False
            )
        )
        account = acc_result.scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        final_price = req.price if req.price is not None else item.price
        if final_price is None or final_price <= 0:
            raise HTTPException(status_code=400, detail="Cannot record expense: Price must be specified and greater than 0")

        total_amount = round_money(final_price * item.quantity)

        # Validate category_id exists in this workspace to prevent Foreign Key Violation errors in PostgreSQL
        target_category_id = None
        if req.category_id:
            cat_check = await db.execute(
                select(TransactionCategory.id).where(
                    TransactionCategory.id == req.category_id,
                    TransactionCategory.workspace_id == workspace_id,
                    TransactionCategory.is_active == True
                )
            )
            target_category_id = cat_check.scalar_one_or_none()

        if not target_category_id:
            fallback_cat = await db.execute(
                select(TransactionCategory.id).where(
                    TransactionCategory.workspace_id == workspace_id,
                    TransactionCategory.type == "EXPENSE",
                    TransactionCategory.is_active == True
                ).limit(1)
            )
            target_category_id = fallback_cat.scalar_one_or_none()

        tx = Transaction(
            id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            account_id=account.id,
            category_id=target_category_id,
            type="EXPENSE",
            amount=total_amount,
            currency_code="INR",
            exchange_rate=Decimal("1.000000"),
            base_amount=total_amount,
            date=date.today(),
            description=f"Purchase: {item.name} ({item.quantity} {item.unit})",
            status="COMPLETED",
            payment_method="CASH",
            is_recurring=False,
            created_by=current_user.id,
        )
        db.add(tx)
        account.current_balance -= total_amount

    await db.commit()
    await db.refresh(item)
    return success_response(WishlistItemResponse.model_validate(item).model_dump(), "Wishlist item purchased successfully")


@wishlist_router.post("/{workspace_id}/wishlist/{item_id}/advance")
async def record_wishlist_advance(
    workspace_id: str,
    item_id: str,
    req: WishlistAdvanceRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _member: WorkspaceMember = Depends(require_workspace_member(WorkspaceRole.MEMBER)),
):
    result = await db.execute(
        select(WishlistItem).where(
            WishlistItem.id == item_id,
            WishlistItem.workspace_id == workspace_id,
            WishlistItem.is_deleted == False
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Wishlist item not found")

    acc_result = await db.execute(
        select(Account).where(
            Account.id == req.account_id,
            Account.workspace_id == workspace_id,
            Account.is_deleted == False
        )
    )
    account = acc_result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Validate category_id exists in this workspace to prevent Foreign Key Violation errors in PostgreSQL
    target_category_id = None
    if req.category_id:
        cat_check = await db.execute(
            select(TransactionCategory.id).where(
                TransactionCategory.id == req.category_id,
                TransactionCategory.workspace_id == workspace_id,
                TransactionCategory.is_active == True
            )
        )
        target_category_id = cat_check.scalar_one_or_none()

    if not target_category_id:
        fallback_cat = await db.execute(
            select(TransactionCategory.id).where(
                TransactionCategory.workspace_id == workspace_id,
                TransactionCategory.type == "INCOME",
                TransactionCategory.is_active == True
            ).limit(1)
        )
        target_category_id = fallback_cat.scalar_one_or_none()

    tx = Transaction(
        id=str(uuid.uuid4()),
        workspace_id=workspace_id,
        account_id=account.id,
        category_id=target_category_id,
        type="INCOME",
        amount=req.amount,
        currency_code="INR",
        exchange_rate=Decimal("1.000000"),
        base_amount=req.amount,
        date=date.today(),
        description=f"Advance Received for: {item.name} ({item.quantity} {item.unit})",
        notes=req.notes,
        status="COMPLETED",
        payment_method="CASH",
        is_recurring=False,
        created_by=current_user.id,
    )
    db.add(tx)
    account.current_balance += req.amount

    await db.commit()
    return success_response(None, "Advance money recorded as income successfully")

