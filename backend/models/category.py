import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, Enum, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, UUIDMixin
import enum

class CategoryType(str, enum.Enum):
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"
    BOTH = "BOTH"

class TransactionCategory(Base, UUIDMixin):
    __tablename__ = "transaction_categories"
    
    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    icon: Mapped[str] = mapped_column(String(50), nullable=True)
    color: Mapped[str] = mapped_column(String(7), nullable=True)
    type: Mapped[CategoryType] = mapped_column(Enum(CategoryType), nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)

class TransactionSubcategory(Base, UUIDMixin):
    __tablename__ = "transaction_subcategories"
    
    category_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("transaction_categories.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    icon: Mapped[str] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
