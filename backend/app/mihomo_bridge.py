from __future__ import annotations

import asyncio
import json
import socket
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import websockets
import yaml
from fastapi import WebSocket, WebSocketDisconnect


@dataclass(slots=True)
class MihomoController:
    http_base: str
    ws_base: str
    secret: str
    extra_http_bases: tuple[str, ...] = ()

    def build_http_url(self, path: str, query_items: Iterable[tuple[str, str]] | None = None, *, base_url: str | None = None) -> str:
        normalized = _encode_upstream_path(path)
        target_base = str(base_url or self.http_base)
        url = urllib.parse.urljoin(target_base.rstrip('/') + '/', normalized.lstrip('/'))
        if query_items:
            pairs = [(str(k), str(v)) for k, v in query_items]
            encoded = urllib.parse.urlencode(pairs, doseq=True)
            if encoded:
                url = f'{url}?{encoded}'
        return url

    def build_ws_url(self, path: str, query_items: Iterable[tuple[str, str]] | None = None) -> str:
        normalized = _encode_upstream_path(path)
        url = urllib.parse.urljoin(self.ws_base.rstrip('/') + '/', normalized.lstrip('/'))
        if query_items:
            pairs = [(str(k), str(v)) for k, v in query_items]
            encoded = urllib.parse.urlencode(pairs, doseq=True)
            if encoded:
                url = f'{url}?{encoded}'
        return url


def _canonical_controller_host(host: str) -> str:
    raw = str(host or '').strip().strip('[]')
    if raw in {'', '0.0.0.0', '::', '::1', '*'}:
        return '127.0.0.1'
    return raw


def _normalize_controller_url(raw: str) -> str:
    value = str(raw or '').strip()
    if not value:
        return ''
    if '://' not in value:
        value = f'http://{value}'
    parsed = urllib.parse.urlsplit(value)
    host = _canonical_controller_host(parsed.hostname or '')
    port = parsed.port
    scheme = parsed.scheme or 'http'
    path = parsed.path.rstrip('/')
    netloc = host if port is None else f'{host}:{port}'
    rebuilt = urllib.parse.urlunsplit((scheme, netloc, path, '', ''))
    return rebuilt.rstrip('/')


def _swap_scheme(http_url: str) -> str:
    parsed = urllib.parse.urlsplit(http_url)
    scheme = 'wss' if parsed.scheme == 'https' else 'ws'
    return urllib.parse.urlunsplit((scheme, parsed.netloc, parsed.path, '', ''))


def _encode_upstream_path(path: str) -> str:
    normalized = '/' + str(path or '').lstrip('/')
    parts = normalized.split('/')
    encoded_parts = [urllib.parse.quote(part, safe=":@!$&'()*+,;=-._~") for part in parts]
    return '/'.join(encoded_parts)


def _read_controller_from_config(active_config_path: Path) -> tuple[str, str]:
    try:
        with active_config_path.open('r', encoding='utf-8', errors='replace') as fh:
            payload = yaml.safe_load(fh) or {}
    except OSError:
        payload = {}
    raw_url = str(payload.get('external-controller') or '').strip()
    secret = str(payload.get('secret') or '').strip()
    return raw_url, secret


def _controller_candidates(explicit_url: str, config_url: str) -> list[str]:
    normalized_explicit = _normalize_controller_url(explicit_url)
    normalized_config = _normalize_controller_url(config_url)
    candidates: list[str] = []

    def push(value: str) -> None:
        if value and value not in candidates:
            candidates.append(value)

    if normalized_explicit and normalized_config:
        explicit_host = urllib.parse.urlsplit(normalized_explicit).hostname or ''
        config_host = urllib.parse.urlsplit(normalized_config).hostname or ''
        if explicit_host in {'127.0.0.1', 'localhost'} and config_host not in {'127.0.0.1', 'localhost'}:
            push(normalized_config)
            push(normalized_explicit)
        else:
            push(normalized_explicit)
            push(normalized_config)
    else:
        push(normalized_explicit)
        push(normalized_config)

    if not candidates:
        candidates.append(_normalize_controller_url('http://127.0.0.1:9090'))
    return candidates


def load_mihomo_controller(active_config_path: Path, explicit_url: str = '', explicit_secret: str = '') -> MihomoController | None:
    secret = str(explicit_secret or '').strip()
    raw_url = str(explicit_url or '').strip()
    config_url, config_secret = _read_controller_from_config(active_config_path)
    if not secret:
        secret = config_secret

    candidates = _controller_candidates(raw_url, config_url)
    if not candidates:
        return None

    primary = candidates[0]
    return MihomoController(
        http_base=primary,
        ws_base=_swap_scheme(primary),
        secret=secret,
        extra_http_bases=tuple(candidates[1:]),
    )


