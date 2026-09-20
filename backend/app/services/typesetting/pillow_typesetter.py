import io
import textwrap
from typing import List
from PIL import Image, ImageDraw, ImageFont
from app.services.typesetting.base import TypesettingService, TypesetItem

class PillowTypesettingService(TypesettingService):
    def _find_font(self, size: int):
        font_paths = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
            "Arial.ttf",
            "DejaVuSans.ttf"
        ]
        for p in font_paths:
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
        return ImageFont.load_default()

    def _fit_text_in_box(self, draw: ImageDraw.ImageDraw, text: str, max_w: int, max_h: int):
        """Find best font size and wrapped lines to fit max_w and max_h."""
        for font_size in range(32, 10, -2):
            font = self._find_font(font_size)
            # Estimate character width
            avg_char_w = max(6, font_size * 0.55)
            wrap_chars = max(4, int(max_w / avg_char_w))
            
            lines = textwrap.wrap(text, width=wrap_chars)
            if not lines:
                continue

            # Calculate total height
            line_height = int(font_size * 1.3)
            total_h = len(lines) * line_height

            # Check max line width
            max_line_w = 0
            for line in lines:
                try:
                    bbox = draw.textbbox((0, 0), line, font=font)
                    w = bbox[2] - bbox[0]
                except Exception:
                    w = len(line) * avg_char_w
                max_line_w = max(max_line_w, w)

            if max_line_w <= max_w and total_h <= max_h:
                return font, lines, font_size, line_height

        font = self._find_font(12)
        lines = textwrap.wrap(text, width=max(4, int(max_w / 7)))
        return font, lines, 12, 16

    async def typeset(self, image_bytes: bytes, items: List[TypesetItem]) -> bytes:
        if not items:
            return image_bytes

        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
            draw = ImageDraw.Draw(image)

            for item in items:
                b = item.bbox
                text = item.translation.strip()
                if not text:
                    continue

                # Add padding inside bubble
                pad_x = max(4, int(b.width * 0.1))
                pad_y = max(4, int(b.height * 0.1))
                inner_w = max(10, b.width - 2 * pad_x)
                inner_h = max(10, b.height - 2 * pad_y)

                font, lines, font_size, line_height = self._fit_text_in_box(draw, text, inner_w, inner_h)

                total_text_h = len(lines) * line_height
                start_y = b.y + pad_y + max(0, (inner_h - total_text_h) // 2)

                for i, line in enumerate(lines):
                    try:
                        bbox = draw.textbbox((0, 0), line, font=font)
                        line_w = bbox[2] - bbox[0]
                    except Exception:
                        line_w = len(line) * (font_size * 0.5)

                    line_x = b.x + pad_x + max(0, (inner_w - line_w) // 2)
                    line_y = start_y + i * line_height

                    # Draw text in crisp manga black with subtle legibility outline
                    draw.text((line_x, line_y), line, fill=(15, 23, 42, 255), font=font)

            out = io.BytesIO()
            image.save(out, format="PNG")
            return out.getvalue()

        except Exception as e:
            return image_bytes
