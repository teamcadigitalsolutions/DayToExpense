import uuid
from datetime import datetime, date, time
from decimal import Decimal
from sqlalchemy import String, Boolean, Enum, ForeignKey, Numeric, Date, Time, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, UUIDMixin
import enum

class TransactionType(str, enum.Enum):
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"
    TRANSFER = "TRANSFER"
    REFUND = "REFUND"
    ADJUSTMENT = "ADJUSTMENT"
    INVESTMENT = "INVESTMENT"
    LOAN_PAYMENT = "LOAN_PAYMENT"
    CREDIT_CARD_PAYMENT = "CREDIT_CARD_PAYMENT"

class PaymentMethod(str, enum.Enum):
    CASH = "CASH"
    UPI = "UPI"
    NEFT = "NEFT"
    IMPS = "IMPS"
    CHEQUE = "CHEQUE"
    CARD = "CARD"
    AUTO_DEBIT = "AUTO_DEBIT"
    OTHER = "OTHER"

class TransactionStatus(str, enum.Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    RECONCILED = "RECONCILED"

class Transaction(Base, UUIDMixin):
    __tablename__ = "transactions"
    
    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id"))
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"))
    category_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("transaction_categories.id"), nullable=True)
    subcategory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("transaction_subcategories.id"), nullable=True)
    type: Mapped[TransactionType] = mapped_column(Enum(TransactionType))
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    currency_code: Mapped[str] = mapped_column(String(3), default="INR")
    exchange_rate: Mapped[Decimal] = mapped_column(Numeric(12, 6), default=1.0)
    base_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    date: Mapped[date] = mapped_column(Date, nullable=False)
    time: Mapped[time] = mapped_column(Time, nullable=True)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[str] = mapped_column(String(1000), nullable=True)
    reference_number: Mapped[str] = mapped_column(String(100), nullable=True)
    payment_method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod), default=PaymentMethod.CASH)
    contact_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("contacts.id"), nullable=True)
    tags: Mapped[list[str]] = mapped_column(JSON, nullable=True)
    status: Mapped[TransactionStatus] = mapped_column(Enum(TransactionStatus), default=TransactionStatus.COMPLETED)
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    recurring_id: Mapped[uuid.UUID] = mapped_column(nullable=True)
    transfer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("transfers.id"), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("app_users.id"))
    
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at: Mapped[datetime] = mapped_column(nullable=True)
    deleted_by: Mapped[uuid.UUID] = mapped_column(nullable=True)
