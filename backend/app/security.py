from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from math import ceil
from threading import Lock
from time import monotonic
from uuid import UUID, uuid4

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
import jwt
import bcrypt
from sqlalchemy.orm import Session

from .core.config import get_settings
from .db import get_db
from .models import User
from .request_context import set_authenticated_user

settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
MAX_PASSWORD_BYTES = 72
DUMMY_PASSWORD_HASH = "$2b$12$0M/wBl8aOIlvbC04cHQfaeD5BZv4lJrImupcN1EOFm1TXV59Sjfg6"
JWT_ISSUER = "interior-studio-api"
JWT_AUDIENCE = "interior-studio-web"


class AttemptLimiter:
    def __init__(self, max_attempts: int, window_seconds: int, max_keys: int = 10_000):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.max_keys = max_keys
        self._attempts: OrderedDict[str, tuple[int, float]] = OrderedDict()
        self._lock = Lock()

    def retry_after(self, key: str) -> int:
        now = monotonic()
        with self._lock:
            attempt = self._attempts.get(key)
            if not attempt:
                return 0
            count, reset_at = attempt
            if reset_at <= now:
                self._attempts.pop(key, None)
                return 0
            self._attempts.move_to_end(key)
            return max(1, ceil(reset_at - now)) if count >= self.max_attempts else 0

    def record_failure(self, key: str) -> int:
        now = monotonic()
        with self._lock:
            count, reset_at = self._attempts.get(
                key, (0, now + self.window_seconds)
            )
            if reset_at <= now:
                count, reset_at = 0, now + self.window_seconds
            self._attempts[key] = (count + 1, reset_at)
            self._attempts.move_to_end(key)
            while len(self._attempts) > self.max_keys:
                self._attempts.popitem(last=False)
            return max(1, ceil(reset_at - now)) if count + 1 >= self.max_attempts else 0

    def reset(self, key: str) -> None:
        with self._lock:
            self._attempts.pop(key, None)


login_attempts = AttemptLimiter(max_attempts=8, window_seconds=10 * 60)
overview_attempts = AttemptLimiter(max_attempts=8, window_seconds=10 * 60)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_bytes = plain_password.encode("utf-8")
    if len(password_bytes) > MAX_PASSWORD_BYTES:
        return False
    try:
        return bcrypt.checkpw(password_bytes, hashed_password.encode("utf-8"))
    except (TypeError, ValueError):
        return False


def hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")
    if not password_bytes or len(password_bytes) > MAX_PASSWORD_BYTES:
        raise ValueError("Password must be between 1 and 72 UTF-8 bytes.")
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")


def create_access_token(subject: str, expires_minutes: int | None = None) -> str:
    issued_at = datetime.now(timezone.utc)
    expires = issued_at + timedelta(
        minutes=expires_minutes or settings.access_token_expire_minutes
    )
    return jwt.encode(
        {
            "sub": subject,
            "iat": issued_at,
            "exp": expires,
            "iss": JWT_ISSUER,
            "aud": JWT_AUDIENCE,
            "jti": str(uuid4()),
        },
        settings.secret_key,
        algorithm="HS256",
    )


def access_token_subject(token: str) -> UUID:
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=["HS256"],
            audience=JWT_AUDIENCE,
            issuer=JWT_ISSUER,
            options={"require": ["sub", "iat", "exp", "iss", "aud", "jti"]},
        )
        return UUID(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise ValueError("Invalid access token") from exc


def get_current_user(request: Request, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="로그인이 필요합니다.", headers={"WWW-Authenticate": "Bearer"})
    try:
        subject_id = access_token_subject(token)
    except ValueError as exc:
        raise credentials_exception from exc
    user = db.get(User, subject_id)
    if not user or not user.is_active:
        raise credentials_exception
    request.state.user_id = str(user.id)
    route = request.scope.get("route")
    set_authenticated_user(str(user.id), getattr(route, "path", None))
    return user
