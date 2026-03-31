from __future__ import annotations

import socket
import ssl
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlparse


def _normalize_url(raw_url: str) -> str:
    url = str(raw_url or "").strip()
    if not url:
        return ""
    if "://" not in url:
        url = f"https://{url}"
    return url


def probe_panel_ssl(panel_url: str, timeout: float = 8.0) -> dict:
    normalized_url = _normalize_url(panel_url)
    if not normalized_url:
        return {
            "status": "missing-url",
            "panel_url": "",
            "error_text": "missing-panel-url",
        }

    parsed = urlparse(normalized_url)
    host = parsed.hostname or ""
    scheme = (parsed.scheme or "https").lower()
    port = parsed.port or (443 if scheme == "https" else 80)
    if not host:
        return {
            "status": "invalid-url",
            "panel_url": normalized_url,
            "error_text": "invalid-panel-url",
        }
    if scheme != "https":
        return {
            "status": "unsupported-scheme",
            "panel_url": normalized_url,
            "error_text": f"unsupported-scheme:{scheme}",
        }

    context = ssl.create_default_context()
    context.check_hostname = True
    context.verify_mode = ssl.CERT_REQUIRED

    checked_at = datetime.now(timezone.utc).replace(microsecond=0)
    try:
        with socket.create_connection((host, port), timeout=timeout) as sock:
            with context.wrap_socket(sock, server_hostname=host) as tls:
                cert = tls.getpeercert()
        not_after_raw = cert.get("notAfter")
        expires_at = parsedate_to_datetime(not_after_raw).astimezone(timezone.utc) if not_after_raw else None
        days_left = None
        if expires_at is not None:
            days_left = max(0, int((expires_at - checked_at).total_seconds() // 86400))
        issuer_parts = ["=".join(part) for entry in cert.get("issuer", []) for part in entry]
        subject_parts = ["=".join(part) for entry in cert.get("subject", []) for part in entry]
        san_parts = [value for key, value in cert.get("subjectAltName", []) if key == "DNS"]
        return {
            "status": "ok",
            "panel_url": normalized_url,
            "checked_at": checked_at.isoformat().replace("+00:00", "Z"),
            "expires_at": expires_at.replace(microsecond=0).isoformat().replace("+00:00", "Z") if expires_at else "",
            "days_left": days_left,
            "issuer": ", ".join(issuer_parts),
            "subject": ", ".join(subject_parts),
            "san": ", ".join(san_parts),
            "error_text": "",
            "raw_payload": {
                "host": host,
                "port": port,
                "issuer": cert.get("issuer", []),
                "subject": cert.get("subject", []),
                "subjectAltName": cert.get("subjectAltName", []),
                "notAfter": not_after_raw,
            },
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "status": "error",
            "panel_url": normalized_url,
            "checked_at": checked_at.isoformat().replace("+00:00", "Z"),
            "expires_at": "",
            "days_left": None,
            "issuer": "",
            "subject": "",
            "san": "",
            "error_text": str(exc),
            "raw_payload": {
                "host": host,
                "port": port,
                "error": str(exc),
            },
        }
