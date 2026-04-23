"""
API v2 Routes - Reseller API
Compatible with common SMM panel POST APIs (e.g. Just Another Panel /api/v2 style).
"""
import logging
from fastapi import APIRouter, Request
from datetime import datetime, timezone
from bson import ObjectId
import re
import json
from time import perf_counter
from urllib.parse import parse_qs, unquote_plus
from pymongo import ReturnDocument
from backend.middleware.admin import get_request_ip

router = APIRouter(tags=["API v2"])

# Dependency injection placeholder
db = None

def set_db(database):
    global db
    db = database

def validate_youtube_url(url: str) -> bool:
    """Validate YouTube URL"""
    youtube_pattern = r'(youtube\.com|youtu\.be)'
    return bool(re.search(youtube_pattern, url, re.IGNORECASE))

def _mask_key(key: str) -> str:
    if not key:
        return ""
    s = str(key)
    if len(s) <= 10:
        return "sk-" + ("*" * max(0, len(s) - 3)) + s[-3:]
    return f"sk-{s[:4]}...{s[-4:]}"

def _ok(result):
    return result

def _err(message: str):
    return {"error": message}

def _normalize_form_value(v) -> str:
    if v is None:
        return ""
    if hasattr(v, "read"):
        return ""
    return str(v).strip()

def _strip_invisible(s: str) -> str:
    s = s.replace("\ufeff", "")
    s = re.sub(r"[\u200b\u200c\u200d\ufeff]", "", s)
    return s

def _clean_api_key(s: str) -> str:
    return unquote_plus(_strip_invisible(str(s).strip()))

def _extract_key(body: dict) -> str:
    """SMM panels vary: key, apikey, api_key, or query-only."""
    for name in (
        "key", "Key", "KEY", "apikey", "api_key", "APIKey", "API_KEY",
    ):
        v = body.get(name)
        if v is not None and _normalize_form_value(v) != "":
            return _clean_api_key(_normalize_form_value(v))
    return ""

def _extract_action(body: dict) -> str:
    for name in ("action", "Action", "type", "Type"):
        v = body.get(name)
        if v is not None and _normalize_form_value(v) != "":
            return _normalize_form_value(v).strip()
    return ""

def _merge_query_params(request: Request, body: dict) -> dict:
    """Some clients send key/action in query string with POST (or wrong Content-Type)."""
    out = dict(body)
    for k, v in request.query_params.items():
        if k not in out and v is not None:
            out[k] = v
    if not _extract_key(out) and "key" in request.query_params:
        out["key"] = request.query_params["key"]
    if not _extract_action(out) and "action" in request.query_params:
        out["action"] = request.query_params["action"]
    return out

async def _read_body(request: Request) -> dict:
    """
    SMM panels send application/x-www-form-urlencoded: use Starlette's form() first.
    Otherwise read raw (JSON, text/plain, missing Content-Type, UTF-8 BOM, etc.).
    """
    ct = (request.headers.get("content-type") or "").lower()
    if "multipart/form-data" in ct:
        try:
            form = await request.form()
            return {k: _normalize_form_value(v) for k, v in form.items()}
        except Exception:
            return {}
    if "application/x-www-form-urlencoded" in ct:
        try:
            form = await request.form()
            return {k: _normalize_form_value(v) for k, v in form.items()}
        except Exception:
            return {}
    try:
        raw = await request.body()
    except Exception:
        return {}
    if not raw:
        return {}
    text = raw.decode("utf-8-sig", "replace")
    st = text.lstrip()
    if st.startswith("{") or st.startswith("["):
        try:
            data = json.loads(text)
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass
    if "application/json" in ct:
        try:
            data = json.loads(text)
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass
    if "=" in text and not st.startswith(("{", "[")):
        try:
            parsed = parse_qs(text, keep_blank_values=True, strict_parsing=False)
            if parsed:
                return {k: (v[0] if v else "") for k, v in parsed.items()}
        except Exception:
            pass
    return {}


async def _find_user_by_api_key(key: str):
    """Exact match, then case-insensitive (hex case varies between panels / copy-paste)."""
    if not key:
        return None
    k = _clean_api_key(key)
    if not k:
        return None
    u = await db.users.find_one({"apiKey": k})
    if u:
        return u if u.get("status") != "banned" else None
    u = await db.users.find_one({"apiKey": {"$regex": f"^{re.escape(k)}$", "$options": "i"}})
    if u and u.get("status") == "banned":
        return None
    return u

