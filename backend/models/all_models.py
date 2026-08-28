"""DayToExpense — All SQLAlchemy models, remaining: category, transfer, contact,
investment, budget, loan, invoice, subscription, currency, attachment,
notification, audit_log, settings.
"""

# ──────────────────────────────────────────────────────────────────────────────
# category.py content (inlined into __init__ for import clarity)
# ──────────────────────────────────────────────────────────────────────────────
import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import (
    Boolean, Date, DateTime, Enum, ForeignKey,
    Integer, JSON, Numeric, String, Text, Time, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database.connection import Base
from backend.models.base import UUIDMixin, TimestampMixin, SoftDeleteMixin


# ─── Category ─────────────────────────────────────────────────────────────────
class CategoryType(str, enum.Enum):
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"
    BOTH = "BOTH"


class TransactionCategory(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "transaction_categories"

    workspace_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    icon: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(7), nullable=True)
    type: Mapped[CategoryType] = mapped_column(Enum(CategoryType), nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    subcategories: Mapped[List["TransactionSubcategory"]] = relationship(
        "TransactionSubcategory", back_populates="category", lazy="select",
        cascade="all, delete-orphan"
    )


class TransactionSubcategory(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "transaction_subcategories"

    category_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("transaction_categories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    icon: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    category: Mapped["TransactionCategory"] = relationship("TransactionCategory", back_populates="subcategories")


# ─── Transfer ────────────────────────────────────────────────────────────────
class Transfer(Base, UUIDMixin):
    __tablename__ = "transfers"

    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_account_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("accounts.id"), nullable=False
    )
    to_account_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("accounts.id"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    from_transaction_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("transactions.id"), nullable=False
    )
    to_transaction_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("transactions.id"), nullable=False
    )
    fee: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0"), nullable=False)
    date: Mapped[datetime] = mapped_column(Date, nullable=False)
    reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("app_users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ─── Contact ─────────────────────────────────────────────────────────────────
class ContactType(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    SUPPLIER = "SUPPLIER"
    EMPLOYEE = "EMPLOYEE"
    PERSONAL = "PERSONAL"
    OTHER = "OTHER"


class Contact(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "contacts"

    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[ContactType] = mapped_column(Enum(ContactType), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    company: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    gstin: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    pincode: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


# ─── Investment ───────────────────────────────────────────────────────────────
class InvestmentType(str, enum.Enum):
    STOCKS = "STOCKS"
    MUTUAL_FUND = "MUTUAL_FUND"
    SIP = "SIP"
    FIXED_DEPOSIT = "FIXED_DEPOSIT"
    RECURRING_DEPOSIT = "RECURRING_DEPOSIT"
    GOLD = "GOLD"
    BONDS = "BONDS"
    PPF = "PPF"
    NPS = "NPS"
    CRYPTO = "CRYPTO"
    REAL_ESTATE = "REAL_ESTATE"
    INSURANCE = "INSURANCE"
    OTHER = "OTHER"


class Investment(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "investments"

    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[InvestmentType] = mapped_column(Enum(InvestmentType), nullable=False)
    institution: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    account_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("accounts.id"), nullable=True
    )
    purchase_date: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True)
    quantity: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 6), nullable=True)
    purchase_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    invested_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0"))
    current_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    current_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    maturity_date: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    inv_transactions: Mapped[List["InvestmentTransaction"]] = relationship(
        "InvestmentTransaction", back_populates="investment", lazy="select"
    )
    sip_plan: Mapped[Optional["SIPPlan"]] = relationship(
        "SIPPlan", back_populates="investment", uselist=False, lazy="select"
    )


class InvestmentTransactionType(str, enum.Enum):
    BUY = "BUY"
    SELL = "SELL"
    DIVIDEND = "DIVIDEND"
    SIP_INSTALLMENT = "SIP_INSTALLMENT"
    INTEREST = "INTEREST"
    BONUS = "BONUS"


class InvestmentTransaction(Base, UUIDMixin):
    __tablename__ = "investment_transactions"

    investment_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("investments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id"), nullable=False
    )
    type: Mapped[InvestmentTransactionType] = mapped_column(
        Enum(InvestmentTransactionType), nullable=False
    )
    date: Mapped[datetime] = mapped_column(Date, nullable=False)
    quantity: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 6), nullable=True)
    price: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    transaction_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("transactions.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    investment: Mapped["Investment"] = relationship("Investment", back_populates="inv_transactions")


class SIPFrequency(str, enum.Enum):
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    YEARLY = "YEARLY"


class SIPStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class SIPPlan(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "sip_plans"

    investment_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("investments.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    frequency: Mapped[SIPFrequency] = mapped_column(Enum(SIPFrequency), nullable=False)
    start_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    next_date: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True)
    status: Mapped[SIPStatus] = mapped_column(Enum(SIPStatus), default=SIPStatus.ACTIVE)
    total_invested: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0"))
    installments_completed: Mapped[int] = mapped_column(Integer, default=0)

    investment: Mapped["Investment"] = relationship("Investment", back_populates="sip_plan")


# ─── Budget ───────────────────────────────────────────────────────────────────
class BudgetPeriod(str, enum.Enum):
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    YEARLY = "YEARLY"
    CUSTOM = "CUSTOM"


class Budget(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "budgets"

    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    period: Mapped[BudgetPeriod] = mapped_column(Enum(BudgetPeriod), nullable=False)
    start_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    end_date: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    categories: Mapped[List["BudgetCategory"]] = relationship(
        "BudgetCategory", back_populates="budget", lazy="select",
        cascade="all, delete-orphan"
    )


class BudgetCategory(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "budget_categories"

    budget_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("transaction_categories.id"), nullable=False
    )
    allocated_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    alert_at_75: Mapped[bool] = mapped_column(Boolean, default=True)
    alert_at_90: Mapped[bool] = mapped_column(Boolean, default=True)
    alert_at_100: Mapped[bool] = mapped_column(Boolean, default=True)

    budget: Mapped["Budget"] = relationship("Budget", back_populates="categories")


# ─── Loan ────────────────────────────────────────────────────────────────────
class LoanType(str, enum.Enum):
    HOME = "HOME"
    VEHICLE = "VEHICLE"
    PERSONAL = "PERSONAL"
    EDUCATION = "EDUCATION"
    BUSINESS = "BUSINESS"
    GOLD = "GOLD"
    OTHER = "OTHER"


class LoanStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    CLOSED = "CLOSED"
    DEFAULTED = "DEFAULTED"


class Loan(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "loans"

    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[LoanType] = mapped_column(Enum(LoanType), nullable=False)
    institution: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    principal: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    interest_rate: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False)
    tenure_months: Mapped[int] = mapped_column(Integer, nullable=False)
    emi_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    start_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    end_date: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True)
    account_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("accounts.id"), nullable=True
    )
    outstanding_balance: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    total_paid: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0"))
    interest_paid: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0"))
    status: Mapped[LoanStatus] = mapped_column(Enum(LoanStatus), default=LoanStatus.ACTIVE)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    payments: Mapped[List["LoanPayment"]] = relationship(
        "LoanPayment", back_populates="loan", lazy="select"
    )


class LoanPayment(Base, UUIDMixin):
    __tablename__ = "loan_payments"

    loan_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("loans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    workspace_id: Mapped[str] = mapped_column(String(36), nullable=False)
    transaction_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("transactions.id"), nullable=True
    )
    date: Mapped[datetime] = mapped_column(Date, nullable=False)
    emi_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    principal_component: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    interest_component: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    loan: Mapped["Loan"] = relationship("Loan", back_populates="payments")


# ─── Invoice ─────────────────────────────────────────────────────────────────
class InvoiceStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    PAID = "PAID"
    OVERDUE = "OVERDUE"
    CANCELLED = "CANCELLED"


class Invoice(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "invoices"

    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    invoice_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    customer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("contacts.id"), nullable=False
    )
    date: Mapped[datetime] = mapped_column(Date, nullable=False)
    due_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0"))
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0"))
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0"))
    total: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0"))
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0"))
    balance: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0"))
    status: Mapped[InvoiceStatus] = mapped_column(Enum(InvoiceStatus), default=InvoiceStatus.DRAFT)
    gstin: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    currency_code: Mapped[str] = mapped_column(String(3), default="INR")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    terms: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("app_users.id"), nullable=False)

    items: Mapped[List["InvoiceItem"]] = relationship(
        "InvoiceItem", back_populates="invoice", lazy="select",
        cascade="all, delete-orphan", order_by="InvoiceItem.sort_order"
    )
    payments_received: Mapped[List["InvoicePayment"]] = relationship(
        "InvoicePayment", back_populates="invoice", lazy="select"
    )


