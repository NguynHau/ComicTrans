from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.core.config import settings
from app.core.errors import AppError, ErrorCode, create_error_response
from app.api.v1.router import api_router
from app.db.session import engine, Base
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("manga.main")

# Auto-create tables if running in simple dev/sqlite
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    logger.warning(f"Could not automatically create tables on engine bind: {e}")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc"
)

# CORS setup
origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if "*" not in origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Custom Exception Handlers
@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return create_error_response(
        code=exc.code,
        message=exc.message,
        status_code=exc.status_code,
        details=exc.details
    )

@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    return create_error_response(
        code=ErrorCode.INVALID_SOURCE,
        message="Dữ liệu đầu vào không hợp lệ.",
        status_code=422,
        details={"errors": exc.errors()}
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return create_error_response(
        code=ErrorCode.INTERNAL_ERROR,
        message="Hệ thống xảy ra lỗi không xác định. Vui lòng thử lại sau.",
        status_code=500
    )

# Mount API routes
app.include_router(api_router, prefix=settings.API_V1_STR)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
