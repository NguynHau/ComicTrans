import io
from typing import List
from app.services.inpainting.base import InpaintingService
from app.schemas import BoundingBox

class OpenCVInpaintingService(InpaintingService):
    async def inpaint(self, image_bytes: bytes, bboxes: List[BoundingBox]) -> bytes:
        if not bboxes:
            return image_bytes

        try:
            import cv2
            import numpy as np
            from PIL import Image

            # Load image from bytes
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                return image_bytes

            h, w, _ = img.shape
            mask = np.zeros((h, w), dtype=np.uint8)

            for b in bboxes:
                # Clamp coordinates
                x1 = max(0, min(w - 1, b.x))
                y1 = max(0, min(h - 1, b.y))
                x2 = max(0, min(w, b.x + b.width))
                y2 = max(0, min(h, b.y + b.height))

                # Extract region to detect text stroke vs speech balloon background
                roi = img[y1:y2, x1:x2]
                if roi.size == 0:
                    continue

                gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
                # Text in manga is typically dark strokes on light background (or vice versa)
                _, thresh = cv2.threshold(gray_roi, 180, 255, cv2.THRESH_BINARY_INV)

                # Expand slightly to cover anti-aliased font edges
                kernel = np.ones((3, 3), np.uint8)
                dilated = cv2.dilate(thresh, kernel, iterations=2)

                mask[y1:y2, x1:x2] = dilated

            # Perform inpainting using Telea algorithm
            inpainted = cv2.inpaint(img, mask, inpaintRadius=5, flags=cv2.INPAINT_TELEA)

            # Encode back to PNG
            _, encoded_img = cv2.imencode('.png', inpainted)
            return encoded_img.tobytes()

        except Exception as e:
            from app.services.inpainting.mock_inpainting import MockInpaintingService
            return await MockInpaintingService().inpaint(image_bytes, bboxes)
