"""DayToExpense — Settings API Router & Configuration Exports."""
from backend.api.v1.all_routes import settings_router as router
from backend.core.config import settings, get_settings, Settings

__all__ = ["router", "settings", "get_settings", "Settings"]
