from abc import ABC, abstractmethod
from typing import Optional

class StorageProvider(ABC):
    @abstractmethod
    async def save(self, file_path: str, data: bytes, content_type: str = "image/png") -> str:
        """Save file bytes and return access path or URL."""
        pass

    @abstractmethod
    async def get(self, file_path: str) -> Optional[bytes]:
        """Retrieve file bytes by path."""
        pass

    @abstractmethod
    async def delete(self, file_path: str) -> bool:
        """Delete file by path."""
        pass

    @abstractmethod
    def get_public_url(self, file_path: str) -> str:
        """Return public URL or API route path to access the file."""
        pass
