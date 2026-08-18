from dataclasses import dataclass
from typing import Any, Protocol

import httpx


@dataclass
class ProviderTask:
    task_id: str
    status: str
    output: dict[str, Any]


class AIProvider(Protocol):
    def submit(self, job_type: str, payload: dict[str, Any]) -> ProviderTask: ...
    def poll(self, task_id: str) -> ProviderTask: ...
    def cancel(self, task_id: str) -> None: ...


class HttpAIProvider:
    """Adapter for a worker service exposing POST/GET/DELETE /tasks endpoints."""

    def __init__(self, base_url: str, api_key: str, timeout: float = 30):
        self.base_url = base_url.rstrip("/")
        self.headers = {"Authorization": f"Bearer {api_key}"}
        self.timeout = timeout

    def submit(self, job_type: str, payload: dict[str, Any]) -> ProviderTask:
        response = httpx.post(f"{self.base_url}/tasks", json={"job_type": job_type, "input": payload}, headers=self.headers, timeout=self.timeout)
        response.raise_for_status()
        data = response.json()
        return ProviderTask(task_id=str(data["id"]), status=data.get("status", "QUEUED"), output=data.get("output", {}))

    def poll(self, task_id: str) -> ProviderTask:
        response = httpx.get(f"{self.base_url}/tasks/{task_id}", headers=self.headers, timeout=self.timeout)
        response.raise_for_status()
        data = response.json()
        return ProviderTask(task_id=task_id, status=data.get("status", "RUNNING"), output=data.get("output", {}))

    def cancel(self, task_id: str) -> None:
        response = httpx.delete(f"{self.base_url}/tasks/{task_id}", headers=self.headers, timeout=self.timeout)
        response.raise_for_status()
