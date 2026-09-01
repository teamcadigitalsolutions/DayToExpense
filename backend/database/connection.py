"""
DayToExpense — Database Connection
Supports MySQL, PostgreSQL, SQLite via SQLAlchemy (async)
Switch database by changing DATABASE_URL in .env only
"""
from typing import AsyncGenerator

from sqlalchemy import text, select, func
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
    if not url or not url.strip():
        return "sqlite+aiosqlite:///./daytoexpense.db"

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


def _sync_table_columns(sync_conn) -> None:
    """
    Auto-migrate pre-existing database tables to ensure all columns defined in SQLAlchemy models
    exist in the database AND have sufficient size.
    Prevents errors like (1054, "Unknown column 'deleted_by' in 'field list'") and
    (1406, "Data too long for column 'deleted_by' at row 1").
    """
    from sqlalchemy import inspect
    import backend.models  # noqa: F401

    # Columns that need to be specifically sized to VARCHAR(36) for UUID storage
    UUID_COLUMNS = {"deleted_by", "created_by", "updated_by", "workspace_id", "user_id", "account_id",
                    "category_id", "contact_id", "subcategory_id", "from_account_id", "to_account_id",
                    "owner_id", "member_id", "recurring_id", "transfer_id"}

    try:
        inspector = inspect(sync_conn)
        existing_tables = inspector.get_table_names()

        for table_name, table in Base.metadata.tables.items():
            if table_name in existing_tables:
                existing_col_map = {c["name"]: c for c in inspector.get_columns(table_name)}
                quote = sync_conn.dialect.identifier_preparer.quote
                q_table = quote(table_name)

                for column in table.columns:
                    col_name = column.name
                    q_col = quote(col_name)

                    if col_name not in existing_col_map:
                        # Column doesn't exist — ADD it
                        col_type = column.type.compile(sync_conn.dialect)
                        sql = f"ALTER TABLE {q_table} ADD COLUMN {q_col} {col_type} NULL"
                        try:
                            sync_conn.execute(text(sql))
                            print(f"[DB Auto-Migration] Added column '{col_name}' ({col_type}) to '{table_name}'")
                        except Exception as col_err:
                            print(f"[DB Auto-Migration] Warning adding column '{col_name}' to '{table_name}': {col_err}")
                    else:
                        # Column exists — check if it needs resizing for UUID columns
                        if col_name in UUID_COLUMNS:
                            existing_col = existing_col_map[col_name]
                            existing_type = str(existing_col.get("type", "")).upper()
                            is_char_or_varchar = "CHAR" in existing_type or "VARCHAR" in existing_type
                            if is_char_or_varchar and "36" not in existing_type:
                                try:
                                    sync_conn.execute(text(f"ALTER TABLE {q_table} MODIFY COLUMN {q_col} VARCHAR(36) NULL"))
                                    print(f"[DB Auto-Migration] Resized '{col_name}' to VARCHAR(36) in '{table_name}'")
                                except Exception as resize_err:
                                    # Try ALTER COLUMN syntax (PostgreSQL)
                                    try:
                                        sync_conn.execute(text(f"ALTER TABLE {q_table} ALTER COLUMN {q_col} TYPE VARCHAR(36)"))
                                    except Exception:
                                        print(f"[DB Auto-Migration] Could not resize '{col_name}' in '{table_name}': {resize_err}")
    except Exception as e:
        print(f"[DB Auto-Migration] Table column sync warning: {e}")



async def seed_default_categories(session) -> None:
    """Seed default system categories if table is empty."""
    from backend.models.all_models import TransactionCategory
    cat_count_res = await session.execute(select(func.count(TransactionCategory.id)))
    cat_count = cat_count_res.scalar() or 0
    if cat_count == 0:
        default_cats = [
            # Income
            {"id": "cat-inc-01", "name": "Salary & Wages", "type": "INCOME", "icon": "DollarSign", "color": "#16a34a"},
            {"id": "cat-inc-02", "name": "Business & Freelance", "type": "INCOME", "icon": "Briefcase", "color": "#2563eb"},
            {"id": "cat-inc-03", "name": "Investments & Dividends", "type": "INCOME", "icon": "TrendingUp", "color": "#8b5cf6"},
            {"id": "cat-inc-04", "name": "Rental & Real Estate", "type": "INCOME", "icon": "Home", "color": "#059669"},
            {"id": "cat-inc-05", "name": "Interest & Returns", "type": "INCOME", "icon": "Percent", "color": "#d97706"},
            {"id": "cat-inc-06", "name": "Refunds & Cashbacks", "type": "INCOME", "icon": "RefreshCw", "color": "#0284c7"},
            {"id": "cat-inc-07", "name": "Gifts & Allowance", "type": "INCOME", "icon": "Gift", "color": "#ec4899"},
            {"id": "cat-inc-08", "name": "Other Income", "type": "INCOME", "icon": "PlusCircle", "color": "#64748b"},
            # Expense
            {"id": "cat-exp-01", "name": "Housing & Rent", "type": "EXPENSE", "icon": "Home", "color": "#dc2626"},
            {"id": "cat-exp-02", "name": "Food & Groceries", "type": "EXPENSE", "icon": "ShoppingCart", "color": "#f59e0b"},
            {"id": "cat-exp-03", "name": "Utilities & Bills", "type": "EXPENSE", "icon": "Zap", "color": "#2563eb"},
            {"id": "cat-exp-04", "name": "Transportation & Fuel", "type": "EXPENSE", "icon": "Car", "color": "#4f46e5"},
            {"id": "cat-exp-05", "name": "Health & Medical", "type": "EXPENSE", "icon": "Heart", "color": "#e11d48"},
            {"id": "cat-exp-06", "name": "Entertainment & Leisure", "type": "EXPENSE", "icon": "Film", "color": "#9333ea"},
            {"id": "cat-exp-07", "name": "Shopping & Personal", "type": "EXPENSE", "icon": "ShoppingBag", "color": "#06b6d4"},
            {"id": "cat-exp-08", "name": "Loans & EMI Repayments", "type": "EXPENSE", "icon": "Landmark", "color": "#ea580c"},
            {"id": "cat-exp-09", "name": "Other Expense", "type": "EXPENSE", "icon": "MoreHorizontal", "color": "#64748b"},
        ]
        for c in default_cats:
            session.add(TransactionCategory(
                id=c["id"],
                name=c["name"],
                type=c["type"],
                icon=c["icon"],
                color=c["color"],
                is_system=True,
                is_active=True,
            ))
        await session.commit()
        print("[Database Init] Default categories seeded successfully")


async def init_db() -> None:
    """
    Initialize the database by creating all tables, syncing missing columns, and seeding default admin user if database is empty.
    """
    async with engine.begin() as conn:
        import backend.models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_sync_table_columns)

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

            # Seed default system categories if table is empty
            await seed_default_categories(session)
    except Exception as e:
        print(f"[Database Init] Warning: {e}")



async def check_db_connection() -> bool:
    """Health check — verify database is reachable."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
