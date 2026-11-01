import time
import re
from pathlib import Path
from collections import defaultdict, deque
from threading import Lock
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas.ai_chat import AIChatIn, AIChatOut
from ..services.ai_provider import generate_general_answer, generate_grounded_answer, transcribe_recording
from ..services.ai_retrieval import deterministic_answer, retrieve_public_records
from ..services.media_storage import MAX_BYTES, MIME_EXTENSIONS, MIME_SUFFIXES, _matches_signature

router = APIRouter(prefix="/api/ai", tags=["Utopia AI Citizen Assistant"])
_rate_lock = Lock()
_request_times: dict[str, deque[float]] = defaultdict(deque)


@router.post("/transcribe")
async def transcribe_audio(request: Request, file: UploadFile = File(...)):
    """Transcribe a short citizen recording without persisting a second copy."""
    _check_rate_limit(request.client.host if request.client else "unknown")
    mime_type = (file.content_type or "").split(";", 1)[0].strip().lower()
    suffix = Path(file.filename or "").suffix.lower()
    allowed_suffixes = MIME_SUFFIXES["audio"].get(mime_type, set())
    if mime_type not in MIME_EXTENSIONS["audio"] or suffix not in allowed_suffixes:
        raise HTTPException(415, "Choose a supported audio recording such as WEBM, OGG, WAV, MP3, or M4A.")
    data = await file.read(MAX_BYTES["audio"] + 1)
    if len(data) > MAX_BYTES["audio"]:
        raise HTTPException(413, "Audio recordings must be at most 20 MB to transcribe.")
    if not data:
        raise HTTPException(400, "The audio recording is empty.")
    if not _matches_signature("audio", mime_type, data[:64]):
        raise HTTPException(415, "The audio file contents do not match the selected format.")
    safe_filename = f"recording{MIME_EXTENSIONS['audio'][mime_type]}"
    try:
        text = await transcribe_recording(data, safe_filename, mime_type)
    except RuntimeError as exc:
        raise HTTPException(502, str(exc)) from None
    return {"text": text}
_SMALL_TALK = re.compile(
    r"^(hi|hello|hey|good morning|good afternoon|good evening|how are you|how's it going|"
    r"thanks|thank you|goodbye|bye|who are you|what can you do)[!.? ]*$", re.I,
)
_TEAM_QUERY = re.compile(
    r"\b(team\s+lazarus|team\s+members?|member\s+names?|developer|developers|"
    r"who\s+(?:built|made|created|developed)|master\s*mind|behind\s+utopia)\b", re.I,
)
_UTOPIA_TERMS = re.compile(
    r"\b(project|worksite|civic|municipal|chennai|gcc|drain|road|closure|detour|"
    r"pothole|grievance|complaint|issue|department|locality|ward|pin\s*code|pincode|"
    r"budget|contractor|milestone|progress|completion|engineer|CG-[A-Z0-9-]+|"
    r"(?:CGI|Q|BLK)-[A-Z0-9-]+)\b|(?<!\d)\d{6}(?!\d)", re.I,
)


def _small_talk_reply(message: str) -> str | None:
    normalized = re.sub(r"\s+", " ", message.strip())
    if not _SMALL_TALK.fullmatch(normalized):
        return None
    lower = normalized.lower().strip(" !?.")
    if lower in {"hi", "hello", "hey", "good morning", "good afternoon", "good evening"}:
        return "Hello! How can I help? You can ask about Utopia projects and civic issues, or ask a general question."
    if lower in {"how are you", "how's it going"}:
        return "I’m doing well, thanks for asking! What can I help you with?"
    if lower in {"thanks", "thank you"}:
        return "You’re welcome! Is there anything else I can help with?"
    if lower in {"goodbye", "bye"}:
        return "Goodbye! Come back any time you need help."
    return "I’m Utopia’s citizen assistant. I can answer from Utopia’s public project and grievance records, and help with general questions when the AI service is configured."


def _check_rate_limit(ip: str) -> None:
    now = time.monotonic()
    with _rate_lock:
        bucket = _request_times[ip]
        while bucket and now - bucket[0] > 60:
            bucket.popleft()
        if len(bucket) >= 20:
            raise HTTPException(429, "Please wait a moment before asking another question.")
        bucket.append(now)


@router.post("/chat", response_model=AIChatOut)
async def chat(payload: AIChatIn, request: Request, db: Session = Depends(get_db)):
    _check_rate_limit(request.client.host if request.client else "unknown")
    message = payload.message.strip()
    if not message:
        raise HTTPException(422, "Please enter a question.")
    context = [{"role": item.role, "content": item.content} for item in payload.context]
    small_talk = _small_talk_reply(message)
    if small_talk:
        return {
            "conversation_id": payload.conversation_id or str(uuid4()),
            "answer": small_talk,
            "sources": [],
            "suggested_questions": ["What projects are happening in 600005?", "How do I report an issue?", "Can you answer general questions?"],
        }
    if _TEAM_QUERY.search(message):
        answer = "Utopia was developed by Team Lazarus, a group of students from IIITDM Kancheepuram. Individual team member names are classified information and aren’t shared here."
        return {
            "conversation_id": payload.conversation_id or str(uuid4()),
            "answer": answer,
            "sources": [],
            "suggested_questions": ["What can Utopia do?", "What projects are happening in 600005?"],
        }
    # A shared browser location must not turn an unrelated question (for example,
    # today's weather) into a nearby-project or grievance search.
    if not _UTOPIA_TERMS.search(message):
        answer = await generate_general_answer(message, context)
        if answer is None:
            answer = "I can answer greetings here. To answer general knowledge questions, add an AI_API_KEY to the backend’s private .env file and restart the API. Utopia project and grievance questions can still be answered from its database records."
        return {
            "conversation_id": payload.conversation_id or str(uuid4()),
            "answer": answer,
            "sources": [],
            "suggested_questions": ["What projects are happening in 600005?", "How do I report an issue?"],
        }
    location = payload.location.model_dump() if payload.location else None
    records, explicit_location = retrieve_public_records(db, message, context, location)
    fallback = deterministic_answer(message, records, explicit_location)
    # Do not ask an LLM to answer questions for which retrieval found no supporting records.
    if records:
        model_records = [dict(record) for record in records]
        asks_for_contacts = bool(re.search(r"\b(contact|engineer|contractor|phone|email)\b", message, re.I))
        if not asks_for_contacts:
            for record in model_records:
                record.pop("public_engineer_contact", None)
                record.pop("public_contractor_contact", None)
        answer = await generate_grounded_answer(message, context, model_records, fallback)
    else:
        answer = fallback
    sources = []
    for record in records:
        if record["type"] == "project":
            sources.append({"type": "project", "id": record["id"], "code": record["code"], "title": record["title"]})
        elif record["type"] == "issue":
            sources.append({"type": "issue", "id": record["id"], "code": record["ref"], "title": record["kind"]})
        elif record["type"] == "department":
            sources.append({"type": "department", "id": record["id"], "title": record["title"]})
        elif record["type"] == "locality":
            sources.append({"type": "locality", "id": record["id"], "code": record["pincode"], "title": record["title"]})
        else:
            sources.append({"type": "statistics", "id": record["id"], "title": record["title"]})
    return {
        "conversation_id": payload.conversation_id or str(uuid4()),
        "answer": answer,
        "sources": sources,
        "suggested_questions": (["What is the recorded completion date?", "Are any disruptions listed?"] if records else ["What projects are happening in 600005?", "How do I report an issue?", "Ask a general question"]),
    }
