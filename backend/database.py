from __future__ import annotations

from contextlib import contextmanager
import json
import sqlite3
from typing import Any, Iterator
from .config import BASE_DIR, Settings

SCHEMA_PATH = BASE_DIR / "sql" / "schema.sql"
SEED_PATH = BASE_DIR / "sql" / "seed.sql"

DEFAULT_SITE_SETTINGS: dict[str, tuple[dict[str, Any], int]] = {
    "theme": ({
        "primary": "#173d2b",
        "accent": "#ef7d22",
        "secondary": "#825334",
        "surface": "#f7f7f2",
        "logo_variant": "orange",
    }, 1),
    "brand": ({
        "name": "Tips",
        "currency": "USD",
        "country": "SV",
    }, 1),
    "home": ({
        "eyebrow": "Arquitectura · objetos · interiores",
        "title": "TIPS QUE",
        "highlight": "INSPIRAN",
        "description": "Ideas y soluciones para diseñar mejores espacios, crear objetos útiles y convertir cada proyecto en una experiencia clara y personal.",
        "primary_cta": "Explorar Tips",
        "secondary_cta": "Ver productos",
    }, 1),
    "contact": ({
        "location": "San Salvador, El Salvador",
        "email": "",
        "whatsapp": "",
        "instagram": "",
        "facebook": "",
    }, 1),
}


class ClosingConnection(sqlite3.Connection):
    """SQLite connection whose context manager also releases the file handle."""

    def __exit__(self, exc_type, exc_value, traceback) -> bool:
        try:
            return super().__exit__(exc_type, exc_value, traceback)
        finally:
            self.close()


def connect(settings: Settings) -> sqlite3.Connection:
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(
        settings.database_path,
        timeout=10,
        isolation_level=None,
        check_same_thread=False,
        factory=ClosingConnection,
    )
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    connection.execute("PRAGMA synchronous = NORMAL")
    connection.execute("PRAGMA busy_timeout = 5000")
    return connection


@contextmanager
def transaction(settings: Settings) -> Iterator[sqlite3.Connection]:
    connection = connect(settings)
    try:
        connection.execute("BEGIN IMMEDIATE")
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize(settings: Settings) -> None:
    schema = SCHEMA_PATH.read_text(encoding="utf-8")
    with connect(settings) as connection:
        connection.executescript(schema)
        count = connection.execute("SELECT COUNT(*) FROM products").fetchone()[0]
        if count == 0 and SEED_PATH.exists():
            connection.executescript(SEED_PATH.read_text(encoding="utf-8"))
        for key, (value, is_public) in DEFAULT_SITE_SETTINGS.items():
            connection.execute(
                "INSERT OR IGNORE INTO site_settings(key,value_json,is_public) VALUES(?,?,?)",
                (key, json.dumps(value, ensure_ascii=False, separators=(",", ":")), is_public),
            )


def fetch_all(settings: Settings, query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    with connect(settings) as connection:
        rows = connection.execute(query, params).fetchall()
    return [dict(row) for row in rows]
