import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from app.db.session import Base

def generate_uuid():
    return str(uuid.uuid4())

class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    source_url = Column(String(2048), nullable=False)
    source_language = Column(String(32), nullable=False, default="auto")
    target_language = Column(String(32), nullable=False, default="vi")
    status = Column(String(32), nullable=False, default="queued", index=True) # queued, analyzing, processing, completed, failed, cancelled
    total_pages = Column(Integer, default=0)
    completed_pages = Column(Integer, default=0)
    current_page = Column(Integer, default=0)
    error_code = Column(String(64), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    pages = relationship("Page", back_populates="job", cascade="all, delete-orphan", order_by="Page.page_number")

class Page(Base):
    __tablename__ = "pages"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    job_id = Column(String(36), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    page_number = Column(Integer, nullable=False)
    source_image = Column(String(1024), nullable=False) # URL or storage path
    processed_image = Column(String(1024), nullable=True) # Storage path or URL
    status = Column(String(32), nullable=False, default="queued") # queued, processing, completed, failed
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    job = relationship("Job", back_populates="pages")
    ocr_results = relationship("OCRResult", back_populates="page", cascade="all, delete-orphan")

class OCRResult(Base):
    __tablename__ = "ocr_results"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    page_id = Column(String(36), ForeignKey("pages.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(Text, nullable=False)
    bbox = Column(JSON, nullable=False) # {"x": int, "y": int, "width": int, "height": int}
    confidence = Column(Float, default=1.0)
    language = Column(String(32), nullable=True)

    page = relationship("Page", back_populates="ocr_results")
    translations = relationship("Translation", back_populates="ocr_result", cascade="all, delete-orphan")

class Translation(Base):
    __tablename__ = "translations"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    ocr_result_id = Column(String(36), ForeignKey("ocr_results.id", ondelete="CASCADE"), nullable=False, index=True)
    source_text = Column(Text, nullable=False)
    translated_text = Column(Text, nullable=False)
    source_language = Column(String(32), nullable=False)
    target_language = Column(String(32), nullable=False)

    ocr_result = relationship("OCRResult", back_populates="translations")
