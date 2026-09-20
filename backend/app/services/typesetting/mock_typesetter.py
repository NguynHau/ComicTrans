from typing import List
from app.services.typesetting.base import TypesettingService, TypesetItem

class MockTypesettingService(TypesettingService):
    async def typeset(self, image_bytes: bytes, items: List[TypesetItem]) -> bytes:
        from app.services.typesetting.pillow_typesetter import PillowTypesettingService
        return await PillowTypesettingService().typeset(image_bytes, items)
