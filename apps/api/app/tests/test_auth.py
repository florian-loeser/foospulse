"""Authentication tests."""
import pytest
import uuid
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_valid_user(client: AsyncClient):
    """Test successful user registration."""
    email = f"auth_test_{uuid.uuid4().hex[:8]}@example.com"
    response = await client.post("/api/auth/register", json={
        "email": email,
        "password": "ValidPass123",
        "display_name": "Auth Test User"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["error"] is None
    assert "user_id" in data["data"]


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    """Test registration with duplicate email fails."""
    email = f"dup_test_{uuid.uuid4().hex[:8]}@example.com"

    # First registration
    response = await client.post("/api/auth/register", json={
        "email": email,
        "password": "ValidPass123",
        "display_name": "First User"
    })
    assert response.status_code == 200

    # Duplicate registration
    response = await client.post("/api/auth/register", json={
        "email": email,
        "password": "ValidPass123",
        "display_name": "Second User"
    })
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_register_weak_password(client: AsyncClient):
    """Test registration with weak password fails."""
    email = f"weak_pw_{uuid.uuid4().hex[:8]}@example.com"

    # Too short - 422 for Pydantic validation, 400 for business logic validation
    response = await client.post("/api/auth/register", json={
        "email": email,
        "password": "short",
        "display_name": "Test User"
    })
    assert response.status_code in [400, 422]

    # No uppercase
    response = await client.post("/api/auth/register", json={
        "email": email,
        "password": "nouppercase123",
        "display_name": "Test User"
    })
    assert response.status_code in [400, 422]

    # No digit
    response = await client.post("/api/auth/register", json={
        "email": email,
        "password": "NoDigitHere",
        "display_name": "Test User"
    })
    assert response.status_code in [400, 422]


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    """Test successful login returns token."""
    email = f"login_test_{uuid.uuid4().hex[:8]}@example.com"
    password = "ValidPass123"

    # Register first
    await client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "display_name": "Login Test"
    })

    # Login
    response = await client.post("/api/auth/login", json={
        "email": email,
        "password": password
    })
    assert response.status_code == 200
    data = response.json()
    assert data["error"] is None
    assert "token" in data["data"]
    assert "user" in data["data"]


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    """Test login with wrong password fails."""
    email = f"wrong_pw_{uuid.uuid4().hex[:8]}@example.com"

    # Register
    await client.post("/api/auth/register", json={
        "email": email,
        "password": "CorrectPass123",
        "display_name": "Test User"
    })

    # Login with wrong password
    response = await client.post("/api/auth/login", json={
        "email": email,
        "password": "WrongPass123"
    })
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_with_valid_token(client: AsyncClient, auth_headers):
    """Test /me endpoint with valid token."""
    email = f"me_test_{uuid.uuid4().hex[:8]}@example.com"
    password = "ValidPass123"

    # Register and login
    await client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "display_name": "Me Test"
    })
    login_response = await client.post("/api/auth/login", json={
        "email": email,
        "password": password
    })
    token = login_response.json()["data"]["token"]

    # Get user info
    response = await client.get("/api/auth/me", headers=auth_headers(token))
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["user"]["email"] == email


@pytest.mark.asyncio
async def test_me_with_invalid_token(client: AsyncClient, auth_headers):
    """Test /me endpoint with invalid token returns 401."""
    response = await client.get("/api/auth/me", headers=auth_headers("invalid_token"))
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_with_expired_token(client: AsyncClient, auth_headers):
    """Test /me endpoint with malformed JWT returns 401."""
    # Malformed JWT
    response = await client.get("/api/auth/me", headers=auth_headers("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxfQ.invalid"))
    assert response.status_code == 401
