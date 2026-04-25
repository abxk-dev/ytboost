"""
Smart Workflow Engine
Executes conditional order splitting workflows for services.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from bson import ObjectId

from backend.services.smm_http import (
    extract_provider_add_order_id,
    normalize_smm_json_body,
    post_smm_api,
)

PROVIDER_STATUS_MAP = {
    "Pending": "Pending",
    "In progress": "In Progress",
    "Processing": "Processing",
    "Completed": "Completed",
    "Partial": "Partial",
    "Canceled": "Failed",
    "Cancelled": "Failed",
    "Canceled (refunded)": "Failed",
}


def evaluate_condition(condition: dict, quantity: int) -> bool:
    op = (condition.get("operator") or "").strip()
    v1 = condition.get("value")
    v2 = condition.get("value2")
    try:
        v1n = int(v1) if v1 is not None else None
    except Exception:
        v1n = None
    try:
        v2n = int(v2) if v2 is not None else None
    except Exception:
        v2n = None

    if op == "<=" and v1n is not None:
        return quantity <= v1n
    if op == ">=" and v1n is not None:
        return quantity >= v1n
    if op == "<" and v1n is not None:
        return quantity < v1n
    if op == ">" and v1n is not None:
        return quantity > v1n
    if op == "=" and v1n is not None:
        return quantity == v1n
    if op == "between" and v1n is not None and v2n is not None:
        lo = min(v1n, v2n)
        hi = max(v1n, v2n)
        return lo <= quantity <= hi
    return False


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ms_for_wait(duration: int, unit: str) -> int:
    u = (unit or "").strip().lower()
    if u == "hours":
        return int(duration) * 60 * 60 * 1000
    if u == "days":
        return int(duration) * 24 * 60 * 60 * 1000
    return int(duration) * 60 * 1000


def _compute_split_quantities(total_qty: int, send_steps: list[dict]) -> list[int]:
    steps = [s for s in send_steps if (s.get("type") or "") == "send_order"]
    if not steps:
        return []
    qtys: list[int] = []
    used = 0
    for i, s in enumerate(steps):
        pct = float(s.get("percentage") or 0)
        if i == len(steps) - 1:
            q = max(0, total_qty - used)
        else:
            q = int(total_qty * (pct / 100.0))
            q = max(0, min(total_qty, q))
        qtys.append(q)
        used += q
    return qtys


async def find_active_workflow_for_service(db, service_id: ObjectId) -> Optional[dict]:
    return await db.workflows.find_one({"serviceId": service_id, "status": True})


async def process_workflow_order(db, order: dict) -> Optional[dict]:
    service_id = order.get("serviceId")
    if not service_id:
        return None

    workflow = await find_active_workflow_for_service(db, service_id)
    if not workflow:
        return None

    quantity = int(order.get("quantity") or 0)
    matched_index = None
    for idx, cond in enumerate(workflow.get("conditions", []) or []):
        if (cond.get("field") or "quantity") != "quantity":
            continue
        if evaluate_condition(cond, quantity):
            matched_index = idx
            break
    if matched_index is None:
        return None

    steps = (workflow.get("conditions") or [])[matched_index].get("actionSteps", []) or []
    job_doc = {
        "workflowId": workflow["_id"],
        "originalOrderId": order["_id"],
        "userId": order.get("userId"),
        "status": "running",
        "currentStep": 0,
        "totalSteps": len(steps),
        "matchedConditionIndex": matched_index,
        "subOrders": [],
        "scheduledFor": None,
        "waitingStepType": "",
        "waiting": {},
        "startedAt": _now(),
        "completedAt": None,
        "createdAt": _now(),
        "updatedAt": _now(),
    }

    insert = await db.workflow_order_jobs.insert_one(job_doc)
    job_id = insert.inserted_id

    await db.orders.update_one(
        {"_id": order["_id"]},
        {"$set": {"workflowJobId": job_id, "fulfillmentType": "workflow", "status": "Processing"}},
    )

    await db.workflows.update_one({"_id": workflow["_id"]}, {"$inc": {"ordersProcessed": 1}, "$set": {"updatedAt": _now()}})
    await execute_due_steps(db, job_id)
    return await db.workflow_order_jobs.find_one({"_id": job_id})


async def _provider_add_order(db, provider: dict, provider_service_id: str, link: str, quantity: int) -> tuple[Optional[str], str, Optional[int], str]:
    provider_http = None
    provider_resp = ""
    provider_error = ""
    provider_order_id = None

    pr, perr, _u, ph = await post_smm_api(
        (provider.get("apiUrl") or "").strip(),
        {
            "key": provider.get("apiKey", ""),
            "action": "add",
            "service": str(provider_service_id or ""),
            "link": link,
            "quantity": int(quantity),
        },
        timeout=25.0,
    )
    if ph is not None:
        provider_http = ph
    if perr:
        provider_error = str(perr)[:2000]
        return None, provider_error, provider_http, provider_error[:2000]

    pr = normalize_smm_json_body(pr)
    oid = extract_provider_add_order_id(pr)
    if oid:
        provider_order_id = str(oid)
        try:
            provider_resp = str(pr)[:2000]
        except Exception:
            provider_resp = ""
        return provider_order_id, "", provider_http, provider_resp

    if isinstance(pr, dict):
        err = pr.get("error") or pr.get("message")
        provider_error = str(err)[:2000] if err is not None else f"No order id in provider response: {str(pr)[:500]}"
        return None, provider_error, provider_http, provider_error[:2000]

    provider_error = "Invalid response from provider (not a JSON object)"
    return None, provider_error, provider_http, provider_error[:2000]


async def _provider_get_status(provider: dict, provider_order_id: str) -> Optional[dict]:
    try:
        result, err, _u, _h = await post_smm_api(
            (provider.get("apiUrl") or "").strip(),
            {"key": provider.get("apiKey", ""), "action": "status", "order": str(provider_order_id or "")},
            timeout=20.0,
        )
        if err or not isinstance(result, dict):
            return None
        return result
    except Exception:
        return None


def _suborder_terminal(sub: dict) -> bool:
    return (sub.get("status") or "") in {"completed", "failed", "cancelled"}


async def refresh_job_suborders_status(db, job: dict) -> dict:
    sub_orders = list(job.get("subOrders") or [])
    if not sub_orders:
        return job

    provider_cache: dict[str, dict] = {}
    updated = False

    for sub in sub_orders:
        if (sub.get("type") or "") != "send_order":
            continue
        if _suborder_terminal(sub):
            continue
        provider_id = sub.get("providerId")
        provider_order_id = (sub.get("providerOrderId") or "").strip()
        if not provider_id or not provider_order_id:
            continue
        pid_str = str(provider_id)
        if pid_str not in provider_cache:
            try:
                pid = provider_id if isinstance(provider_id, ObjectId) else ObjectId(str(provider_id))
            except Exception:
                continue
            p = await db.api_providers.find_one({"_id": pid})
            if p and p.get("status", True):
                provider_cache[pid_str] = p
        provider = provider_cache.get(pid_str)
        if not provider:
            continue

        status_payload = await _provider_get_status(provider, provider_order_id)
        if not status_payload:
            continue

        panel_status = PROVIDER_STATUS_MAP.get(status_payload.get("status", ""), "")
        if not panel_status:
            continue

        mapped = sub.get("status") or "sent"
        if panel_status == "Completed":
            mapped = "completed"
        elif panel_status in {"Pending", "Processing", "In Progress"}:
            mapped = "processing"
        elif panel_status == "Partial":
            mapped = "completed"
        elif panel_status == "Failed":
            mapped = "failed"

        if mapped != (sub.get("status") or ""):
            sub["status"] = mapped
            if mapped == "completed":
                sub["completedAt"] = _now()
            updated = True

    if updated:
        await db.workflow_order_jobs.update_one(
            {"_id": job["_id"]},
            {"$set": {"subOrders": sub_orders, "updatedAt": _now()}},
        )
        job = await db.workflow_order_jobs.find_one({"_id": job["_id"]})
    return job


def _find_last_send_suborder(job: dict) -> Optional[dict]:
    subs = list(job.get("subOrders") or [])
    for sub in reversed(subs):
        if (sub.get("type") or "") == "send_order":
            return sub
    return None


async def execute_due_steps(db, job_id: ObjectId) -> Optional[dict]:
    job = await db.workflow_order_jobs.find_one({"_id": job_id})
    if not job:
        return None
    if (job.get("status") or "") not in {"running", "pending"}:
        return job

    workflow = await db.workflows.find_one({"_id": job.get("workflowId")})
    if not workflow:
        await db.workflow_order_jobs.update_one({"_id": job_id}, {"$set": {"status": "failed", "updatedAt": _now()}})
        return await db.workflow_order_jobs.find_one({"_id": job_id})

    order = await db.orders.find_one({"_id": job.get("originalOrderId")})
    if not order:
        await db.workflow_order_jobs.update_one({"_id": job_id}, {"$set": {"status": "failed", "updatedAt": _now()}})
        return await db.workflow_order_jobs.find_one({"_id": job_id})

    conditions = workflow.get("conditions") or []
    try:
        cond = conditions[int(job.get("matchedConditionIndex") or 0)]
    except Exception:
        cond = None
    if not cond:
        await db.workflow_order_jobs.update_one({"_id": job_id}, {"$set": {"status": "failed", "updatedAt": _now()}})
        return await db.workflow_order_jobs.find_one({"_id": job_id})

    steps = list(cond.get("actionSteps") or [])
    current = int(job.get("currentStep") or 0)
    total_qty = int(order.get("quantity") or 0)

    send_steps = [s for s in steps if (s.get("type") or "") == "send_order"]
    send_qtys = _compute_split_quantities(total_qty, send_steps)
    send_idx = 0

    executed_guard = 0
    while True:
        executed_guard += 1
        if executed_guard > 25:
            break

        job = await db.workflow_order_jobs.find_one({"_id": job_id})
        if not job or (job.get("status") or "") not in {"running", "pending"}:
            return job
        current = int(job.get("currentStep") or 0)
        if current >= len(steps):
            await db.workflow_order_jobs.update_one(
                {"_id": job_id},
                {"$set": {"status": "completed", "completedAt": _now(), "updatedAt": _now(), "scheduledFor": None, "waitingStepType": "", "waiting": {}}},
            )
            await db.orders.update_one({"_id": order["_id"]}, {"$set": {"status": "Completed"}})
            return await db.workflow_order_jobs.find_one({"_id": job_id})

        step = steps[current]
        stype = (step.get("type") or "").strip()
        step_number = int(step.get("stepNumber") or (current + 1))

        if stype == "send_order":
            percentage = float(step.get("percentage") or 0)
            provider_id_raw = step.get("providerId")
            provider_service_id = (step.get("providerServiceId") or "").strip()
            retries = int(step.get("retries") or 0)

            if not provider_id_raw or not provider_service_id:
                await db.workflow_order_jobs.update_one(
                    {"_id": job_id},
                    {"$set": {"status": "failed", "updatedAt": _now()}, "$push": {"subOrders": {"stepNumber": step_number, "type": "send_order", "status": "failed", "percentage": percentage, "quantity": 0, "providerId": provider_id_raw, "providerName": "", "providerOrderId": "", "sentAt": _now(), "error": "Provider and provider service id are required"}}},
                )
                await db.orders.update_one({"_id": order["_id"]}, {"$set": {"status": "Failed"}})
                return await db.workflow_order_jobs.find_one({"_id": job_id})

            try:
                provider_id = provider_id_raw if isinstance(provider_id_raw, ObjectId) else ObjectId(str(provider_id_raw))
            except Exception:
                provider_id = None
            provider = await db.api_providers.find_one({"_id": provider_id}) if provider_id else None
            if not provider or not provider.get("status", True):
                await db.workflow_order_jobs.update_one(
                    {"_id": job_id},
                    {"$set": {"status": "failed", "updatedAt": _now()}, "$push": {"subOrders": {"stepNumber": step_number, "type": "send_order", "status": "failed", "percentage": percentage, "quantity": 0, "providerId": provider_id_raw, "providerName": "", "providerOrderId": "", "sentAt": _now(), "error": "Provider not found or disabled"}}},
                )
                await db.orders.update_one({"_id": order["_id"]}, {"$set": {"status": "Failed"}})
                return await db.workflow_order_jobs.find_one({"_id": job_id})

            qty = 0
            if send_idx < len(send_qtys):
                qty = int(send_qtys[send_idx])
            else:
                qty = max(0, int(total_qty))
            send_idx += 1

            now = _now()
            try:
                provider_order_id, perr, _p_http, presp = await _provider_add_order(
                    db,
                    provider,
                    provider_service_id,
                    str(order.get("link") or ""),
                    qty,
                )
            except Exception as e:
                provider_order_id, perr, presp = None, str(e)[:2000], str(e)[:2000]

            if not provider_order_id:
                workflow_settings = workflow.get("settings") or {}
                auto_retry = bool(workflow_settings.get("autoRetry", True))
                max_retries = int(workflow_settings.get("maxRetries") or 3)
                if auto_retry and retries < max_retries:
                    step["retries"] = retries + 1
                    await db.workflow_order_jobs.update_one(
                        {"_id": job_id},
                        {
                            "$set": {
                                "status": "waiting",
                                "scheduledFor": now + timedelta(minutes=1),
                                "waitingStepType": "retry_send",
                                "waiting": {"type": "retry_send", "stepIndex": current, "retryAt": (now + timedelta(minutes=1)).isoformat()},
                                "updatedAt": _now(),
                            }
                        },
                    )
                    await db.workflows.update_one({"_id": workflow["_id"]}, {"$set": {"conditions": conditions, "updatedAt": _now()}})
                    await db.workflow_order_jobs.update_one(
                        {"_id": job_id},
                        {"$push": {"subOrders": {"stepNumber": step_number, "type": "send_order", "status": "failed", "percentage": percentage, "quantity": qty, "providerId": provider_id, "providerName": provider.get("name", ""), "providerOrderId": "", "providerServiceId": provider_service_id, "sentAt": now, "error": perr[:2000], "providerResponse": presp[:2000], "retry": retries + 1}}},
                    )
                    return await db.workflow_order_jobs.find_one({"_id": job_id})

                await db.workflow_order_jobs.update_one(
                    {"_id": job_id},
                    {"$set": {"status": "failed", "updatedAt": _now()}, "$push": {"subOrders": {"stepNumber": step_number, "type": "send_order", "status": "failed", "percentage": percentage, "quantity": qty, "providerId": provider_id, "providerName": provider.get("name", ""), "providerOrderId": "", "providerServiceId": provider_service_id, "sentAt": now, "error": perr[:2000], "providerResponse": presp[:2000]}}},
                )
                await db.orders.update_one({"_id": order["_id"]}, {"$set": {"status": "Failed"}})
                return await db.workflow_order_jobs.find_one({"_id": job_id})

            await db.workflow_order_jobs.update_one(
                {"_id": job_id},
                {
                    "$push": {
                        "subOrders": {
                            "stepNumber": step_number,
                            "type": "send_order",
                            "providerId": provider_id,
                            "providerName": provider.get("name", ""),
                            "providerOrderId": provider_order_id,
                            "providerServiceId": provider_service_id,
                            "quantity": qty,
                            "percentage": percentage,
                            "status": "sent",
                            "sentAt": now,
                            "completedAt": None,
                        }
                    },
                    "$set": {"currentStep": current + 1, "updatedAt": _now()},
                },
            )
            continue

        if stype == "wait":
            try:
                duration = int(step.get("waitDuration") or 0)
            except Exception:
                duration = 0
            unit = (step.get("waitUnit") or "minutes").strip().lower()
            wait_ms = _ms_for_wait(max(0, duration), unit)
            resume_at = _now() + timedelta(milliseconds=wait_ms)
            last_send = _find_last_send_suborder(job)
            dep = {}
            if last_send:
                dep = {
                    "dependsOnProviderId": last_send.get("providerId"),
                    "dependsOnProviderOrderId": last_send.get("providerOrderId"),
                }
            await db.workflow_order_jobs.update_one(
                {"_id": job_id},
                {
                    "$push": {"subOrders": {"stepNumber": step_number, "type": "wait", "status": "waiting", "scheduledFor": resume_at, "sentAt": _now()}},
                    "$set": {
                        "status": "waiting",
                        "scheduledFor": resume_at,
                        "waitingStepType": "wait",
                        "waiting": {"type": "wait", "resumeAt": resume_at.isoformat(), **dep},
                        "currentStep": current + 1,
                        "updatedAt": _now(),
                    },
                },
            )
            return await db.workflow_order_jobs.find_one({"_id": job_id})

        if stype == "check_status":
            try:
                check_interval = int(step.get("checkInterval") or 5)
            except Exception:
                check_interval = 5
            try:
                timeout_hours = float(step.get("checkTimeout") or 24)
            except Exception:
                timeout_hours = 24.0
            timeout_hours = max(0.1, min(7 * 24, timeout_hours))
            timeout_at = _now() + timedelta(hours=timeout_hours)
            last_send = _find_last_send_suborder(job)
            if not last_send:
                await db.workflow_order_jobs.update_one(
                    {"_id": job_id},
                    {"$set": {"status": "failed", "updatedAt": _now()}, "$push": {"subOrders": {"stepNumber": step_number, "type": "check_status", "status": "failed", "sentAt": _now(), "error": "No previous send_order step found"}}},
                )
                await db.orders.update_one({"_id": order["_id"]}, {"$set": {"status": "Failed"}})
                return await db.workflow_order_jobs.find_one({"_id": job_id})

            scheduled_for = _now() + timedelta(minutes=max(1, check_interval))
            await db.workflow_order_jobs.update_one(
                {"_id": job_id},
                {
                    "$push": {
                        "subOrders": {
                            "stepNumber": step_number,
                            "type": "check_status",
                            "status": "waiting",
                            "sentAt": _now(),
                            "scheduledFor": scheduled_for,
                            "checkInterval": check_interval,
                            "checkTimeout": timeout_hours,
                        }
                    },
                    "$set": {
                        "status": "waiting",
                        "scheduledFor": scheduled_for,
                        "waitingStepType": "check_status",
                        "waiting": {
                            "type": "check_status",
                            "dependsOnProviderId": last_send.get("providerId"),
                            "dependsOnProviderOrderId": last_send.get("providerOrderId"),
                            "timeoutAt": timeout_at.isoformat(),
                            "checkIntervalMinutes": check_interval,
                        },
                        "currentStep": current + 1,
                        "updatedAt": _now(),
                    },
                },
            )
            return await db.workflow_order_jobs.find_one({"_id": job_id})

        await db.workflow_order_jobs.update_one(
            {"_id": job_id},
            {"$set": {"status": "failed", "updatedAt": _now()}, "$push": {"subOrders": {"stepNumber": step_number, "type": stype, "status": "failed", "sentAt": _now(), "error": "Unknown step type"}}},
        )
        await db.orders.update_one({"_id": order["_id"]}, {"$set": {"status": "Failed"}})
        return await db.workflow_order_jobs.find_one({"_id": job_id})

    return await db.workflow_order_jobs.find_one({"_id": job_id})


async def resume_waiting_job_if_due(db, job: dict) -> Optional[dict]:
    job = await refresh_job_suborders_status(db, job)
    if not job:
        return None
    if (job.get("status") or "") != "waiting":
        return job

    wtype = (job.get("waitingStepType") or "").strip()
    waiting = job.get("waiting") or {}
    now = _now()

    if wtype == "retry_send":
        step_index = int(waiting.get("stepIndex") or 0)
        scheduled_for = job.get("scheduledFor")
        if scheduled_for and isinstance(scheduled_for, datetime) and scheduled_for > now:
            return job
        await db.workflow_order_jobs.update_one(
            {"_id": job["_id"]},
            {"$set": {"status": "running", "currentStep": step_index, "scheduledFor": None, "waitingStepType": "", "waiting": {}, "updatedAt": _now()}},
        )
        return await execute_due_steps(db, job["_id"])

    if wtype == "wait":
        resume_at_raw = waiting.get("resumeAt")
        resume_at = None
        if isinstance(job.get("scheduledFor"), datetime):
            resume_at = job.get("scheduledFor")
        if resume_at is None and isinstance(resume_at_raw, str):
            try:
                resume_at = datetime.fromisoformat(resume_at_raw.replace("Z", "+00:00"))
            except Exception:
                resume_at = None

        last_send = _find_last_send_suborder(job)
        prev_completed = bool(last_send and (last_send.get("status") or "") == "completed")

        if prev_completed or (resume_at is not None and resume_at <= now):
            await db.workflow_order_jobs.update_one(
                {"_id": job["_id"]},
                {"$set": {"status": "running", "scheduledFor": None, "waitingStepType": "", "waiting": {}, "updatedAt": _now()}},
            )
            return await execute_due_steps(db, job["_id"])
        return job

    if wtype == "check_status":
        timeout_at_raw = waiting.get("timeoutAt")
        timeout_at = None
        if isinstance(timeout_at_raw, str):
            try:
                timeout_at = datetime.fromisoformat(timeout_at_raw.replace("Z", "+00:00"))
            except Exception:
                timeout_at = None
        if timeout_at and now >= timeout_at:
            await db.workflow_order_jobs.update_one(
                {"_id": job["_id"]},
                {"$set": {"status": "failed", "updatedAt": _now(), "scheduledFor": None, "waitingStepType": "", "waiting": {}}},
            )
            await db.orders.update_one({"_id": job.get("originalOrderId")}, {"$set": {"status": "Failed"}})
            return await db.workflow_order_jobs.find_one({"_id": job["_id"]})

        depends_pid = waiting.get("dependsOnProviderId")
        depends_oid = (waiting.get("dependsOnProviderOrderId") or "").strip()
        prev_completed = False
        last_send = _find_last_send_suborder(job)
        if last_send and depends_oid and (last_send.get("providerOrderId") or "") == depends_oid:
            prev_completed = (last_send.get("status") or "") == "completed"

        if prev_completed:
            await db.workflow_order_jobs.update_one(
                {"_id": job["_id"]},
                {"$set": {"status": "running", "scheduledFor": None, "waitingStepType": "", "waiting": {}, "updatedAt": _now()}},
            )
            return await execute_due_steps(db, job["_id"])

        interval_min = int(waiting.get("checkIntervalMinutes") or 5)
        scheduled_for = job.get("scheduledFor")
        if scheduled_for and isinstance(scheduled_for, datetime) and scheduled_for > now:
            return job

        next_run = now + timedelta(minutes=max(1, interval_min))
        await db.workflow_order_jobs.update_one(
            {"_id": job["_id"]},
            {"$set": {"scheduledFor": next_run, "updatedAt": _now()}},
        )
        return await db.workflow_order_jobs.find_one({"_id": job["_id"]})

    return job


async def force_next_step(db, job_id: ObjectId) -> Optional[dict]:
    job = await db.workflow_order_jobs.find_one({"_id": job_id})
    if not job:
        return None
    if (job.get("status") or "") in {"completed", "failed", "cancelled"}:
        return job
    await db.workflow_order_jobs.update_one(
        {"_id": job_id},
        {"$set": {"status": "running", "scheduledFor": None, "waitingStepType": "", "waiting": {}, "updatedAt": _now()}},
    )
    return await execute_due_steps(db, job_id)


async def cancel_job(db, job_id: ObjectId) -> Optional[dict]:
    job = await db.workflow_order_jobs.find_one({"_id": job_id})
    if not job:
        return None
    await db.workflow_order_jobs.update_one(
        {"_id": job_id},
        {"$set": {"status": "cancelled", "completedAt": _now(), "scheduledFor": None, "waitingStepType": "", "waiting": {}, "updatedAt": _now()}},
    )
    await db.orders.update_one({"_id": job.get("originalOrderId")}, {"$set": {"status": "Cancelled"}})
    return await db.workflow_order_jobs.find_one({"_id": job_id})
