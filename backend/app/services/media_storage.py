import hashlib
import os
import re
import secrets
import tempfile
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile


DEFAULT_UPLOAD_DIR = Path(os.getenv("MEDIA_STORAGE_DIR", "/app/uploads")).expanduser()
MAX_BYTES = {
    "image": int(os.getenv("MEDIA_MAX_IMAGE_BYTES", 10 * 1024 * 1024)),
    "audio": int(os.getenv("MEDIA_MAX_AUDIO_BYTES", 20 * 1024 * 1024)),
    "video": int(os.getenv("MEDIA_MAX_VIDEO_BYTES", 50 * 1024 * 1024)),
}
MIME_EXTENSIONS = {
    "image": {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"},
    "audio": {"audio/webm": ".webm", "audio/ogg": ".ogg", "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/aac": ".aac"},
    "video": {"video/webm": ".webm", "video/mp4": ".mp4", "video/quicktime": ".mov"},
}
MIME_SUFFIXES = {
    "image": {"image/jpeg": {".jpg", ".jpeg"}, "image/png": {".png"}, "image/webp": {".webp"}, "image/gif": {".gif"}},
    "audio": {"audio/webm": {".webm"}, "audio/ogg": {".ogg"}, "audio/wav": {".wav"}, "audio/x-wav": {".wav"}, "audio/mpeg": {".mp3"}, "audio/mp4": {".m4a"}, "audio/aac": {".aac"}},
    "video": {"video/webm": {".webm"}, "video/mp4": {".mp4"}, "video/quicktime": {".mov"}},
}


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _matches_signature(media_type: str, mime_type: str, head: bytes) -> bool:
    if media_type == "image":
        return ((mime_type == "image/jpeg" and head.startswith(b"\xff\xd8\xff")) or
                (mime_type == "image/png" and head.startswith(b"\x89PNG\r\n\x1a\n")) or
                (mime_type == "image/gif" and head[:6] in (b"GIF87a", b"GIF89a")) or
                (mime_type == "image/webp" and head.startswith(b"RIFF") and head[8:12] == b"WEBP"))
    if media_type == "audio":
        return ((mime_type in {"audio/wav", "audio/x-wav"} and head.startswith(b"RIFF") and head[8:12] == b"WAVE") or
                (mime_type == "audio/ogg" and head.startswith(b"OggS")) or
                (mime_type == "audio/webm" and head.startswith(b"\x1aE\xdf\xa3")) or
                (mime_type == "audio/mpeg" and (head.startswith(b"ID3") or (len(head) > 1 and head[0] == 0xff and head[1] & 0xe0 == 0xe0))) or
                (mime_type in {"audio/mp4", "audio/aac"} and (b"ftyp" in head[:16] or head.startswith(b"\xff\xf1") or head.startswith(b"\xff\xf9"))))
    if media_type == "video":
        return ((mime_type == "video/webm" and head.startswith(b"\x1aE\xdf\xa3")) or
                (mime_type in {"video/mp4", "video/quicktime"} and b"ftyp" in head[:16]))
    return False


async def persist_upload(upload: UploadFile, media_type: str) -> dict:
    if media_type not in MIME_EXTENSIONS:
        raise HTTPException(400, "Choose image, audio, or video evidence.")
    mime_type = (upload.content_type or "").split(";", 1)[0].strip().lower()
    extension = MIME_EXTENSIONS[media_type].get(mime_type)
    supplied_extension = Path(upload.filename or "").suffix.lower()
    if not extension or supplied_extension not in MIME_SUFFIXES[media_type].get(mime_type, set()):
        raise HTTPException(415, "This media type is not supported.")

    original = Path(upload.filename or "evidence").name
    original = re.sub(r"[^A-Za-z0-9._ -]", "_", original)[:255] or "evidence"
    max_size = MAX_BYTES[media_type]
    temp_path = None
    size = 0
    head = b""
    target_dir = DEFAULT_UPLOAD_DIR / "issues" / f"{media_type}s"
    target_dir.mkdir(parents=True, exist_ok=True, mode=0o750)
    try:
        with tempfile.NamedTemporaryFile(prefix=".upload-", dir=target_dir, delete=False) as tmp:
            temp_path = Path(tmp.name)
            while True:
                chunk = await upload.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > max_size:
                    raise HTTPException(413, f"{media_type.title()} files must be at most {max_size // (1024 * 1024)} MB.")
                if len(head) < 64:
                    head += chunk[:64 - len(head)]
                tmp.write(chunk)
        if size == 0:
            raise HTTPException(400, "The selected file is empty.")
        if not _matches_signature(media_type, mime_type, head):
            raise HTTPException(415, "The file contents do not match the selected media type.")

        file_uuid = str(uuid.uuid4())
        stored = f"{file_uuid}{extension}"
        final_path = target_dir / stored
        os.replace(temp_path, final_path)
        return {
            "uuid": file_uuid,
            "original_filename": original,
            "stored_filename": stored,
            "storage_path": str(final_path.resolve()),
            "media_type": media_type,
            "mime_type": mime_type,
            "file_size": size,
        }
    except Exception:
        if temp_path:
            temp_path.unlink(missing_ok=True)
        raise


def safe_stored_path(path_value: str) -> Path:
    root = DEFAULT_UPLOAD_DIR.resolve()
    path = Path(path_value).resolve()
    if root not in path.parents or not path.is_file():
        raise FileNotFoundError("Media file is unavailable")
    return path


def make_upload_token() -> str:
    return secrets.token_urlsafe(32)
