import uuid
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import String, ForeignKey, Numeric, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, UUIDMixin

class Transfer(Base, UUIDMixin):
    __tablename__ = "transfers"
    
    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id"))
    from_account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"))
    to_account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    from_transaction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("transactions.id"))
    to_transaction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("transactions.id"))
    fee: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=0)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    reference: Mapped[str] = mapped_column(String(100), nullable=True)
    notes: Mapped[str] = mapped_column(String(255), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("app_users.id"))
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
