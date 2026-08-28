import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Boolean, Enum, ForeignKey, Numeric, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, UUIDMixin
import enum

class AccountType(str, enum.Enum):
    SAVINGS = "SAVINGS"
    CURRENT = "CURRENT"
    CASH = "CASH"
    CREDIT_CARD = "CREDIT_CARD"
    LOAN = "LOAN"
    WALLET = "WALLET"
    INVESTMENT = "INVESTMENT"
    OTHER = "OTHER"

class Account(Base, UUIDMixin):
    __tablename__ = "accounts"
    
    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id"))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    account_type: Mapped[AccountType] = mapped_column(Enum(AccountType), nullable=False)
    bank_name: Mapped[str] = mapped_column(String(100), nullable=True)
    account_number_masked: Mapped[str] = mapped_column(String(4), nullable=True)
    currency_code: Mapped[str] = mapped_column(String(3), default="INR")
    opening_balance: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=0)
    current_balance: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=0)
    credit_limit: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=True)
    billing_date: Mapped[int] = mapped_column(Integer, nullable=True)
    due_date: Mapped[int] = mapped_column(Integer, nullable=True)
    color: Mapped[str] = mapped_column(String(7), nullable=True)
    icon: Mapped[str] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str] = mapped_column(String(255), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at: Mapped[datetime] = mapped_column(nullable=True)
