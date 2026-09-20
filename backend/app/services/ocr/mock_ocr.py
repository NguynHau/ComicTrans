from typing import List
from app.services.ocr.base import OCRService
from app.schemas import OCRItem, BoundingBox

class MockOCRService(OCRService):
    async def detect_and_ocr(self, image_bytes: bytes, source_language: str = "auto") -> List[OCRItem]:
        # Return sample speech bubbles positioned naturally across manga panels
        return [
            OCRItem(
                text="オレは海賊王になる男だ！",
                bbox=BoundingBox(x=140, y=120, width=220, height=90),
                confidence=0.98,
                language="ja"
            ),
            OCRItem(
                text="行くぞ、みんな！準備はいいか？",
                bbox=BoundingBox(x=450, y=280, width=260, height=110),
                confidence=0.95,
                language="ja"
            ),
            OCRItem(
                text="任せておけ！この力を見せてやる！",
                bbox=BoundingBox(x=180, y=520, width=280, height=100),
                confidence=0.96,
                language="ja"
            )
        ]
