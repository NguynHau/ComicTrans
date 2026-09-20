from enum import Enum
from typing import Optional, Dict, Any
from fastapi import HTTPException, status
from fastapi.responses import JSONResponse

class ErrorCode(str, Enum):
    INVALID_SOURCE = "INVALID_SOURCE"
    SSRF_DETECTED = "SSRF_DETECTED"
    LOGIN_REQUIRED = "LOGIN_REQUIRED"
    PROTECTION_BLOCKED = "PROTECTION_BLOCKED"
    NO_IMAGES_FOUND = "NO_IMAGES_FOUND"
    IMAGE_TOO_LARGE = "IMAGE_TOO_LARGE"
    HTML_TOO_LARGE = "HTML_TOO_LARGE"
    RATE_LIMITED = "RATE_LIMITED"
    JOB_NOT_FOUND = "JOB_NOT_FOUND"
    PAGE_NOT_FOUND = "PAGE_NOT_FOUND"
    TIMEOUT = "TIMEOUT"
    PROCESSING_FAILED = "PROCESSING_FAILED"
    STORAGE_ERROR = "STORAGE_ERROR"
    INTERNAL_ERROR = "INTERNAL_ERROR"

class AppError(Exception):
    def __init__(
        self,
        code: ErrorCode,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: Optional[Dict[str, Any]] = None
    ):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)

def create_error_response(code: ErrorCode, message: str, status_code: int = 400, details: Optional[Dict[str, Any]] = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code.value if isinstance(code, ErrorCode) else str(code),
                "message": message,
                "details": details or {}
            }
        }
    )
