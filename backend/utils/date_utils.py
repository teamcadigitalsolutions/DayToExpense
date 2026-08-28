"""DayToExpense — Date utility: period → (start_date, end_date)."""
from datetime import date, timedelta
from typing import Tuple


def get_period_dates(period: str, reference: date = None) -> Tuple[date, date]:
    """
    Convert a period string to (start_date, end_date).
    Supported: TODAY, THIS_WEEK, THIS_MONTH, LAST_MONTH, THIS_QUARTER,
               THIS_YEAR, LAST_YEAR, LAST_7_DAYS, LAST_30_DAYS, LAST_90_DAYS
    """
    today = reference or date.today()

    if period == "TODAY":
        return today, today

    if period == "THIS_WEEK":
        start = today - timedelta(days=today.weekday())
        return start, today

    if period == "LAST_7_DAYS":
        return today - timedelta(days=6), today

    if period == "LAST_30_DAYS":
        return today - timedelta(days=29), today

    if period == "LAST_90_DAYS":
        return today - timedelta(days=89), today

    if period == "THIS_MONTH":
        start = today.replace(day=1)
        return start, today

    if period == "LAST_MONTH":
        first_of_this = today.replace(day=1)
        last_of_prev = first_of_this - timedelta(days=1)
        start = last_of_prev.replace(day=1)
        return start, last_of_prev

    if period == "THIS_QUARTER":
        q = (today.month - 1) // 3
        start = date(today.year, q * 3 + 1, 1)
        return start, today

    if period == "THIS_YEAR":
        return date(today.year, 1, 1), today

    if period == "LAST_YEAR":
        year = today.year - 1
        return date(year, 1, 1), date(year, 12, 31)

    # Default: this month
    return today.replace(day=1), today


def get_month_label(year: int, month: int) -> str:
    """Return abbreviated month label like 'Jan 2026'."""
    months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    return f"{months[month-1]} {year}"


def get_last_n_months(n: int, reference: date = None) -> list[Tuple[date, date, str]]:
    """Return list of (start, end, label) for the last n months."""
    today = reference or date.today()
    result = []
    year, month = today.year, today.month
    for _ in range(n):
        start = date(year, month, 1)
        if month == 12:
            end = date(year, 12, 31)
        else:
            end = date(year, month + 1, 1) - timedelta(days=1)
        result.append((start, min(end, today), get_month_label(year, month)))
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    return list(reversed(result))
