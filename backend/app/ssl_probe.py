from __future__ import annotations

import hashlib
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


def _extract_cert_payload(cert: dict, cert_bin: bytes | None, *, host: str, port: int) -> dict:
    not_before_raw = cert.get("notBefore")
    not_after_raw = cert.get("notAfter")
    valid_from = parsedate_to_datetime(not_before_raw).astimezone(timezone.utc) if not_before_raw else None
    expires_at = parsedate_to_datetime(not_after_raw).astimezone(timezone.utc) if not_after_raw else None
    issuer_parts = ["=".join(part) for entry in cert.get("issuer", []) for part in entry]
    subject_parts = ["=".join(part) for entry in cert.get("subject", []) for part in entry]
    san_parts = [
        value for key, value in cert.get("subjectAltName", []) if key in {"DNS", "IP Address", "IP"}
    ]
    fingerprint_sha256 = hashlib.sha256(cert_bin).hexdigest().upper() if cert_bin else ""
    return {
        "host": host,
        "port": port,
        "issuer": ", ".join(issuer_parts),
        "subject": ", ".join(subject_parts),
        "san": ", ".join(str(v) for v in san_parts if str(v).strip()),
        "valid_from": valid_from.replace(microsecond=0).isoformat().replace("+00:00", "Z") if valid_from else "",
        "expires_at": expires_at.replace(microsecond=0).isoformat().replace("+00:00", "Z") if expires_at else "",
        "fingerprint_sha256": fingerprint_sha256,
        "raw_payload": {
            "host": host,
            "port": port,
            "issuer": cert.get("issuer", []),
            "subject": cert.get("subject", []),
            "subjectAltName": cert.get("subjectAltName", []),
            "notBefore": not_before_raw,
            "notAfter": not_after_raw,
            "fingerprintSha256": fingerprint_sha256,
        },
    }


def _read_cert(host: str, port: int, timeout: float, *, verify: bool):
    if verify:
        context = ssl.create_default_context()
        context.check_hostname = True
        context.verify_mode = ssl.CERT_REQUIRED
    else:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
    with socket.create_connection((host, port), timeout=timeout) as sock:
        with context.wrap_socket(sock, server_hostname=host if verify else None) as tls:
            cert = tls.getpeercert()
            cert_bin = tls.getpeercert(binary_form=True)
    return cert, cert_bin


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

    checked_at = datetime.now(timezone.utc).replace(microsecond=0)
    verify_error = ""
    cert = None
    cert_bin = None
    try:
        cert, cert_bin = _read_cert(host, port, timeout, verify=True)
    except Exception as exc:  # noqa: BLE001
        verify_error = str(exc)
        try:
            cert, cert_bin = _read_cert(host, port, timeout, verify=False)
        except Exception as exc2:  # noqa: BLE001
            return {
                "status": "error",
                "panel_url": normalized_url,
                "checked_at": checked_at.isoformat().replace("+00:00", "Z"),
                "expires_at": "",
                "valid_from": "",
                "days_left": None,
                "issuer": "",
                "subject": "",
                "san": "",
                "fingerprint_sha256": "",
                "verify_error": verify_error,
                "error_text": str(exc2),
                "raw_payload": {
                    "host": host,
                    "port": port,
                    "verifyError": verify_error,
                    "error": str(exc2),
                },
            }

    payload = _extract_cert_payload(cert or {}, cert_bin, host=host, port=port)
    expires_raw = payload.get("expires_at") or ""
    days_left = None
    if expires_raw:
        expires_at = datetime.fromisoformat(expires_raw.replace("Z", "+00:00"))
        days_left = int((expires_at - checked_at).total_seconds() // 86400)

    status = "ok"
    if days_left is not None and days_left < 0:
        status = "expired"

    return {
        "status": status,
        "panel_url": normalized_url,
        "checked_at": checked_at.isoformat().replace("+00:00", "Z"),
        "expires_at": payload.get("expires_at") or "",
        "valid_from": payload.get("valid_from") or "",
        "days_left": days_left,
        "issuer": payload.get("issuer") or "",
        "subject": payload.get("subject") or "",
        "san": payload.get("san") or "",
        "fingerprint_sha256": payload.get("fingerprint_sha256") or "",
        "verify_error": verify_error,
        "error_text": "",
        "raw_payload": {
            **(payload.get("raw_payload") or {}),
            "verifyError": verify_error,
        },
    }
