from abc import ABC, abstractmethod
from typing import List, Dict, Any, Tuple
from pydantic import BaseModel

class ExtractedChapter(BaseModel):
    url: str
    title: str
    images: List[str] # Ordered list of image URLs

class SourceExtractor(ABC):
    @abstractmethod
    def can_handle(self, url: str) -> bool:
        """Check if this extractor can handle the given URL."""
        pass

    @abstractmethod
    async def analyze(self, url: str) -> Dict[str, Any]:
        """Analyze the chapter page and return metadata and image count."""
        pass

    @abstractmethod
    async def extract_images(self, url: str) -> List[str]:
        """Extract high-resolution comic page image URLs in order."""
        pass
