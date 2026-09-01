"""
DayToExpense — Base model mixins
All models inherit from these to ensure consistent structure.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, Union
from uuid import UUID

from sqlalchemy import Boolean, DateTime, String, UUID as SQLAlchemyUUID, func
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
    deleted_by: Mapped[Optional[UUID]] = mapped_column(
        SQLAlchemyUUID(as_uuid=True), nullable=True
    )

    def soft_delete(self, deleted_by_id: Union[UUID, str]) -> None:
        self.is_deleted = True
        self.deleted_at = datetime.now(timezone.utc)
        if deleted_by_id is not None:
            self.deleted_by = UUID(str(deleted_by_id)) if not isinstance(deleted_by_id, UUID) else deleted_by_id
        else:
            self.deleted_by = None
