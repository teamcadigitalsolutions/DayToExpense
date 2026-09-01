"""
DayToExpense — Base model mixins
All models inherit from these to ensure consistent structure.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from backend.database.connection import Base


class UUIDMixin:
    """UUID primary key mixin."""
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )


class TimestampMixin:
    """Auto-managed created_at and updated_at timestamps."""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )



class SoftDeleteMixin:
    """Soft-delete support. Always filter with is_deleted=False in queries."""
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    deleted_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    def soft_delete(self, deleted_by_id: str) -> None:
        self.is_deleted = True
        self.deleted_at = datetime.now(timezone.utc)
        self.deleted_by = deleted_by_id
