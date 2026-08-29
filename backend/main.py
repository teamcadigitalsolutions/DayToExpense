import sys
from pathlib import Path

# Add project root to sys.path to support running from either backend/ or project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from backend.core.config import settings
from backend.database.connection import init_db, check_db_connection

# Import all API routers
from backend.api.v1.auth import router as auth_router
from backend.api.v1.workspaces import router as workspace_router
from backend.api.v1.accounts import router as account_router
from backend.api.v1.transactions import router as transaction_router
from backend.api.v1.transfers import router as transfer_router
from backend.api.v1.categories import router as category_router
from backend.api.v1.dashboard import router as dashboard_router
from backend.api.v1.investments import router as investment_router
from backend.api.v1.budgets import router as budget_router
from backend.api.v1.loans import router as loan_router
from backend.api.v1.invoices import router as invoice_router
from backend.api.v1.contacts import router as contact_router
from backend.api.v1.subscriptions import router as subscription_router
from backend.api.v1.reports import router as report_router
from backend.api.v1.notifications import router as notification_router
from backend.api.v1.migration import router as migration_router
from backend.api.v1.settings import router as settings_router


# Rate limiter
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup / shutdown lifecycle."""
    # Startup
    await init_db()
    yield
    # Shutdown (cleanup if needed)


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="DayToExpense — Professional Finance Management API",
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
    lifespan=lifespan,
)

# ─── Middleware ────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─── Global Exception Handlers ────────────────────────────────────────────────
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Never expose stack traces or internal details in production."""
    if settings.is_development:
        import traceback
        return JSONResponse(
            status_code=500,
            content={
                "status": 500,
                "isSuccess": False,
                "message": str(exc),
                "detail": traceback.format_exc() if settings.debug else None,
            },
        )
    return JSONResponse(
        status_code=500,
        content={"status": 500, "isSuccess": False, "message": "An internal error occurred."},
    )


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=422,
        content={"status": 422, "isSuccess": False, "message": str(exc)},
    )


# ─── Routes ────────────────────────────────────────────────────────────────────
PREFIX = settings.api_prefix

app.include_router(auth_router, prefix=f"{PREFIX}/auth", tags=["Authentication"])
app.include_router(workspace_router, prefix=f"{PREFIX}/workspaces", tags=["Workspaces"])
app.include_router(account_router, prefix=f"{PREFIX}/workspaces", tags=["Accounts"])
app.include_router(transaction_router, prefix=f"{PREFIX}/workspaces", tags=["Transactions"])
app.include_router(transfer_router, prefix=f"{PREFIX}/workspaces", tags=["Transfers"])
app.include_router(category_router, prefix=f"{PREFIX}", tags=["Categories"])
app.include_router(dashboard_router, prefix=f"{PREFIX}/workspaces", tags=["Dashboard"])
app.include_router(investment_router, prefix=f"{PREFIX}/workspaces", tags=["Investments"])
app.include_router(budget_router, prefix=f"{PREFIX}/workspaces", tags=["Budgets"])
app.include_router(loan_router, prefix=f"{PREFIX}/workspaces", tags=["Loans"])
app.include_router(invoice_router, prefix=f"{PREFIX}/workspaces", tags=["Invoices"])
app.include_router(contact_router, prefix=f"{PREFIX}/workspaces", tags=["Contacts"])
app.include_router(subscription_router, prefix=f"{PREFIX}/workspaces", tags=["Subscriptions"])
app.include_router(report_router, prefix=f"{PREFIX}/workspaces", tags=["Reports"])
app.include_router(notification_router, prefix=f"{PREFIX}/notifications", tags=["Notifications"])
app.include_router(migration_router, prefix=f"{PREFIX}/migration", tags=["Migration"])
app.include_router(settings_router, prefix=f"{PREFIX}/workspaces", tags=["Settings"])


# ─── Health Check ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    db_ok = await check_db_connection()
    return {
        "status": "ok" if db_ok else "degraded",
        "app": settings.app_name,
        "version": "1.0.0",
        "database": "connected" if db_ok else "disconnected",
        "environment": settings.app_env,
    }


@app.get("/", tags=["Root"])
async def root():
    return {"message": f"Welcome to {settings.app_name} API", "docs": "/docs"}
