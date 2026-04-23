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


async def post_smm_api(
    api_url: str,
    form: dict,
    *,
    timeout: float = 25.0,
) -> Tuple[Optional[Any], Optional[str], str]:
    """
    POST form; try each URL candidate (exact path, then /api/v2, etc.).
    Returns (data, err, used_url). `data` is dict or list.
    """
    t = httpx.Timeout(timeout, connect=12.0)
    cands = smm_v2_url_candidates(api_url)
    if not cands:
        return None, "Empty API URL", (api_url or "")
    last_err = "Request failed"
    last_tried = cands[-1]
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
        except httpx.TimeoutException:
            last_err = "Connection timed out"
            continue
        except httpx.RequestError as e:
            last_err = str(e) or "Request failed"
            continue
        if resp.status_code >= 500:
            last_err = f"HTTP {resp.status_code} {getattr(resp, 'reason_phrase', '')}".strip()
            if len(cands) > 1:
                continue
        if resp.status_code in (404, 405) and len(cands) > 1:
            last_err = f"HTTP {resp.status_code} at {candidate}"
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
            return None, last_err, last_tried
        if isinstance(data, (dict, list)):
            return data, None, last_tried
        last_err = "Unexpected JSON type from provider"
    return None, last_err, last_tried
