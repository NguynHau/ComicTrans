import io
from typing import List
from PIL import Image, ImageDraw
from app.services.inpainting.base import InpaintingService
from app.schemas import BoundingBox

class MockInpaintingService(InpaintingService):
    async def inpaint(self, image_bytes: bytes, bboxes: List[BoundingBox]) -> bytes:
        if not bboxes:
            return image_bytes
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
            draw = ImageDraw.Draw(image)

            for b in bboxes:
                # Fill speech bubble bounding area with solid/soft off-white mask
                draw.rectangle(
                    [b.x, b.y, b.x + b.width, b.y + b.height],
                    fill=(255, 255, 255, 245)
                )

            out = io.BytesIO()
            image.save(out, format="PNG")
            return out.getvalue()
        except Exception:
            return image_bytes
