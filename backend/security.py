from __future__ import annotations

from collections import defaultdict, deque
import base64
import hashlib
import hmac
import secrets
import threading
import time
from typing import Deque

PBKDF2_ITERATIONS = 600_000
CSRF_MAX_AGE_SECONDS = 7200


def _b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def hash_password(password: str) -> str:
    if len(password) < 12:
        raise ValueError("La contraseña debe tener al menos 12 caracteres.")
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${_b64encode(salt)}${_b64encode(digest)}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations_raw, salt_raw, digest_raw = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        iterations = int(iterations_raw)
        if iterations < 100000 or iterations > 2000000:
            return False
        salt, expected = _b64decode(salt_raw), _b64decode(digest_raw)
    except (ValueError, TypeError):
        return False
    candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return hmac.compare_digest(candidate, expected)


def new_session_token() -> str:
    return _b64encode(secrets.token_bytes(32))


def session_token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def create_csrf_token(session_token: str, secret_key: str, now: int | None = None) -> str:
    timestamp = int(time.time() if now is None else now)
    nonce = secrets.token_urlsafe(16)
    payload = f"{timestamp}.{nonce}"
    signature = hmac.new(secret_key.encode(), f"{session_token}.{payload}".encode(), hashlib.sha256).digest()
    return f"{payload}.{_b64encode(signature)}"


def verify_csrf_token(token: str, session_token: str, secret_key: str, *, max_age_seconds: int = CSRF_MAX_AGE_SECONDS, now: int | None = None) -> bool:
    try:
        timestamp_raw, nonce, signature_raw = token.split(".", 2)
        timestamp = int(timestamp_raw)
        supplied = _b64decode(signature_raw)
    except (ValueError, TypeError):
        return False
    current = int(time.time() if now is None else now)
    if timestamp > current + 60 or current - timestamp > max_age_seconds:
        return False
    payload = f"{timestamp}.{nonce}"
    expected = hmac.new(secret_key.encode(), f"{session_token}.{payload}".encode(), hashlib.sha256).digest()
    return hmac.compare_digest(supplied, expected)


def security_headers() -> dict[str, str]:
    return {
        "Content-Security-Policy": "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(self)",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
    }


def is_allowed_origin(origin: str | None, allowed_origins: tuple[str, ...]) -> bool:
    return not origin or origin.rstrip("/") in allowed_origins


def validate_search_term(value: str, max_length: int = 80) -> str:
    cleaned = value.strip()
    if len(cleaned) > max_length or any(ord(char) < 32 for char in cleaned):
        raise ValueError("El texto de búsqueda es inválido o demasiado largo.")
    return cleaned


class RateLimiter:
    def __init__(self, limit: int, window_seconds: int = 60) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._events: dict[str, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str, now: float | None = None) -> bool:
        current = time.monotonic() if now is None else now
        cutoff = current - self.window_seconds
        with self._lock:
            events = self._events[key]
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= self.limit:
                return False
            events.append(current)
            return True