class InvoiceItem(Base, UUIDMixin):
    __tablename__ = "invoice_items"

    invoice_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False, default=Decimal("1"))
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0"))
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0"))
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="items")


class InvoicePayment(Base, UUIDMixin):
    __tablename__ = "invoice_payments"

    invoice_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    workspace_id: Mapped[str] = mapped_column(String(36), nullable=False)
    transaction_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("transactions.id"), nullable=True
    )
    date: Mapped[datetime] = mapped_column(Date, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(50), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="payments_received")


# ─── Subscription ────────────────────────────────────────────────────────────
class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class BillingCycle(str, enum.Enum):
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    YEARLY = "YEARLY"


class Subscription(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "subscriptions"

    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    currency_code: Mapped[str] = mapped_column(String(3), default="INR")
    billing_cycle: Mapped[BillingCycle] = mapped_column(Enum(BillingCycle), nullable=False)
    next_billing_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    account_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("accounts.id"), nullable=True
    )
    category_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("transaction_categories.id"), nullable=True
    )
    status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus), default=SubscriptionStatus.ACTIVE
    )
    reminder_days: Mapped[int] = mapped_column(Integer, default=3)
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


class RecurringTransactionStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"


class RecurringTransaction(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "recurring_transactions"

    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # INCOME / EXPENSE
    account_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("accounts.id"), nullable=False
    )
    category_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("transaction_categories.id"), nullable=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    frequency: Mapped[SIPFrequency] = mapped_column(Enum(SIPFrequency), nullable=False)
    start_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    next_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    end_date: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True)
    status: Mapped[RecurringTransactionStatus] = mapped_column(
        Enum(RecurringTransactionStatus), default=RecurringTransactionStatus.ACTIVE
    )
    last_generated: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True)


