from app.core.config import settings
from app.services.ocr.base import OCRService
from app.services.ocr.gemini_ocr import GeminiOCRService
from app.services.ocr.mock_ocr import MockOCRService

_ocr_service = None

def get_ocr_service() -> OCRService:
    global _ocr_service
    if _ocr_service is None:
        if settings.OCR_PROVIDER == "gemini" and settings.GEMINI_API_KEY:
            _ocr_service = GeminiOCRService(settings.GEMINI_API_KEY)
        else:
            _ocr_service = MockOCRService()
    return _ocr_service
