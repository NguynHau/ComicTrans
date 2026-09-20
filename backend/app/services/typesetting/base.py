from abc import ABC, abstractmethod
from typing import List, Dict, Any
from pydantic import BaseModel
from app.schemas import BoundingBox

class TypesetItem(BaseModel):
    translation: str
    bbox: BoundingBox
    original_font_size: int = 16
    color: str = "#000000"
    alignment: str = "center" # center | left | right

class TypesettingService(ABC):
    @abstractmethod
    async def typeset(self, image_bytes: bytes, items: List[TypesetItem]) -> bytes:
        """
        Render translated text into speech bubbles with automatic font sizing, word-wrap, and centering.
        """
        pass
