"""DayToExpense — Auth Service: register, login, JWT, password management."""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import settings
from backend.core.security import (
    hash_password, verify_password, password_needs_rehash,
    create_access_token, create_refresh_token, decode_refresh_token,
)
from backend.models.user import User
from backend.models.workspace import Workspace, WorkspaceMember, WorkspaceRole, WorkspaceType
from backend.schemas.schemas import RegisterRequest, LoginRequest, TokenResponse, UserResponse
from backend.utils.decimal_utils import safe_decimal

MAX_LOGIN_ATTEMPTS = 5
LOCK_DURATION_MINUTES = 30


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, data: RegisterRequest) -> User:
        """Register a new user and create their default Personal workspace."""
        # Check email uniqueness
        existing = await self.db.execute(
            select(User).where(or_(User.email == data.email, User.username == data.username))
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email or username already exists",
            )

        # Create user
        user = User(
            id=str(uuid.uuid4()),
            email=data.email.lower(),
            username=data.username.lower(),
            password_hash=hash_password(data.password),
            full_name=data.full_name,
            phone=data.phone,
            is_active=True,
            is_verified=False,
        )
        self.db.add(user)
        await self.db.flush()  # Get user.id without committing

        # Create default Personal workspace
        workspace = Workspace(
            id=str(uuid.uuid4()),
            name=f"{data.full_name.split()[0]}'s Finance",
            type=WorkspaceType.PERSONAL,
            owner_id=user.id,
            base_currency="INR",
        )
        self.db.add(workspace)
        await self.db.flush()

        # Add user as OWNER of workspace
        member = WorkspaceMember(
            id=str(uuid.uuid4()),
            workspace_id=workspace.id,
            user_id=user.id,
            role=WorkspaceRole.OWNER,
            is_active=True,
        )
        self.db.add(member)
        await self.db.commit()
        await self.db.refresh(user)

        return user

    async def login(self, data: LoginRequest) -> dict:
        """Authenticate user, check lock, return tokens."""
        # Find user by email or username
        result = await self.db.execute(
            select(User).where(
                or_(
                    User.email == data.username_or_email.lower(),
                    User.username == data.username_or_email.lower(),
                )
            )
        )
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        # Check account lock
        if user.is_locked:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account locked due to too many failed attempts. Try again after {user.locked_until}",
            )

        # Verify password
        if not verify_password(data.password, user.password_hash):
            user.login_attempts = (user.login_attempts or 0) + 1
            if user.login_attempts >= MAX_LOGIN_ATTEMPTS:
                user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCK_DURATION_MINUTES)
            await self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated. Contact support.",
            )

        # Rehash if using legacy SHA-256
        if password_needs_rehash(user.password_hash):
            user.password_hash = hash_password(data.password)

        # Reset login attempts, update last_login
        user.login_attempts = 0
        user.locked_until = None
        user.last_login = datetime.now(timezone.utc)
        await self.db.commit()

        # Generate tokens
        token_data = {"sub": user.id}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.access_token_expire_minutes * 60,
            "user": user,
        }

    async def refresh_tokens(self, refresh_token: str) -> dict:
        """Validate refresh token and issue new access + refresh tokens."""
        payload = decode_refresh_token(refresh_token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token",
            )

        user_id = payload.get("sub")
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive",
            )

        token_data = {"sub": user.id}
        return {
            "access_token": create_access_token(token_data),
            "refresh_token": create_refresh_token(token_data),
            "token_type": "bearer",
            "expires_in": settings.access_token_expire_minutes * 60,
            "user": user,
        }

    async def change_password(self, user: User, current_password: str, new_password: str) -> None:
        """Change password after verifying current password."""
        if not verify_password(current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )
        user.password_hash = hash_password(new_password)
        await self.db.commit()

    async def get_user_workspaces(self, user_id: str) -> list:
        """Get all active workspaces the user is a member of."""
        result = await self.db.execute(
            select(Workspace, WorkspaceMember.role)
            .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
            .where(
                WorkspaceMember.user_id == user_id,
                WorkspaceMember.is_active == True,
                Workspace.is_active == True,
            )
        )
        rows = result.all()
        workspaces = []
        for ws, role in rows:
            ws.member_role = role.value
            workspaces.append(ws)
        return workspaces