_log = logging.getLogger(__name__)

@router.get("/v2/health")
async def api_v2_health():
    """Public: load balancers / external panels can probe without a key."""
    return {"ok": True, "v": 2}

@router.api_route("/v2", methods=["GET", "POST", "PUT"])
@router.api_route("/v2/", methods=["GET", "POST", "PUT"])
async def api_v2_handler(request: Request):
    """
    Reseller API v2 endpoint
    
    Actions:
    - services: List all services
    - add: Create new order
    - status: Get order status
    - balance: Get account balance
    - cancel: Request cancellation
    """
    t0 = perf_counter()
    ip = get_request_ip(request)
    user = None
    user_id = None
    http_status = 200
    action = ""
    key = ""
    body: dict = {}
    response = _err("Incorrect request")

    try:
        body = _merge_query_params(request, await _read_body(request))
        action = _extract_action(body)
        key = _extract_key(body)

        if not action:
            response = _err("Incorrect request")
            return response

        if not key:
            response = _err("Invalid API key")
            return response

        user = await _find_user_by_api_key(key)
        if not user:
            response = _err("Invalid API key")
            return response

        user_id = user["_id"]
        await db.users.update_one({"_id": user_id}, {"$set": {"apiKeyLastUsedAt": datetime.now(timezone.utc)}})

        if action == "balance":
            response = _ok({"balance": round(float(user.get("balance", 0) or 0), 4), "currency": "USD"})
            return response

        if action == "services":
            services = await db.services.find({"status": True}).to_list(5000)
            special_services = await db.user_special_services.find({"userId": user_id, "status": True}).to_list(5000)
            special_map = {ss["serviceId"]: ss for ss in special_services if ss.get("serviceId")}

            cat_ids = list({s.get("categoryId") for s in services if s.get("categoryId")})
            cats = await db.categories.find({"_id": {"$in": cat_ids}}, {"name": 1}).to_list(len(cat_ids) or 1)
            cat_name = {c["_id"]: c.get("name", "Unknown") for c in cats}

            ordered = []
            for ss in special_services:
                svc = next((s for s in services if s["_id"] == ss.get("serviceId")), None)
                if not svc:
                    continue
                ordered.append((svc, ss))
            for svc in services:
                if svc["_id"] in special_map:
                    continue
                ordered.append((svc, None))

            result = []
            for svc, ss in ordered:
                rate = float(ss["customRate"]) if ss else float(svc.get("rate", 0))
                min_qty = int(ss.get("minQty", svc.get("minQty", 0))) if ss else int(svc.get("minQty", 0))
                max_qty = int(ss.get("maxQty", svc.get("maxQty", 0))) if ss else int(svc.get("maxQty", 0))
                result.append({
                    "service": str(svc["_id"]),
                    "name": svc.get("name", ""),
                    "category": cat_name.get(svc.get("categoryId"), "Unknown"),
                    "rate": f"{float(rate):.2f}",
                    "min": str(min_qty),
                    "max": str(max_qty),
                    "type": svc.get("type", "Default"),
                    "refill": bool(svc.get("refillEnabled", False)),
                    "cancel": True,
                })
            response = _ok(result)
            return response

        if action == "add":
            service_id = str(body.get("service") or "").strip()
            link = str(body.get("link") or "").strip()
            quantity_raw = body.get("quantity")
            if not service_id or not link or quantity_raw is None:
                response = _err("Incorrect request")
                return response
            try:
                quantity = int(quantity_raw)
            except Exception:
                response = _err("Incorrect request")
                return response
            if not validate_youtube_url(link):
                response = _err("Incorrect request")
                return response
            try:
                svc_obj_id = ObjectId(service_id)
            except Exception:
                response = _err("Incorrect request")
                return response
            service = await db.services.find_one({"_id": svc_obj_id, "status": True})
            if not service:
                response = _err("Incorrect request")
                return response

            special = await db.user_special_services.find_one({"userId": user_id, "serviceId": svc_obj_id, "status": True})
            if special:
                rate = float(special.get("customRate", service.get("rate", 0)))
                min_qty = int(special.get("minQty", service.get("minQty", 0)))
                max_qty = int(special.get("maxQty", service.get("maxQty", 0)))
            else:
                rate = float(service.get("rate", 0))
                min_qty = int(service.get("minQty", 0))
                max_qty = int(service.get("maxQty", 0))

            if quantity < min_qty or quantity > max_qty:
                response = _err("Incorrect request")
                return response

            svc_type = service.get("type", "Default")
            if svc_type == "Package":
                charge = float(service.get("packagePrice", rate) or rate)
                qty_for_order = 1
            else:
                charge = (quantity / 1000) * rate
                qty_for_order = quantity

            updated_user = await db.users.find_one_and_update(
                {"_id": user_id, "balance": {"$gte": charge}},
                {"$inc": {"balance": -charge}},
                return_document=ReturnDocument.AFTER
            )
            if not updated_user:
                response = _err("Insufficient balance")
                return response

            fulfillment = service.get("fulfillmentType", "manual")
            provider_name = ""
            provider_order_id = ""
            if fulfillment == "auto" and service.get("providerId"):
                provider = await db.api_providers.find_one({"_id": service["providerId"]})
                if provider and provider.get("status", True):
                    provider_name = provider.get("name", "")
                    try:
                        from backend.services.smm_http import post_smm_api
                        pr, _perr, _u = await post_smm_api(
                            provider["apiUrl"],
                            {
                                "key": provider["apiKey"],
                                "action": "add",
                                "service": service.get("providerServiceId", ""),
                                "link": link,
                                "quantity": qty_for_order,
                            },
                            timeout=25.0,
                        )
                        if isinstance(pr, dict) and "order" in pr:
                            provider_order_id = str(pr["order"])
                    except Exception:
                        pass

            now = datetime.now(timezone.utc)
            order_doc = {
                "userId": user_id,
                "serviceId": svc_obj_id,
                "serviceType": service.get("type", "Default"),
                "link": link,
                "quantity": qty_for_order,
                "charge": round(float(charge), 4),
                "status": "Pending",
                "startCount": 0,
                "remains": qty_for_order,
                "customData": "",
                "duration": "",
                "fulfillmentType": fulfillment,
                "providerName": provider_name,
                "providerOrderId": provider_order_id,
                "refillHistory": [],
                "viaApi": True,
                "createdAt": now,
            }
            insert = await db.orders.insert_one(order_doc)

            await db.transactions.insert_one({
                "userId": user_id,
                "type": "debit",
                "amount": float(charge),
                "description": f'API Order #{str(insert.inserted_id)[-8:]} - {service.get("name","")}',
                "balanceAfter": float(updated_user.get("balance", 0) or 0),
                "createdAt": now,
            })

            response = _ok({"order": str(insert.inserted_id)})
            return response

        if action == "status":
            order_id = str(body.get("order") or "").strip()
            if not order_id:
                response = _err("Incorrect order ID")
                return response
            try:
                order_obj_id = ObjectId(order_id)
            except Exception:
                response = _err("Incorrect order ID")
                return response
            order = await db.orders.find_one({"_id": order_obj_id, "userId": user_id})
            if not order:
                response = _err("Incorrect order ID")
                return response
            response = _ok({
                "charge": float(order.get("charge", 0) or 0),
                "start_count": int(order.get("startCount", 0) or 0),
                "status": order.get("status", ""),
                "remains": int(order.get("remains", 0) or 0),
            })
            return response

        if action == "cancel":
            order_id = str(body.get("order") or "").strip()
            if not order_id:
                response = _err("Incorrect order ID")
                return response
            try:
                order_obj_id = ObjectId(order_id)
            except Exception:
                response = _err("Incorrect order ID")
                return response
            order = await db.orders.find_one({"_id": order_obj_id, "userId": user_id})
            if not order:
                response = _err("Incorrect order ID")
                return response
            await db.orders.update_one({"_id": order_obj_id}, {"$set": {"status": "Cancellation Requested", "cancellationRequestedAt": datetime.now(timezone.utc)}})
            response = _ok({"cancel": str(order_obj_id)})
            return response

        response = _err("Incorrect request")
        return response
    except Exception as exc:
        _log.exception("apiv2 handler: %s", exc)
        response = _err("Service temporarily unavailable")
    finally:
        try:
            elapsed_ms = int((perf_counter() - t0) * 1000)
            log_doc = {
                "userId": user_id if user_id else None,
                "action": action,
                "requestBody": body,
                "responseStatus": http_status,
                "responseTime": elapsed_ms,
                "ipAddress": ip,
                "createdAt": datetime.now(timezone.utc),
            }
            await db.api_call_logs.insert_one(log_doc)
        except Exception:
            pass
    return response
