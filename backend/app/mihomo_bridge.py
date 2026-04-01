from __future__ import annotations

import asyncio
import json
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

    def build_http_url(self, path: str, query_items: Iterable[tuple[str, str]] | None = None) -> str:
        normalized = '/' + str(path or '').lstrip('/')
        url = urllib.parse.urljoin(self.http_base.rstrip('/') + '/', normalized.lstrip('/'))
        if query_items:
            pairs = [(str(k), str(v)) for k, v in query_items]
            encoded = urllib.parse.urlencode(pairs, doseq=True)
            if encoded:
                url = f'{url}?{encoded}'
        return url

    def build_ws_url(self, path: str, query_items: Iterable[tuple[str, str]] | None = None) -> str:
        normalized = '/' + str(path or '').lstrip('/')
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


def load_mihomo_controller(active_config_path: Path, explicit_url: str = '', explicit_secret: str = '') -> MihomoController | None:
    secret = str(explicit_secret or '').strip()
    raw_url = str(explicit_url or '').strip()

    if not raw_url:
        try:
            with active_config_path.open('r', encoding='utf-8', errors='replace') as fh:
                payload = yaml.safe_load(fh) or {}
        except OSError:
            payload = {}
        raw_url = str(payload.get('external-controller') or '').strip()
        if not secret:
            secret = str(payload.get('secret') or '').strip()

    if not raw_url:
        raw_url = 'http://127.0.0.1:9090'

    http_base = _normalize_controller_url(raw_url)
    if not http_base:
        return None

    return MihomoController(http_base=http_base, ws_base=_swap_scheme(http_base), secret=secret)


def _proxy_headers(secret: str, content_type: str = '') -> dict[str, str]:
    headers = {
        'Accept': 'application/json, text/plain, */*',
    }
    if secret:
        headers['Authorization'] = f'Bearer {secret}'
    if content_type:
        headers['Content-Type'] = content_type
    return headers


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
    url = controller.build_http_url(path, query_items)
    request = urllib.request.Request(
        url,
        data=body if body else None,
        headers=_proxy_headers(controller.secret, content_type),
        method=str(method or 'GET').upper(),
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = response.read()
            media_type = response.headers.get_content_type() or response.headers.get('Content-Type', 'application/json')
            return int(getattr(response, 'status', 200) or 200), payload, media_type
    except urllib.error.HTTPError as exc:
        payload = exc.read()
        media_type = exc.headers.get_content_type() if exc.headers else 'application/json'
        return int(exc.code), payload, media_type or 'application/json'
    except urllib.error.URLError as exc:
        reason = getattr(exc, 'reason', exc)
        payload = encode_json_bytes({
            'message': 'mihomo-controller-connect-failed',
            'url': url,
            'error': str(reason),
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
