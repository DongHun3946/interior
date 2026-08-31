import json
import logging
import re
import sys
import time
import uuid
from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exception_handlers import (
    http_exception_handler,
    request_validation_exception_handler,
)
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from .core.config import get_settings
from .request_context import RequestContext, bind_request_context


settings = get_settings()
REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,128}$")
request_logger = logging.getLogger("interior.api")


def configure_request_logger() -> None:
    if not request_logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter("%(message)s"))
        request_logger.addHandler(handler)
    request_logger.setLevel(getattr(logging, settings.log_level.upper(), logging.INFO))
    request_logger.propagate = False
    logging.getLogger("uvicorn.access").disabled = True


def emit_request_log(payload: dict[str, Any], level: int) -> None:
    request_logger.log(
        level,
        json.dumps(payload, ensure_ascii=False, separators=(",", ":"), default=str),
    )


def _request_id(request: Request) -> str:
    supplied = request.headers.get("x-request-id", "")
    return supplied if REQUEST_ID_PATTERN.fullmatch(supplied) else str(uuid.uuid4())


def _route_path(request: Request) -> str:
    route = request.scope.get("route")
    return getattr(route, "path", None) or request.url.path


def _error_level(status_code: int) -> int:
    if status_code >= 500:
        return logging.ERROR
    if status_code >= 400:
        return logging.WARNING
    return logging.INFO


def _fallback_error(status_code: int) -> dict[str, Any] | None:
    if status_code < 400:
        return None
    try:
        message = HTTPStatus(status_code).phrase
    except ValueError:
        message = "HTTP error"
    return {
        "code": f"HTTP_{status_code}",
        "type": "HTTPError",
        "message": message,
    }


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = _request_id(request)
        request.state.request_id = request_id
        context = RequestContext(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            client_ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        started_at = time.perf_counter()
        response: Response | None = None
        caught_exception: Exception | None = None
        unhandled_error: dict[str, Any] | None = None

        with bind_request_context(context):
            try:
                response = await call_next(request)
            except Exception as exc:
                caught_exception = exc
                unhandled_error = {
                    "code": "INTERNAL_SERVER_ERROR",
                    "type": type(exc).__name__,
                    "message": "요청 처리 중 내부 오류가 발생했습니다.",
                }
            finally:
                status_code = response.status_code if response else 500
                error = unhandled_error or getattr(request.state, "api_error", None)
                error = error or _fallback_error(status_code)
                duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
                payload: dict[str, Any] = {
                    "event": "api_request",
                    "request_id": request_id,
                    "method": request.method,
                    "path": _route_path(request),
                    "status_code": status_code,
                    "duration_ms": duration_ms,
                    "user_id": context.user_id,
                    "client_ip": context.client_ip,
                    "user_agent": context.user_agent,
                    "content_length": request.headers.get("content-length"),
                    "error": error,
                }
                if settings.request_log_enabled and (
                    settings.log_health_checks or request.url.path != "/health"
                ):
                    emit_request_log(payload, _error_level(status_code))

        if caught_exception:
            raise caught_exception
        assert response is not None
        response.headers["X-Request-ID"] = request_id
        return response


async def logged_http_exception_handler(request: Request, exc: StarletteHTTPException) -> Response:
    detail = exc.detail if isinstance(exc.detail, str) else "요청을 처리할 수 없습니다."
    request.state.api_error = {
        "code": f"HTTP_{exc.status_code}",
        "type": type(exc).__name__,
        "message": detail[:500],
    }
    return await http_exception_handler(request, exc)


async def logged_validation_exception_handler(request: Request, exc: RequestValidationError) -> Response:
    fields = []
    for error in exc.errors():
        location = [str(item) for item in error.get("loc", ()) if item != "body"]
        fields.append(
            {
                "field": ".".join(location),
                "reason": str(error.get("msg", "올바르지 않은 값입니다."))[:300],
                "type": str(error.get("type", "validation_error")),
            }
        )
    request.state.api_error = {
        "code": "VALIDATION_ERROR",
        "type": type(exc).__name__,
        "message": "요청 데이터 형식이 올바르지 않습니다.",
        "fields": fields,
    }
    return await request_validation_exception_handler(request, exc)


def install_request_logging(app: FastAPI) -> None:
    configure_request_logger()
    app.add_exception_handler(StarletteHTTPException, logged_http_exception_handler)
    app.add_exception_handler(RequestValidationError, logged_validation_exception_handler)
    app.add_middleware(RequestLoggingMiddleware)
