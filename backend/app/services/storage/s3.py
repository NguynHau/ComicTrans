import io
from typing import Optional
from app.services.storage.base import StorageProvider
from app.core.config import settings

class S3StorageProvider(StorageProvider):
    def __init__(self):
        try:
            import boto3
            self.s3 = boto3.client(
                's3',
                endpoint_url=settings.STORAGE_ENDPOINT or None,
                aws_access_key_id=settings.STORAGE_ACCESS_KEY or None,
                aws_secret_access_key=settings.STORAGE_SECRET_KEY or None,
                region_name=settings.STORAGE_REGION or "us-east-1"
            )
            self.bucket = settings.STORAGE_BUCKET
        except Exception as e:
            self.s3 = None
            self.bucket = settings.STORAGE_BUCKET

    async def save(self, file_path: str, data: bytes, content_type: str = "image/png") -> str:
        clean_path = file_path.lstrip("/")
        if self.s3:
            self.s3.put_object(
                Bucket=self.bucket,
                Key=clean_path,
                Body=data,
                ContentType=content_type
            )
        return clean_path

    async def get(self, file_path: str) -> Optional[bytes]:
        clean_path = file_path.lstrip("/")
        if not self.s3:
            return None
        try:
            resp = self.s3.get_object(Bucket=self.bucket, Key=clean_path)
            return resp['Body'].read()
        except Exception:
            return None

    async def delete(self, file_path: str) -> bool:
        clean_path = file_path.lstrip("/")
        if not self.s3:
            return False
        try:
            self.s3.delete_object(Bucket=self.bucket, Key=clean_path)
            return True
        except Exception:
            return False

    def get_public_url(self, file_path: str) -> str:
        clean_path = file_path.lstrip("/")
        if settings.STORAGE_ENDPOINT:
            return f"{settings.STORAGE_ENDPOINT.rstrip('/')}/{self.bucket}/{clean_path}"
        return f"https://{self.bucket}.s3.{settings.STORAGE_REGION}.amazonaws.com/{clean_path}"
