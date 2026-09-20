import pytest
from bs4 import BeautifulSoup
from app.services.source_extractor.generic import GenericHtmlExtractor

@pytest.mark.asyncio
async def test_extract_various_image_attributes():
    html = """
    <html>
        <head><title>Test Manga Chapter 1</title></head>
        <body>
            <img class="logo" src="https://cdn.example.com/logo.png" />
            <img class="page" src="/uploads/chapter1/page1.jpg" />
            <img class="page" data-src="https://cdn.example.com/ch1/page2.webp" />
            <img class="page" data-original="https://cdn.example.com/ch1/page3.png" />
            <img class="page" srcset="https://cdn.example.com/ch1/page4_small.jpg 300w, https://cdn.example.com/ch1/page4_large.jpg 1200w" />
            <img class="ad" src="https://ad.example.com/banner.gif" />
            <!-- Duplicate image -->
            <img class="page" src="/uploads/chapter1/page1.jpg" />
        </body>
    </html>
    """
    extractor = GenericHtmlExtractor()
    soup = BeautifulSoup(html, "html.parser")
    images = await extractor._parse_images_from_soup(soup, "https://mangasite.com/chapter-1")

    # Should resolve relative URLs
    assert "https://mangasite.com/uploads/chapter1/page1.jpg" in images
    assert "https://cdn.example.com/ch1/page2.webp" in images
    assert "https://cdn.example.com/ch1/page3.png" in images
    # Should pick the largest image from srcset
    assert "https://cdn.example.com/ch1/page4_large.jpg" in images
    # Should exclude logo and banner
    assert not any("logo" in img for img in images)
    assert not any("banner" in img for img in images)
    # Should deduplicate page1
    assert len(images) == 4
