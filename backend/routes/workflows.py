"""
Workflows Routes - Smart order workflows admin + status APIs
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from backend.services.workflow_engine import cancel_job, force_next_step

router = APIRouter(tags=["Workflows"])

db = None


def set_db(database):
    global db
    db = database


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _oid(value: str, label: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid {label}")


def _str_id(v: Any) -> str:
    return str(v) if v is not None else ""


def _validate_workflow_payload(payload: dict):
    conditions = payload.get("conditions") or []
    if not isinstance(conditions, list) or len(conditions) < 1:
        raise HTTPException(status_code=400, detail="At least 1 condition is required")

    for idx, c in enumerate(conditions):
        if (c.get("field") or "quantity") != "quantity":
            raise HTTPException(status_code=400, detail=f"Condition {idx + 1}: invalid field")
        op = (c.get("operator") or "").strip()
        if op not in {"<=", ">=", "=", ">", "<", "between"}:
            raise HTTPException(status_code=400, detail=f"Condition {idx + 1}: invalid operator")
        if c.get("value") is None:
            raise HTTPException(status_code=400, detail=f"Condition {idx + 1}: value is required")
        if op == "between" and c.get("value2") is None:
            raise HTTPException(status_code=400, detail=f"Condition {idx + 1}: value2 is required for between")

        steps = c.get("actionSteps") or []
        if not isinstance(steps, list) or len(steps) < 1:
            raise HTTPException(status_code=400, detail=f"Condition {idx + 1}: at least 1 action step is required")

        total_pct = 0.0
        has_send = False
        for sidx, s in enumerate(steps):
            st = (s.get("type") or "").strip()
            if st not in {"send_order", "wait", "check_status"}:
                raise HTTPException(status_code=400, detail=f"Condition {idx + 1}: step {sidx + 1}: invalid type")
            if st == "send_order":
                has_send = True
                if s.get("percentage") is None:
                    raise HTTPException(status_code=400, detail=f"Condition {idx + 1}: step {sidx + 1}: percentage is required")
                try:
                    pct = float(s.get("percentage") or 0)
                except Exception:
                    raise HTTPException(status_code=400, detail=f"Condition {idx + 1}: step {sidx + 1}: invalid percentage")
                if pct <= 0 or pct > 100:
                    raise HTTPException(status_code=400, detail=f"Condition {idx + 1}: step {sidx + 1}: percentage must be 1-100")
                total_pct += pct
                if not s.get("providerId"):
                    raise HTTPException(status_code=400, detail=f"Condition {idx + 1}: step {sidx + 1}: provider is required")
                if not (s.get("providerServiceId") or "").strip():
                    raise HTTPException(status_code=400, detail=f"Condition {idx + 1}: step {sidx + 1}: providerServiceId is required")
            elif st == "wait":
                if s.get("waitDuration") is None:
                    raise HTTPException(status_code=400, detail=f"Condition {idx + 1}: step {sidx + 1}: waitDuration is required")
                unit = (s.get("waitUnit") or "minutes").strip().lower()
                if unit not in {"minutes", "hours", "days"}:
                    raise HTTPException(status_code=400, detail=f"Condition {idx + 1}: step {sidx + 1}: waitUnit invalid")
            elif st == "check_status":
                if s.get("checkInterval") is None:
                    s["checkInterval"] = 5
                if s.get("checkTimeout") is None:
                    s["checkTimeout"] = 24

        if not has_send:
            raise HTTPException(status_code=400, detail=f"Condition {idx + 1}: must include at least 1 Send Order step")

        if abs(total_pct - 100.0) > 0.0001:
            raise HTTPException(status_code=400, detail=f"Condition {idx + 1}: Send Order steps must total 100%")


class WorkflowStep(BaseModel):
    stepNumber: int = Field(..., ge=1)
    type: str = Field(..., pattern="^(send_order|wait|check_status)$")
    percentage: Optional[float] = None
    providerId: Optional[str] = None
    providerServiceId: Optional[str] = None
    waitDuration: Optional[int] = None
    waitUnit: Optional[str] = None
    checkInterval: Optional[int] = None
    checkTimeout: Optional[float] = None


class WorkflowCondition(BaseModel):
    field: str = Field("quantity")
    operator: str = Field(..., pattern="^(<=|>=|=|>|<|between)$")
    value: int
    value2: Optional[int] = None
    actionSteps: list[WorkflowStep] = []


class WorkflowSettings(BaseModel):
    defaultDelayMinutes: Optional[int] = None
    autoRetry: bool = True
    maxRetries: int = 3
    notifyAdminOnFailure: bool = True
    notifyUserOnCompletion: bool = True


class WorkflowCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    serviceId: str
    status: bool = True
    conditions: list[WorkflowCondition] = []
    settings: Optional[WorkflowSettings] = None


class WorkflowUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=80)
    serviceId: Optional[str] = None
    status: Optional[bool] = None
    conditions: Optional[list[WorkflowCondition]] = None
    settings: Optional[WorkflowSettings] = None


class WorkflowStatusPatch(BaseModel):
    status: bool


@router.get("/admin/workflows")
async def admin_list_workflows(request: Request):
    from backend.middleware.admin import get_current_admin

    await get_current_admin(request, db)
    workflows = await db.workflows.find({}).sort("updatedAt", -1).to_list(500)
    service_ids = [w.get("serviceId") for w in workflows if w.get("serviceId")]
    services = {}
    if service_ids:
        svcs = await db.services.find({"_id": {"$in": service_ids}}).to_list(2000)
        services = {s["_id"]: s for s in svcs}

    result = []
    for w in workflows:
        svc = services.get(w.get("serviceId"))
        conds = w.get("conditions") or []
        cond_summary = []
        for c in conds:
            op = c.get("operator")
            v1 = c.get("value")
            v2 = c.get("value2")
            if op == "between":
                cond_summary.append(f"qty between {v1} and {v2}")
            else:
                cond_summary.append(f"qty {op} {v1}")
        result.append(
            {
                "id": _str_id(w.get("_id")),
                "name": w.get("name", ""),
                "serviceId": _str_id(w.get("serviceId")),
                "serviceName": (svc or {}).get("name", "Unknown"),
                "conditionsSummary": " | ".join(cond_summary) if cond_summary else "-",
                "status": bool(w.get("status", True)),
                "ordersProcessed": int(w.get("ordersProcessed") or 0),
                "createdAt": w.get("createdAt"),
                "updatedAt": w.get("updatedAt"),
            }
        )
    return result


@router.post("/admin/workflows")
async def admin_create_workflow(request: Request, data: WorkflowCreate):
    from backend.middleware.admin import get_current_admin, log_admin_action, require_admin_role

    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin", "manager"})

    service_id = _oid(data.serviceId, "serviceId")
    svc = await db.services.find_one({"_id": service_id})
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")

    payload = data.model_dump()
    _validate_workflow_payload(payload)

    existing = await db.workflows.find_one({"serviceId": service_id, "status": True})
    if existing and data.status:
        raise HTTPException(status_code=400, detail="An active workflow already exists for this service")

    conds = payload.get("conditions") or []
    normalized_conditions = []
    for c in conds:
        steps = c.get("actionSteps") or []
        normalized_steps = []
        for s in steps:
            st = dict(s)
            if st.get("providerId"):
                st["providerId"] = _oid(str(st["providerId"]), "providerId")
            normalized_steps.append(st)
        normalized_conditions.append(
            {
                "field": "quantity",
                "operator": c.get("operator"),
                "value": int(c.get("value")),
                "value2": int(c.get("value2")) if c.get("value2") is not None else None,
                "actionSteps": normalized_steps,
            }
        )

    doc = {
        "name": (payload.get("name") or "").strip(),
        "serviceId": service_id,
        "status": bool(payload.get("status", True)),
        "conditions": normalized_conditions,
        "settings": (payload.get("settings") or {}) or {},
        "ordersProcessed": 0,
        "createdAt": _now(),
        "updatedAt": _now(),
    }
    ins = await db.workflows.insert_one(doc)
    doc["_id"] = ins.inserted_id

    await db.services.update_one({"_id": service_id}, {"$set": {"hasWorkflow": True}})
    await log_admin_action(db, request, admin, "WORKFLOW_CREATED", f"{doc['name']} for service {str(service_id)}")

    return {"id": _str_id(doc["_id"])}


@router.get("/admin/workflows/{workflow_id}")
async def admin_get_workflow(request: Request, workflow_id: str):
    from backend.middleware.admin import get_current_admin

    await get_current_admin(request, db)
    wid = _oid(workflow_id, "workflow_id")
    w = await db.workflows.find_one({"_id": wid})
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")

    def clean_step(s: dict) -> dict:
        out = dict(s)
        if out.get("providerId") is not None:
            out["providerId"] = _str_id(out.get("providerId"))
        return out

    w_out = {
        "id": _str_id(w.get("_id")),
        "name": w.get("name", ""),
        "serviceId": _str_id(w.get("serviceId")),
        "status": bool(w.get("status", True)),
        "conditions": [],
        "settings": w.get("settings") or {},
        "ordersProcessed": int(w.get("ordersProcessed") or 0),
        "createdAt": w.get("createdAt"),
        "updatedAt": w.get("updatedAt"),
    }
    for c in w.get("conditions") or []:
        w_out["conditions"].append(
            {
                "field": c.get("field", "quantity"),
                "operator": c.get("operator"),
                "value": c.get("value"),
                "value2": c.get("value2"),
                "actionSteps": [clean_step(s) for s in (c.get("actionSteps") or [])],
            }
        )
    return w_out


@router.put("/admin/workflows/{workflow_id}")
async def admin_update_workflow(request: Request, workflow_id: str, data: WorkflowUpdate):
    from backend.middleware.admin import get_current_admin, log_admin_action, require_admin_role

    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin", "manager"})

    wid = _oid(workflow_id, "workflow_id")
    existing = await db.workflows.find_one({"_id": wid})
    if not existing:
        raise HTTPException(status_code=404, detail="Workflow not found")

    patch = data.model_dump(exclude_unset=True)
    if "serviceId" in patch and patch["serviceId"] is not None:
        patch["serviceId"] = _oid(str(patch["serviceId"]), "serviceId")

    merged = dict(existing)
    merged.update(patch)
    _validate_workflow_payload(merged)

    if "conditions" in patch:
        normalized_conditions = []
        for c in (patch.get("conditions") or []):
            steps = c.get("actionSteps") or []
            normalized_steps = []
            for s in steps:
                st = dict(s)
                if st.get("providerId"):
                    st["providerId"] = _oid(str(st["providerId"]), "providerId")
                normalized_steps.append(st)
            normalized_conditions.append(
                {
                    "field": "quantity",
                    "operator": c.get("operator"),
                    "value": int(c.get("value")),
                    "value2": int(c.get("value2")) if c.get("value2") is not None else None,
                    "actionSteps": normalized_steps,
                }
            )
        patch["conditions"] = normalized_conditions

    patch["updatedAt"] = _now()
    if "name" in patch and patch["name"] is not None:
        patch["name"] = str(patch["name"]).strip()

    if patch.get("status") is True:
        svc_id = patch.get("serviceId") or existing.get("serviceId")
        active_other = await db.workflows.find_one({"serviceId": svc_id, "status": True, "_id": {"$ne": wid}})
        if active_other:
            raise HTTPException(status_code=400, detail="Another active workflow exists for this service")

    await db.workflows.update_one({"_id": wid}, {"$set": patch})

    svc_id = patch.get("serviceId") or existing.get("serviceId")
    if svc_id:
        active_exists = await db.workflows.count_documents({"serviceId": svc_id, "status": True})
        await db.services.update_one({"_id": svc_id}, {"$set": {"hasWorkflow": active_exists > 0}})

    await log_admin_action(db, request, admin, "WORKFLOW_UPDATED", f"{workflow_id}")
    return {"message": "Workflow updated"}


@router.delete("/admin/workflows/{workflow_id}")
async def admin_delete_workflow(request: Request, workflow_id: str):
    from backend.middleware.admin import get_current_admin, log_admin_action, require_admin_role

    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin", "manager"})

    wid = _oid(workflow_id, "workflow_id")
    w = await db.workflows.find_one({"_id": wid})
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")

    await db.workflows.delete_one({"_id": wid})
    svc_id = w.get("serviceId")
    if svc_id:
        active_exists = await db.workflows.count_documents({"serviceId": svc_id, "status": True})
        await db.services.update_one({"_id": svc_id}, {"$set": {"hasWorkflow": active_exists > 0}})

    await log_admin_action(db, request, admin, "WORKFLOW_DELETED", f"{workflow_id}")
    return {"message": "Workflow deleted"}


@router.patch("/admin/workflows/{workflow_id}/status")
async def admin_toggle_workflow_status(request: Request, workflow_id: str, data: WorkflowStatusPatch):
    from backend.middleware.admin import get_current_admin, log_admin_action, require_admin_role

    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin", "manager"})

    wid = _oid(workflow_id, "workflow_id")
    w = await db.workflows.find_one({"_id": wid})
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if data.status:
        active_other = await db.workflows.find_one({"serviceId": w.get("serviceId"), "status": True, "_id": {"$ne": wid}})
        if active_other:
            raise HTTPException(status_code=400, detail="Another active workflow exists for this service")

    await db.workflows.update_one({"_id": wid}, {"$set": {"status": bool(data.status), "updatedAt": _now()}})

    svc_id = w.get("serviceId")
    if svc_id:
        active_exists = await db.workflows.count_documents({"serviceId": svc_id, "status": True})
        await db.services.update_one({"_id": svc_id}, {"$set": {"hasWorkflow": active_exists > 0}})

    await log_admin_action(db, request, admin, "WORKFLOW_STATUS_CHANGED", f"{workflow_id} -> {bool(data.status)}")
    return {"message": "Status updated", "status": bool(data.status)}


@router.get("/admin/workflows/{workflow_id}/jobs")
async def admin_workflow_jobs(request: Request, workflow_id: str, page: int = 1, limit: int = 50):
    from backend.middleware.admin import get_current_admin

    await get_current_admin(request, db)
    wid = _oid(workflow_id, "workflow_id")
    skip = (page - 1) * limit
    jobs = await db.workflow_order_jobs.find({"workflowId": wid}).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.workflow_order_jobs.count_documents({"workflowId": wid})
    result = []
    for j in jobs:
        result.append(
            {
                "id": _str_id(j.get("_id")),
                "workflowId": _str_id(j.get("workflowId")),
                "originalOrderId": _str_id(j.get("originalOrderId")),
                "userId": _str_id(j.get("userId")),
                "status": j.get("status", ""),
                "currentStep": int(j.get("currentStep") or 0),
                "totalSteps": int(j.get("totalSteps") or 0),
                "matchedConditionIndex": int(j.get("matchedConditionIndex") or 0),
                "scheduledFor": j.get("scheduledFor"),
                "startedAt": j.get("startedAt"),
                "completedAt": j.get("completedAt"),
                "createdAt": j.get("createdAt"),
            }
        )
    return {"jobs": result, "total": total, "page": page, "pages": (total + limit - 1) // limit}


@router.get("/admin/workflows/jobs/active")
async def admin_active_workflow_jobs(request: Request, limit: int = 200):
    from backend.middleware.admin import get_current_admin

    await get_current_admin(request, db)
    jobs = await db.workflow_order_jobs.find({"status": {"$in": ["running", "waiting"]}}).sort("createdAt", -1).limit(limit).to_list(limit)
    result = []
    for j in jobs:
        order = await db.orders.find_one({"_id": j.get("originalOrderId")})
        service = await db.services.find_one({"_id": order.get("serviceId")}) if order else None
        user = await db.users.find_one({"_id": order.get("userId")}) if order else None
        result.append(
            {
                "id": _str_id(j.get("_id")),
                "workflowId": _str_id(j.get("workflowId")),
                "originalOrderId": _str_id(j.get("originalOrderId")),
                "orderShort": _str_id(j.get("originalOrderId"))[-8:],
                "userId": _str_id(j.get("userId")),
                "userEmail": (user or {}).get("email", ""),
                "serviceId": _str_id((order or {}).get("serviceId")),
                "serviceName": (service or {}).get("name", "Unknown"),
                "status": j.get("status", ""),
                "currentStep": int(j.get("currentStep") or 0),
                "totalSteps": int(j.get("totalSteps") or 0),
                "scheduledFor": j.get("scheduledFor"),
                "createdAt": j.get("createdAt"),
            }
        )
    return result


@router.post("/admin/workflow-jobs/{job_id}/force-next")
async def admin_force_next_step(request: Request, job_id: str):
    from backend.middleware.admin import get_current_admin, log_admin_action, require_admin_role

    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin", "manager", "support"})

    jid = _oid(job_id, "job_id")
    job = await force_next_step(db, jid)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    await log_admin_action(db, request, admin, "WORKFLOW_FORCE_NEXT", f"{job_id}")
    return {"message": "Next step triggered", "status": job.get("status", "")}


@router.post("/admin/workflow-jobs/{job_id}/cancel")
async def admin_cancel_job(request: Request, job_id: str):
    from backend.middleware.admin import get_current_admin, log_admin_action, require_admin_role

    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin", "manager", "support"})

    jid = _oid(job_id, "job_id")
    job = await cancel_job(db, jid)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    await log_admin_action(db, request, admin, "WORKFLOW_CANCELLED", f"{job_id}")
    return {"message": "Workflow cancelled", "status": job.get("status", "")}


def _workflow_status_response(workflow: dict, job: dict, order: dict, service: dict) -> dict:
    def clean_sub(s: dict) -> dict:
        out = dict(s)
        if out.get("providerId") is not None:
            out["providerId"] = _str_id(out.get("providerId"))
        return out

    return {
        "workflow": {
            "id": _str_id(workflow.get("_id")),
            "name": workflow.get("name", ""),
            "serviceId": _str_id(workflow.get("serviceId")),
            "serviceName": (service or {}).get("name", "Unknown"),
        },
        "order": {
            "id": _str_id(order.get("_id")),
            "quantity": int(order.get("quantity") or 0),
            "link": order.get("link", ""),
            "status": order.get("status", ""),
        },
        "job": {
            "id": _str_id(job.get("_id")),
            "status": job.get("status", ""),
            "currentStep": int(job.get("currentStep") or 0),
            "totalSteps": int(job.get("totalSteps") or 0),
            "matchedConditionIndex": int(job.get("matchedConditionIndex") or 0),
            "scheduledFor": job.get("scheduledFor"),
            "subOrders": [clean_sub(s) for s in (job.get("subOrders") or [])],
            "startedAt": job.get("startedAt"),
            "completedAt": job.get("completedAt"),
        },
    }


@router.get("/admin/orders/{order_id}/workflow-status")
async def admin_order_workflow_status(request: Request, order_id: str):
    from backend.middleware.admin import get_current_admin

    await get_current_admin(request, db)
    oid = _oid(order_id, "order_id")
    order = await db.orders.find_one({"_id": oid})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    job_id = order.get("workflowJobId")
    if not job_id:
        raise HTTPException(status_code=404, detail="No workflow job for this order")
    job = await db.workflow_order_jobs.find_one({"_id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Workflow job not found")
    workflow = await db.workflows.find_one({"_id": job.get("workflowId")})
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    service = await db.services.find_one({"_id": order.get("serviceId")})
    return _workflow_status_response(workflow, job, order, service)


@router.get("/user/orders/{order_id}/workflow-status")
async def user_order_workflow_status(request: Request, order_id: str):
    from backend.middleware.auth import get_current_user

    user = await get_current_user(request, db)
    user_id = _oid(user["_id"], "user_id")
    oid = _oid(order_id, "order_id")
    order = await db.orders.find_one({"_id": oid, "userId": user_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    job_id = order.get("workflowJobId")
    if not job_id:
        raise HTTPException(status_code=404, detail="No workflow job for this order")
    job = await db.workflow_order_jobs.find_one({"_id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Workflow job not found")
    workflow = await db.workflows.find_one({"_id": job.get("workflowId")})
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    service = await db.services.find_one({"_id": order.get("serviceId")})
    return _workflow_status_response(workflow, job, order, service)

