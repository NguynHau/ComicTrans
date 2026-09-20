from app.services.typesetting.base import TypesettingService
from app.services.typesetting.pillow_typesetter import PillowTypesettingService

_typesetting_service = None

def get_typesetting_service() -> TypesettingService:
    global _typesetting_service
    if _typesetting_service is None:
        _typesetting_service = PillowTypesettingService()
    return _typesetting_service
