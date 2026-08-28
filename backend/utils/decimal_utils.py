"""DayToExpense — Utility modules."""
# ─── decimal_utils.py ──────────────────────────────────────────────────────────
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Union


def safe_decimal(value: Union[str, int, float, Decimal, None], default: Decimal = Decimal("0")) -> Decimal:
    """Safely convert any value to Decimal. Never raises, returns default on failure."""
    if value is None:
        return default
    try:
        if isinstance(value, float):
            # Avoid float precision issues
            return Decimal(str(value))
        return Decimal(value)
    except (InvalidOperation, ValueError, TypeError):
        return default


def round_money(value: Decimal, places: int = 2) -> Decimal:
    """Round Decimal to specified decimal places using ROUND_HALF_UP."""
    quantize_str = "0." + "0" * places
    return value.quantize(Decimal(quantize_str), rounding=ROUND_HALF_UP)


def format_inr(amount: Decimal) -> str:
    """Format Decimal as Indian Rupee string: ₹1,23,456.78"""
    rounded = round_money(amount)
    is_negative = rounded < 0
    abs_amount = abs(rounded)

    # Convert to string, split at decimal
    amount_str = f"{abs_amount:.2f}"
    integer_part, decimal_part = amount_str.split(".")

    # Indian number system: last 3 digits, then groups of 2
    if len(integer_part) <= 3:
        formatted = integer_part
    else:
        last_three = integer_part[-3:]
        remaining = integer_part[:-3]
        # Add commas every 2 digits from right in remaining
        groups = []
        while len(remaining) > 2:
            groups.append(remaining[-2:])
            remaining = remaining[:-2]
        if remaining:
            groups.append(remaining)
        formatted = ",".join(reversed(groups)) + "," + last_three

    sign = "-" if is_negative else ""
    return f"{sign}₹{formatted}.{decimal_part}"


def calculate_percentage(part: Decimal, total: Decimal, decimal_places: int = 2) -> Decimal:
    """Calculate percentage safely, returns 0 if total is 0."""
    if total == 0:
        return Decimal("0")
    result = (part / total) * Decimal("100")
    return round_money(result, decimal_places)


def calculate_emi(principal: Decimal, annual_rate: Decimal, months: int) -> Decimal:
    """Calculate EMI using reducing balance method: P * r * (1+r)^n / ((1+r)^n - 1)"""
    if annual_rate == 0:
        return round_money(principal / months)
    monthly_rate = annual_rate / Decimal("100") / Decimal("12")
    n = months
    numerator = principal * monthly_rate * (1 + monthly_rate) ** n
    denominator = (1 + monthly_rate) ** n - 1
    return round_money(numerator / denominator)
