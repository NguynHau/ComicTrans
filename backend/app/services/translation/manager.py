from app.core.config import settings
from app.services.translation.base import TranslationService
from app.services.translation.gemini_translation import GeminiTranslationService
from app.services.translation.mock_translation import MockTranslationService

_translation_service = None

def get_translation_service() -> TranslationService:
    global _translation_service
    if _translation_service is None:
        if settings.TRANSLATION_PROVIDER == "gemini" and settings.GEMINI_API_KEY:
            _translation_service = GeminiTranslationService(settings.GEMINI_API_KEY)
        else:
            _translation_service = MockTranslationService()
    return _translation_service
