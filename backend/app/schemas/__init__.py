from pydantic import BaseModel, HttpUrl, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class BoundingBox(BaseModel):
    x: int
    y: int
    width: int
    height: int

class OCRItem(BaseModel):
    id: Optional[str] = None
    text: str
    bbox: BoundingBox
    confidence: float = 1.0
    language: Optional[str] = "ja"

class TranslationItem(BaseModel):
    id: Optional[str] = None
    ocr_result_id: Optional[str] = None
    source_text: str
    translated_text: str
    source_language: str
    target_language: str

class ChapterAnalyzeRequest(BaseModel):
    url: str
    source_language: str = "auto"
    target_language: str = "vi"

class ChapterImage(BaseModel):
    page_number: int
    image_url: str
    alt_text: Optional[str] = None

class ChapterAnalyzeResponse(BaseModel):
    url: str
    title: Optional[str] = "Manga Chapter"
    source_language: str
    target_language: str
    total_images: int
    images: List[ChapterImage]

class JobCreateRequest(BaseModel):
    url: str
    source_language: str = "auto"
    target_language: str = "vi"
    custom_images: Optional[List[str]] = None

class PageResponse(BaseModel):
    id: str
    job_id: str
    page_number: int
    source_image: str
    processed_image: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    ocr_results: Optional[List[OCRItem]] = None

    class Config:
        from_attributes = True

class JobResponse(BaseModel):
    job_id: str
    status: str
    source_url: str
    source_language: str
    target_language: str
    total_pages: int
    completed_pages: int
    current_page: int
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class JobDetailResponse(JobResponse):
    pages: List[PageResponse] = []
