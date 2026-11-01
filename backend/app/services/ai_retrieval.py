import math
import re
from typing import Any

from sqlalchemy.orm import Session

from ..models.issue import Issue
from ..models.project import Project

PIN_RE = re.compile(r"(?<!\d)(\d{6})(?!\d)")
CODE_RE = re.compile(r"\bCG-[A-Z0-9-]+\b", re.I)
ISSUE_REF_RE = re.compile(r"\b(?:CGI|Q|BLK)-[A-Z0-9-]+\b", re.I)
STOP = {"what", "which", "where", "when", "near", "around", "about", "there", "their", "project", "projects", "work", "works", "status", "current", "happening", "happen", "please", "tell", "show", "find", "give", "the", "and", "for", "with", "from", "nearby", "any", "are", "is", "in", "my", "me", "of", "to", "a", "an", "on", "at", "how", "can", "i", "do", "check", "road", "roads", "closure", "closures", "delayed", "delay", "progress", "issue", "issues", "grievance", "grievances"}
MILESTONE_NAMES = ["Sanction & DPR Published", "Tender & Site Mobilisation", "Utility Shifting & Excavation", "Core Conduit / Pipe Laying", "Quality & Compaction Audit", "Road Surface Restoration", "Commissioned & Reopened"]


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * radius * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _project_record(project: Project, distance_km: float | None = None) -> dict[str, Any]:
    def public_text(value: str | None) -> str | None:
        if value is None:
            return None
        value = re.sub(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", "[contact omitted]", value, flags=re.I)
        return re.sub(r"(?<!\w)(?:\+?\d[\d ()-]{7,}\d)(?!\w)", "[contact omitted]", value)

    def public_event_detail(detail: str) -> str:
        detail = re.sub(r"\s*\(Submitted on-site by [^)]*\)", "", detail, flags=re.I)
        detail = re.sub(r"\s*\(Field supervisor: [^)]*\)", "", detail, flags=re.I)
        detail = re.sub(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", "[contact omitted]", detail, flags=re.I)
        return re.sub(r"(?<!\w)(?:\+?\d[\d ()-]{7,}\d)(?!\w)", "[contact omitted]", detail)

    return {
        "id": project.id, "type": "project", "code": project.code, "title": project.title,
        "category": project.category, "department": project.department, "locality": project.locality,
        "pincode": project.pincode, "address": public_text(project.address), "description": public_text(project.description),
        "status": project.status, "progress": project.progress, "current_step": project.current_step,
        "current_step_title": MILESTONE_NAMES[max(1, min(7, project.current_step or 1)) - 1],
        "budget": project.budget, "start_date": project.start_date.isoformat(),
        "due_date": project.due_date.isoformat(),
        "revised_date": project.revised_date.isoformat() if project.revised_date else None,
        "delay_reason": public_text(project.delay_reason), "mitigation": public_text(project.mitigation),
        "disruption": public_text(project.disruption), "detour_advice": public_text(project.detour_advice),
        "noise_warning": public_text(project.noise_warning), "dust_warning": public_text(project.dust_warning),
        "public_engineer_contact": {"name": project.contact_engineer_name, "phone": project.contact_engineer_phone, "email": project.contact_engineer_email},
        "public_contractor_contact": {"name": project.contact_contractor, "phone": project.contact_contractor_phone},
        "events": [{"title": e.title, "detail": public_event_detail(e.detail), "created": e.created.isoformat()}
                   for e in sorted(project.events, key=lambda item: item.created)[-8:]],
        "distance_km_approx": round(distance_km, 2) if distance_km is not None else None,
    }


def retrieve_public_records(db: Session, message: str, context: list[dict], location: dict | None) -> tuple[list[dict], bool]:
    query = " ".join([*(turn["content"] for turn in context[-4:]), message]).lower()
    pins = PIN_RE.findall(query)
    code_match = CODE_RE.search(query)
    issue_match = ISSUE_REF_RE.search(query)
    projects = db.query(Project).all()
    issues = db.query(Issue).all()
    matches: list[tuple[float, Project, float | None]] = []
    normalize_area = lambda value: re.sub(r"[^a-z0-9]", "", value.lower())
    normalized_query = normalize_area(query)
    known_localities = {p.locality.lower() for p in projects if p.locality}
    known_localities.update(issue.locality.lower() for issue in issues if issue.locality)
    matched_localities = {area for area in known_localities if normalize_area(area) in normalized_query}
    explicit_location = bool(pins or matched_localities or any(word in query for word in ("near me", "nearby", "my area", "around me", "near ")))

    if location and any(word in query for word in ("near", "nearby", "around", "within", "current location", "my area", "me")):
        explicit_location = True
        for project in projects:
            distance = haversine_km(location["latitude"], location["longitude"], project.lat, project.lng)
            if distance <= 2:
                matches.append((100 - distance, project, distance))
    elif pins:
        for project in projects:
            if project.pincode in pins:
                matches.append((100, project, None))
    elif matched_localities:
        for project in projects:
            if project.locality.lower() in matched_localities:
                matches.append((100, project, None))

    if code_match:
        for project in projects:
            if project.code.lower() == code_match.group(0).lower():
                matches.append((200, project, None))

    if not matches:
        keywords = [w for w in re.findall(r"[a-z0-9]+", query) if len(w) > 2 and w not in STOP]
        for project in projects:
            haystack = " ".join([project.title, project.code, project.department, project.category,
                                  project.locality, project.address, project.pincode, project.description, project.status]).lower()
            weight = sum(3 if word in project.title.lower() else 1 for word in set(keywords) if word in haystack)
            if "delayed" in query and project.status.lower() == "delayed":
                weight += 4
            if any(w in query for w in ("closure", "disruption", "detour")) and project.disruption:
                weight += 1
            if weight:
                matches.append((weight, project, None))

    if any(word in query for word in ("closure", "closures", "closed", "roadblock", "blocked road")):
        matches = [item for item in matches if item[1].status.lower() != "completed" and any(term in item[1].disruption.lower() for term in ("close", "closure", "blocked", "blockage", "road narrowing"))]

    matches.sort(key=lambda value: value[0], reverse=True)
    selected: list[dict] = []
    seen: set[int] = set()
    for _, project, distance in matches:
        if project.id not in seen:
            selected.append(_project_record(project, distance))
            seen.add(project.id)
        if len(selected) >= 12:
            break

    issue_refs = [ref.lower() for ref in ISSUE_REF_RE.findall(query)]
    selected_issues = []
    selected_project_ids = {record["id"] for record in selected}
    for issue in issues:
        if (issue_refs and issue.ref.lower() in issue_refs) or issue.project_id in selected_project_ids or (
            explicit_location and (issue.pincode in pins or issue.locality.lower() in matched_localities or (selected and any(
                issue.locality.lower() in project["locality"].lower() for project in selected)))
        ):
            public_reply = issue.official_reply
            if public_reply:
                public_reply = re.sub(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", "[contact omitted]", public_reply, flags=re.I)
                public_reply = re.sub(r"(?<!\w)(?:\+?\d[\d ()-]{7,}\d)(?!\w)", "[contact omitted]", public_reply)
            selected_issues.append({"id": issue.id, "type": "issue", "ref": issue.ref,
                                    "kind": issue.kind, "department": issue.department,
                                    "locality": issue.locality, "pincode": issue.pincode,
                                    "status": issue.status, "is_question": issue.is_question,
                                    "official_reply": public_reply})
        if len(selected_issues) >= 12:
            break

    if not selected and any(word in query for word in ("statistics", "citywide", "overall", "how many", "total projects", "project count", "total budget", "capital budget")) and not any(word in query for word in ("department", "locality", "localities", "area", "areas")):
        summary = {
            "id": 1, "type": "statistics", "title": "Current citywide public works statistics",
            "total": len(projects),
            "in_progress": sum(1 for project in projects if project.status == "In progress"),
            "delayed": sum(1 for project in projects if project.status == "Delayed"),
            "completed": sum(1 for project in projects if project.status == "Completed"),
            "upcoming": sum(1 for project in projects if project.status in {"Upcoming", "Scheduled"}),
            "total_budget": sum(project.budget for project in projects),
        }
        selected = [summary]
    elif not selected and any(word in query for word in ("locality", "localities", "area", "areas", "pincode", "pin codes", "postal code")):
        groups: dict[str, dict[str, Any]] = {}
        for project in projects:
            item = groups.setdefault(project.pincode, {"locality": project.locality, "count": 0, "active": 0, "delayed": 0})
            item["count"] += 1
            if project.status in {"In progress", "Delayed"}:
                item["active"] += 1
            if project.status == "Delayed":
                item["delayed"] += 1
        selected = [{"id": index + 1, "type": "locality", "title": item["locality"], "pincode": pin,
                     "count": item["count"], "active": item["active"], "delayed": item["delayed"]}
                    for index, (pin, item) in enumerate(sorted(groups.items()))]
    elif not selected and any(word in query for word in ("department", "departments", "agency", "agencies", "utility", "utilities")):
        departments = sorted({project.department for project in projects if project.department})
        selected = [{"id": index + 1, "type": "department", "title": name} for index, name in enumerate(departments)]
    return selected + selected_issues, explicit_location


def deterministic_answer(message: str, records: list[dict], explicit_location: bool) -> str:
    if not records:
        lower_message = message.lower()
        if "grievance" in lower_message and any(word in lower_message for word in ("status", "track", "check")):
            return "I can check a grievance's recorded status. Please share its Utopia reference number (for example, CGI-… or Q-…)."
        if any(word in lower_message for word in ("report", "complaint", "issue", "grievance")):
            return "You can report an issue from the citizen portal using ‘Report Issue’. Add the location and a description, review the details, then submit. I couldn't find matching Utopia records for the information you asked about."
        if explicit_location and not any(PIN_RE.findall(message)):
            return "I couldn't resolve that location to a Utopia project area. Please share a six-digit PIN code or a Chennai locality name."
        return "I couldn't find this information in the Utopia records currently available. You can try a project code, locality, or six-digit PIN code."

    projects = [record for record in records if record["type"] == "project"]
    issues = [record for record in records if record["type"] == "issue"]
    departments = [record["title"] for record in records if record["type"] == "department"]
    localities = [record for record in records if record["type"] == "locality"]
    statistics = next((record for record in records if record["type"] == "statistics"), None)
    lines = []
    if departments:
        lines.append("Departments represented in current Utopia project records: " + ", ".join(departments) + ".")
    if localities:
        lines.append("Localities with project records: " + "; ".join(f"{item['title']} (PIN {item['pincode']}, {item['count']} work(s), {item['active']} active, {item['delayed']} delayed)" for item in localities) + ".")
    if statistics:
        lines.append(f"Current Utopia records list {statistics['total']} works: {statistics['in_progress']} in progress, {statistics['delayed']} delayed, {statistics['completed']} completed, and {statistics['upcoming']} scheduled/upcoming. Total recorded budget: ₹{statistics['total_budget']:,}.")
    if projects:
        if any(pin in message for pin in PIN_RE.findall(message)) or any(w in message.lower() for w in ("projects", "works", "near", "nearby", "around", "area")):
            grouped = {"Active": [], "Delayed": [], "Completed": [], "Upcoming": []}
            for project in projects:
                status = project["status"].lower()
                bucket = "Delayed" if status == "delayed" else "Completed" if status == "completed" else "Upcoming" if status in {"scheduled", "upcoming"} or project["progress"] == 0 else "Active"
                grouped[bucket].append(project)
            lines.append(f"I found {len(projects)} matching project(s) in Utopia:")
            for label, items in grouped.items():
                if items:
                    lines.append(f"{label}: " + "; ".join(f"{p['title']} ({p['code']}) — {p['department']}, {p['progress']}% complete" + (f", approximately {p['distance_km_approx']} km away" if p['distance_km_approx'] is not None else "") for p in items))
        for project in projects[:4]:
            details = []
            if "progress" in message.lower() or "status" in message.lower():
                details.append(f"recorded status: {project['status']}, {project['progress']}% complete, stage {project['current_step']}/7 ({project['current_step_title']})")
            if "milestone" in message.lower() or "stage" in message.lower():
                details.append(f"current recorded milestone: {project['current_step_title']} (stage {project['current_step']}/7)")
            if "delay" in message.lower() and project["delay_reason"]:
                details.append(f"delay reason: {project['delay_reason']}")
                if project["mitigation"]:
                    details.append(f"mitigation: {project['mitigation']}")
            if any(w in message.lower() for w in ("closure", "disruption", "detour", "road")):
                details.append(f"disruption: {project['disruption']}; detour: {project['detour_advice']}")
            if "budget" in message.lower():
                details.append(f"recorded budget: ₹{project['budget']:,}")
            if any(word in message.lower() for word in ("contact", "engineer", "contractor", "phone", "email")):
                engineer = project["public_engineer_contact"]
                contractor = project["public_contractor_contact"]
                details.append(f"public supervising engineer: {engineer['name']}, {engineer['phone']}, {engineer['email']}")
                details.append(f"public contractor contact: {contractor['name']}, {contractor['phone']}")
            if "date" in message.lower() or "completion" in message.lower() or "finish" in message.lower():
                details.append(f"due date: {project['revised_date'] or project['due_date']}")
            if details:
                lines.append(f"{project['title']} ({project['code']}): " + "; ".join(details) + ".")
    for issue in issues:
        lines.append(f"Grievance {issue['ref']}: {issue['kind']} in {issue['locality']} is recorded as {issue['status']}." + (f" Official reply: {issue['official_reply']}" if issue["official_reply"] else ""))
    if not lines:
        lines.append("I found these matching Utopia records: " + "; ".join(f"{p['title']} ({p['code']}), {p['status']}, {p['progress']}% complete" for p in projects[:6]) + ".")
    return "\n".join(lines)
