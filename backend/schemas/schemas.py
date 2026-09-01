"""DayToExpense — Pydantic schemas: auth, workspace, account, transaction, common."""
from __future__ import annotations

import uuid
from datetime import date as DateType, datetime as DateTimeType, date, datetime
from decimal import Decimal
from typing import Any, Generic, List, Optional, TypeVar

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

# ─── Generic API Response ─────────────────────────────────────────────────────
T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    status: int = 200
    isSuccess: bool = True
    message: str = "Success"
    data: Optional[T] = None


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    size: int
    pages: int


class ErrorResponse(BaseModel):
    status: int
    isSuccess: bool = False
    message: str
    detail: Optional[Any] = None


class DateRangeFilter(BaseModel):
    period: Optional[str] = "THIS_MONTH"  # TODAY/THIS_WEEK/THIS_MONTH/THIS_YEAR/LAST_MONTH/CUSTOM
    start_date: Optional[date] = None
    end_date: Optional[date] = None


# ─── Auth Schemas ─────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=1, max_length=255)
    phone: Optional[str] = None

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        import re
        if not re.match(r"^[a-zA-Z0-9_]+$", v):
            raise ValueError("Username may only contain letters, numbers, and underscores")
        return v.lower()

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    username_or_email: str = Field(..., description="Email address or username")
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    user: "UserResponse"


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)
    confirm_password: str

    @model_validator(mode="after")
    def passwords_match(self) -> "ChangePasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    full_name: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    is_verified: bool
    last_login: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None


# ─── Workspace Schemas ────────────────────────────────────────────────────────
class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    type: str = "PERSONAL"
    base_currency: str = Field(default="INR", max_length=3)
    description: Optional[str] = None


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    base_currency: Optional[str] = None
    gstin: Optional[str] = None
    business_address: Optional[str] = None
    business_phone: Optional[str] = None
    business_email: Optional[str] = None
    invoice_prefix: Optional[str] = None


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    type: str
    base_currency: str
    description: Optional[str] = None
    owner_id: str
    is_active: bool
    gstin: Optional[str] = None
    business_address: Optional[str] = None
    invoice_prefix: str
    created_at: datetime
    member_role: Optional[str] = None  # injected from WorkspaceMember

    model_config = {"from_attributes": True}


class WorkspaceMemberResponse(BaseModel):
    id: str
    workspace_id: str
    user_id: str
    role: str
    is_active: bool
    user: Optional[UserResponse] = None

    model_config = {"from_attributes": True}


class WorkspaceMemberInvite(BaseModel):
    email: EmailStr
    role: str = "MEMBER"


# ─── Account Schemas ──────────────────────────────────────────────────────────
class AccountCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    account_type: str
    bank_name: Optional[str] = None
    account_number_masked: Optional[str] = Field(None, max_length=4, description="Last 4 digits only")
    currency_code: str = "INR"
    opening_balance: Decimal = Field(default=Decimal("0"), ge=0)
    credit_limit: Optional[Decimal] = Field(None, ge=0)
    billing_date: Optional[int] = Field(None, ge=1, le=31)
    due_date: Optional[int] = Field(None, ge=1, le=31)
    color: Optional[str] = None
    icon: Optional[str] = None
    notes: Optional[str] = None


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    account_type: Optional[str] = None
    bank_name: Optional[str] = None
    currency_code: Optional[str] = None
    opening_balance: Optional[Decimal] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    notes: Optional[str] = None
    credit_limit: Optional[Decimal] = None
    billing_date: Optional[int] = None
    due_date: Optional[int] = None
    is_active: Optional[bool] = None



class AccountResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    account_type: str
    bank_name: Optional[str] = None
    account_number_masked: Optional[str] = None
    currency_code: str
    opening_balance: Decimal
    current_balance: Decimal
    credit_limit: Optional[Decimal] = None
    billing_date: Optional[int] = None
    due_date: Optional[int] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    is_active: bool
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AccountSummary(BaseModel):
    id: str
    name: str
    account_type: str
    current_balance: Decimal
    currency_code: str
    color: Optional[str] = None
    icon: Optional[str] = None

    model_config = {"from_attributes": True}


# ─── Category Schemas ─────────────────────────────────────────────────────────
class SubcategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    icon: Optional[str] = None


class SubcategoryResponse(BaseModel):
    id: str
    category_id: str
    name: str
    icon: Optional[str] = None
    is_active: bool

    model_config = {"from_attributes": True}


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: str  # INCOME / EXPENSE / BOTH
    icon: Optional[str] = None
    color: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


