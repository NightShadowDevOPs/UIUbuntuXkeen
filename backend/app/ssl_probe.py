from __future__ import annotations

import hashlib
import socket
import ssl
import time
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


def _build_context(*, verify: bool, tls12_only: bool = False) -> ssl.SSLContext:
    if verify:
        context = ssl.create_default_context()
        context.check_hostname = True
        context.verify_mode = ssl.CERT_REQUIRED
    else:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
    if tls12_only:
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.maximum_version = ssl.TLSVersion.TLSv1_2
    return context


def _route_mode_label(route_mode: str, bind_interface: str, bind_source_ip: str) -> str:
    normalized = str(route_mode or "system-route").strip().lower()
    if normalized == "forced-direct" and (bind_interface or bind_source_ip):
        return "forced-direct"
    return "system-route"


def _bind_socket_route(sock: socket.socket, family: int, *, bind_interface: str, bind_source_ip: str) -> None:
    if bind_interface and hasattr(socket, 'SO_BINDTODEVICE'):
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BINDTODEVICE, bind_interface.encode() + b'\0')
    if not bind_source_ip:
        return
    source_ip = str(bind_source_ip or '').strip()
    if not source_ip:
        return
    if family == socket.AF_INET:
        if ':' in source_ip:
            raise OSError(f'source-ip-family-mismatch:{source_ip}')
        sock.bind((source_ip, 0))
        return
    if family == socket.AF_INET6:
        if ':' not in source_ip:
            raise OSError(f'source-ip-family-mismatch:{source_ip}')
        sock.bind((source_ip, 0, 0, 0))


def _open_tcp_socket(host: str, port: int, timeout: float, *, bind_interface: str, bind_source_ip: str) -> socket.socket:
    last_error: Exception | None = None
    addrinfos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    for family, socktype, proto, _canonname, sockaddr in addrinfos:
        sock = socket.socket(family, socktype, proto)
        try:
            sock.settimeout(timeout)
            _bind_socket_route(sock, family, bind_interface=bind_interface, bind_source_ip=bind_source_ip)
            sock.connect(sockaddr)
            return sock
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            try:
                sock.close()
            except Exception:
                pass
    if last_error is not None:
        raise last_error
    raise OSError('socket-connect-failed')


def _read_cert(
    host: str,
    port: int,
    timeout: float,
    *,
    verify: bool,
    send_sni: bool,
    tls12_only: bool = False,
    route_mode: str = 'system-route',
    bind_interface: str = '',
    bind_source_ip: str = '',
):
    context = _build_context(verify=verify, tls12_only=tls12_only)
    server_hostname = host if send_sni else None
    effective_route_mode = _route_mode_label(route_mode, bind_interface, bind_source_ip)
    with _open_tcp_socket(
        host,
        port,
        timeout,
        bind_interface=bind_interface if effective_route_mode == 'forced-direct' else '',
        bind_source_ip=bind_source_ip if effective_route_mode == 'forced-direct' else '',
    ) as sock:
        sock.settimeout(timeout)
        with context.wrap_socket(sock, server_hostname=server_hostname) as tls:
            cert = tls.getpeercert()
            cert_bin = tls.getpeercert(binary_form=True)
    return cert, cert_bin


