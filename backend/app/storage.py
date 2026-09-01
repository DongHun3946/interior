import mimetypes
import os
import re
import uuid
from functools import lru_cache
from pathlib import Path
from typing import BinaryIO, Protocol

from fastapi import UploadFile

from .core.config import get_settings

settings = get_settings()
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
SCAN_TYPES = ALLOWED_TYPES | {"video/mp4", "video/quicktime", "video/webm"}
CONTENT_TYPE_SUFFIXES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
}


class StorageUploadError(RuntimeError):
    """Raised when an accepted upload cannot be persisted."""


class S3Client(Protocol):
    def upload_fileobj(self, Fileobj: BinaryIO, Bucket: str, Key: str, ExtraArgs: dict[str, str]) -> None: ...


def safe_name(filename: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]", "_", filename)
    return cleaned[:180] or "image"


def _validated_folder(folder: str) -> str:
    segments = [segment for segment in folder.replace("\\", "/").split("/") if segment]
    if not segments or any(segment in {".", ".."} for segment in segments):
        raise ValueError("올바르지 않은 저장 경로입니다.")
    return "/".join(safe_name(segment) for segment in segments)


def _upload_size(file: BinaryIO) -> int:
    try:
        file.seek(0, os.SEEK_END)
        size = file.tell()
        file.seek(0)
    except (AttributeError, OSError) as exc:
        raise ValueError("파일 크기를 확인할 수 없습니다.") from exc
    return size


def _object_key(folder: str, content_type: str, filename: str) -> str:
    suffix = CONTENT_TYPE_SUFFIXES.get(content_type) or Path(filename).suffix.lower()
    if not suffix:
        suffix = mimetypes.guess_extension(content_type) or ""
    prefix = settings.storage_prefix.strip().strip("/\\")
    storage_folder = "/".join(part for part in (prefix, folder) if part)
    return f"{_validated_folder(storage_folder)}/{uuid.uuid4().hex}{suffix}"


def validate_storage_configuration() -> None:
    if not settings.uses_r2:
        return
    required = {
        "R2_ACCOUNT_ID": settings.r2_account_id,
        "R2_ACCESS_KEY_ID": settings.r2_access_key_id,
        "R2_SECRET_ACCESS_KEY": settings.r2_secret_access_key,
        "R2_BUCKET_NAME": settings.r2_bucket_name,
        "R2_PUBLIC_BASE_URL": settings.r2_public_base_url,
    }
    missing = [name for name, value in required.items() if not value.strip()]
    if missing:
        raise StorageUploadError(f"R2 설정이 누락되었습니다: {', '.join(missing)}")


@lru_cache
def _r2_client() -> S3Client:
    validate_storage_configuration()
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint_url,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name="auto",
    )


def _save_r2_upload(key: str, upload: UploadFile) -> str:
    validate_storage_configuration()
    try:
        upload.file.seek(0)
        _r2_client().upload_fileobj(
            upload.file,
            settings.r2_bucket_name,
            key,
            ExtraArgs={
                "ContentType": upload.content_type or "application/octet-stream",
                "CacheControl": "public, max-age=31536000, immutable",
            },
        )
    except StorageUploadError:
        raise
    except Exception as exc:
        raise StorageUploadError("R2에 파일을 저장하지 못했습니다.") from exc
    return f"{settings.r2_public_base_url.rstrip('/')}/{key}"


def _save_local_upload(key: str, upload: UploadFile, max_size: int) -> str:
    target = Path(settings.media_dir) / Path(*key.split("/"))
    target.parent.mkdir(parents=True, exist_ok=True)
    size = 0
    upload.file.seek(0)
    with target.open("wb") as output:
        while chunk := upload.file.read(1024 * 1024):
            size += len(chunk)
            if size > max_size:
                target.unlink(missing_ok=True)
                raise ValueError(f"파일 크기는 {max_size // (1024 * 1024)}MB 이하여야 합니다.")
            output.write(chunk)
    return f"/media/{key}"


def save_media_upload(folder: str, upload: UploadFile, allowed_types: set[str], max_size: int) -> tuple[str, str, int]:
    if upload.content_type not in allowed_types:
        raise ValueError("지원하지 않는 파일 형식입니다.")
    size = _upload_size(upload.file)
    if size > max_size:
        raise ValueError(f"파일 크기는 {max_size // (1024 * 1024)}MB 이하여야 합니다.")
    key = _object_key(folder, upload.content_type, upload.filename or "image")
    url = _save_r2_upload(key, upload) if settings.uses_r2 else _save_local_upload(key, upload, max_size)
    return key, url, size


def save_upload(project_id: str, upload: UploadFile) -> tuple[str, str, int]:
    return save_media_upload(project_id, upload, ALLOWED_TYPES, settings.max_upload_size)


def save_scan_upload(simulation_id: str, upload: UploadFile) -> tuple[str, str, int]:
    return save_media_upload(f"scans/{simulation_id}", upload, SCAN_TYPES, settings.max_scan_upload_size)
