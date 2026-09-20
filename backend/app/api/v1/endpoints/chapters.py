from fastapi import APIRouter, Depends
from app.schemas import ChapterAnalyzeRequest, ChapterAnalyzeResponse, ChapterImage
from app.services.source_extractor.manager import get_extractor_manager
from app.core.security import validate_url_security
from app.core.errors import AppError, ErrorCode

router = APIRouter()

@router.post("/analyze", response_model=ChapterAnalyzeResponse)
async def analyze_chapter(request: ChapterAnalyzeRequest):
    """
    Validates URL, checks SSRF, fetches chapter HTML, and extracts comic page images.
    """
    validate_url_security(request.url)
    
    extractor_manager = get_extractor_manager()
    extractor = extractor_manager.get_extractor_for_url(request.url)
    
    try:
        data = await extractor.analyze(request.url)
        images = [
            ChapterImage(page_number=i + 1, image_url=img)
            for i, img in enumerate(data.get("images", []))
        ]
        
        return ChapterAnalyzeResponse(
            url=request.url,
            title=data.get("title", "Manga Chapter"),
            source_language=request.source_language,
            target_language=request.target_language,
            total_images=len(images),
            images=images
        )
    except AppError:
        raise
    except Exception as e:
        raise AppError(
            ErrorCode.INVALID_SOURCE,
            f"Không thể đọc trang truyện này: {str(e)}"
        )
