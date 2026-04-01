from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import Settings
from .live_runtime import stream_connections, stream_logs, stream_memory, stream_traffic
from .mihomo_bridge import load_mihomo_controller, proxy_http_request, relay_websocket_to_mihomo
from .service import BackendService

settings = Settings.from_env()
service = BackendService(settings)
_scheduler_task: asyncio.Task | None = None


def _mihomo_controller():
    return load_mihomo_controller(
        settings.mihomo_active_config,
        settings.mihomo_controller_url,
        settings.mihomo_controller_secret,
    )


async def _scheduler_loop() -> None:
    while True:
        try:
            last_run_at = service.get_setting("provider_checks_last_run_at", "")
            last_run_sec = 0
            if last_run_at:
                from datetime import datetime

                last_run_sec = int(datetime.fromisoformat(last_run_at.replace("Z", "+00:00")).timestamp())
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


async def _proxy_mihomo(request: Request, path: str) -> Response:
    controller = _mihomo_controller()
    if not controller:
        return JSONResponse(
            status_code=503,
            content={
                "message": "mihomo-controller-unavailable",
                "path": path,
            },
        )
    body = await request.body()
    status, payload, media_type = await asyncio.to_thread(
        proxy_http_request,
        controller,
        method=request.method,
        path=path,
        query_items=list(request.query_params.multi_items()),
        body=body,
        content_type=request.headers.get("content-type", ""),
    )
    return Response(content=payload, status_code=status, media_type=media_type)


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)
if settings.cors_allow_all:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.get("/health")
@app.get("/api/health")
@app.get("/api/api/health")
def api_health():
    return service.health()


@app.get("/version")
@app.get("/api/version")
@app.get("/api/api/version")
def api_version():
    return service.version_payload()


@app.get("/capabilities")
@app.get("/api/capabilities")
@app.get("/api/api/capabilities")
def api_capabilities():
    return service.capabilities_payload()


@app.get("/status")
@app.get("/api/status")
@app.get("/api/api/status")
def api_status():
    return service.status_payload()


@app.api_route("/configs", methods=["GET", "PATCH", "PUT"])
@app.api_route("/api/configs", methods=["GET", "PATCH", "PUT"])
@app.api_route("/api/api/configs", methods=["GET", "PATCH", "PUT"])
async def proxy_configs(request: Request):
    return await _proxy_mihomo(request, "/configs")


@app.api_route("/proxies", methods=["GET"])
@app.api_route("/api/proxies", methods=["GET"])
@app.api_route("/api/api/proxies", methods=["GET"])
async def proxy_proxies(request: Request):
    return await _proxy_mihomo(request, "/proxies")


@app.api_route("/providers/proxies", methods=["GET"])
@app.api_route("/api/providers/proxies", methods=["GET"])
@app.api_route("/api/api/providers/proxies", methods=["GET"])
async def proxy_provider_proxies(request: Request):
    return await _proxy_mihomo(request, "/providers/proxies")


@app.api_route("/providers/rules", methods=["GET"])
@app.api_route("/api/providers/rules", methods=["GET"])
@app.api_route("/api/api/providers/rules", methods=["GET"])
async def proxy_provider_rules(request: Request):
    return await _proxy_mihomo(request, "/providers/rules")


@app.api_route("/rules", methods=["GET"])
@app.api_route("/api/rules", methods=["GET"])
@app.api_route("/api/api/rules", methods=["GET"])
async def proxy_rules(request: Request):
    return await _proxy_mihomo(request, "/rules")


@app.api_route("/connections", methods=["DELETE"])
@app.api_route("/api/connections", methods=["DELETE"])
@app.api_route("/api/api/connections", methods=["DELETE"])
async def proxy_connections_delete_all(request: Request):
    return await _proxy_mihomo(request, "/connections")


@app.api_route("/connections/{connection_id}", methods=["DELETE"])
@app.api_route("/api/connections/{connection_id}", methods=["DELETE"])
@app.api_route("/api/api/connections/{connection_id}", methods=["DELETE"])
async def proxy_connection_delete(request: Request, connection_id: str):
    return await _proxy_mihomo(request, f"/connections/{connection_id}")


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


@app.websocket("/traffic")
@app.websocket("/api/traffic")
@app.websocket("/api/api/traffic")
async def ws_traffic(websocket: WebSocket):
    try:
        await stream_traffic(websocket)
    except WebSocketDisconnect:
        return


@app.websocket("/memory")
@app.websocket("/api/memory")
@app.websocket("/api/api/memory")
async def ws_memory(websocket: WebSocket):
    try:
        await stream_memory(websocket)
    except WebSocketDisconnect:
        return


@app.websocket("/connections")
@app.websocket("/api/connections")
@app.websocket("/api/api/connections")
async def ws_connections(websocket: WebSocket):
    controller = _mihomo_controller()
    if controller:
        try:
            await relay_websocket_to_mihomo(websocket, controller, "/connections")
            return
        except WebSocketDisconnect:
            return
        except Exception:
            pass
    try:
        await stream_connections(websocket)
    except WebSocketDisconnect:
        return


@app.websocket("/logs")
@app.websocket("/api/logs")
@app.websocket("/api/api/logs")
async def ws_logs(websocket: WebSocket):
    try:
        await stream_logs(websocket, settings.mihomo_log_file, websocket.query_params.get("level", "info"))
    except WebSocketDisconnect:
        return
