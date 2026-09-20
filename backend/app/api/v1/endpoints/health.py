from fastapi import APIRouter
from app.core.config import settings

router = APIRouter()

@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "version": settings.VERSION,
        "ocr_provider": settings.OCR_PROVIDER,
        "translation_provider": settings.TRANSLATION_PROVIDER,
        "storage_provider": settings.STORAGE_PROVIDER
    }
