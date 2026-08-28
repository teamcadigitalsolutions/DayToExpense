import enum
import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Boolean, Enum, ForeignKey, JSON, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, UUIDMixin, TimestampMixin


class WorkspaceType(str, enum.Enum):
    PERSONAL = "PERSONAL"
    FAMILY = "FAMILY"
    BUSINESS = "BUSINESS"
    ORGANIZATION = "ORGANIZATION"


class WorkspaceRole(str, enum.Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"
    VIEWER = "VIEWER"


ROLE_HIERARCHY = {
    WorkspaceRole.OWNER: 4,
    WorkspaceRole.ADMIN: 3,
    WorkspaceRole.MEMBER: 2,
    WorkspaceRole.VIEWER: 1,
}


class Workspace(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "workspaces"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[WorkspaceType] = mapped_column(
        Enum(WorkspaceType), default=WorkspaceType.PERSONAL, nullable=False
    )
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("app_users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    base_currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    settings: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Invoice settings
    invoice_prefix: Mapped[str] = mapped_column(String(20), default="INV", nullable=False)
    invoice_next_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    gstin: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    business_address: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    business_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    business_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    members: Mapped[List["WorkspaceMember"]] = relationship(
        "WorkspaceMember", back_populates="workspace", lazy="select",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Workspace id={self.id} name={self.name}>"


class WorkspaceMember(Base, UUIDMixin):
    __tablename__ = "workspace_members"

    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("app_users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[WorkspaceRole] = mapped_column(
        Enum(WorkspaceRole), default=WorkspaceRole.MEMBER, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="members")
    user: Mapped["User"] = relationship("User", back_populates="workspace_memberships")

    def __repr__(self) -> str:
        return f"<WorkspaceMember workspace={self.workspace_id} user={self.user_id} role={self.role}>"

    def has_permission(self, required_role: WorkspaceRole) -> bool:
        return ROLE_HIERARCHY.get(self.role, 0) >= ROLE_HIERARCHY.get(required_role, 0)
