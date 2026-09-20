from typing import List, Dict, Any, Optional
from app.services.translation.base import TranslationService

# Realistic manga dialogue mappings for mock / offline fallback
SAMPLE_DICTIONARY = {
    "オレは海賊王になる男だ！": {
        "vi": "Tôi là người đàn ông sẽ trở thành Vua Hải Tặc!",
        "en": "I'm the man who will become the Pirate King!"
    },
    "行くぞ、みんな！準備はいいか？": {
        "vi": "Đi thôi mọi người! Mọi người đã sẵn sàng chưa?",
        "en": "Let's go, everyone! Are you ready?"
    },
    "任せておけ！この力を見せてやる！": {
        "vi": "Cứ để đó cho tôi! Tôi sẽ cho họ thấy sức mạnh này!",
        "en": "Leave it to me! I'll show them this power!"
    }
}

class MockTranslationService(TranslationService):
    async def translate(
        self,
        texts: List[str],
        source_language: str = "auto",
        target_language: str = "vi",
        context: Optional[Dict[str, Any]] = None
    ) -> List[str]:
        results = []
        for text in texts:
            if text in SAMPLE_DICTIONARY and target_language in SAMPLE_DICTIONARY[text]:
                results.append(SAMPLE_DICTIONARY[text][target_language])
            else:
                if target_language == "vi":
                    results.append(f"[Dịch] {text}")
                elif target_language == "en":
                    results.append(f"[Translated] {text}")
                else:
                    results.append(f"[{target_language.upper()}] {text}")
        return results
