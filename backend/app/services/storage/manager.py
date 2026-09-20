from app.core.config import settings
from app.services.storage.base import StorageProvider
from app.services.storage.local import LocalStorageProvider
from app.services.storage.s3 import S3StorageProvider

_storage_instance: StorageProvider = None

def get_storage_provider() -> StorageProvider:
    global _storage_instance
    if _storage_instance is None:
        if settings.STORAGE_PROVIDER == "s3":
            _storage_instance = S3StorageProvider()
        else:
            _storage_instance = LocalStorageProvider()
    return _storage_instance
