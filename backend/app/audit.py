import enum
import json
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import event, inspect
from sqlalchemy.orm import Session

from .models import AuditAction, AuditLog
from .request_context import get_request_context


SENSITIVE_FIELD_PARTS = (
    "password",
    "secret",
    "token",
    "authorization",
    "cookie",
    "api_key",
    "access_key",
)
MAX_VALUE_LENGTH = 2000


def _is_sensitive(field_name: str) -> bool:
    lowered = field_name.lower()
    return any(part in lowered for part in SENSITIVE_FIELD_PARTS)


def _normalize(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        normalized = value
    elif isinstance(value, (uuid.UUID, datetime, date, Decimal, enum.Enum)):
        normalized = str(value.value if isinstance(value, enum.Enum) else value)
    elif isinstance(value, dict):
        normalized = {
            str(key): "[REDACTED]" if _is_sensitive(str(key)) else _normalize(item)
            for key, item in value.items()
        }
    elif isinstance(value, (list, tuple, set)):
        normalized = [_normalize(item) for item in value]
    elif isinstance(value, bytes):
        normalized = "[BINARY]"
    else:
        normalized = str(value)

    encoded = json.dumps(normalized, ensure_ascii=False, default=str)
    if len(encoded) > MAX_VALUE_LENGTH:
        return {"omitted": True, "size": len(encoded)}
    return normalized


def _changes_for(instance: Any, is_new: bool) -> dict[str, Any]:
    state = inspect(instance)
    changes: dict[str, Any] = {}
    for attribute in state.mapper.column_attrs:
        key = attribute.key
        if _is_sensitive(key):
            history = state.attrs[key].history
            if is_new or history.has_changes():
                changes[key] = {"before": "[REDACTED]", "after": "[REDACTED]"}
            continue
        value = getattr(instance, key, None)
        if is_new:
            changes[key] = {"before": None, "after": _normalize(value)}
            continue
        history = state.attrs[key].history
        if not history.has_changes():
            continue
        before = history.deleted[-1] if history.deleted else None
        after = history.added[-1] if history.added else value
        changes[key] = {"before": _normalize(before), "after": _normalize(after)}
    return changes


def _action_for(instance: Any, changes: dict[str, Any], is_new: bool, is_deleted: bool) -> AuditAction:
    if is_new:
        return AuditAction.CREATE
    if is_deleted:
        return AuditAction.DELETE
    deleted_at = changes.get("deleted_at")
    if deleted_at:
        if deleted_at["before"] is None and deleted_at["after"] is not None:
            return AuditAction.DELETE
        if deleted_at["before"] is not None and deleted_at["after"] is None:
            return AuditAction.RESTORE
    if "status" in changes:
        return AuditAction.STATUS_CHANGE
    return AuditAction.UPDATE


@event.listens_for(Session, "before_flush")
def add_audit_rows(session: Session, _flush_context: Any, _instances: Any) -> None:
    context = get_request_context()
    if not context or context.method not in {"POST", "PUT", "PATCH", "DELETE"}:
        return

    candidates = (
        [(instance, True, False) for instance in list(session.new)]
        + [(instance, False, False) for instance in list(session.dirty)]
        + [(instance, False, True) for instance in list(session.deleted)]
    )
    seen: set[int] = set()
    for instance, is_new, is_deleted in candidates:
        if isinstance(instance, AuditLog) or id(instance) in seen:
            continue
        seen.add(id(instance))
        state = inspect(instance)
        if not state.mapper or (not is_new and not is_deleted and not session.is_modified(instance, include_collections=False)):
            continue
        if hasattr(instance, "id") and getattr(instance, "id") is None:
            setattr(instance, "id", uuid.uuid4())
        changes = _changes_for(instance, is_new)
        if not changes and not is_deleted:
            continue
        entity_id = getattr(instance, "id", None)
        session.add(
            AuditLog(
                actor_user_id=uuid.UUID(context.user_id) if context.user_id else None,
                action=_action_for(instance, changes, is_new, is_deleted),
                entity_type=state.mapper.local_table.name.upper(),
                entity_id=str(entity_id) if entity_id is not None else "",
                changes=changes,
                request_id=context.request_id,
                method=context.method,
                path=context.path,
                ip_address=context.client_ip,
                user_agent=context.user_agent,
            )
        )
