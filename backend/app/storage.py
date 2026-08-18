import re
import uuid
from pathlib import Path

from fastapi import UploadFile

from .core.config import get_settings

settings = get_settings()
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
SCAN_TYPES = ALLOWED_TYPES | {"video/mp4", "video/quicktime", "video/webm"}


def safe_name(filename: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9가-힣._-]", "_", filename)
    return cleaned[:180] or "image"


def save_media_upload(folder: str, upload: UploadFile, allowed_types: set[str], max_size: int) -> tuple[str, str, int]:
    if upload.content_type not in allowed_types:
        raise ValueError("지원하지 않는 파일 형식입니다.")
    root = Path(settings.media_dir) / folder
    root.mkdir(parents=True, exist_ok=True)
    key = f"{uuid.uuid4().hex}_{safe_name(upload.filename or 'image')}"
    target = root / key
    size = 0
    with target.open("wb") as output:
        while chunk := upload.file.read(1024 * 1024):
            size += len(chunk)
            if size > max_size:
                target.unlink(missing_ok=True)
                raise ValueError(f"파일 크기는 {max_size // (1024 * 1024)}MB 이하이어야 합니다.")
            output.write(chunk)
    return f"{folder}/{key}", f"/media/{folder}/{key}", size


def save_upload(project_id: str, upload: UploadFile) -> tuple[str, str, int]:
    return save_media_upload(project_id, upload, ALLOWED_TYPES, settings.max_upload_size)


def save_scan_upload(simulation_id: str, upload: UploadFile) -> tuple[str, str, int]:
    return save_media_upload(f"scans/{simulation_id}", upload, SCAN_TYPES, settings.max_scan_upload_size)
