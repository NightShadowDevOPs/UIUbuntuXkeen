from __future__ import annotations

import asyncio
import hashlib
import os
import re
import subprocess
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import WebSocket

_CONN_FIRST_SEEN: dict[str, str] = {}
_SS_LINE_RE = re.compile(r"^(?P<proto>tcp|udp)\s+(?:(?P<state>\S+)\s+)?(?P<recvq>\d+)\s+(?P<sendq>\d+)\s+(?P<local>\S+)\s+(?P<peer>\S+)(?:\s+.*)?$")


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def read_memory_inuse_bytes() -> int:
    total_kb = 0
    avail_kb = 0
    try:
        with open('/proc/meminfo', 'r', encoding='utf-8') as fh:
            for line in fh:
                if line.startswith('MemTotal:'):
                    total_kb = int(line.split()[1])
                elif line.startswith('MemAvailable:'):
                    avail_kb = int(line.split()[1])
                if total_kb and avail_kb:
                    break
    except OSError:
        return 0
    used_kb = max(0, total_kb - avail_kb)
    return used_kb * 1024


def read_network_totals() -> tuple[int, int]:
    rx_total = 0
    tx_total = 0
    try:
        with open('/proc/net/dev', 'r', encoding='utf-8') as fh:
            for raw in fh.readlines()[2:]:
                line = raw.strip()
                if not line or ':' not in line:
                    continue
                iface, payload = [part.strip() for part in line.split(':', 1)]
                if iface == 'lo':
                    continue
                fields = payload.split()
                if len(fields) < 16:
                    continue
                rx_total += int(fields[0])
                tx_total += int(fields[8])
    except OSError:
        return 0, 0
    return rx_total, tx_total


def _split_addr(value: str) -> tuple[str, str]:
    raw = str(value or '').strip()
    if not raw or raw == '*':
        return '', ''
    if raw.startswith('[') and ']:' in raw:
        host, port = raw.rsplit(']:', 1)
        return host.strip('[]'), port
    if raw.count(':') > 1 and raw.rsplit(':', 1)[1].isdigit():
        host, port = raw.rsplit(':', 1)
        return host.strip('[]'), port
    if ':' in raw:
        host, port = raw.rsplit(':', 1)
        return host, port
    return raw, ''


def snapshot_connections(limit: int = 500) -> list[dict[str, Any]]:
    try:
        proc = subprocess.run(
            ['ss', '-tunH'],
            check=False,
            capture_output=True,
            text=True,
            timeout=4,
        )
        output = proc.stdout or ''
    except Exception:
        return []

    now = utc_now()
    rows: list[dict[str, Any]] = []
    seen_now: set[str] = set()
    for raw in output.splitlines():
        line = raw.strip()
        if not line:
            continue
        match = _SS_LINE_RE.match(line)
        if not match:
            continue
        proto = (match.group('proto') or '').strip().lower()
        state = (match.group('state') or '').strip().upper()
        local_host, local_port = _split_addr(match.group('local') or '')
        peer_host, peer_port = _split_addr(match.group('peer') or '')
        if not local_host and not peer_host:
            continue
        conn_id = hashlib.sha1(f'{proto}|{state}|{local_host}|{local_port}|{peer_host}|{peer_port}'.encode('utf-8')).hexdigest()[:24]
        seen_now.add(conn_id)
        first_seen = _CONN_FIRST_SEEN.setdefault(conn_id, now)
        rows.append(
            {
                'id': conn_id,
                'download': 0,
                'upload': 0,
                'chains': [],
                'rule': '',
                'rulePayload': '',
                'start': first_seen,
                'metadata': {
                    'destinationGeoIP': '',
                    'destinationIP': peer_host,
                    'destinationIPASN': '',
                    'destinationPort': peer_port,
                    'dnsMode': '',
                    'dscp': 0,
                    'host': peer_host,
                    'inboundIP': local_host,
                    'inboundName': '',
                    'inboundPort': local_port,
                    'inboundUser': '',
                    'network': proto,
                    'process': '',
                    'processPath': '',
                    'remoteDestination': peer_host,
                    'sniffHost': '',
                    'sourceGeoIP': '',
                    'sourceIP': local_host,
                    'sourceIPASN': '',
                    'sourcePort': local_port,
                    'specialProxy': '',
                    'specialRules': '',
                    'type': proto,
                    'uid': 0,
                },
            }
        )
        if len(rows) >= limit:
            break

    stale_ids = set(_CONN_FIRST_SEEN.keys()) - seen_now
    for stale in stale_ids:
        _CONN_FIRST_SEEN.pop(stale, None)

    return rows


