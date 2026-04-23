"""
API v2 Routes - Reseller API
Compatible with common SMM panel POST APIs (e.g. Just Another Panel /api/v2 style).
"""
import logging
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response
from datetime import datetime, timezone
from bson import ObjectId
import re
import json
from time import perf_counter
from urllib.parse import parse_qs, unquote_plus
from pymongo import ReturnDocument
from backend.middleware.admin import get_request_ip
from backend.smm.jap_v2 import (
    get_next_jap_order_number,
    jap_service_number,
    jap_status_dict,
    parse_cancel_orders,
    parse_status_orders,
    resolve_service_for_add,
    resolve_user_order_by_jap_param,
)

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

def _v2_json(data, status_code: int = 200) -> JSONResponse:
    """
    SMM panels expect 200 with application/json (not HTML). Always UTF-8.
    List body is valid for action=services (JAP returns a JSON array).
    """
    return JSONResponse(
        content=data,
        status_code=status_code,
        media_type="application/json; charset=utf-8",
    )

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
        "key", "Key", "KEY", "apikey", "api_key", "APIKey", "API_KEY", "auth", "token",
    ):
        v = body.get(name)
        if v is not None and _normalize_form_value(v) != "":
            return _clean_api_key(_normalize_form_value(v))
    return ""


def _merge_key_from_headers(request: Request, body: dict) -> dict:
    if _extract_key(body):
        return body
    out = dict(body)
    for hname in ("X-API-Key", "X-Api-Key", "API-Key"):
        v = request.headers.get(hname)
        if v and str(v).strip():
            out["key"] = str(v).strip()
            return out
    auth = (request.headers.get("Authorization") or "").strip()
    if auth.lower().startswith("bearer "):
        out["key"] = _clean_api_key(auth[7:])
    return out

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
        if v is None:
            continue
        if k not in out or _normalize_form_value(out.get(k)) == "":
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
    return _v2_json({"ok": True, "v": 2, "endpoints": ["/v2", "/api/v2"]})


