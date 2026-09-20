import pytest
from app.core.security import is_ip_private_or_reserved, validate_url_security
from app.core.errors import AppError, ErrorCode

def test_private_ip_detection():
    assert is_ip_private_or_reserved("127.0.0.1") is True
    assert is_ip_private_or_reserved("10.0.0.1") is True
    assert is_ip_private_or_reserved("192.168.1.1") is True
    assert is_ip_private_or_reserved("172.16.0.5") is True
    assert is_ip_private_or_reserved("169.254.169.254") is True # AWS Metadata
    assert is_ip_private_or_reserved("::1") is True
    assert is_ip_private_or_reserved("8.8.8.8") is False # Public Google DNS

def test_url_validation_disallow_non_http():
    with pytest.raises(AppError) as exc_info:
        validate_url_security("file:///etc/passwd")
    assert exc_info.value.code == ErrorCode.INVALID_SOURCE

    with pytest.raises(AppError) as exc_info:
        validate_url_security("ftp://example.com/image.jpg")
    assert exc_info.value.code == ErrorCode.INVALID_SOURCE

def test_ssrf_reject_localhost():
    with pytest.raises(AppError) as exc_info:
        validate_url_security("http://127.0.0.1:8000/admin")
    assert exc_info.value.code == ErrorCode.SSRF_DETECTED

    with pytest.raises(AppError) as exc_info:
        validate_url_security("http://localhost/secret")
    assert exc_info.value.code == ErrorCode.SSRF_DETECTED