class CategoryResponse(BaseModel):
    id: str
    workspace_id: Optional[str] = None
    name: str
    type: str
    icon: Optional[str] = None
    color: Optional[str] = None
    is_system: bool
    is_active: bool
    sort_order: int
    subcategories: List[SubcategoryResponse] = []

    model_config = {"from_attributes": True}


# ─── Transaction Schemas ──────────────────────────────────────────────────────
class TransactionCreate(BaseModel):
    account_id: str
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    type: str  # INCOME / EXPENSE / TRANSFER / etc.
    amount: Decimal = Field(..., gt=0, description="Always positive")
    currency_code: str = "INR"
    date: DateType
    time: Optional[str] = None
    description: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = None
    reference_number: Optional[str] = None
    payment_method: str = "CASH"
    contact_id: Optional[str] = None
    tags: Optional[List[str]] = None
    status: str = "COMPLETED"

    @field_validator("category_id", "subcategory_id", "contact_id", "time", "notes", "reference_number", mode="before")
    @classmethod
    def empty_str_to_none(cls, v: Any) -> Any:
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Amount must be greater than zero")
        return v.quantize(Decimal("0.0001"))


class TransactionUpdate(BaseModel):
    account_id: Optional[str] = None
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    amount: Optional[Decimal] = None
    date: Optional[DateType] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    reference_number: Optional[str] = None
    payment_method: Optional[str] = None
    contact_id: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = None

    @field_validator("account_id", "category_id", "subcategory_id", "contact_id", "notes", "reference_number", mode="before")
    @classmethod
    def empty_str_to_none_update(cls, v: Any) -> Any:
        if isinstance(v, str) and not v.strip():
            return None
        return v



class TransactionResponse(BaseModel):
    id: str
    workspace_id: str
    account_id: str
    account_name: Optional[str] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    category_icon: Optional[str] = None
    category_color: Optional[str] = None
    subcategory_id: Optional[str] = None
    subcategory_name: Optional[str] = None
    type: str
    amount: Decimal
    currency_code: str
    base_amount: Decimal
    date: DateType
    description: str
    notes: Optional[str] = None
    reference_number: Optional[str] = None
    payment_method: str
    tags: Optional[List[str]] = None
    status: str
    is_recurring: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TransactionFilter(BaseModel):
    type: Optional[str] = None
    account_id: Optional[str] = None
    category_id: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    min_amount: Optional[Decimal] = None
    max_amount: Optional[Decimal] = None
    search: Optional[str] = None
    status: Optional[str] = None
    payment_method: Optional[str] = None
    page: int = Field(default=1, ge=1)
    size: int = Field(default=50, ge=1, le=200)


# ─── Transfer Schemas ─────────────────────────────────────────────────────────
class TransferCreate(BaseModel):
    from_account_id: str
    to_account_id: str
    amount: Decimal = Field(..., gt=0)
    date: DateType
    fee: Decimal = Field(default=Decimal("0"), ge=0)
    reference: Optional[str] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def accounts_must_differ(self) -> "TransferCreate":
        if self.from_account_id == self.to_account_id:
            raise ValueError("From and To accounts must be different")
        return self


class TransferResponse(BaseModel):
    id: str
    workspace_id: str
    from_account_id: str
    from_account_name: Optional[str] = None
    to_account_id: str
    to_account_name: Optional[str] = None
    amount: Decimal
    fee: Decimal
    date: DateType
    reference: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Dashboard Schemas ────────────────────────────────────────────────────────
class DashboardSummary(BaseModel):
    total_balance: Decimal = Decimal("0")
    total_income: Decimal = Decimal("0")
    total_expense: Decimal = Decimal("0")
    net_cash_flow: Decimal = Decimal("0")
    total_investments: Decimal = Decimal("0")
    investment_profit_loss: Decimal = Decimal("0")
    total_receivable: Decimal = Decimal("0")
    total_payable: Decimal = Decimal("0")
    credit_card_outstanding: Decimal = Decimal("0")
    loan_outstanding: Decimal = Decimal("0")
    savings_rate: Decimal = Decimal("0")
    income_change_pct: Decimal = Decimal("0")
    expense_change_pct: Decimal = Decimal("0")
    period_label: str = "This Month"


class ChartDataPoint(BaseModel):
    label: str
    value: Decimal
    color: Optional[str] = None


class MonthlyChartPoint(BaseModel):
    month: str
    income: Decimal = Decimal("0")
    expense: Decimal = Decimal("0")
    net: Decimal = Decimal("0")


class CategoryBreakdown(BaseModel):
    category_id: str
    category_name: str
    category_color: Optional[str] = None
    category_icon: Optional[str] = None
    amount: Decimal
    percentage: Decimal
    transaction_count: int


class AccountBalance(BaseModel):
    account_id: str
    account_name: str
    account_type: str
    balance: Decimal
    currency_code: str
    color: Optional[str] = None