@router.api_route(
    "/v2",
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
)
@router.api_route(
    "/v2/",
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
)
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
    if request.method == "OPTIONS":
        return Response(status_code=200)
    if request.method == "HEAD":
        return Response(status_code=200)

    user = None
    user_id = None
    http_status = 200
    action = ""
    key = ""
    body: dict = {}
    response = _err("Incorrect request")

    try:
        body = _merge_key_from_headers(
            request,
            _merge_query_params(request, await _read_body(request)),
        )
        action = (_extract_action(body) or "").lower().strip()
        key = _extract_key(body)

        if not action:
            response = _err("Incorrect request")
            return _v2_json(response)

        if not key:
            response = _err("Invalid API key")
            return _v2_json(response)

        user = await _find_user_by_api_key(key)
        if not user:
            response = _err("Invalid API key")
            return _v2_json(response)

        user_id = user["_id"]
        await db.users.update_one({"_id": user_id}, {"$set": {"apiKeyLastUsedAt": datetime.now(timezone.utc)}})

        if action == "balance":
            bal = float(user.get("balance", 0) or 0)
            # JAP-style: balance is a string in their docs
            response = _ok({"balance": f"{bal:.4f}", "currency": "USD"})
            return _v2_json(response)

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

            # JAP: "service" is a small integer; we use admin 3-digit sid (https://justanotherpanel.com/api)
            result = []
            for svc, ss in ordered:
                rate = float(ss["customRate"]) if ss else float(svc.get("rate", 0))
                min_qty = int(ss.get("minQty", svc.get("minQty", 0))) if ss else int(svc.get("minQty", 0))
                max_qty = int(ss.get("maxQty", svc.get("maxQty", 0))) if ss else int(svc.get("maxQty", 0))
                result.append({
                    "service": jap_service_number(svc),
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
            return _v2_json(response)

        if action == "add":
            link = str(body.get("link") or "").strip()
            quantity_raw = body.get("quantity")
            resolved = await resolve_service_for_add(db, user_id, body.get("service"))
            if not resolved or not link or quantity_raw is None:
                response = _err("Incorrect request")
                return _v2_json(response)
            service, special = resolved
            svc_obj_id = service["_id"]
            try:
                quantity = int(quantity_raw)
            except Exception:
                response = _err("Incorrect request")
                return _v2_json(response)
            if not validate_youtube_url(link):
                response = _err("Incorrect request")
                return _v2_json(response)

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
                return _v2_json(response)

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
                return _v2_json(response)

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
            jap_id = await get_next_jap_order_number(db)
            order_doc = {
                "userId": user_id,
                "japOrderId": jap_id,
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

            # JAP: { "order": 23501 } (integer)
            response = _ok({"order": jap_id})
            return _v2_json(response)

        if action == "status":
            status_keys = parse_status_orders(body)
            if status_keys:
                if len(status_keys) > 100:
                    response = _err("Incorrect request")
                    return _v2_json(response)
                multi: dict = {}
                for k in status_keys:
                    o = await resolve_user_order_by_jap_param(db, user_id, k)
                    if not o:
                        multi[k] = {"error": "Incorrect order ID"}
                    else:
                        multi[k] = jap_status_dict(o)
                response = _ok(multi)
                return _v2_json(response)
            order_param = body.get("order")
            if order_param is None or str(order_param).strip() == "":
                response = _err("Incorrect order ID")
                return _v2_json(response)
            order = await resolve_user_order_by_jap_param(db, user_id, order_param)
            if not order:
                response = _err("Incorrect order ID")
                return _v2_json(response)
            response = _ok(jap_status_dict(order))
            return _v2_json(response)

        if action == "cancel":
            cancel_keys = parse_cancel_orders(body)
            if cancel_keys:
                if len(cancel_keys) > 100:
                    response = _err("Incorrect request")
                    return _v2_json(response)
                out_list = []
                for k in cancel_keys:
                    o = await resolve_user_order_by_jap_param(db, user_id, k)
                    try:
                        ord_key = int(k) if str(k).strip().lstrip("-").isdigit() else k
                    except Exception:
                        ord_key = k
                    if not o:
                        out_list.append(
                            {
                                "order": ord_key,
                                "cancel": {"error": "Incorrect order ID"},
                            }
                        )
                    else:
                        await db.orders.update_one(
                            {"_id": o["_id"]},
                            {
                                "$set": {
                                    "status": "Cancellation Requested",
                                    "cancellationRequestedAt": datetime.now(timezone.utc),
                                }
                            },
                        )
                        o_j = o.get("japOrderId")
                        if o_j is not None:
                            out_list.append({"order": int(o_j), "cancel": 1})
                        else:
                            out_list.append({"order": ord_key, "cancel": 1})
                response = _ok(out_list)
                return _v2_json(response)
            order_param = body.get("order")
            if order_param is None or str(order_param).strip() == "":
                response = _err("Incorrect order ID")
                return _v2_json(response)
            order = await resolve_user_order_by_jap_param(db, user_id, order_param)
            if not order:
                response = _err("Incorrect order ID")
                return _v2_json(response)
            await db.orders.update_one(
                {"_id": order["_id"]},
                {
                    "$set": {
                        "status": "Cancellation Requested",
                        "cancellationRequestedAt": datetime.now(timezone.utc),
                    }
                },
            )
            # JAP: { "cancel": 1 } on success
            response = _ok({"cancel": 1})
            return _v2_json(response)

        if action == "refill":
            # JAP-compatible stub — full refill flow not implemented
            response = _err("Refill not available")
            return _v2_json(response)

        if action == "refill_status":
            response = _err("Refill not found")
            return _v2_json(response)

        response = _err("Incorrect request")
        return _v2_json(response)
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
    return _v2_json(response)
