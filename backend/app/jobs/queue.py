import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from app.db.session import SessionLocal
from app.models import Job, Page, OCRResult, Translation
from app.services.pipeline import get_pipeline
from app.services.source_extractor.manager import get_extractor_manager
from app.core.errors import AppError

logger = logging.getLogger("manga.jobs")

class JobManager:
    def __init__(self):
        self._cancelled_jobs = set()

    def cancel_job(self, job_id: str):
        self._cancelled_jobs.add(job_id)

    async def execute_job(self, job_id: str):
        db = SessionLocal()
        try:
            job = db.query(Job).filter(Job.id == job_id).first()
            if not job:
                return

            job.status = "analyzing"
            job.updated_at = datetime.utcnow()
            db.commit()

            # Extract chapter images
            extractor_manager = get_extractor_manager()
            extractor = extractor_manager.get_extractor_for_url(job.source_url)
            
            chapter_info = await extractor.analyze(job.source_url)
            image_urls = chapter_info.get("images", [])

            if not image_urls:
                job.status = "failed"
                job.error_code = "NO_IMAGES_FOUND"
                job.error_message = "Không tìm thấy hình ảnh truyện trong chapter này."
                db.commit()
                return

            job.total_pages = len(image_urls)
            job.status = "processing"
            db.commit()

            # Create Page rows in DB
            pages = []
            for i, img_url in enumerate(image_urls, start=1):
                p = Page(
                    job_id=job.id,
                    page_number=i,
                    source_image=img_url,
                    status="queued"
                )
                db.add(p)
                pages.append(p)
            db.commit()

            pipeline = get_pipeline()

            # Process pages in order
            for page in pages:
                if job_id in self._cancelled_jobs:
                    job.status = "cancelled"
                    db.commit()
                    return

                job.current_page = page.page_number
                page.status = "processing"
                db.commit()

                try:
                    res = await pipeline.process_page(
                        job_id=job.id,
                        page_number=page.page_number,
                        image_url=page.source_image,
                        source_language=job.source_language,
                        target_language=job.target_language,
                        context={"title": chapter_info.get("title", "")}
                    )

                    page.processed_image = res["processed_image_url"]
                    page.status = "completed"
                    job.completed_pages += 1

                    # Save OCR & Translation records to DB
                    for ocr_item, trans_item in zip(res["ocr_results"], res["translations"]):
                        ocr_rec = OCRResult(
                            page_id=page.id,
                            text=ocr_item.text,
                            bbox=ocr_item.bbox.dict(),
                            confidence=ocr_item.confidence,
                            language=ocr_item.language
                        )
                        db.add(ocr_rec)
                        db.flush()

                        trans_rec = Translation(
                            ocr_result_id=ocr_rec.id,
                            source_text=trans_item.source_text,
                            translated_text=trans_item.translated_text,
                            source_language=trans_item.source_language,
                            target_language=trans_item.target_language
                        )
                        db.add(trans_rec)

                except Exception as e:
                    logger.error(f"Error processing page {page.page_number}: {e}")
                    page.status = "failed"
                    page.error_message = str(e)

                db.commit()

            job.status = "completed" if job.completed_pages > 0 else "failed"
            job.updated_at = datetime.utcnow()
            db.commit()

        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}")
            job = db.query(Job).filter(Job.id == job_id).first()
            if job:
                job.status = "failed"
                job.error_code = "PROCESSING_FAILED"
                job.error_message = "Server mất quá nhiều thời gian hoặc gặp sự cố khi xử lý."
                db.commit()
        finally:
            db.close()

    async def retry_page(self, job_id: str, page_id: str):
        db = SessionLocal()
        try:
            job = db.query(Job).filter(Job.id == job_id).first()
            page = db.query(Page).filter(Page.id == page_id, Page.job_id == job_id).first()
            if not job or not page:
                return False

            page.status = "processing"
            page.error_message = None
            db.commit()

            pipeline = get_pipeline()
            res = await pipeline.process_page(
                job_id=job.id,
                page_number=page.page_number,
                image_url=page.source_image,
                source_language=job.source_language,
                target_language=job.target_language
            )

            page.processed_image = res["processed_image_url"]
            page.status = "completed"
            db.commit()
            return True
        except Exception as e:
            if page:
                page.status = "failed"
                page.error_message = str(e)
                db.commit()
            return False
        finally:
            db.close()

_job_manager = JobManager()

def get_job_manager() -> JobManager:
    return _job_manager
