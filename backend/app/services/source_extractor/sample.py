from typing import List, Dict, Any
from app.services.source_extractor.base import SourceExtractor

SAMPLE_CHAPTERS = {
    "sample://manga/chapter-1": {
        "title": "One Piece Chapter 1090 [JP Sample]",
        "images": [
            "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1000&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1000&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1618336753974-aae8e04506aa?w=1000&auto=format&fit=crop&q=80"
        ]
    },
    "sample://manhwa/solo-leveling": {
        "title": "Solo Leveling Episode 1 [KR Sample]",
        "images": [
            "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1000&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1563089145-599997674d42?w=1000&auto=format&fit=crop&q=80"
        ]
    }
}

class SampleChapterExtractor(SourceExtractor):
    def can_handle(self, url: str) -> bool:
        return url.startswith("sample://") or "example.com/manga" in url or "sample" in url.lower()

    async def analyze(self, url: str) -> Dict[str, Any]:
        sample = SAMPLE_CHAPTERS.get(url, {
            "title": "Sample Manga Chapter",
            "images": [
                "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1000&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1000&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1618336753974-aae8e04506aa?w=1000&auto=format&fit=crop&q=80"
            ]
        })
        return {
            "url": url,
            "title": sample["title"],
            "total_images": len(sample["images"]),
            "images": sample["images"]
        }

    async def extract_images(self, url: str) -> List[str]:
        data = await self.analyze(url)
        return data["images"]