def classify_log_line(line: str) -> str:
    lowered = line.lower()
    if ' error ' in f' {lowered} ' or 'error:' in lowered or ' err ' in f' {lowered} ':
        return 'error'
    if ' warn ' in f' {lowered} ' or 'warning' in lowered:
        return 'warning'
    if ' debug ' in f' {lowered} ' or 'debug:' in lowered:
        return 'debug'
    return 'info'


def tail_last_lines(path: Path, max_lines: int = 80) -> list[str]:
    if not path.exists() or not path.is_file():
        return []
    try:
        with path.open('r', encoding='utf-8', errors='replace') as fh:
            return list(deque((line.rstrip('\n') for line in fh), maxlen=max_lines))
    except OSError:
        return []


async def stream_traffic(websocket: WebSocket) -> None:
    await websocket.accept()
    prev_rx, prev_tx = read_network_totals()
    prev_ts = asyncio.get_running_loop().time()
    while True:
        await asyncio.sleep(1)
        rx, tx = read_network_totals()
        now_ts = asyncio.get_running_loop().time()
        elapsed = max(0.001, now_ts - prev_ts)
        down = max(0, int((rx - prev_rx) / elapsed))
        up = max(0, int((tx - prev_tx) / elapsed))
        prev_rx, prev_tx, prev_ts = rx, tx, now_ts
        await websocket.send_json({'down': down, 'up': up})


async def stream_memory(websocket: WebSocket) -> None:
    await websocket.accept()
    while True:
        await asyncio.sleep(1)
        await websocket.send_json({'inuse': read_memory_inuse_bytes()})


async def stream_connections(websocket: WebSocket) -> None:
    await websocket.accept()
    while True:
        await asyncio.sleep(1)
        rx, tx = read_network_totals()
        await websocket.send_json(
            {
                'connections': snapshot_connections(),
                'downloadTotal': rx,
                'uploadTotal': tx,
                'memory': read_memory_inuse_bytes(),
            }
        )


async def stream_logs(websocket: WebSocket, log_file: Path, level: str = 'info') -> None:
    await websocket.accept()
    threshold = str(level or 'info').strip().lower()
    order = {'debug': 10, 'info': 20, 'warning': 30, 'error': 40}
    threshold_value = order.get(threshold, 20)

    sent_any = False
    for line in tail_last_lines(log_file):
        kind = classify_log_line(line)
        if order.get(kind, 20) < threshold_value:
            continue
        await websocket.send_json({'type': kind, 'payload': line})
        sent_any = True

    if not sent_any:
        await websocket.send_json({'type': 'info', 'payload': f'Ubuntu backend log tail is active. Waiting for lines from {log_file}.'})

    current_inode = None
    fh = None
    try:
        while True:
            if fh is None:
                try:
                    fh = log_file.open('r', encoding='utf-8', errors='replace')
                    fh.seek(0, os.SEEK_END)
                    current_inode = log_file.stat().st_ino
                except OSError:
                    fh = None
                    current_inode = None
                    await asyncio.sleep(1)
                    continue

            line = fh.readline() if fh else ''
            if line:
                payload = line.rstrip('\n')
                kind = classify_log_line(payload)
                if order.get(kind, 20) >= threshold_value:
                    await websocket.send_json({'type': kind, 'payload': payload})
                continue

            await asyncio.sleep(0.5)
            try:
                latest_inode = log_file.stat().st_ino
            except OSError:
                latest_inode = None
            if latest_inode != current_inode:
                try:
                    fh.close()
                except Exception:
                    pass
                fh = None
                current_inode = None
    finally:
        if fh is not None:
            try:
                fh.close()
            except Exception:
                pass
