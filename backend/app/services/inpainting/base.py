from abc import ABC, abstractmethod
from typing import List
from app.schemas import BoundingBox

class InpaintingService(ABC):
    @abstractmethod
    async def inpaint(self, image_bytes: bytes, bboxes: List[BoundingBox]) -> bytes:
        """
        Remove original text inside speech bubbles / bboxes and reconstruct background cleanly.
        """
        pass