def probe_panel_ssl(
    panel_url: str,
    timeout: float = 8.0,
    *,
    route_mode: str = 'system-route',
    bind_interface: str = '',
    bind_source_ip: str = '',
) -> dict:
    normalized_url = _normalize_url(panel_url)
    effective_route_mode = _route_mode_label(route_mode, bind_interface, bind_source_ip)
    route_info = {
        'routeMode': effective_route_mode,
        'bindInterface': bind_interface if effective_route_mode == 'forced-direct' else '',
        'bindSourceIp': bind_source_ip if effective_route_mode == 'forced-direct' else '',
    }
    if not normalized_url:
        return {
            'status': 'missing-url',
            'panel_url': '',
            'error_text': 'missing-panel-url',
            'probe_route': effective_route_mode,
            'raw_payload': route_info,
        }

    parsed = urlparse(normalized_url)
    host = parsed.hostname or ''
    scheme = (parsed.scheme or 'https').lower()
    port = parsed.port or (443 if scheme == 'https' else 80)
    if not host:
        return {
            'status': 'invalid-url',
            'panel_url': normalized_url,
            'error_text': 'invalid-panel-url',
            'probe_route': effective_route_mode,
            'raw_payload': route_info,
        }
    if scheme != 'https':
        return {
            'status': 'unsupported-scheme',
            'panel_url': normalized_url,
            'error_text': f'unsupported-scheme:{scheme}',
            'probe_route': effective_route_mode,
            'raw_payload': route_info,
        }

    checked_at = datetime.now(timezone.utc).replace(microsecond=0)
    verify_error = ''
    cert = None
    cert_bin = None
    attempts: list[dict] = []
    deadline = time.monotonic() + max(3.0, float(timeout or 8.0))

    def next_timeout() -> float:
        remaining = deadline - time.monotonic()
        return max(1.2, min(4.5, remaining))

    def remember_attempt(*, stage: str, verify: bool, send_sni: bool, tls12_only: bool, error: str = '') -> None:
        attempts.append(
            {
                'stage': stage,
                'verify': verify,
                'sendSni': send_sni,
                'tls12Only': tls12_only,
                'error': error,
                **route_info,
            }
        )

    probe_plan = [
        {'stage': 'verify', 'verify': True, 'send_sni': True, 'tls12_only': False},
        {'stage': 'insecure-sni', 'verify': False, 'send_sni': True, 'tls12_only': False},
        {'stage': 'insecure-no-sni', 'verify': False, 'send_sni': False, 'tls12_only': False},
        {'stage': 'insecure-sni-tls12', 'verify': False, 'send_sni': True, 'tls12_only': True},
        {'stage': 'insecure-no-sni-tls12', 'verify': False, 'send_sni': False, 'tls12_only': True},
    ]
    last_error = ''
    for plan in probe_plan:
        remaining = deadline - time.monotonic()
        if remaining <= 0.2:
            break
        attempt_timeout = next_timeout()
        try:
            cert, cert_bin = _read_cert(
                host,
                port,
                attempt_timeout,
                verify=bool(plan['verify']),
                send_sni=bool(plan['send_sni']),
                tls12_only=bool(plan['tls12_only']),
                route_mode=effective_route_mode,
                bind_interface=route_info['bindInterface'],
                bind_source_ip=route_info['bindSourceIp'],
            )
            remember_attempt(
                stage=str(plan['stage']),
                verify=bool(plan['verify']),
                send_sni=bool(plan['send_sni']),
                tls12_only=bool(plan['tls12_only']),
            )
            if bool(plan['verify']):
                verify_error = ''
            elif not verify_error:
                verify_error = last_error
            break
        except Exception as exc:  # noqa: BLE001
            err = str(exc)
            last_error = err
            if bool(plan['verify']):
                verify_error = err
            remember_attempt(
                stage=str(plan['stage']),
                verify=bool(plan['verify']),
                send_sni=bool(plan['send_sni']),
                tls12_only=bool(plan['tls12_only']),
                error=err,
            )
    if cert is None:
        return {
            'status': 'error',
            'panel_url': normalized_url,
            'checked_at': checked_at.isoformat().replace('+00:00', 'Z'),
            'expires_at': '',
            'valid_from': '',
            'days_left': None,
            'issuer': '',
            'subject': '',
            'san': '',
            'fingerprint_sha256': '',
            'verify_error': verify_error,
            'error_text': last_error,
            'probe_route': effective_route_mode,
            'raw_payload': {
                'host': host,
                'port': port,
                'verifyError': verify_error,
                'error': last_error,
                'attempts': attempts,
                **route_info,
            },
        }

    payload = _extract_cert_payload(cert or {}, cert_bin, host=host, port=port)
    expires_raw = payload.get('expires_at') or ''
    days_left = None
    if expires_raw:
        expires_at = datetime.fromisoformat(expires_raw.replace('Z', '+00:00'))
        days_left = int((expires_at - checked_at).total_seconds() // 86400)

    status = 'ok'
    if days_left is not None and days_left < 0:
        status = 'expired'

    return {
        'status': status,
        'panel_url': normalized_url,
        'checked_at': checked_at.isoformat().replace('+00:00', 'Z'),
        'expires_at': payload.get('expires_at') or '',
        'valid_from': payload.get('valid_from') or '',
        'days_left': days_left,
        'issuer': payload.get('issuer') or '',
        'subject': payload.get('subject') or '',
        'san': payload.get('san') or '',
        'fingerprint_sha256': payload.get('fingerprint_sha256') or '',
        'verify_error': verify_error,
        'error_text': '',
        'probe_route': effective_route_mode,
        'raw_payload': {
            **(payload.get('raw_payload') or {}),
            'verifyError': verify_error,
            'attempts': attempts,
            **route_info,
        },
    }
