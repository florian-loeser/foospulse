"""League management tests."""
import pytest
import uuid
from httpx import AsyncClient


async def create_user_and_login(client: AsyncClient, display_name: str = None) -> tuple[str, str]:
    """Helper to create a user and return (token, user_id)."""
    unique_id = uuid.uuid4().hex[:8]
    email = f"league_test_{unique_id}@example.com"
    password = "ValidPass123"

    await client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "display_name": display_name or f"League Test User {unique_id}"
    })
    login_response = await client.post("/api/auth/login", json={
        "email": email,
        "password": password
    })
    data = login_response.json()["data"]
    return data["token"], data["user"]["id"]


@pytest.mark.asyncio
async def test_create_league(client: AsyncClient, auth_headers):
    """Test creating a new league."""
    token, _ = await create_user_and_login(client)
    slug = f"test-league-{uuid.uuid4().hex[:8]}"

    response = await client.post("/api/leagues", json={
        "name": "Test League",
        "slug": slug,
        "timezone": "Europe/Paris",
        "visibility": "private"
    }, headers=auth_headers(token))

    assert response.status_code == 200
    data = response.json()
    assert data["error"] is None
    assert data["data"]["league"]["slug"] == slug
    assert data["data"]["league"]["active_season"] is not None


@pytest.mark.asyncio
async def test_create_league_duplicate_slug(client: AsyncClient, auth_headers):
    """Test creating league with duplicate slug fails."""
    token, _ = await create_user_and_login(client)
    slug = f"dup-league-{uuid.uuid4().hex[:8]}"

    # First league
    await client.post("/api/leagues", json={
        "name": "First League",
        "slug": slug,
        "timezone": "UTC",
        "visibility": "private"
    }, headers=auth_headers(token))

    # Duplicate slug
    response = await client.post("/api/leagues", json={
        "name": "Second League",
        "slug": slug,
        "timezone": "UTC",
        "visibility": "private"
    }, headers=auth_headers(token))

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_list_leagues(client: AsyncClient, auth_headers):
    """Test listing user's leagues."""
    token, _ = await create_user_and_login(client)
    slug = f"list-league-{uuid.uuid4().hex[:8]}"

    # Create a league
    await client.post("/api/leagues", json={
        "name": "List Test League",
        "slug": slug,
        "timezone": "UTC",
        "visibility": "private"
    }, headers=auth_headers(token))

    # List leagues
    response = await client.get("/api/leagues", headers=auth_headers(token))
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]["leagues"]) >= 1


@pytest.mark.asyncio
async def test_get_league(client: AsyncClient, auth_headers):
    """Test getting league details."""
    token, _ = await create_user_and_login(client)
    slug = f"get-league-{uuid.uuid4().hex[:8]}"

    # Create league
    await client.post("/api/leagues", json={
        "name": "Get Test League",
        "slug": slug,
        "timezone": "America/New_York",
        "visibility": "private"
    }, headers=auth_headers(token))

    # Get league
    response = await client.get(f"/api/leagues/{slug}", headers=auth_headers(token))
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["league"]["slug"] == slug
    assert data["data"]["league"]["timezone"] == "America/New_York"


@pytest.mark.asyncio
async def test_get_nonexistent_league(client: AsyncClient, auth_headers):
    """Test getting nonexistent league returns 404."""
    token, _ = await create_user_and_login(client)

    response = await client.get("/api/leagues/nonexistent-league-12345", headers=auth_headers(token))
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_league_settings(client: AsyncClient, auth_headers):
    """Test league settings get and update."""
    token, _ = await create_user_and_login(client)
    slug = f"settings-league-{uuid.uuid4().hex[:8]}"

    # Create league
    await client.post("/api/leagues", json={
        "name": "Settings Test League",
        "slug": slug,
        "timezone": "UTC",
        "visibility": "private"
    }, headers=auth_headers(token))

    # Get settings
    response = await client.get(f"/api/leagues/{slug}/settings", headers=auth_headers(token))
    assert response.status_code == 200
    settings = response.json()["data"]["settings"]
    assert "show_gamelles_board" in settings

    # Update settings
    response = await client.patch(f"/api/leagues/{slug}/settings", json={
        "show_gamelles_board": False
    }, headers=auth_headers(token))
    assert response.status_code == 200
    assert response.json()["data"]["settings"]["show_gamelles_board"] is False


@pytest.mark.asyncio
async def test_invite_code(client: AsyncClient, auth_headers):
    """Test getting and regenerating invite code."""
    token, _ = await create_user_and_login(client)
    slug = f"invite-league-{uuid.uuid4().hex[:8]}"

    # Create league
    await client.post("/api/leagues", json={
        "name": "Invite Test League",
        "slug": slug,
        "timezone": "UTC",
        "visibility": "private"
    }, headers=auth_headers(token))

    # Get invite code
    response = await client.get(f"/api/leagues/{slug}/invite", headers=auth_headers(token))
    assert response.status_code == 200
    invite_code = response.json()["data"]["invite_code"]
    assert invite_code is not None

    # Regenerate invite code
    response = await client.post(f"/api/leagues/{slug}/invite/regenerate", headers=auth_headers(token))
    assert response.status_code == 200
    new_invite_code = response.json()["data"]["invite_code"]
    assert new_invite_code != invite_code


@pytest.mark.asyncio
async def test_join_league_with_invite(client: AsyncClient, auth_headers):
    """Test joining a league with invite code."""
    # Create owner and league
    owner_token, _ = await create_user_and_login(client)
    slug = f"join-league-{uuid.uuid4().hex[:8]}"

    await client.post("/api/leagues", json={
        "name": "Join Test League",
        "slug": slug,
        "timezone": "UTC",
        "visibility": "private"
    }, headers=auth_headers(owner_token))

    # Get invite code
    invite_response = await client.get(f"/api/leagues/{slug}/invite", headers=auth_headers(owner_token))
    invite_code = invite_response.json()["data"]["invite_code"]

    # Create new user
    joiner_token, _ = await create_user_and_login(client)

    # Preview league by invite
    response = await client.get(f"/api/leagues/join/{invite_code}", headers=auth_headers(joiner_token))
    assert response.status_code == 200
    assert response.json()["data"]["already_member"] is False

    # Join league
    response = await client.post(f"/api/leagues/join/{invite_code}", headers=auth_headers(joiner_token))
    assert response.status_code == 200
    assert response.json()["data"]["joined"] is True

    # Verify membership
    response = await client.get(f"/api/leagues/{slug}", headers=auth_headers(joiner_token))
    assert response.status_code == 200
