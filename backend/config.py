from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os
import secrets

BASE_DIR = Path(__file__).resolve().parent.parent


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on", "si", "sí"}


def _as_int(name: str, default: int, minimum: int, maximum: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    value = int(raw)
    if not minimum <= value <= maximum:
        raise ValueError(f"{name} debe estar entre {minimum} y {maximum}.")
    return value


def _origins() -> tuple[str, ...]:
    raw = os.getenv("TIPS_ALLOWED_ORIGINS", "http://127.0.0.1:8000,http://localhost:8000")
    return tuple(origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip())


@dataclass(frozen=True)
class Settings:
    environment: str
    host: str
    port: int
    database_path: Path
    allowed_origins: tuple[str, ...]
    secret_key: str
    secure_cookies: bool
    session_ttl_seconds: int
    max_request_bytes: int
    rate_limit_per_minute: int

    @classmethod
    def load(cls) -> "Settings":
        environment = os.getenv("TIPS_ENV", "development").strip().lower()
        supplied_secret = os.getenv("TIPS_SECRET_KEY")
        if environment == "production" and not supplied_secret:
            raise RuntimeError("TIPS_SECRET_KEY es obligatorio en producción.")
        database_raw = os.getenv("TIPS_DB_PATH")
        database_path = Path(database_raw).expanduser() if database_raw else BASE_DIR / "data" / "tips.db"
        if not database_path.is_absolute():
            database_path = BASE_DIR / database_path
        return cls(
            environment=environment,
            host=os.getenv("TIPS_HOST", "127.0.0.1"),
            port=_as_int("TIPS_PORT", 8000, 1, 65535),
            database_path=database_path,
            allowed_origins=_origins(),
            secret_key=supplied_secret or secrets.token_urlsafe(48),
            secure_cookies=_as_bool(os.getenv("TIPS_SECURE_COOKIES"), environment == "production"),
            session_ttl_seconds=_as_int("TIPS_SESSION_TTL_SECONDS", 28800, 900, 2592000),
            max_request_bytes=_as_int("TIPS_MAX_REQUEST_BYTES", 1048576, 16384, 10485760),
            rate_limit_per_minute=_as_int("TIPS_RATE_LIMIT_PER_MINUTE", 120, 10, 10000),
        )