# ─── Currency ─────────────────────────────────────────────────────────────────
class Currency(Base):
    __tablename__ = "currencies"

    code: Mapped[str] = mapped_column(String(3), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    symbol: Mapped[str] = mapped_column(String(5), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ExchangeRate(Base, UUIDMixin):
    __tablename__ = "exchange_rates"

    from_currency: Mapped[str] = mapped_column(String(3), ForeignKey("currencies.code"), nullable=False)
    to_currency: Mapped[str] = mapped_column(String(3), ForeignKey("currencies.code"), nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    date: Mapped[datetime] = mapped_column(Date, nullable=False)
    source: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ─── Attachment ───────────────────────────────────────────────────────────────
class Attachment(Base, UUIDMixin):
    __tablename__ = "attachments"

    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    uploaded_by: Mapped[str] = mapped_column(String(36), ForeignKey("app_users.id"), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    entity_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ─── Notification ─────────────────────────────────────────────────────────────
class NotificationType(str, enum.Enum):
    BILL_DUE = "BILL_DUE"
    LOAN_EMI = "LOAN_EMI"
    CREDIT_CARD_DUE = "CREDIT_CARD_DUE"
    SUBSCRIPTION = "SUBSCRIPTION"
    BUDGET_ALERT = "BUDGET_ALERT"
    SIP_DATE = "SIP_DATE"
    INVOICE_OVERDUE = "INVOICE_OVERDUE"
    GENERAL = "GENERAL"


class Notification(Base, UUIDMixin):
    __tablename__ = "notifications"

    workspace_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("app_users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[NotificationType] = mapped_column(Enum(NotificationType), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    entity_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ─── AuditLog ─────────────────────────────────────────────────────────────────
class AuditLog(Base, UUIDMixin):
    __tablename__ = "audit_logs"

    workspace_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("app_users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entity_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    old_value: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    new_value: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[Optional["User"]] = relationship("User", back_populates="audit_logs")


# ─── Settings ─────────────────────────────────────────────────────────────────
class Setting(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "settings"

    workspace_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True, index=True
    )
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("app_users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    key: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    value: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
