from pathlib import Path
import os
import shutil
import subprocess

import pytest

ROOT = Path(__file__).resolve().parents[1]


def test_compose_declares_services_health_dependencies_and_persistent_db():
    compose = (ROOT / "compose.yml").read_text()
    assert all(f"  {name}:" in compose for name in ("db", "api", "web"))
    assert "condition: service_healthy" in compose
    assert "pgdata:/var/lib/postgresql/data" in compose
    assert "${JWT_SECRET:?" in compose
    assert "${POSTGRES_PASSWORD:?" in compose
    assert "${API_PORT:-8001}:8001" in compose
    assert "WEB_PORT:-5174" in compose
    assert "WEB_CONTAINER_PORT:-80" in compose


def test_nginx_serves_spa_and_proxies_api_docs():
    nginx = (ROOT / "frontend/nginx.conf").read_text()
    assert "location /api/" in nginx
    assert "proxy_pass http://api:8001/api/" in nginx
    assert "location /docs" in nginx
    assert "location /openapi.json" in nginx
    assert "try_files $uri $uri/ /index.html" in nginx


def test_dockerfiles_install_backend_with_uv_and_frontend_with_locked_npm():
    backend = (ROOT / "backend/Dockerfile").read_text()
    frontend = (ROOT / "frontend/Dockerfile").read_text()
    assert "astral-sh/uv" in backend
    assert "uv pip sync" in backend
    assert "pip install" not in backend
    assert "npm ci" in frontend
    assert "nginx" in frontend.lower()


@pytest.mark.skipif(shutil.which("docker") is None, reason="Docker CLI not installed")
def test_compose_yaml_parses():
    env = {**os.environ, "POSTGRES_PASSWORD": "test-password-url-safe", "JWT_SECRET": "test-jwt-secret"}
    result = subprocess.run(
        ["docker", "compose", "-f", str(ROOT / "compose.yml"), "config", "-q"],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
