from typing import List
from app.services.source_extractor.base import SourceExtractor
from app.services.source_extractor.sample import SampleChapterExtractor
from app.services.source_extractor.generic import GenericHtmlExtractor

class ExtractorManager:
    def __init__(self):
        self._extractors: List[SourceExtractor] = [
            SampleChapterExtractor(),
            # Additional specialized site extractors can be registered here:
            # MangadexExtractor(),
            # WebtoonsExtractor(),
            GenericHtmlExtractor() # Generic fallback is always last
        ]

    def register_extractor(self, extractor: SourceExtractor, prepend: bool = True):
        if prepend:
            self._extractors.insert(0, extractor)
        else:
            self._extractors.append(extractor)

    def get_extractor_for_url(self, url: str) -> SourceExtractor:
        for extractor in self._extractors:
            if extractor.can_handle(url):
                return extractor
        return self._extractors[-1]

_extractor_manager = ExtractorManager()

def get_extractor_manager() -> ExtractorManager:
    return _extractor_manager