def _proxy_headers(secret: str, content_type: str = '') -> dict[str, str]:
    headers = {
        'Accept': 'application/json, text/plain, */*',
    }
    if secret:
        headers['Authorization'] = f'Bearer {secret}'
    if content_type:
        headers['Content-Type'] = content_type
    return headers


def _is_transient_connect_error(reason: object) -> bool:
    message = str(reason or '').lower()
    if 'connection refused' in message:
        return True
    if 'timed out' in message:
        return True
    return isinstance(reason, (TimeoutError, socket.timeout, ConnectionRefusedError))


def proxy_http_request(
    controller: MihomoController,
    *,
    method: str,
    path: str,
    query_items: Iterable[tuple[str, str]] | None = None,
    body: bytes | None = None,
    content_type: str = '',
    timeout: float = 8.0,
) -> tuple[int, bytes, str]:
    attempted: list[dict[str, str]] = []
    retry_delays = (0.0, 0.35, 0.8)
    normalized_method = str(method or 'GET').upper()
    normalized_body = body if body not in (None, b'') else (b'' if normalized_method in {'PUT', 'POST', 'PATCH'} else None)
    for base_url in (controller.http_base, *controller.extra_http_bases):
        url = controller.build_http_url(path, query_items, base_url=base_url)
        for attempt_index, delay in enumerate(retry_delays, start=1):
            if delay > 0:
                import time
                time.sleep(delay)
            request = urllib.request.Request(
                url,
                data=normalized_body,
                headers=_proxy_headers(controller.secret, content_type),
                method=normalized_method,
            )
            try:
                opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
                with opener.open(request, timeout=timeout) as response:
                    payload = response.read()
                    media_type = response.headers.get_content_type() or response.headers.get('Content-Type', 'application/json')
                    return int(getattr(response, 'status', 200) or 200), payload, media_type
            except urllib.error.HTTPError as exc:
                payload = exc.read()
                media_type = exc.headers.get_content_type() if exc.headers else 'application/json'
                return int(exc.code), payload, media_type or 'application/json'
            except urllib.error.URLError as exc:
                reason = getattr(exc, 'reason', exc)
                attempted.append({'url': url, 'error': str(reason), 'attempt': str(attempt_index)})
                if _is_transient_connect_error(reason) and attempt_index < len(retry_delays):
                    continue
                break
            except Exception as exc:  # noqa: BLE001
                attempted.append({'url': url, 'error': str(exc), 'attempt': str(attempt_index)})
                break

    last = attempted[-1] if attempted else {'url': controller.build_http_url(path, query_items), 'error': 'unknown'}
    payload = encode_json_bytes({
        'message': 'mihomo-controller-connect-failed',
        'url': last['url'],
        'error': last['error'],
        'attempts': attempted,
    })
    return 502, payload, 'application/json'


async def relay_websocket_to_mihomo(client: WebSocket, controller: MihomoController, path: str) -> None:
    query_items = [(k, v) for k, v in client.query_params.multi_items() if str(k).lower() != 'token']
    upstream_url = controller.build_ws_url(path, query_items)
    headers = _proxy_headers(controller.secret)

    async with websockets.connect(
        upstream_url,
        additional_headers=headers,
        open_timeout=8,
        ping_interval=20,
        ping_timeout=20,
        close_timeout=5,
        max_size=2**22,
    ) as upstream:
        await client.accept()

        async def upstream_to_client() -> None:
            async for message in upstream:
                if isinstance(message, bytes):
                    await client.send_bytes(message)
                else:
                    await client.send_text(message)

        async def client_to_upstream() -> None:
            while True:
                try:
                    event = await client.receive()
                except WebSocketDisconnect:
                    await upstream.close()
                    return
                event_type = event.get('type')
                if event_type == 'websocket.disconnect':
                    await upstream.close()
                    return
                text = event.get('text')
                binary = event.get('bytes')
                if text is not None:
                    await upstream.send(text)
                elif binary is not None:
                    await upstream.send(binary)

        tasks = [asyncio.create_task(upstream_to_client()), asyncio.create_task(client_to_upstream())]
        done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for task in pending:
            task.cancel()
        for task in done:
            try:
                task.result()
            except Exception:
                pass


def encode_json_bytes(payload: object) -> bytes:
    return json.dumps(payload, ensure_ascii=False).encode('utf-8')
