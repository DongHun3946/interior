from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Iterator


@dataclass
class RequestContext:
    request_id: str
    method: str
    path: str
    client_ip: str | None
    user_agent: str | None
    user_id: str | None = None


_request_context: ContextVar[RequestContext | None] = ContextVar(
    "request_context",
    default=None,
)


@contextmanager
def bind_request_context(context: RequestContext) -> Iterator[RequestContext]:
    token = _request_context.set(context)
    try:
        yield context
    finally:
        _request_context.reset(token)


def get_request_context() -> RequestContext | None:
    return _request_context.get()


def set_authenticated_user(user_id: str, route_path: str | None = None) -> None:
    context = get_request_context()
    if not context:
        return
    context.user_id = user_id
    if route_path:
        context.path = route_path
