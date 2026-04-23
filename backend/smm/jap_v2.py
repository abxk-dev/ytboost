"""
Just Another Panel–compatible helpers: https://justanotherpanel.com/api
Numeric `service` (our `sid`), numeric `order` in responses (japOrderId), and lookups.
"""
import re
from typing import Any, Optional, Tuple

from bson import ObjectId
from pymongo import ReturnDocument


def jap_service_number(svc: dict) -> int:
    """
    JAP `service` field is an int. We use the admin 3-digit `sid` (always on new services),
    with a stable fallback for legacy records without sid.
    """
    sid = svc.get("sid")
    if sid is not None:
        return int(sid)
    return int(str(svc["_id"])[-6:], 16) % 1_000_000 + 1


def _is_object_id_hex(s: str) -> bool:
    return bool(re.fullmatch(r"[a-fA-F0-9]{24}", s or ""))


async def resolve_service_for_add(db, user_id, service_param: Any) -> Optional[Tuple[dict, Any]]:
    """
    Find (service, special|None) for JAP add. Accepts:
    - Integer / numeric string (our `sid`)
    - 24-char ObjectId (Mongo) as service id
    """
    if service_param is None:
        return None
    s_raw = str(service_param).strip()
    if not s_raw:
        return None

    if _is_object_id_hex(s_raw):
        try:
            oid = ObjectId(s_raw)
        except Exception:
            return None
        svc = await db.services.find_one({"_id": oid, "status": True})
        if not svc:
            return None
        sp = await db.user_special_services.find_one(
            {"userId": user_id, "serviceId": oid, "status": True}
        )
        return svc, sp

    try:
        n = int(s_raw)
    except (TypeError, ValueError):
        return None
    svc = await db.services.find_one({"sid": n, "status": True})
    if not svc:
        # services list can show jap_service_number() for legacy rows with no `sid` field; match that
        for doc in await db.services.find({"status": True}).to_list(5000):
            if jap_service_number(doc) == n:
                svc = doc
                break
    if not svc:
        return None
    sp = await db.user_special_services.find_one(
        {"userId": user_id, "serviceId": svc["_id"], "status": True}
    )
    return svc, sp


async def get_next_jap_order_number(db) -> int:
    r = await db.counters.find_one_and_update(
        {"_id": "smm_jap_order_seq"},
        {"$inc": {"n": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    n = (r or {}).get("n")
    if n is None:
        return 1
    return int(n)


async def resolve_user_order_by_jap_param(db, user_id, order_param: Any) -> Any:
    """Resolve a single user order: JAP numeric `order` (japOrderId), or 24-hex ObjectId string."""
    if order_param is None:
        return None
    s = str(order_param).strip()
    if not s:
        return None
    if s.lstrip("-").isdigit():
        try:
            n = int(s)
            o = await db.orders.find_one({"userId": user_id, "japOrderId": n})
            if o:
                return o
        except Exception:
            pass
    if _is_object_id_hex(s):
        try:
            return await db.orders.find_one({"_id": ObjectId(s), "userId": user_id})
        except Exception:
            return None
    return None


def jap_status_dict(order: dict) -> dict:
    """JAP order status object (strings for numerics, per JAP JSON examples)."""
    return {
        "charge": f"{float(order.get('charge', 0) or 0):.5f}",
        "start_count": str(int(order.get("startCount", 0) or 0)),
        "status": str(order.get("status", "")),
        "remains": str(int(order.get("remains", 0) or 0)),
        "currency": "USD",
    }


def _split_comma_separated(s: str) -> list:
    if not s or not str(s).strip():
        return []
    return [p.strip() for p in str(s).split(",") if p.strip()]


def parse_status_orders(body: dict) -> list:
    """JAP: action=status with `orders` = '1,2,3' (single string)."""
    o = body.get("orders")
    if o is None or str(o).strip() == "":
        return []
    if isinstance(o, (list, tuple)):
        return [str(x).strip() for x in o if str(x).strip()]
    return _split_comma_separated(str(o))


def parse_cancel_orders(body: dict) -> list:
    o = body.get("orders")
    if o is None or str(o).strip() == "":
        return []
    if isinstance(o, (list, tuple)):
        return [str(x).strip() for x in o if str(x).strip()]
    return _split_comma_separated(str(o))