class AnalyticsInsight(BaseModel):
    type: str  # info / warning / success
    message: str


# ─── Investment Schemas ───────────────────────────────────────────────────────
class InvestmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    type: str
    institution: Optional[str] = None
    account_id: Optional[str] = None
    purchase_date: Optional[date] = None
    quantity: Optional[Decimal] = None
    purchase_price: Optional[Decimal] = None
    invested_amount: Decimal = Field(..., ge=0)
    current_value: Optional[Decimal] = None
    maturity_date: Optional[date] = None
    notes: Optional[str] = None

    @field_validator("account_id", "institution", "notes", mode="before")
    @classmethod
    def empty_str_to_none(cls, v: Any) -> Any:
        if isinstance(v, str) and not v.strip():
            return None
        return v



class InvestmentUpdate(BaseModel):
    name: Optional[str] = None
    institution: Optional[str] = None
    current_value: Optional[Decimal] = None
    current_price: Optional[Decimal] = None
    notes: Optional[str] = None


class InvestmentResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    type: str
    institution: Optional[str] = None
    invested_amount: Decimal
    current_value: Optional[Decimal] = None
    profit_loss: Optional[Decimal] = None
    return_pct: Optional[Decimal] = None
    purchase_date: Optional[date] = None
    maturity_date: Optional[date] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SIPPlanCreate(BaseModel):
    amount: Decimal = Field(..., gt=0)
    frequency: str = "MONTHLY"
    start_date: date
    end_date: Optional[date] = None


class SIPPlanResponse(BaseModel):
    id: str
    investment_id: str
    amount: Decimal
    frequency: str
    start_date: date
    next_date: Optional[date] = None
    status: str
    total_invested: Decimal
    installments_completed: int

    model_config = {"from_attributes": True}


class PortfolioSummary(BaseModel):
    total_invested: Decimal
    current_value: Decimal
    total_profit_loss: Decimal
    total_return_pct: Decimal
    investments_count: int
    asset_allocation: List[ChartDataPoint]


# ─── Budget Schemas ───────────────────────────────────────────────────────────
class BudgetCategoryCreate(BaseModel):
    category_id: str
    allocated_amount: Decimal = Field(..., gt=0)
    alert_at_75: bool = True
    alert_at_90: bool = True
    alert_at_100: bool = True


class BudgetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    period: str = "MONTHLY"
    start_date: date
    end_date: Optional[date] = None
    categories: List[BudgetCategoryCreate]


class BudgetUpdate(BaseModel):
    name: Optional[str] = None
    period: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None



class BudgetCategoryStatus(BaseModel):
    id: str
    category_id: str
    category_name: str
    category_color: Optional[str] = None
    category_icon: Optional[str] = None
    allocated_amount: Decimal
    spent_amount: Decimal
    remaining: Decimal
    percentage_used: Decimal
    alert_at_75: bool
    alert_at_90: bool
    alert_at_100: bool


class BudgetResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    period: str
    start_date: date
    end_date: Optional[date] = None
    is_active: bool
    total_allocated: Decimal = Decimal("0")
    total_spent: Decimal = Decimal("0")
    categories: List[BudgetCategoryStatus] = []
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Loan Schemas ─────────────────────────────────────────────────────────────
class LoanCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    type: str = "PERSONAL"
    institution: Optional[str] = None
    principal: Decimal = Field(..., gt=0)
    interest_rate: Decimal = Field(..., ge=0)
    tenure_months: int = Field(..., gt=0)
    emi_amount: Decimal = Field(..., gt=0)
    start_date: date
    account_id: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("account_id", "institution", "notes", mode="before")
    @classmethod
    def empty_str_to_none(cls, v: Any) -> Any:
        if isinstance(v, str) and not v.strip():
            return None
        return v



class LoanUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    institution: Optional[str] = None
    interest_rate: Optional[Decimal] = None
    tenure_months: Optional[int] = None
    emi_amount: Optional[Decimal] = None
    notes: Optional[str] = None
    status: Optional[str] = None



class LoanResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    type: str
    institution: Optional[str] = None
    principal: Decimal
    interest_rate: Decimal
    tenure_months: int
    emi_amount: Decimal
    start_date: date
    end_date: Optional[date] = None
    outstanding_balance: Decimal
    total_paid: Decimal
    interest_paid: Decimal
    status: str
    months_remaining: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class LoanPaymentCreate(BaseModel):
    date: DateType
    emi_amount: Decimal = Field(..., gt=0)
    principal_component: Decimal = Field(..., ge=0)
    interest_component: Decimal = Field(..., ge=0)
    notes: Optional[str] = None


