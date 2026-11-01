from datetime import datetime, timedelta
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.media import MediaAttachment
from ..models.issue import CommentEvidence
from ..services.media_storage import DEFAULT_UPLOAD_DIR, make_upload_token, persist_upload, safe_stored_path, token_digest

router = APIRouter(prefix="/api/media", tags=["Citizen Evidence Media"])
_upload_lock = Lock()
_upload_times: dict[str, deque[float]] = defaultdict(deque)


def _check_upload_rate(ip: str) -> None:
    now = time.monotonic()
    with _upload_lock:
        bucket = _upload_times[ip]
        while bucket and now - bucket[0] > 60:
            bucket.popleft()
        if len(bucket) >= 10:
            raise HTTPException(429, "Too many evidence uploads. Please wait a minute and try again.")
        bucket.append(now)


def serialize_media(item: MediaAttachment) -> dict:
    return {
        "media_id": item.id,
        "media_type": item.media_type,
        "mime_type": item.mime_type,
        "filename": item.original_filename,
        "size": item.file_size,
        "url": f"/api/media/{item.id}",
        "created_at": item.created_at.isoformat(),
    }


@router.post("/upload")
async def upload_media(
    request: Request,
    file: UploadFile = File(...),
    media_type: str = Form(...),
    s: Session = Depends(get_db),
):
    """Stage one evidence file. Its capability token can only attach it to one new issue."""
    _check_upload_rate(request.client.host if request.client else "unknown")
    stored = await persist_upload(file, media_type)
    token = make_upload_token()
    item = MediaAttachment(
        uuid=stored["uuid"], issue_id=None, upload_token_hash=token_digest(token),
        original_filename=stored["original_filename"], stored_filename=stored["stored_filename"],
        storage_path=stored["storage_path"], media_type=stored["media_type"],
        mime_type=stored["mime_type"], file_size=stored["file_size"],
    )
    try:
        s.add(item)
        s.commit()
        s.refresh(item)
    except Exception:
        s.rollback()
        from pathlib import Path
        Path(stored["storage_path"]).unlink(missing_ok=True)
        raise HTTPException(500, "Could not save the evidence record. Please retry.")
    return {**serialize_media(item), "upload_token": token}


@router.get("/{media_id}")
def get_media(media_id: int, s: Session = Depends(get_db)):
    item = s.get(MediaAttachment, media_id)
    if not item or (item.issue_id is None and not s.query(CommentEvidence).filter_by(media_id=media_id).first()):
        raise HTTPException(404, "Evidence not found")
    try:
        path = safe_stored_path(item.storage_path)
    except FileNotFoundError as exc:
        raise HTTPException(404, "Evidence file is unavailable") from exc
    return FileResponse(path, media_type=item.mime_type, filename=item.original_filename, content_disposition_type="inline", headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=3600"})


def cleanup_staged_media(s: Session, older_than_hours: int = 24) -> int:
    """Remove expired unassociated files and metadata so canceled uploads do not accumulate."""
    from pathlib import Path
    cutoff = datetime.utcnow() - timedelta(hours=older_than_hours)
    root = DEFAULT_UPLOAD_DIR.resolve()
    if root.exists():
        for path in root.rglob(".upload-*"):
            try:
                if datetime.utcfromtimestamp(path.stat().st_mtime) < cutoff:
                    path.unlink(missing_ok=True)
            except OSError:
                continue
    attached_comment_media = s.query(CommentEvidence.media_id).subquery()
    stale = s.query(MediaAttachment).filter(MediaAttachment.issue_id.is_(None), MediaAttachment.created_at < cutoff, ~MediaAttachment.id.in_(attached_comment_media)).all()
    for item in stale:
        try:
            safe_stored_path(item.storage_path).unlink(missing_ok=True)
        except FileNotFoundError:
            pass
        s.delete(item)
    if stale:
        s.commit()
    return len(stale)
