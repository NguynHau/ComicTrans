from fastapi import APIRouter, Depends, BackgroundTasks, Response
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.models import Job, Page
from app.schemas import JobCreateRequest, JobResponse, JobDetailResponse, PageResponse
from app.jobs.queue import get_job_manager
from app.core.security import validate_url_security
from app.core.errors import AppError, ErrorCode
from app.services.storage.manager import get_storage_provider

router = APIRouter()

@router.post("", response_model=dict, status_code=201)
async def create_job(
    request: JobCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Creates a new manga translation job and enqueues background processing.
    """
    validate_url_security(request.url)
    
    new_job = Job(
        source_url=request.url,
        source_language=request.source_language,
        target_language=request.target_language,
        status="queued"
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    # Queue job execution
    job_mgr = get_job_manager()
    background_tasks.add_task(job_mgr.execute_job, new_job.id)

    return {
        "job_id": new_job.id,
        "status": "queued"
    }

@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: str, db: Session = Depends(get_db)):
    """
    Get current progress and status of a manga translation job.
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise AppError(ErrorCode.JOB_NOT_FOUND, f"Job {job_id} not found", status_code=404)
    
    return JobResponse(
        job_id=job.id,
        status=job.status,
        source_url=job.source_url,
        source_language=job.source_language,
        target_language=job.target_language,
        total_pages=job.total_pages,
        completed_pages=job.completed_pages,
        current_page=job.current_page,
        error_code=job.error_code,
        error_message=job.error_message,
        created_at=job.created_at,
        updated_at=job.updated_at
    )

@router.get("/{job_id}/pages", response_model=List[PageResponse])
def get_job_pages(job_id: str, db: Session = Depends(get_db)):
    """
    Get all pages and translated image URLs for a job.
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise AppError(ErrorCode.JOB_NOT_FOUND, f"Job {job_id} not found", status_code=404)
    
    pages = db.query(Page).filter(Page.job_id == job_id).order_by(Page.page_number).all()
    return pages

@router.get("/{job_id}/pages/{page_id}", response_model=PageResponse)
def get_job_page(job_id: str, page_id: str, db: Session = Depends(get_db)):
    """
    Get single page details.
    """
    page = db.query(Page).filter(Page.id == page_id, Page.job_id == job_id).first()
    if not page:
        raise AppError(ErrorCode.PAGE_NOT_FOUND, "Page not found", status_code=404)
    return page

@router.get("/{job_id}/pages/{page_id}/image")
async def get_page_image(job_id: str, page_id: str, db: Session = Depends(get_db)):
    """
    Retrieve raw binary image for a processed page.
    """
    page = db.query(Page).filter(Page.id == page_id, Page.job_id == job_id).first()
    if not page or not page.processed_image:
        raise AppError(ErrorCode.PAGE_NOT_FOUND, "Image not available yet", status_code=404)
    
    storage = get_storage_provider()
    image_bytes = await storage.get(page.processed_image)
    if not image_bytes:
        raise AppError(ErrorCode.STORAGE_ERROR, "Image file could not be read", status_code=404)
    
    return Response(content=image_bytes, media_type="image/png")

@router.post("/{job_id}/pages/{page_id}/retry")
async def retry_page(job_id: str, page_id: str, background_tasks: BackgroundTasks):
    """
    Retry processing a specific failed page.
    """
    job_mgr = get_job_manager()
    background_tasks.add_task(job_mgr.retry_page, job_id, page_id)
    return {"status": "retrying", "job_id": job_id, "page_id": page_id}

@router.delete("/{job_id}")
def cancel_or_delete_job(job_id: str, db: Session = Depends(get_db)):
    """
    Cancel and remove a job.
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise AppError(ErrorCode.JOB_NOT_FOUND, "Job not found", status_code=404)
    
    job_mgr = get_job_manager()
    job_mgr.cancel_job(job_id)

    db.delete(job)
    db.commit()
    return {"status": "deleted", "job_id": job_id}
