import pytest
import io
from PIL import Image
from app.services.ocr.mock_ocr import MockOCRService
from app.services.translation.mock_translation import MockTranslationService
from app.services.inpainting.mock_inpainting import MockInpaintingService
from app.services.typesetting.pillow_typesetter import PillowTypesettingService
from app.services.typesetting.base import TypesetItem
from app.schemas import BoundingBox

@pytest.mark.asyncio
async def test_ocr_and_translation_flow():
    # 1. Create a dummy test image
    img = Image.new("RGB", (600, 800), color=(240, 240, 240))
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    raw_bytes = img_byte_arr.getvalue()

    # 2. OCR detection
    ocr = MockOCRService()
    items = await ocr.detect_and_ocr(raw_bytes, "ja")
    assert len(items) > 0
    assert items[0].text != ""

    # 3. Translation
    translator = MockTranslationService()
    translations = await translator.translate(
        [item.text for item in items],
        source_language="ja",
        target_language="vi"
    )
    assert len(translations) == len(items)
    assert "Vua Hải Tặc" in translations[0]

    # 4. Inpainting
    inpainter = MockInpaintingService()
    cleaned = await inpainter.inpaint(raw_bytes, [item.bbox for item in items])
    assert len(cleaned) > 0

    # 5. Typesetting
    typesetter = PillowTypesettingService()
    typeset_items = [
        TypesetItem(translation=trans, bbox=item.bbox)
        for item, trans in zip(items, translations)
    ]
    final_img = await typesetter.typeset(cleaned, typeset_items)
    assert len(final_img) > 0
