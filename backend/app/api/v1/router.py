from fastapi import APIRouter
from app.api.v1.endpoints import chapters, jobs, health

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(chapters.router, prefix="/chapters", tags=["Chapters"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["Jobs"])
