from abc import ABC, abstractmethod
from typing import List, Optional
from app.schemas import OCRItem

class OCRService(ABC):
    @abstractmethod
    async def detect_and_ocr(self, image_bytes: bytes, source_language: str = "auto") -> List[OCRItem]:
        """
        Detect text balloons/regions, extract text, bounding boxes, confidence, and reading order.
        """
        pass
