import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "Manga Translator API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Server
    PORT: int = 8000
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,*"
    
    # Database
    DATABASE_URL: str = "sqlite:///./manga_app.db" # Default fallback for local dev
    
    # AI & Providers
    GEMINI_API_KEY: str = ""
    TRANSLATION_PROVIDER: str = "gemini" # gemini | mock
    OCR_PROVIDER: str = "gemini" # gemini | tesseract | mock
    
    # Storage
    STORAGE_PROVIDER: str = "local" # local | s3
    STORAGE_LOCAL_DIR: str = "./storage"
    STORAGE_BUCKET: str = "manga-translated-pages"
    STORAGE_ENDPOINT: str = ""
    STORAGE_ACCESS_KEY: str = ""
    STORAGE_SECRET_KEY: str = ""
    STORAGE_REGION: str = "us-east-1"
    
    # Security & Limits
    MAX_PAGES_PER_JOB: int = 50
    MAX_IMAGE_SIZE_MB: int = 20
    MAX_SOURCE_HTML_MB: int = 10
    JOB_TIMEOUT_MINUTES: int = 15
    REQUEST_TIMEOUT_SECONDS: int = 15
    ALLOWED_IMAGE_MIME_TYPES: List[str] = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/avif"
    ]
    
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
