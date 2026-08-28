"""DayToExpense — Utils: response helpers, pagination, dates, audit."""
# ─── response.py ──────────────────────────────────────────────────────────────
from typing import Any, Optional


def success_response(data: Any = None, message: str = "Success", status: int = 200) -> dict:
    return {"status": status, "isSuccess": True, "message": message, "data": data}


def error_response(message: str, status: int = 400, detail: Any = None) -> dict:
    return {"status": status, "isSuccess": False, "message": message, "detail": detail}


def created_response(data: Any, message: str = "Created successfully") -> dict:
    return success_response(data, message, 201)


def deleted_response(message: str = "Deleted successfully") -> dict:
    return success_response(None, message, 200)
