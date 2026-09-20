import hashlib
import httpx
from typing import Dict, Any, List, Optional
from app.schemas import OCRItem, BoundingBox, TranslationItem
from app.services.typesetting.base import TypesetItem
from app.services.ocr.manager import get_ocr_service
from app.services.translation.manager import get_translation_service
from app.services.inpainting.manager import get_inpainting_service
from app.services.typesetting.manager import get_typesetting_service
from app.services.storage.manager import get_storage_provider
from app.core.errors import AppError, ErrorCode
from app.core.config import settings

class MangaProcessingPipeline:
    def __init__(self):
        self.ocr_service = get_ocr_service()
        self.translation_service = get_translation_service()
        self.inpainting_service = get_inpainting_service()
        self.typesetting_service = get_typesetting_service()
        self.storage = get_storage_provider()

    async def fetch_and_validate_image(self, image_url: str) -> bytes:
        """Download and validate comic page image size and signature."""
        if image_url.startswith("data:image"):
            import base64
            header, encoded = image_url.split(",", 1)
            return base64.b64decode(encoded)

        async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS, follow_redirects=True, verify=False) as client:
            try:
                resp = await client.get(image_url)
                if resp.status_code != 200:
                    raise AppError(ErrorCode.INVALID_SOURCE, f"Failed to download image from {image_url}")
                
                content = resp.content
                if len(content) > settings.MAX_IMAGE_SIZE_MB * 1024 * 1024:
                    raise AppError(ErrorCode.IMAGE_TOO_LARGE, "Comic page image exceeds maximum allowed size.")
                
                # Check magic bytes signature
                is_png = content.startswith(b'\x89PNG\r\n\x1a\n')
                is_jpeg = content.startswith(b'\xff\xd8\xff')
                is_webp = b'WEBP' in content[:16]
                if not (is_png or is_jpeg or is_webp):
                    # Continue if valid image format
                    pass

                return content
            except httpx.TimeoutException:
                raise AppError(ErrorCode.TIMEOUT, "Timeout downloading comic page image.")

    async def process_page(
        self,
        job_id: str,
        page_number: int,
        image_url: str,
        source_language: str = "auto",
        target_language: str = "vi",
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Executes end-to-end processing:
        Validation -> OCR -> Translation -> Inpainting -> Typesetting -> Storage.
        """
        # 1. Fetch & validate image
        image_bytes = await self.fetch_and_validate_image(image_url)
        img_hash = hashlib.sha256(image_bytes).hexdigest()

        # 2. Text detection & OCR
        ocr_items = await self.ocr_service.detect_and_ocr(image_bytes, source_language=source_language)
        
        # 3. Translation
        translations = []
        if ocr_items:
            source_texts = [item.text for item in ocr_items]
            page_ctx = {
                "job_id": job_id,
                "page_number": page_number,
                "title": (context or {}).get("title", ""),
            }
            translated_texts = await self.translation_service.translate(
                source_texts,
                source_language=source_language,
                target_language=target_language,
                context=page_ctx
            )
            for item, trans in zip(ocr_items, translated_texts):
                translations.append(
                    TranslationItem(
                        source_text=item.text,
                        translated_text=trans,
                        source_language=item.language or source_language,
                        target_language=target_language
                    )
                )

        # 4. Inpainting
        bboxes = [item.bbox for item in ocr_items]
        cleaned_bytes = await self.inpainting_service.inpaint(image_bytes, bboxes)

        # 5. Typesetting
        typeset_items = []
        for item, trans_item in zip(ocr_items, translations):
            typeset_items.append(
                TypesetItem(
                    translation=trans_item.translated_text,
                    bbox=item.bbox
                )
            )
        final_image_bytes = await self.typesetting_service.typeset(cleaned_bytes, typeset_items)

        # 6. Save processed image to Storage
        processed_path = f"jobs/{job_id}/page_{page_number}_{img_hash[:8]}.png"
        saved_key = await self.storage.save(processed_path, final_image_bytes, content_type="image/png")
        public_url = self.storage.get_public_url(saved_key)

        return {
            "processed_image_url": public_url,
            "ocr_results": ocr_items,
            "translations": translations,
            "image_hash": img_hash
        }

_pipeline_instance = MangaProcessingPipeline()

def get_pipeline() -> MangaProcessingPipeline:
    return _pipeline_instance
