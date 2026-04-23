"""
HTTP helpers for SMM “JAP-style” /api/v2 posts (outbound from this app to any provider).
"""
import re
from typing import Any, List, Optional, Tuple
import httpx

_SMM_UA = "YTBoost/1.0 (smm-api; +https://ytboost.io)"


def smm_v2_url_candidates(url: str) -> List[str]:
    u = (url or "").strip().rstrip("/")
    if not u:
        return []
    if not re.match(r"^https?://", u, re.I):
        u = f"https://{u.lstrip('/')}"
    cands: List[str] = [u]
    if not re.search(r"/v2$", u, re.I):
        if re.search(r"/api$", u, re.I):
            cands.append(u + "/v2")
        else:
            cands.append(u + "/api/v2")
    seen: set = set()
    out: List[str] = []
    for x in cands:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


def normalize_smm_json_body(data: Any) -> Any:
    """JAP add usually returns a dict; some panels return a one-element list of a dict."""
    if isinstance(data, list) and len(data) == 1 and isinstance(data[0], dict):
        return data[0]
    return data


def extract_provider_add_order_id(data: Any) -> Optional[str]:
    """
    New order id from provider JSON (JAP-style, common variants).
    """
    if data is None:
        return None
    data = normalize_smm_json_body(data)
    if not isinstance(data, dict):
        return None
    for k in (
        "order", "Order",
        "order_id", "orderId", "orderID",
    ):
        if k not in data or data.get(k) is None:
            continue
        v = data[k]
        if isinstance(v, bool):
            continue
        s = str(v).strip()
        if not s or s.lower() in ("none", "null", ""):
            continue
        if s in ("0", "false", "False") and (data.get("error") is not None or data.get("message") is not None):
            continue
        return s
    return None


async def post_smm_api(
    api_url: str,
    form: dict,
    *,
    timeout: float = 25.0,
) -> Tuple[Optional[Any], Optional[str], str, Optional[int]]:
    """
    POST form; try each URL candidate (exact path, then /api/v2, etc.).
    Returns (data, err, used_url, last_http_status). `data` is dict or list.
    """
    t = httpx.Timeout(timeout, connect=12.0)
    cands = smm_v2_url_candidates(api_url)
    if not cands:
        return None, "Empty API URL", (api_url or ""), None
    last_err = "Request failed"
    last_tried = cands[-1]
    last_status: Optional[int] = None
    for candidate in cands:
        last_tried = candidate
        try:
            async with httpx.AsyncClient(
                timeout=t,
                follow_redirects=True,
                verify=True,
                headers={"User-Agent": _SMM_UA, "Accept": "application/json, */*;q=0.7"},
            ) as client:
                resp = await client.post(
                    candidate,
                    data=form,
                    headers={"Content-Type": "application/x-www-form-urlencoded; charset=utf-8"},
                )
                last_status = resp.status_code
        except httpx.TimeoutException:
            last_err = "Connection timed out"
            last_status = None
            continue
        except httpx.RequestError as e:
            last_err = str(e) or "Request failed"
            last_status = None
            continue
        if resp.status_code >= 500:
            last_err = f"HTTP {resp.status_code} {getattr(resp, 'reason_phrase', '')}".strip()
            if len(cands) > 1:
                continue
        if resp.status_code in (404, 405) and len(cands) > 1:
            last_err = f"HTTP {resp.status_code} at {candidate}"
            continue
        if resp.status_code in (400, 401, 403, 410, 429) and len(cands) > 1:
            # Try next candidate (e.g. /api/v2) before accepting HTML error as final
            last_err = f"HTTP {resp.status_code} at {candidate}"
            try:
                preview = (resp.text or "")[: 120].replace("\n", " ")
                if preview:
                    last_err = f"{last_err}: {preview!r}"
            except Exception:
                pass
            continue
        try:
            data = resp.json()
        except Exception:
            last_err = f"Not JSON (HTTP {resp.status_code})"
            snip = (resp.text or "")[: 200].replace("\n", " ")
            if snip:
                last_err = f"{last_err}: {snip!r}"
            if len(cands) > 1 and resp.status_code in (404, 400, 405):
                continue
            return None, last_err, last_tried, last_status
        if isinstance(data, (dict, list)):
            if isinstance(data, list) and not data and len(cands) > 1:
                last_err = "Empty JSON array from provider"
                continue
            return data, None, last_tried, last_status
        last_err = "Unexpected JSON type from provider"
    return None, last_err, last_tried, last_status
