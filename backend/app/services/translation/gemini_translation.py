import json
from typing import List, Dict, Any, Optional
from app.services.translation.base import TranslationService
from app.core.config import settings

class GeminiTranslationService(TranslationService):
    def __init__(self, api_key: str = None):
        self.api_key = api_key or settings.GEMINI_API_KEY

    async def translate(
        self,
        texts: List[str],
        source_language: str = "auto",
        target_language: str = "vi",
        context: Optional[Dict[str, Any]] = None
    ) -> List[str]:
        if not texts:
            return []

        if not self.api_key:
            from app.services.translation.mock_translation import MockTranslationService
            return await MockTranslationService().translate(texts, source_language, target_language, context)

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=self.api_key)

            lang_map = {
                "vi": "Vietnamese",
                "en": "English",
                "ja": "Japanese",
                "ko": "Korean",
                "zh": "Chinese",
                "fr": "French",
                "es": "Spanish",
                "id": "Indonesian",
                "th": "Thai"
            }
            target_name = lang_map.get(target_language, target_language)
            source_name = lang_map.get(source_language, source_language) if source_language != "auto" else "the original manga language"

            chapter_title = context.get("title", "") if context else ""
            page_num = context.get("page_number", 1) if context else 1

            prompt = (
                f"You are a professional comic and manga localization translator. "
                f"Translate the following ordered dialogue bubbles from {source_name} into fluent, natural {target_name}. "
                f"Context: Chapter '{chapter_title}', Page {page_num}. "
                f"Guidelines: "
                f"1. Keep the emotional tone, slang, character personality, and comedic nuances. "
                f"2. For Vietnamese, use natural pronouns (cậu/tớ, anh/em, ngươi/ta, tôi) matching manga context. "
                f"3. Return an array of translated strings with the exact same length and order as the input array."
            )

            response = client.models.generate_content(
                model="gemini-3.8-flash",
                contents=[
                    prompt,
                    json.dumps(texts, ensure_ascii=False)
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema={
                        "type": "ARRAY",
                        "items": {"type": "STRING"}
                    }
                )
            )

            result = json.loads(response.text)
            if isinstance(result, list) and len(result) == len(texts):
                return result
            return result if isinstance(result, list) else texts

        except Exception as e:
            from app.services.translation.mock_translation import MockTranslationService
            return await MockTranslationService().translate(texts, source_language, target_language, context)
