"""
DayToExpense — Database Connection
Supports MySQL, PostgreSQL, SQLite via SQLAlchemy (async)
Switch database by changing DATABASE_URL in .env only
"""
from typing import AsyncGenerator

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from backend.core.config import settings


def _build_engine_url(url: str) -> str:
    """
    Normalize the DATABASE_URL for async drivers:
    - Strips inadvertent 'DATABASE_URL=' prefixes
    - postgres:// / postgresql:// / postgresql+psycopg2:// → postgresql+asyncpg://
    - mysql+pymysql:// / mysql:// → mysql+aiomysql:// or mysql+asyncmy://
    - sqlite:// → sqlite+aiosqlite://
    """
    if not url:
        raise ValueError("DATABASE_URL environment variable is missing or empty. Please specify DATABASE_URL in backend/.env")

    while url.startswith("DATABASE_URL="):
        url = url.replace("DATABASE_URL=", "", 1).strip()
    if url.startswith("postgresql+asyncpg://"):
        return url

    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)

    if url.startswith("postgresql+psycopg2://"):
        return url.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)

    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)

    if url.startswith("mysql+aiomysql://") or url.startswith("mysql+asyncmy://"):
        return url

    if url.startswith("mysql+pymysql://"):
        try:
            import aiomysql  # noqa: F401
            return url.replace("mysql+pymysql://", "mysql+aiomysql://", 1)
        except ImportError:
            return url.replace("mysql+pymysql://", "mysql+asyncmy://", 1)

    if url.startswith("mysql://"):
        try:
            import aiomysql  # noqa: F401
            return url.replace("mysql://", "mysql+aiomysql://", 1)
        except ImportError:
            return url.replace("mysql://", "mysql+asyncmy://", 1)

    if url.startswith("sqlite://") and not url.startswith("sqlite+aiosqlite://"):
        return url.replace("sqlite://", "sqlite+aiosqlite://", 1)

    return url


_async_url = _build_engine_url(settings.database_url)

_engine_kwargs: dict = {
    "echo": False,
    "future": True,
}

if "sqlite" in _async_url:
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
elif "mysql" in _async_url:
    _engine_kwargs["pool_pre_ping"] = True
    _engine_kwargs["pool_size"] = 10
    _engine_kwargs["max_overflow"] = 20
    _engine_kwargs["pool_recycle"] = 3600
elif "postgresql" in _async_url:
    _engine_kwargs["pool_pre_ping"] = True
    _engine_kwargs["pool_size"] = 10
    _engine_kwargs["max_overflow"] = 20


engine: AsyncEngine = create_async_engine(_async_url, **_engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all models."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that yields an async database session.
    Automatically commits on success or rolls back on exception.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """
    Initialize the database by creating all tables and seeding default admin user if database is empty.
    """
    async with engine.begin() as conn:
        import backend.models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)

    # Seed default Admin user in MySQL if not present
    try:
        async with AsyncSessionLocal() as session:
            from backend.models.user import User
            from backend.models.workspace import Workspace, WorkspaceMember, WorkspaceRole, WorkspaceType
            from backend.core.security import hash_password

            res = await session.execute(select(User).where(User.username == "admin"))
            existing_admin = res.scalar_one_or_none()

            if not existing_admin:
                admin_user = User(
                    id="admin-master-01",
                    email="admin@daytoexpense.com",
                    username="admin",
                    password_hash=hash_password("DayToExpense@2024"),
                    full_name="System Administrator",
                    is_active=True,
                    is_verified=True,
                    is_superuser=True,
                )
                session.add(admin_user)
                await session.flush()

                workspace = Workspace(
                    id="ws-primary-01",
                    name="Primary Workspace",
                    type=WorkspaceType.PERSONAL,
                    owner_id=admin_user.id,
                    base_currency="INR",
                )
                session.add(workspace)
                await session.flush()

                member = WorkspaceMember(
                    id="wm-primary-01",
                    workspace_id=workspace.id,
                    user_id=admin_user.id,
                    role=WorkspaceRole.OWNER,
                    is_active=True,
                )
                session.add(member)
                await session.commit()
    except Exception as e:
        print(f"[Database Init] Seed admin warning: {e}")


async def check_db_connection() -> bool:
    """Health check — verify database is reachable."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
