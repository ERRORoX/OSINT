"""Compatibility exports for the former modules.domain_search location.

The canonical implementation now lives in tools/domain-search/backend/domain_search.py.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

_MODULE_FILE = Path(__file__).resolve().parents[1] / "tools" / "domain-search" / "backend" / "domain_search.py"
_SPEC = importlib.util.spec_from_file_location("_osint_domain_search_compat", _MODULE_FILE)
if _SPEC is None or _SPEC.loader is None:
    raise ImportError(f"Cannot load canonical domain search logic from {_MODULE_FILE}")
_MODULE = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_MODULE)

_normalize_domain = _MODULE._normalize_domain
_validate_domain = _MODULE._validate_domain
_get_ip = _MODULE._get_ip
_whois = _MODULE._whois
_dns_records = _MODULE._dns_records
_ssl_info = _MODULE._ssl_info
_crtsh = _MODULE._crtsh
DomainSearch = _MODULE.DomainSearch
run_domain_search = _MODULE.run_domain_search

__all__ = ["DomainSearch", "run_domain_search"]
