"""Smoke tests for API."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    """Test health endpoint returns OK."""
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["status"] in ["ok", "degraded"]
    assert "dependencies" in data["data"]


@pytest.mark.asyncio
async def test_register_user(client: AsyncClient):
    """Test user registration."""
    import uuid
    # Use unique email per test run
    unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    response = await client.post("/api/auth/register", json={
        "email": unique_email,
        "password": "TestPass123",  # Meets password policy: 8+ chars, upper, lower, digit
        "display_name": "Test User"
    })
    assert response.status_code == 200
    data = response.json()
    assert data.get("data") is not None
    assert "user_id" in data["data"]


@pytest.mark.asyncio
async def test_login_invalid_credentials(client: AsyncClient):
    """Test login with invalid credentials returns 401."""
    response = await client.post("/api/auth/login", json={
        "email": "nonexistent@example.com",
        "password": "wrongpass"
    })
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_unauthorized(client: AsyncClient):
    """Test /me endpoint without auth returns 401."""
    response = await client.get("/api/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_leagues_unauthorized(client: AsyncClient):
    """Test leagues endpoint without auth returns 401."""
    response = await client.get("/api/leagues")
    assert response.status_code == 401
