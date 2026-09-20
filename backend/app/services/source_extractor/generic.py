import httpx
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import re
from typing import List, Dict, Any, Set
from app.services.source_extractor.base import SourceExtractor
from app.core.security import validate_url_security
from app.core.errors import AppError, ErrorCode
from app.core.config import settings

COMMON_IMAGE_ATTRIBUTES = [
    "data-src",
    "data-original",
    "data-lazy-src",
    "data-url",
    "data-image",
    "data-full-image",
    "data-cdn-src",
    "srcset",
    "src"
]

# Patterns for non-comic assets (avatars, icons, banners, tracking pixels, ads)
EXCLUDE_PATTERNS = [
    r"logo", r"avatar", r"icon", r"banner", r"advert", r"promo",
    r"widget", r"tracking", r"badge", r"fb_share", r"twitter",
    r"footer", r"header-bg", r"favicon", r"1x1", r"pixel"
]

class GenericHtmlExtractor(SourceExtractor):
    def can_handle(self, url: str) -> bool:
        # Generic extractor handles any valid web URL as fallback
        return True

    async def _fetch_html(self, url: str) -> str:
        validate_url_security(url)
        headers = {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,ja;q=0.8,vi;q=0.7",
        }

        async with httpx.AsyncClient(
            timeout=settings.REQUEST_TIMEOUT_SECONDS,
            follow_redirects=True,
            verify=False
        ) as client:
            try:
                response = await client.get(url, headers=headers)
                
                # Check status
                if response.status_code == 401 or response.status_code == 403:
                    raise AppError(
                        ErrorCode.LOGIN_REQUIRED,
                        "This chapter requires login or is blocked by protection."
                    )
                if response.status_code >= 400:
                    raise AppError(
                        ErrorCode.INVALID_SOURCE,
                        f"Failed to fetch webpage (HTTP status {response.status_code})"
                    )

                content_type = response.headers.get("content-type", "").lower()
                if "text/html" not in content_type and "application/xhtml" not in content_type:
                    # If direct image URL was passed
                    if any(t in content_type for t in ["image/jpeg", "image/png", "image/webp"]):
                        return f"<html><body><img src='{url}' /></body></html>"
                    raise AppError(ErrorCode.INVALID_SOURCE, "The provided URL does not return HTML or an image.")

                # Check max size limit
                if len(response.content) > settings.MAX_SOURCE_HTML_MB * 1024 * 1024:
                    raise AppError(ErrorCode.HTML_TOO_LARGE, "HTML page exceeds maximum allowed size.")

                return response.text
            except httpx.TimeoutException:
                raise AppError(ErrorCode.TIMEOUT, "Request to source URL timed out.")
            except httpx.RequestError as e:
                raise AppError(ErrorCode.INVALID_SOURCE, f"Network error fetching URL: {str(e)}")

    def _extract_best_image_url(self, img_tag, base_url: str) -> str:
        # Check srcset first for highest resolution candidate
        srcset = img_tag.get("srcset") or img_tag.get("data-srcset")
        if srcset:
            parts = [p.strip().split(" ") for p in srcset.split(",") if p.strip()]
            if parts:
                best = parts[-1][0] # last candidate is usually largest
                return urljoin(base_url, best)

        for attr in COMMON_IMAGE_ATTRIBUTES:
            val = img_tag.get(attr)
            if val and isinstance(val, str) and not val.startswith("data:image"):
                # Clean up query params if they restrict size (e.g., thumb=1)
                return urljoin(base_url, val.strip())
        
        return ""

    async def analyze(self, url: str) -> Dict[str, Any]:
        html = await self._fetch_html(url)
        soup = BeautifulSoup(html, "html.parser")
        
        title = soup.title.string.strip() if soup.title and soup.title.string else "Manga Chapter"
        images = await self._parse_images_from_soup(soup, url)
        
        return {
            "url": url,
            "title": title,
            "total_images": len(images),
            "images": images[:settings.MAX_PAGES_PER_JOB]
        }

    async def extract_images(self, url: str) -> List[str]:
        data = await self.analyze(url)
        images = data.get("images", [])
        if not images:
            raise AppError(
                ErrorCode.NO_IMAGES_FOUND,
                "Could not find any comic images in this chapter URL."
            )
        return images

    async def _parse_images_from_soup(self, soup: BeautifulSoup, base_url: str) -> List[str]:
        img_tags = soup.find_all("img")
        candidates = []
        seen: Set[str] = set()

        for img in img_tags:
            src = self._extract_best_image_url(img, base_url)
            if not src:
                continue

            parsed = urlparse(src)
            if not parsed.scheme or not parsed.netloc:
                continue

            # Check exclude patterns
            lower_src = src.lower()
            if any(re.search(pat, lower_src) for pat in EXCLUDE_PATTERNS):
                continue

            # Filter tiny thumbnails if width/height attributes exist
            width = img.get("width")
            height = img.get("height")
            try:
                if width and int(width) < 150 and height and int(height) < 150:
                    continue
            except ValueError:
                pass

            if src not in seen:
                seen.add(src)
                candidates.append(src)

        return candidates[:settings.MAX_PAGES_PER_JOB]
