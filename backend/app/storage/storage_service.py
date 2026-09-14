"""
CTF Platform — Storage Service (Abstract + S3 + Local)
Provides a consistent interface for file uploads regardless of backend.
"""
import os
import uuid
import mimetypes
import re
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

import boto3
from botocore.exceptions import ClientError

from app.core.config import settings

# ── Allowed MIME types for challenge files ─────────────────────────────────
ALLOWED_MIME_TYPES = {
    "application/zip",
    "application/x-zip-compressed",
    "application/octet-stream",
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "text/plain",
    "application/vnd.android.package-archive",  # .apk
    "application/x-pcap",
    "application/x-executable",
    "application/x-elf",
}

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a filename: remove path components, strip dangerous chars.
    Prevents path traversal attacks.
    """
    # Strip any path components
    filename = Path(filename).name
    # Remove non-alphanumeric chars except dot, hyphen, underscore
    filename = re.sub(r"[^\w\-.]", "_", filename)
    # Prevent hidden files / double-extension tricks
    if filename.startswith("."):
        filename = f"file{filename}"
    return filename[:200]  # max 200 chars


def validate_mime_type(mime_type: str) -> bool:
    """Validate that a MIME type is allowed for challenge files."""
    return mime_type in ALLOWED_MIME_TYPES


class StorageBackend(ABC):
    """Abstract storage backend interface."""

    @abstractmethod
    async def upload(
        self,
        *,
        data: bytes,
        storage_key: str,
        mime_type: str,
    ) -> str:
        """Upload a file. Returns the storage key."""

    @abstractmethod
    async def get_download_url(self, storage_key: str, expires_in: int = 3600) -> str:
        """Get a (pre-signed) URL for downloading a file."""

    @abstractmethod
    async def delete(self, storage_key: str) -> None:
        """Delete a file from storage."""

    @abstractmethod
    async def exists(self, storage_key: str) -> bool:
        """Check if a file exists."""


class S3StorageBackend(StorageBackend):
    """AWS S3 (or compatible: Cloudflare R2, MinIO) storage backend."""

    def __init__(self):
        kwargs = {
            "aws_access_key_id": settings.AWS_ACCESS_KEY_ID,
            "aws_secret_access_key": settings.AWS_SECRET_ACCESS_KEY,
            "region_name": settings.AWS_REGION,
        }
        if settings.AWS_S3_ENDPOINT_URL:
            kwargs["endpoint_url"] = settings.AWS_S3_ENDPOINT_URL

        self.client = boto3.client("s3", **kwargs)
        self.bucket = settings.AWS_S3_BUCKET

    async def upload(self, *, data: bytes, storage_key: str, mime_type: str) -> str:
        self.client.put_object(
            Bucket=self.bucket,
            Key=storage_key,
            Body=data,
            ContentType=mime_type,
        )
        return storage_key

    async def get_download_url(self, storage_key: str, expires_in: int = 3600) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": storage_key},
            ExpiresIn=expires_in,
        )

    async def delete(self, storage_key: str) -> None:
        try:
            self.client.delete_object(Bucket=self.bucket, Key=storage_key)
        except ClientError:
            pass

    async def exists(self, storage_key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=storage_key)
            return True
        except ClientError:
            return False


class LocalStorageBackend(StorageBackend):
    """Local filesystem storage (development only)."""

    def __init__(self):
        self.base_path = Path(settings.LOCAL_STORAGE_PATH)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _full_path(self, storage_key: str) -> Path:
        # Prevent path traversal
        safe_key = storage_key.replace("..", "").lstrip("/")
        return self.base_path / safe_key

    async def upload(self, *, data: bytes, storage_key: str, mime_type: str) -> str:
        path = self._full_path(storage_key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return storage_key

    async def get_download_url(self, storage_key: str, expires_in: int = 3600) -> str:
        # For local dev: return a backend download URL
        return f"{settings.BACKEND_URL}/api/v1/files/download/{storage_key}"

    async def delete(self, storage_key: str) -> None:
        path = self._full_path(storage_key)
        if path.exists():
            path.unlink()

    async def exists(self, storage_key: str) -> bool:
        return self._full_path(storage_key).exists()

    async def read(self, storage_key: str) -> Optional[bytes]:
        path = self._full_path(storage_key)
        if path.exists():
            return path.read_bytes()
        return None


class StorageService:
    """
    High-level storage service. Wraps the configured backend.
    Use this class everywhere — never call the backend directly.
    """

    def __init__(self):
        if settings.STORAGE_PROVIDER == "s3":
            self.backend = S3StorageBackend()
        else:
            self.backend = LocalStorageBackend()

    def _generate_key(self, prefix: str, original_filename: str) -> str:
        """Generate a unique storage key from a prefix and original filename."""
        safe_name = sanitize_filename(original_filename)
        unique_id = uuid.uuid4().hex
        return f"{prefix}/{unique_id}_{safe_name}"

    async def upload_challenge_file(
        self,
        *,
        challenge_id: str,
        data: bytes,
        original_filename: str,
        mime_type: str,
    ) -> str:
        """Upload a challenge attachment. Returns the storage key."""
        if len(data) > MAX_FILE_SIZE:
            raise ValueError(f"File exceeds maximum size of {MAX_FILE_SIZE // (1024*1024)} MB")
        if not validate_mime_type(mime_type):
            raise ValueError(f"File type '{mime_type}' is not allowed")

        storage_key = self._generate_key(f"challenges/{challenge_id}", original_filename)
        await self.backend.upload(data=data, storage_key=storage_key, mime_type=mime_type)
        return storage_key

    async def get_file_url(self, storage_key: str, expires_in: int = 3600) -> str:
        """Get a download URL for a stored file."""
        return await self.backend.get_download_url(storage_key, expires_in=expires_in)

    async def delete_file(self, storage_key: str) -> None:
        await self.backend.delete(storage_key)

    async def upload_avatar(
        self,
        *,
        user_id: str,
        data: bytes,
        mime_type: str,
    ) -> str:
        """Upload a user avatar."""
        allowed = {"image/jpeg", "image/png", "image/webp", "image/gif"}
        if mime_type not in allowed:
            raise ValueError("Avatar must be JPEG, PNG, WebP, or GIF")
        if len(data) > 5 * 1024 * 1024:
            raise ValueError("Avatar must be under 5 MB")
        key = f"avatars/{user_id}/{uuid.uuid4().hex}"
        await self.backend.upload(data=data, storage_key=key, mime_type=mime_type)
        return key


# Singleton
storage_service = StorageService()
