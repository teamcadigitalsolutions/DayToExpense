import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Boolean, Enum, ForeignKey, Numeric, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional
from backend.models.base import Base, UUIDMixin, TimestampMixin, SoftDeleteMixin
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

class Account(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "accounts"
    
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    account_type: Mapped[AccountType] = mapped_column(Enum(AccountType), nullable=False)
    bank_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    account_number_masked: Mapped[Optional[str]] = mapped_column(String(4), nullable=True)
    currency_code: Mapped[str] = mapped_column(String(3), default="INR")
    opening_balance: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0"))
    current_balance: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0"))
    credit_limit: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    billing_date: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    due_date: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(7), nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

