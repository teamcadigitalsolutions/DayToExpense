"""
DayToExpense — Security: Password hashing + JWT token management
Uses Argon2id for password hashing with legacy SHA-256 support
"""
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from jose import JWTError, jwt

from backend.core.config import settings

# ─── Password Hashing (Argon2id) ─────────────────────────────────────────────
_ph = PasswordHasher(
    time_cost=2,
    memory_cost=65536,  # 64 MB
    parallelism=2,
    hash_len=32,
    salt_len=16,
    encoding="utf-8",
)


def hash_password(plain_password: str) -> str:
    """Hash a plain-text password using Argon2id."""
    return _ph.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify password against an Argon2id hash.
    Also checks SHA-256 for migrated legacy passwords from the old desktop app.
    """
    try:
        return _ph.verify(hashed_password, plain_password)
    except VerifyMismatchError:
        return False
    except (VerificationError, InvalidHashError):
        try:
            import hashlib
            sha256_hash = hashlib.sha256(plain_password.encode()).hexdigest()
            return sha256_hash == hashed_password
        except Exception:
            return False


def password_needs_rehash(hashed_password: str) -> bool:
    """Check if a password hash needs to be upgraded."""
    try:
        return _ph.check_needs_rehash(hashed_password)
    except Exception:
        return True


# ─── JWT Token Management ─────────────────────────────────────────────────────
def create_access_token(
    data: dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))

    to_encode.update({
        "exp": expire,
        "iat": now,
        "type": "access",
    })
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(
    data: dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a JWT refresh token."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(days=settings.refresh_token_expire_days))

    to_encode.update({
        "exp": expire,
        "iat": now,
        "type": "refresh",
    })
    return jwt.encode(
        to_encode, settings.jwt_refresh_secret_key, algorithm=settings.jwt_algorithm
    )


def decode_access_token(token: str) -> Optional[dict[str, Any]]:
    """Decode and validate a JWT access token. Returns None if invalid."""
    try:
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None


def decode_refresh_token(token: str) -> Optional[dict[str, Any]]:
    """Decode and validate a JWT refresh token. Returns None if invalid."""
    try:
        payload = jwt.decode(
            token, settings.jwt_refresh_secret_key, algorithms=[settings.jwt_algorithm]
        )
        if payload.get("type") != "refresh":
            return None
        return payload
    except JWTError:
        return None


def get_token_subject(token: str) -> Optional[str]:
    """Extract the subject (user_id) from a token without full validation."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"verify_exp": False},
        )
        return payload.get("sub")
    except JWTError:
        return None
