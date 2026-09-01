import uuid
from uuid import UUID
from datetime import datetime, date as DateType, time as TimeType
from decimal import Decimal
from sqlalchemy import String, Boolean, Enum, ForeignKey, Numeric, Date, Time, JSON, UUID as SQLAlchemyUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional
from backend.models.base import Base, UUIDMixin, TimestampMixin, SoftDeleteMixin
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

class Transaction(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "transactions"
    
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id: Mapped[str] = mapped_column(String(36), ForeignKey("accounts.id"), nullable=False, index=True)
    category_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("transaction_categories.id"), nullable=True, index=True)
    subcategory_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("transaction_subcategories.id"), nullable=True)
    type: Mapped[TransactionType] = mapped_column(Enum(TransactionType), nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    currency_code: Mapped[str] = mapped_column(String(3), default="INR")
    exchange_rate: Mapped[Decimal] = mapped_column(Numeric(12, 6), default=Decimal("1.0"))
    base_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    date: Mapped[DateType] = mapped_column(Date, nullable=False, index=True)
    time: Mapped[Optional[TimeType]] = mapped_column(Time, nullable=True)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    reference_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    payment_method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod), default=PaymentMethod.CASH)
    contact_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("contacts.id"), nullable=True)
    tags: Mapped[Optional[list[str]]] = mapped_column(JSON, nullable=True)
    status: Mapped[TransactionStatus] = mapped_column(Enum(TransactionStatus), default=TransactionStatus.COMPLETED)
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    recurring_id: Mapped[Optional[UUID]] = mapped_column(SQLAlchemyUUID(as_uuid=True), nullable=True)
    transfer_id: Mapped[Optional[UUID]] = mapped_column(SQLAlchemyUUID(as_uuid=True), ForeignKey("transfers.id"), nullable=True)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("app_users.id"), nullable=False)

