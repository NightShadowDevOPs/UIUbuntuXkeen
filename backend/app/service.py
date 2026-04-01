from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import Settings
from .db import get_conn, init_db, json_dumps, row_to_dict, utc_now
from .ssl_probe import probe_panel_ssl


def _ts_to_sec(value: str | None) -> int:
    if not value:
        return 0
    try:
        return int(datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp())
    except ValueError:
        return 0


class BackendService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.settings.ensure_dirs()
        init_db(self.settings.db_path)
        with get_conn(self.settings.db_path) as conn:
            conn.execute(
                "UPDATE service_settings SET value=?, updated_at=? WHERE key='provider_checks_interval_secs'",
                (str(self.settings.ssl_interval_secs), utc_now()),
            )
            conn.execute(
                "UPDATE service_settings SET value=?, updated_at=? WHERE key='provider_ssl_warn_days'",
                (str(self.settings.ssl_warn_days), utc_now()),
            )
        self._checks_lock = threading.Lock()

    def health(self) -> dict[str, Any]:
        db_ok = False
        with get_conn(self.settings.db_path) as conn:
            conn.execute("SELECT 1")
            db_ok = True
        return {
            "ok": db_ok,
            "service": self.settings.app_name,
            "version": self.settings.app_version,
            "db": {"ok": db_ok, "path": str(self.settings.db_path)},
            "scheduler": {
                "sslIntervalSecs": self.settings.ssl_interval_secs,
                "sslWarnDays": self.ssl_warn_days(),
                "running": self.is_provider_checks_running(),
                "lastRunAt": self.get_setting("provider_checks_last_run_at", ""),
                "lastReason": self.get_setting("provider_checks_last_reason", ""),
            },
        }

    def version_payload(self) -> dict[str, Any]:
        return {
            "ok": True,
            "version": self.settings.app_version,
            "service": self.settings.app_name,
            "runtime": "ubuntu-service",
        }

    def capabilities_payload(self) -> dict[str, Any]:
        return {"ok": True, **self.settings.capabilities}

    def status_payload(self) -> dict[str, Any]:
        providers = self.list_providers()
        users = self.list_users_inventory()["items"]
        ssl_state = self.provider_ssl_cache_status()
        return {
            "ok": True,
            "service": {
                "name": self.settings.app_name,
                "version": self.settings.app_version,
                "runtime": "ubuntu-service",
                "dbPath": str(self.settings.db_path),
                "runtimeDir": str(self.settings.runtime_dir),
                "logDir": str(self.settings.log_dir),
            },
            "host": {
                "hostname": self._read_hostname(),
                "kernel": self._read_kernel(),
            },
            "counts": {
                "providers": len(providers),
                "usersInventory": len(users),
            },
            "sslCache": ssl_state,
            "sslWarnDays": self.ssl_warn_days(),
            "jobs": self.list_jobs(),
        }

    def ssl_warn_days(self) -> int:
        raw = self.get_setting("provider_ssl_warn_days", str(self.settings.ssl_warn_days))
        try:
            return max(0, int(raw))
        except ValueError:
            return max(0, int(self.settings.ssl_warn_days))

    def provider_checks_due(self) -> bool:
        providers = [p for p in self.list_providers() if bool(p.get("enabled", True))]
        if not providers:
            return False
        last_run_sec = _ts_to_sec(self.get_setting("provider_checks_last_run_at", ""))
        now_sec = int(datetime.now(timezone.utc).timestamp())
        if not last_run_sec or (now_sec - last_run_sec) >= self.settings.ssl_interval_secs:
            return True
        with get_conn(self.settings.db_path) as conn:
            rows = conn.execute(
                "SELECT provider_name, panel_url, checked_at FROM provider_ssl_state"
            ).fetchall()
        by_name = {str(row["provider_name"]): row_to_dict(row) for row in rows}
        for provider in providers:
            state = by_name.get(str(provider["name"]))
            if not state:
                return True
            if str(state.get("panel_url") or "").strip() != str(provider.get("panelUrl") or "").strip():
                return True
            if not str(state.get("checked_at") or "").strip():
                return True
        return False

    def _classify_ssl_status(self, *, days_left: Any, expires_at: str, error_text: str) -> str:
        try:
            days = int(days_left) if days_left is not None else None
        except Exception:
            days = None
        if expires_at and days is not None:
            if days < 0:
                return "expired"
            if days <= self.ssl_warn_days():
                return "warning"
            return "ok"
        return "error" if str(error_text or "").strip() else "unknown"

    def list_providers(self) -> list[dict[str, Any]]:
        with get_conn(self.settings.db_path) as conn:
            rows = conn.execute(
                "SELECT name, panel_url, enabled, created_at, updated_at FROM provider_hosts ORDER BY name COLLATE NOCASE ASC"
            ).fetchall()
        return [
            {
                "name": str(row["name"]),
                "panelUrl": str(row["panel_url"]),
                "enabled": bool(row["enabled"]),
                "createdAt": str(row["created_at"]),
                "updatedAt": str(row["updated_at"]),
            }
            for row in rows
        ]

    def replace_providers(self, providers: list[dict[str, Any]]) -> list[dict[str, Any]]:
        now = utc_now()
        cleaned: list[dict[str, Any]] = []
        seen: set[str] = set()
        for item in providers:
            name = str(item.get("name") or "").strip()
            panel_url = str(item.get("panelUrl") or item.get("url") or "").strip()
            if not name or not panel_url or name in seen:
                continue
            cleaned.append(
                {
                    "name": name,
                    "panelUrl": panel_url,
                    "enabled": bool(item.get("enabled", True)),
                }
            )
            seen.add(name)
        with get_conn(self.settings.db_path) as conn:
            conn.execute("DELETE FROM provider_hosts")
            for item in cleaned:
                conn.execute(
                    "INSERT INTO provider_hosts(name, panel_url, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                    (item["name"], item["panelUrl"], 1 if item["enabled"] else 0, now, now),
                )
            self._log_event(conn, "providers.replaced", "providers", "providers", f"Providers replaced: {len(cleaned)}", cleaned)
        return self.list_providers()

    def list_users_inventory(self) -> dict[str, Any]:
        with get_conn(self.settings.db_path) as conn:
            rows = conn.execute(
                "SELECT ip, mac, display_name, hostname, source, proxy_access, updated_at FROM users_inventory ORDER BY ip ASC"
            ).fetchall()
        return {
            "items": [
                {
                    "ip": str(row["ip"]),
                    "key": str(row["ip"]),
                    "mac": str(row["mac"] or ""),
                    "label": str(row["display_name"] or ""),
                    "hostname": str(row["hostname"] or ""),
                    "source": str(row["source"] or ""),
                    "proxyAccess": bool(row["proxy_access"]),
                    "updatedAt": str(row["updated_at"]),
                }
                for row in rows
            ],
            "policyMode": self.get_setting("users_inventory_policy_mode", "allowAll") or "allowAll",
        }

    def replace_users_inventory(self, items: list[dict[str, Any]], policy_mode: str) -> dict[str, Any]:
        now = utc_now()
        cleaned: list[dict[str, Any]] = []
        seen: set[str] = set()
        for item in items:
            ip = str(item.get("ip") or item.get("key") or "").strip()
            if not ip or ip in seen:
                continue
            cleaned.append(
                {
                    "ip": ip,
                    "mac": str(item.get("mac") or "").strip(),
                    "label": str(item.get("label") or item.get("displayName") or "").strip(),
                    "hostname": str(item.get("hostname") or "").strip(),
                    "source": str(item.get("source") or "").strip(),
                    "proxyAccess": bool(item.get("proxyAccess", True)),
                }
            )
            seen.add(ip)
        normalized_policy_mode = "allowListOnly" if str(policy_mode).strip() == "allowListOnly" else "allowAll"
        with get_conn(self.settings.db_path) as conn:
            conn.execute("DELETE FROM users_inventory")
            for item in cleaned:
                conn.execute(
                    "INSERT INTO users_inventory(ip, mac, display_name, hostname, source, proxy_access, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (
                        item["ip"],
                        item["mac"],
                        item["label"],
                        item["hostname"],
                        item["source"],
                        1 if item["proxyAccess"] else 0,
                        now,
                    ),
                )
            self.set_setting(conn, "users_inventory_policy_mode", normalized_policy_mode)
            self._log_event(conn, "users.replaced", "users_inventory", "inventory", f"Users inventory replaced: {len(cleaned)}", {"items": cleaned, "policyMode": normalized_policy_mode})
        return self.list_users_inventory()

    def provider_ssl_cache_status(self) -> dict[str, Any]:
        last_run_at = self.get_setting("provider_checks_last_run_at", "")
        next_run_sec = _ts_to_sec(last_run_at) + self.settings.ssl_interval_secs if last_run_at else 0
        with get_conn(self.settings.db_path) as conn:
            count_row = conn.execute("SELECT COUNT(*) AS count FROM provider_ssl_state").fetchone()
        checked_at_sec = _ts_to_sec(last_run_at)
        age_sec = max(0, int(datetime.now(timezone.utc).timestamp()) - checked_at_sec) if checked_at_sec else -1
        fresh = bool(checked_at_sec and age_sec >= 0 and age_sec <= self.settings.ssl_interval_secs)
        pending = self.provider_checks_due() and not self.is_provider_checks_running()
        return {
            "ok": True,
            "checkedAtSec": checked_at_sec,
            "sslCacheReady": bool((count_row["count"] if count_row else 0) >= 0),
            "sslCacheFresh": fresh,
            "sslRefreshing": self.is_provider_checks_running(),
            "sslRefreshPending": pending,
            "sslWarnDays": self.ssl_warn_days(),
            "sslCacheAgeSec": age_sec,
            "sslCacheNextRefreshAtSec": next_run_sec,
            "job": self.get_job("provider_ssl_checks"),
        }

    def provider_checks_payload(self) -> dict[str, Any]:
        providers = self.list_providers()
        with get_conn(self.settings.db_path) as conn:
            rows = conn.execute(
                "SELECT provider_name, panel_url, checked_at, status, expires_at, days_left, issuer, subject, san, valid_from, fingerprint_sha256, verify_error, error_text FROM provider_ssl_state"
            ).fetchall()
        by_name = {str(row["provider_name"]): row_to_dict(row) for row in rows}
        cache = self.provider_ssl_cache_status()
        merged: list[dict[str, Any]] = []
        for provider in providers:
            state = by_name.get(provider["name"], {})
            merged.append(
                {
                    "name": provider["name"],
                    "panelUrl": provider["panelUrl"],
                    "enabled": provider["enabled"],
                    "panelSslCheckedAtSec": _ts_to_sec(state.get("checked_at")),
                    "panelSslNotAfter": state.get("expires_at") or "",
                    "panelSslIssuer": state.get("issuer") or "",
                    "panelSslSubject": state.get("subject") or "",
                    "panelSslSan": state.get("san") or "",
                    "panelSslValidFrom": state.get("valid_from") or "",
                    "panelSslFingerprintSha256": state.get("fingerprint_sha256") or "",
                    "panelSslVerifyError": state.get("verify_error") or "",
                    "panelSslDaysLeft": state.get("days_left"),
                    "panelSslStatus": self._classify_ssl_status(days_left=state.get("days_left"), expires_at=str(state.get("expires_at") or ""), error_text=str(state.get("error_text") or "")),
                    "panelSslError": state.get("error_text") or "",
                    "jobStatus": str(cache.get("job", {}).get("status") or "").strip(),
                }
            )
        return {
            "ok": True,
            "providers": merged,
            "checkedAtSec": cache["checkedAtSec"],
            "nextCheckAtSec": cache.get("sslCacheNextRefreshAtSec", 0),
            "sslCacheReady": cache["sslCacheReady"],
            "sslCacheFresh": cache["sslCacheFresh"],
            "sslRefreshing": cache["sslRefreshing"],
            "sslRefreshPending": cache["sslRefreshPending"],
            "sslCacheAgeSec": cache["sslCacheAgeSec"],
            "sslCacheNextRefreshAtSec": cache["sslCacheNextRefreshAtSec"],
            "sslWarnDays": self.ssl_warn_days(),
            "job": cache["job"],
        }

    def provider_checks_history(self, provider_name: str = "", limit: int = 20) -> dict[str, Any]:
        provider_name = str(provider_name or "").strip()
        try:
            limit = max(1, min(200, int(limit)))
        except Exception:
            limit = 20
        query = (
            "SELECT provider_name, panel_url, checked_at, status, expires_at, days_left, issuer, subject, san, valid_from, fingerprint_sha256, verify_error, error_text FROM provider_ssl_checks "
        )
        params: list[Any] = []
        if provider_name:
            query += "WHERE provider_name = ? "
            params.append(provider_name)
        query += "ORDER BY checked_at DESC, id DESC LIMIT ?"
        params.append(limit)
        with get_conn(self.settings.db_path) as conn:
            rows = conn.execute(query, tuple(params)).fetchall()
        items: list[dict[str, Any]] = []
        for row in rows:
            item = row_to_dict(row)
            items.append(
                {
                    "provider": str(item.get("provider_name") or "").strip(),
                    "panelUrl": item.get("panel_url") or "",
                    "checkedAtSec": _ts_to_sec(item.get("checked_at")),
                    "status": self._classify_ssl_status(days_left=item.get("days_left"), expires_at=str(item.get("expires_at") or ""), error_text=str(item.get("error_text") or "")),
                    "expiresAt": item.get("expires_at") or "",
                    "validFrom": item.get("valid_from") or "",
                    "daysLeft": item.get("days_left"),
                    "issuer": item.get("issuer") or "",
                    "subject": item.get("subject") or "",
                    "san": item.get("san") or "",
                    "fingerprintSha256": item.get("fingerprint_sha256") or "",
                    "verifyError": item.get("verify_error") or "",
                    "error": item.get("error_text") or "",
                }
            )
        return {"ok": True, "provider": provider_name, "limit": limit, "items": items, "checks": items}

    def run_provider_checks(self, reason: str = "manual") -> dict[str, Any]:
        if not self._checks_lock.acquire(blocking=False):
            return self.provider_checks_payload()
        job_id = str(uuid.uuid4())
        started_at = utc_now()
        self.upsert_job(
            job_type="provider_ssl_checks",
            job_id=job_id,
            status="running",
            started_at=started_at,
            finished_at="",
            error_text="",
            payload={"reason": reason},
        )
        try:
            providers = self.list_providers()
            results: list[dict[str, Any]] = []
            with get_conn(self.settings.db_path) as conn:
                for provider in providers:
                    result = probe_panel_ssl(provider["panelUrl"])
                    checked_at = str(result.get("checked_at") or utc_now())
                    conn.execute(
                        "INSERT INTO provider_ssl_checks(provider_name, panel_url, checked_at, status, expires_at, days_left, issuer, subject, san, valid_from, fingerprint_sha256, verify_error, error_text, raw_payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        (
                            provider["name"],
                            result.get("panel_url") or provider["panelUrl"],
                            checked_at,
                            self._classify_ssl_status(days_left=result.get("days_left"), expires_at=str(result.get("expires_at") or ""), error_text=str(result.get("error_text") or "")),
                            result.get("expires_at") or "",
                            result.get("days_left"),
                            result.get("issuer") or "",
                            result.get("subject") or "",
                            result.get("san") or "",
                            result.get("valid_from") or "",
                            result.get("fingerprint_sha256") or "",
                            result.get("verify_error") or "",
                            result.get("error_text") or "",
                            json_dumps(result.get("raw_payload") or {}),
                        ),
                    )
                    conn.execute(
                        "INSERT INTO provider_ssl_state(provider_name, panel_url, checked_at, status, expires_at, days_left, issuer, subject, san, valid_from, fingerprint_sha256, verify_error, error_text, raw_payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(provider_name) DO UPDATE SET panel_url=excluded.panel_url, checked_at=excluded.checked_at, status=excluded.status, expires_at=excluded.expires_at, days_left=excluded.days_left, issuer=excluded.issuer, subject=excluded.subject, san=excluded.san, valid_from=excluded.valid_from, fingerprint_sha256=excluded.fingerprint_sha256, verify_error=excluded.verify_error, error_text=excluded.error_text, raw_payload=excluded.raw_payload",
                        (
                            provider["name"],
                            result.get("panel_url") or provider["panelUrl"],
                            checked_at,
                            self._classify_ssl_status(days_left=result.get("days_left"), expires_at=str(result.get("expires_at") or ""), error_text=str(result.get("error_text") or "")),
                            result.get("expires_at") or "",
                            result.get("days_left"),
                            result.get("issuer") or "",
                            result.get("subject") or "",
                            result.get("san") or "",
                            result.get("valid_from") or "",
                            result.get("fingerprint_sha256") or "",
                            result.get("verify_error") or "",
                            result.get("error_text") or "",
                            json_dumps(result.get("raw_payload") or {}),
                        ),
                    )
                    results.append({"provider": provider["name"], **result})
                self.set_setting(conn, "provider_checks_last_run_at", utc_now())
                self.set_setting(conn, "provider_checks_last_reason", reason)
                self._log_event(conn, "providers.ssl.refresh", "providers", "provider_ssl_checks", f"Provider SSL checks run ({reason})", results)
            self.upsert_job(
                job_type="provider_ssl_checks",
                job_id=job_id,
                status="ok",
                started_at=started_at,
                finished_at=utc_now(),
                error_text="",
                payload={"reason": reason, "resultCount": len(results)},
            )
        except Exception as exc:  # noqa: BLE001
            self.upsert_job(
                job_type="provider_ssl_checks",
                job_id=job_id,
                status="error",
                started_at=started_at,
                finished_at=utc_now(),
                error_text=str(exc),
                payload={"reason": reason},
            )
            raise
        finally:
            self._checks_lock.release()
        return self.provider_checks_payload()

    def is_provider_checks_running(self) -> bool:
        return self._checks_lock.locked()

    def list_jobs(self) -> list[dict[str, Any]]:
        with get_conn(self.settings.db_path) as conn:
            rows = conn.execute(
                "SELECT id, job_type, status, started_at, finished_at, updated_at, error_text, payload FROM jobs ORDER BY updated_at DESC"
            ).fetchall()
        return [
            {
                "id": str(row["id"]),
                "type": str(row["job_type"]),
                "status": str(row["status"]),
                "startedAt": str(row["started_at"] or ""),
                "finishedAt": str(row["finished_at"] or ""),
                "updatedAt": str(row["updated_at"]),
                "error": str(row["error_text"] or ""),
                "payload": json.loads(str(row["payload"] or "{}")),
            }
            for row in rows
        ]

    def get_job(self, job_type: str) -> dict[str, Any]:
        with get_conn(self.settings.db_path) as conn:
            row = conn.execute(
                "SELECT id, job_type, status, started_at, finished_at, updated_at, error_text, payload FROM jobs WHERE job_type=? ORDER BY updated_at DESC LIMIT 1",
                (job_type,),
            ).fetchone()
        if not row:
            return {}
        return {
            "id": str(row["id"]),
            "type": str(row["job_type"]),
            "status": str(row["status"]),
            "startedAt": str(row["started_at"] or ""),
            "finishedAt": str(row["finished_at"] or ""),
            "updatedAt": str(row["updated_at"]),
            "error": str(row["error_text"] or ""),
            "payload": json.loads(str(row["payload"] or "{}")),
        }

    def get_setting(self, key: str, default: str = "") -> str:
        with get_conn(self.settings.db_path) as conn:
            row = conn.execute("SELECT value FROM service_settings WHERE key=?", (key,)).fetchone()
        return str(row["value"]) if row else default

    def set_setting(self, conn, key: str, value: str) -> None:
        conn.execute(
            "INSERT INTO service_settings(key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
            (key, value, utc_now()),
        )

    def upsert_job(
        self,
        *,
        job_type: str,
        job_id: str,
        status: str,
        started_at: str,
        finished_at: str,
        error_text: str,
        payload: dict[str, Any],
    ) -> None:
        with get_conn(self.settings.db_path) as conn:
            conn.execute(
                "INSERT INTO jobs(id, job_type, status, started_at, finished_at, updated_at, error_text, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status=excluded.status, finished_at=excluded.finished_at, updated_at=excluded.updated_at, error_text=excluded.error_text, payload=excluded.payload",
                (job_id, job_type, status, started_at, finished_at or None, utc_now(), error_text or None, json_dumps(payload)),
            )

    def _log_event(self, conn, event_type: str, entity_type: str, entity_key: str, message: str, payload: Any) -> None:
        conn.execute(
            "INSERT INTO document_events(event_type, entity_type, entity_key, message, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (event_type, entity_type, entity_key, message, json_dumps(payload), utc_now()),
        )

    @staticmethod
    def _read_hostname() -> str:
        try:
            return Path("/etc/hostname").read_text(encoding="utf-8").strip()
        except OSError:
            return ""

    @staticmethod
    def _read_kernel() -> str:
        try:
            return Path("/proc/version").read_text(encoding="utf-8").strip()
        except OSError:
            return ""
