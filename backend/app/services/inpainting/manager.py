from app.services.inpainting.base import InpaintingService
from app.services.inpainting.opencv_inpainting import OpenCVInpaintingService

_inpainting_service = None

def get_inpainting_service() -> InpaintingService:
    global _inpainting_service
    if _inpainting_service is None:
        _inpainting_service = OpenCVInpaintingService()
    return _inpainting_service
