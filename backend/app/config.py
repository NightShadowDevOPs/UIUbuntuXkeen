from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

APP_VERSION = "0.6.74"
DEFAULT_CAPABILITIES = {
    "status": True,
    "health": True,
    "version": True,
    "capabilities": True,
    "providers": True,
    "providerChecks": True,
    "providerChecksRun": True,
    "providerRefresh": True,
    "providerSslCacheRefresh": True,
    "providerSslCacheStatus": True,
    "providerChecksHistory": True,
    "usersInventory": True,
    "usersInventoryPut": True,
    "jobs": True,
    "connections": True,
    "logs": True,
    "configActive": True,
    "trafficTopology": True,
}



def _env_bool(name: str, default: bool) -> bool:
    raw = str(os.getenv(name, "")).strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "on"}


@dataclass(slots=True)
class Settings:
    app_name: str
    app_version: str
    host: str
    port: int
    db_path: Path
    runtime_dir: Path
    log_dir: Path
    env_path: Path
    mihomo_log_file: Path
    mihomo_active_config: Path
    mihomo_controller_url: str
    mihomo_controller_secret: str
    ssl_interval_secs: int
    ssl_warn_days: int
    ssl_probe_route_mode: str
    ssl_probe_direct_interface: str
    ssl_probe_direct_source_ip: str
    cors_allow_all: bool
    capabilities: dict[str, bool]

    @classmethod
    def from_env(cls) -> "Settings":
        runtime_dir = Path(os.getenv("ULTRA_UI_RUNTIME", "/var/lib/ultra-ui-ubuntu/runtime"))
        log_dir = Path(os.getenv("ULTRA_UI_LOG_DIR", "/var/log/ultra-ui-ubuntu"))
        db_path = Path(os.getenv("ULTRA_UI_DB_PATH", str(runtime_dir / "backend.sqlite3")))
        env_path = Path(os.getenv("ULTRA_UI_AGENT_ENV", "/etc/ultra-ui-ubuntu/agent.env"))
        mihomo_log_file = Path(os.getenv("MIHOMO_LOG_FILE", "/var/log/mihomo/mihomo.log"))
        mihomo_active_config = Path(os.getenv("MIHOMO_ACTIVE_CONFIG", "/etc/mihomo/config.yaml"))
        mihomo_controller_url = os.getenv("MIHOMO_CONTROLLER_URL", "")
        mihomo_controller_secret = os.getenv("MIHOMO_CONTROLLER_SECRET", "")
        interval_raw = os.getenv("ULTRA_UI_SSL_CHECK_INTERVAL_SECS", "14400")
        try:
            ssl_interval_secs = max(300, int(interval_raw))
        except ValueError:
            ssl_interval_secs = 14400
        warn_days_raw = os.getenv("ULTRA_UI_SSL_WARN_DAYS", "2")
        try:
            ssl_warn_days = max(0, int(warn_days_raw))
        except ValueError:
            ssl_warn_days = 2
        ssl_probe_route_mode = str(os.getenv("ULTRA_UI_SSL_PROBE_ROUTE_MODE", "system-route")).strip().lower()
        if ssl_probe_route_mode not in {"system-route", "forced-direct"}:
            ssl_probe_route_mode = "system-route"
        ssl_probe_direct_interface = str(os.getenv("ULTRA_UI_SSL_PROBE_DIRECT_INTERFACE", "")).strip()
        ssl_probe_direct_source_ip = str(os.getenv("ULTRA_UI_SSL_PROBE_DIRECT_SOURCE_IP", "")).strip()
        if ssl_probe_route_mode == "forced-direct" and not ssl_probe_direct_interface and not ssl_probe_direct_source_ip:
            ssl_probe_route_mode = "system-route"
        return cls(
            app_name="ultra-ui-ubuntu-backend",
            app_version=APP_VERSION,
            host=os.getenv("ULTRA_UI_HOST", "0.0.0.0"),
            port=int(os.getenv("ULTRA_UI_PORT", "18090")),
            db_path=db_path,
            runtime_dir=runtime_dir,
            log_dir=log_dir,
            env_path=env_path,
            mihomo_log_file=mihomo_log_file,
            mihomo_active_config=mihomo_active_config,
            mihomo_controller_url=mihomo_controller_url,
            mihomo_controller_secret=mihomo_controller_secret,
            ssl_interval_secs=ssl_interval_secs,
            ssl_warn_days=ssl_warn_days,
            ssl_probe_route_mode=ssl_probe_route_mode,
            ssl_probe_direct_interface=ssl_probe_direct_interface,
            ssl_probe_direct_source_ip=ssl_probe_direct_source_ip,
            cors_allow_all=_env_bool("ULTRA_UI_CORS_ALLOW_ALL", True),
            capabilities=dict(DEFAULT_CAPABILITIES),
        )

    def ensure_dirs(self) -> None:
        self.runtime_dir.mkdir(parents=True, exist_ok=True)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
