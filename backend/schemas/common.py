from typing import Generic, TypeVar, Optional, List
from pydantic import BaseModel, Field
from datetime import date

T = TypeVar("T")

class APIResponse(BaseModel, Generic[T]):
    status: int = 200
    isSuccess: bool = True
    message: str = "Success"
    data: Optional[T] = None

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    size: int
    pages: int

class DateRangeFilter(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    period: Optional[str] = Field(None, description="TODAY, WEEK, MONTH, YEAR, CUSTOM")

class ErrorResponse(BaseModel):
    status: int
    isSuccess: bool = False
    message: str
    data: Optional[dict] = None
