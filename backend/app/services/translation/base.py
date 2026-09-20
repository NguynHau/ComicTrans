from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class TranslationService(ABC):
    @abstractmethod
    async def translate(
        self,
        texts: List[str],
        source_language: str = "auto",
        target_language: str = "vi",
        context: Optional[Dict[str, Any]] = None
    ) -> List[str]:
        """
        Translate a list of comic dialogue texts while preserving chapter/scene context.
        """
        pass
