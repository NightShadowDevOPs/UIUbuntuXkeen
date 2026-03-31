from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings
from .service import BackendService

settings = Settings.from_env()
service = BackendService(settings)
_scheduler_task: asyncio.Task | None = None


async def _scheduler_loop() -> None:
    while True:
        try:
            last_run_at = service.get_setting("provider_checks_last_run_at", "")
            last_run_sec = 0
            if last_run_at:
                from datetime import datetime

                last_run_sec = int(datetime.fromisoformat(last_run_at.replace("Z", "+00:00")).timestamp())
            now_sec = int(asyncio.get_running_loop().time())
            should_run = not last_run_sec or (int(__import__("time").time()) - last_run_sec) >= settings.ssl_interval_secs
            if should_run and not service.is_provider_checks_running():
                await asyncio.to_thread(service.run_provider_checks, "scheduler")
        except Exception:
            pass
        await asyncio.sleep(30)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scheduler_task
    _scheduler_task = asyncio.create_task(_scheduler_loop())
    yield
    if _scheduler_task:
        _scheduler_task.cancel()
        try:
            await _scheduler_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)
if settings.cors_allow_all:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.get("/api/health")
def api_health():
    return service.health()


@app.get("/api/version")
def api_version():
    return service.version_payload()


@app.get("/api/capabilities")
def api_capabilities():
    return service.capabilities_payload()


@app.get("/api/status")
def api_status():
    return service.status_payload()


@app.get("/api/providers")
def api_providers():
    providers = service.list_providers()
    return {"ok": True, "providers": providers, "items": providers}


@app.put("/api/providers")
def api_put_providers(payload: dict):
    providers = service.replace_providers(list(payload.get("providers") or []))
    return {"ok": True, "providers": providers, "items": providers}


@app.get("/api/providers/checks")
def api_provider_checks():
    return service.provider_checks_payload()


@app.post("/api/providers/checks/run")
async def api_provider_checks_run():
    return await asyncio.to_thread(service.run_provider_checks, "manual")


@app.post("/api/providers/refresh")
async def api_provider_refresh():
    return await asyncio.to_thread(service.run_provider_checks, "refresh")


@app.post("/api/providers/ssl-cache/refresh")
async def api_provider_ssl_cache_refresh():
    return await asyncio.to_thread(service.run_provider_checks, "ssl-cache-refresh")


@app.get("/api/providers/ssl-cache/status")
def api_provider_ssl_cache_status():
    return service.provider_ssl_cache_status()


@app.get("/api/users/inventory")
def api_users_inventory():
    return {"ok": True, **service.list_users_inventory()}


@app.put("/api/users/inventory")
def api_put_users_inventory(payload: dict):
    items = list(payload.get("items") or [])
    policy_mode = str(payload.get("policyMode") or "allowAll")
    data = service.replace_users_inventory(items, policy_mode)
    return {"ok": True, **data}


@app.get("/api/jobs")
def api_jobs():
    return {"ok": True, "jobs": service.list_jobs(), "items": service.list_jobs()}