class LoanPaymentResponse(BaseModel):
    id: str
    loan_id: str
    date: DateType
    emi_amount: Decimal
    principal_component: Decimal
    interest_component: Decimal
    balance_after: Decimal
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Invoice Schemas ──────────────────────────────────────────────────────────
class InvoiceItemCreate(BaseModel):
    description: str = Field(..., min_length=1, max_length=500)
    quantity: Decimal = Field(default=Decimal("1"), gt=0)
    unit_price: Decimal = Field(..., gt=0)
    discount_pct: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    tax_rate: Decimal = Field(default=Decimal("0"), ge=0, le=100)


class InvoiceCreate(BaseModel):
    customer_id: str
    date: DateType
    due_date: DateType
    items: List[InvoiceItemCreate] = Field(..., min_length=1)
    gstin: Optional[str] = None
    currency_code: str = "INR"
    notes: Optional[str] = None
    terms: Optional[str] = None


class InvoiceUpdate(BaseModel):
    customer_id: Optional[str] = None
    due_date: Optional[DateType] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    terms: Optional[str] = None



class InvoiceItemResponse(BaseModel):
    id: str
    description: str
    quantity: Decimal
    unit_price: Decimal
    discount_pct: Decimal
    tax_rate: Decimal
    amount: Decimal
    sort_order: int

    model_config = {"from_attributes": True}


class InvoiceResponse(BaseModel):
    id: str
    workspace_id: str
    invoice_number: str
    customer_id: str
    customer_name: Optional[str] = None
    date: DateType
    due_date: DateType
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total: Decimal
    paid_amount: Decimal
    balance: Decimal
    status: str
    currency_code: str
    notes: Optional[str] = None
    items: List[InvoiceItemResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class InvoicePaymentCreate(BaseModel):
    date: DateType
    amount: Decimal = Field(..., gt=0)
    payment_method: str = "CASH"
    account_id: Optional[str] = None
    notes: Optional[str] = None


# ─── Contact Schemas ──────────────────────────────────────────────────────────
class ContactCreate(BaseModel):
    type: str
    name: str = Field(..., min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    notes: Optional[str] = None


class ContactUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class ContactResponse(BaseModel):
    id: str
    workspace_id: str
    type: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Subscription Schemas ─────────────────────────────────────────────────────
class SubscriptionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    amount: Decimal = Field(..., gt=0)
    currency_code: str = "INR"
    billing_cycle: str = "MONTHLY"
    next_billing_date: date
    account_id: Optional[str] = None
    category_id: Optional[str] = None
    reminder_days: int = Field(default=3, ge=0, le=30)
    notes: Optional[str] = None

    @field_validator("account_id", "category_id", "notes", mode="before")
    @classmethod
    def empty_str_to_none(cls, v: Any) -> Any:
        if isinstance(v, str) and not v.strip():
            return None
        return v



class SubscriptionUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[Decimal] = None
    currency_code: Optional[str] = None
    billing_cycle: Optional[str] = None
    next_billing_date: Optional[date] = None
    status: Optional[str] = None
    reminder_days: Optional[int] = None
    notes: Optional[str] = None



class SubscriptionResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    amount: Decimal
    currency_code: str
    billing_cycle: str
    next_billing_date: date
    status: str
    reminder_days: int
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SubscriptionAnalytics(BaseModel):
    monthly_total: Decimal
    yearly_total: Decimal
    active_count: int
    by_category: List[ChartDataPoint]


# ─── Notification Schemas ─────────────────────────────────────────────────────
class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    message: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Wishlist Schemas ─────────────────────────────────────────────────────────
class WishlistItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    quantity: Decimal = Field(default=Decimal("1.00"), gt=0)
    unit: str = "pcs"
    price: Optional[Decimal] = None
    notes: Optional[str] = None

    @field_validator("unit", "notes", mode="before")
    @classmethod
    def empty_str_to_none(cls, v: Any) -> Any:
        if isinstance(v, str) and not v.strip():
            return None
        return v


class WishlistItemUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit: Optional[str] = None
    price: Optional[Decimal] = None
    is_purchased: Optional[bool] = None
    notes: Optional[str] = None


class WishlistItemResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    quantity: Decimal
    unit: str
    price: Optional[Decimal] = None
    is_purchased: bool
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class WishlistPurchaseRequest(BaseModel):
    account_id: str
    category_id: Optional[str] = "cat-exp-02"
    price: Optional[Decimal] = None
    record_expense: bool = True


class WishlistAdvanceRequest(BaseModel):
    account_id: str
    category_id: Optional[str] = "cat-inc-08"
    amount: Decimal = Field(..., gt=0)
    notes: Optional[str] = None
