from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS provider_hosts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    panel_url TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_ssl_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_name TEXT NOT NULL,
    panel_url TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    status TEXT NOT NULL,
    expires_at TEXT,
    days_left INTEGER,
    issuer TEXT,
    subject TEXT,
    san TEXT,
    valid_from TEXT,
    fingerprint_sha256 TEXT,
    verify_error TEXT,
    error_text TEXT,
    raw_payload TEXT
);

CREATE TABLE IF NOT EXISTS provider_ssl_state (
    provider_name TEXT PRIMARY KEY,
    panel_url TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    status TEXT NOT NULL,
    expires_at TEXT,
    days_left INTEGER,
    issuer TEXT,
    subject TEXT,
    san TEXT,
    valid_from TEXT,
    fingerprint_sha256 TEXT,
    verify_error TEXT,
    error_text TEXT,
    raw_payload TEXT
);

CREATE TABLE IF NOT EXISTS users_inventory (
    ip TEXT PRIMARY KEY,
    mac TEXT,
    display_name TEXT,
    hostname TEXT,
    source TEXT,
    proxy_access INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    job_type TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    updated_at TEXT NOT NULL,
    error_text TEXT,
    payload TEXT
);

CREATE TABLE IF NOT EXISTS document_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_key TEXT,
    message TEXT NOT NULL,
    payload TEXT,
    created_at TEXT NOT NULL
);
"""


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_conn(db_path: Path) -> Iterator[sqlite3.Connection]:
    conn = connect(db_path)
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db(db_path: Path) -> None:
    with get_conn(db_path) as conn:
        conn.executescript(SCHEMA)
        migrations = [
            "ALTER TABLE provider_ssl_checks ADD COLUMN valid_from TEXT",
            "ALTER TABLE provider_ssl_checks ADD COLUMN fingerprint_sha256 TEXT",
            "ALTER TABLE provider_ssl_checks ADD COLUMN verify_error TEXT",
            "ALTER TABLE provider_ssl_state ADD COLUMN valid_from TEXT",
            "ALTER TABLE provider_ssl_state ADD COLUMN fingerprint_sha256 TEXT",
            "ALTER TABLE provider_ssl_state ADD COLUMN verify_error TEXT",
        ]
        for sql in migrations:
            try:
                conn.execute(sql)
            except sqlite3.OperationalError:
                pass
        now = utc_now()
        defaults = {
            "users_inventory_policy_mode": "allowAll",
            "provider_checks_interval_secs": "14400",
            "provider_checks_last_run_at": "",
            "provider_checks_last_reason": "",
            "provider_ssl_warn_days": "2",
        }
        for key, value in defaults.items():
            conn.execute(
                "INSERT OR IGNORE INTO service_settings(key, value, updated_at) VALUES (?, ?, ?)",
                (key, value, now),
            )


def row_to_dict(row: sqlite3.Row | None) -> dict:
    return dict(row) if row is not None else {}


def json_dumps(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=False)
