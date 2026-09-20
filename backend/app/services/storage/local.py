import os
import aiofiles
from pathlib import Path
from typing import Optional
from app.services.storage.base import StorageProvider
from app.core.config import settings

class LocalStorageProvider(StorageProvider):
    def __init__(self, base_dir: str = None):
        self.base_dir = Path(base_dir or settings.STORAGE_LOCAL_DIR)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    async def save(self, file_path: str, data: bytes, content_type: str = "image/png") -> str:
        # Sanitize filename / relative path
        clean_path = Path(file_path).as_posix().lstrip("/")
        full_path = self.base_dir / clean_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        
        async with aiofiles.open(full_path, "wb") as f:
            await f.write(data)
        return clean_path

    async def get(self, file_path: str) -> Optional[bytes]:
        clean_path = Path(file_path).as_posix().lstrip("/")
        full_path = self.base_dir / clean_path
        if not full_path.exists():
            return None
        async with aiofiles.open(full_path, "rb") as f:
            return await f.read()

    async def delete(self, file_path: str) -> bool:
        clean_path = Path(file_path).as_posix().lstrip("/")
        full_path = self.base_dir / clean_path
        if full_path.exists():
            full_path.unlink()
            return True
        return False

    def get_public_url(self, file_path: str) -> str:
        clean_path = Path(file_path).as_posix().lstrip("/")
        return f"/api/v1/storage/{clean_path}"
