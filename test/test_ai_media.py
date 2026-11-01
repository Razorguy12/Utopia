import pytest


def test_ai_answers_from_database_and_returns_sources(client, make_project, monkeypatch):
    monkeypatch.delenv("AI_API_KEY", raising=False)
    project = make_project(code="CG-TN-001", title="T Nagar Stormwater Drain Work", pincode="600017", progress=42)
    response = client.post("/api/ai/chat", json={"message": "What projects are happening in 600017?"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["conversation_id"]
    assert "T Nagar Stormwater Drain Work" in payload["answer"]
    assert "42%" in payload["answer"]
    assert payload["sources"][0]["code"] == project.code


def test_ai_unknown_pin_and_unrelated_question_do_not_invent_records(client, monkeypatch):
    monkeypatch.delenv("AI_API_KEY", raising=False)
    for question in ("What projects are there in 999999?", "Who won a football match yesterday?"):
        response = client.post("/api/ai/chat", json={"message": question})
        assert response.status_code == 200
        payload = response.json()
        assert payload["sources"] == []
        assert "couldn't find" in payload["answer"].lower()


def test_ai_grievance_lookup_returns_status_without_contact_data(client, db_session):
    from app.models.issue import Issue

    issue = Issue(ref="CGI-TN-0099", kind="Open trench", message="Private description", locality="T. Nagar",
                  pincode="600017", status="Under Review", phone="9876543210", email="citizen@example.com")
    db_session.add(issue)
    db_session.commit()
    payload = client.post("/api/ai/chat", json={"message": "Check grievance CGI-TN-0099 status"}).json()
    assert "Under Review" in payload["answer"]
    assert payload["sources"][0]["code"] == issue.ref
    assert "9876543210" not in str(payload)
    assert "citizen@example.com" not in str(payload)


def test_media_upload_association_and_public_retrieval(client, db_session, monkeypatch, tmp_path):
    from app.services import media_storage

    monkeypatch.setattr(media_storage, "DEFAULT_UPLOAD_DIR", tmp_path)
    image = b"\x89PNG\r\n\x1a\n" + b"IHDR" + b"\x00" * 32
    staged = client.post("/api/media/upload", data={"media_type": "image"}, files={
        "file": ("evidence.png", image, "image/png"),
    })
    assert staged.status_code == 200
    staged_data = staged.json()
    staged_audio = client.post("/api/media/upload", data={"media_type": "audio"}, files={
        "file": ("voice.ogg", b"OggS" + b"\x00" * 24, "audio/ogg"),
    }).json()
    assert client.get(staged_data["url"]).status_code == 404

    created = client.post("/api/issues", json={
        "kind": "Open trench", "message": "An open trench is present near the school gate.",
        "locality": "T. Nagar", "pincode": "600017",
        "attachments": [
            {"media_id": staged_data["media_id"], "upload_token": staged_data["upload_token"]},
            {"media_id": staged_audio["media_id"], "upload_token": staged_audio["upload_token"]},
        ],
    })
    assert created.status_code == 200
    assert {item["media_type"] for item in created.json()["attachments"]} == {"image", "audio"}
    fetched = client.get(staged_data["url"])
    assert fetched.status_code == 200
    assert fetched.content == image
    issue_feed = client.get("/api/issues?pincode=600017").json()
    assert {item["media_id"] for item in issue_feed[0]["attachments"]} == {staged_data["media_id"], staged_audio["media_id"]}


def test_media_rejects_bad_signature_and_invalid_association(client, monkeypatch, tmp_path):
    from app.services import media_storage

    monkeypatch.setattr(media_storage, "DEFAULT_UPLOAD_DIR", tmp_path)
    invalid = client.post("/api/media/upload", data={"media_type": "image"}, files={
        "file": ("fake.png", b"not a png", "image/png"),
    })
    assert invalid.status_code == 415
    response = client.post("/api/issues", json={
        "kind": "Open trench", "message": "An open trench is present near the school gate.",
        "locality": "T. Nagar", "attachments": [{"media_id": 9999, "upload_token": "x" * 40}],
    })
    assert response.status_code == 400


@pytest.mark.parametrize("media_type, filename, mime_type, body", [
    ("audio", "voice.ogg", "audio/ogg", b"OggS" + b"\x00" * 24),
    ("video", "clip.mp4", "video/mp4", b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 24),
])
def test_audio_and_video_uploads_are_validated(client, monkeypatch, tmp_path, media_type, filename, mime_type, body):
    from app.services import media_storage

    monkeypatch.setattr(media_storage, "DEFAULT_UPLOAD_DIR", tmp_path)
    response = client.post("/api/media/upload", data={"media_type": media_type}, files={
        "file": (filename, body, mime_type),
    })
    assert response.status_code == 200
    assert response.json()["media_type"] == media_type


def test_media_size_cap_and_single_use_upload_token(client, monkeypatch, tmp_path):
    from app.services import media_storage

    monkeypatch.setattr(media_storage, "DEFAULT_UPLOAD_DIR", tmp_path)
    monkeypatch.setitem(media_storage.MAX_BYTES, "image", 8)
    oversized = client.post("/api/media/upload", data={"media_type": "image"}, files={
        "file": ("large.png", b"\x89PNG\r\n\x1a\n" + b"x" * 10, "image/png"),
    })
    assert oversized.status_code == 413

    monkeypatch.setitem(media_storage.MAX_BYTES, "image", 10 * 1024 * 1024)
    valid = b"\x89PNG\r\n\x1a\nIHDR" + b"\x00" * 32
    staged = client.post("/api/media/upload", data={"media_type": "image"}, files={
        "file": ("evidence.png", valid, "image/png"),
    }).json()
    payload = {
        "kind": "Open trench", "message": "An open trench is present beside the public school gate.",
        "locality": "T. Nagar", "attachments": [{"media_id": staged["media_id"], "upload_token": "z" * 40}],
    }
    assert client.post("/api/issues", json=payload).status_code == 403
    payload["attachments"][0]["upload_token"] = staged["upload_token"]
    assert client.post("/api/issues", json=payload).status_code == 200
    assert client.post("/api/issues", json=payload).status_code == 400


def test_ai_lists_departments_from_public_project_records(client, make_project, monkeypatch):
    monkeypatch.delenv("AI_API_KEY", raising=False)
    make_project(department="Stormwater Drainage")
    response = client.post("/api/ai/chat", json={"message": "Which departments are in Utopia?"})
    assert response.status_code == 200
    assert "Stormwater Drainage" in response.json()["answer"]
    assert response.json()["sources"][0]["type"] == "department"


def test_ai_lists_database_localities_and_unknown_nearby_location(client, make_project, monkeypatch):
    monkeypatch.delenv("AI_API_KEY", raising=False)
    make_project(locality="Triplicane", pincode="600005")
    localities = client.post("/api/ai/chat", json={"message": "Which localities have public works?"}).json()
    assert localities["sources"][0]["type"] == "locality"
    assert "Triplicane" in localities["answer"] and "600005" in localities["answer"]
    unknown = client.post("/api/ai/chat", json={"message": "What projects are near Salem?"}).json()
    assert unknown["sources"] == []
    assert "locality name" in unknown["answer"]


def test_llm_grounding_guard_rejects_unsupported_numbers_and_terms():
    from app.services.ai_provider import _grounded

    evidence = [{"code": "CG-TN-1", "title": "T Nagar Drainage Work", "status": "In progress", "progress": 42}]
    assert _grounded("T Nagar Drainage Work is 42% complete.", evidence)
    assert not _grounded("T Nagar Drainage Work is 100% complete.", evidence)
    assert not _grounded("The bridge will open tomorrow.", evidence)

