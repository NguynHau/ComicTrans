import ipaddress
import socket
from urllib.parse import urlparse
from typing import Tuple
from app.core.errors import AppError, ErrorCode

# Disallowed IP Networks (SSRF Protection)
PRIVATE_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"), # CGNAT
    ipaddress.ip_network("127.0.0.0/8"), # Loopback
    ipaddress.ip_network("169.254.0.0/16"), # Link-local / AWS metadata
    ipaddress.ip_network("172.16.0.0/12"), # Private Class B
    ipaddress.ip_network("192.0.0.0/24"),
    ipaddress.ip_network("192.0.2.0/24"), # TEST-NET-1
    ipaddress.ip_network("192.168.0.0/16"), # Private Class C
    ipaddress.ip_network("198.18.0.0/15"), # Benchmarking
    ipaddress.ip_network("198.51.100.0/24"), # TEST-NET-2
    ipaddress.ip_network("203.0.113.0/24"), # TEST-NET-3
    ipaddress.ip_network("224.0.0.0/4"), # Multicast
    ipaddress.ip_network("240.0.0.0/4"), # Reserved
    ipaddress.ip_network("255.255.255.255/32"), # Broadcast
    # IPv6 ranges
    ipaddress.ip_network("::1/128"), # Loopback
    ipaddress.ip_network("::/128"), # Unspecified
    ipaddress.ip_network("fc00::/7"), # Unique Local
    ipaddress.ip_network("fe80::/10"), # Link Local
]

def is_ip_private_or_reserved(ip_str: str) -> bool:
    """Check if an IP address string belongs to private or reserved ranges."""
    try:
        ip = ipaddress.ip_address(ip_str)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved or ip.is_unspecified:
            return True
        for net in PRIVATE_NETWORKS:
            if ip in net:
                return True
        return False
    except ValueError:
        return True

def validate_url_security(url: str) -> Tuple[bool, str]:
    """
    Validates URL scheme, resolves hostname, and protects against SSRF.
    Returns (True, clean_url) or raises AppError.
    """
    if not url or not isinstance(url, str):
        raise AppError(ErrorCode.INVALID_SOURCE, "URL cannot be empty")
    
    parsed = urlparse(url.strip())
    if parsed.scheme.lower() not in ("http", "https"):
        raise AppError(
            ErrorCode.INVALID_SOURCE, 
            "Only HTTP and HTTPS protocols are allowed"
        )
    
    hostname = parsed.hostname
    if not hostname:
        raise AppError(ErrorCode.INVALID_SOURCE, "URL has no valid hostname")
        
    # Check if host is direct IP
    try:
        if is_ip_private_or_reserved(hostname):
            raise AppError(
                ErrorCode.SSRF_DETECTED, 
                "Access to private, loopback, or cloud metadata IP addresses is forbidden"
            )
    except Exception:
        pass
        
    # Check hostname resolution
    try:
        addr_info = socket.getaddrinfo(hostname, None, proto=socket.IPPROTO_TCP)
        for entry in addr_info:
            ip_str = entry[4][0]
            if is_ip_private_or_reserved(ip_str):
                raise AppError(
                    ErrorCode.SSRF_DETECTED,
                    f"Resolved destination address ({ip_str}) points to internal/private network"
                )
    except socket.gaierror:
        raise AppError(ErrorCode.INVALID_SOURCE, f"Could not resolve domain name: {hostname}")
        
    return True, url.strip()
