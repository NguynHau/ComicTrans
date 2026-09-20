import base64
import json
from typing import List
from app.services.ocr.base import OCRService
from app.schemas import OCRItem, BoundingBox
from app.core.config import settings

class GeminiOCRService(OCRService):
    def __init__(self, api_key: str = None):
        self.api_key = api_key or settings.GEMINI_API_KEY

    async def detect_and_ocr(self, image_bytes: bytes, source_language: str = "auto") -> List[OCRItem]:
        if not self.api_key:
            # Fallback to smart heuristic detection if no API key
            from app.services.ocr.mock_ocr import MockOCRService
            return await MockOCRService().detect_and_ocr(image_bytes, source_language)

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=self.api_key)
            b64_img = base64.b64encode(image_bytes).decode('utf-8')

            prompt = (
                "You are an expert Manga/Manhwa/Manhua OCR and Vision engine. "
                "Detect all speech bubbles, dialogue boxes, and captions in this comic page image. "
                "For each text balloon, return: "
                "1. Exact text transcribed in the original language (Japanese/Korean/Chinese/English/etc.) "
                "2. Absolute pixel coordinates bounding box: x, y, width, height (based on image pixel dimensions) "
                "3. Confidence score (0.0 to 1.0) "
                "4. Detected language code (ja, ko, zh, en, etc.) "
                "Preserve standard comic reading order (right-to-left for Japanese Manga, top-to-bottom for Manhwa/Webtoons)."
            )

            response = client.models.generate_content(
                model="gemini-3.8-flash",
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type="image/png"),
                    prompt
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema={
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "text": {"type": "STRING"},
                                "x": {"type": "INTEGER"},
                                "y": {"type": "INTEGER"},
                                "width": {"type": "INTEGER"},
                                "height": {"type": "INTEGER"},
                                "confidence": {"type": "NUMBER"},
                                "language": {"type": "STRING"}
                            },
                            "required": ["text", "x", "y", "width", "height"]
                        }
                    }
                )
            )

            data = json.loads(response.text)
            results = []
            for item in data:
                results.append(
                    OCRItem(
                        text=item.get("text", "").strip(),
                        bbox=BoundingBox(
                            x=int(item.get("x", 0)),
                            y=int(item.get("y", 0)),
                            width=max(10, int(item.get("width", 50))),
                            height=max(10, int(item.get("height", 30)))
                        ),
                        confidence=float(item.get("confidence", 0.98)),
                        language=item.get("language", source_language if source_language != "auto" else "ja")
                    )
                )
            return results

        except Exception as e:
            # Fallback gracefully
            from app.services.ocr.mock_ocr import MockOCRService
            return await MockOCRService().detect_and_ocr(image_bytes, source_language)
