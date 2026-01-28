"""Player management tests."""
import pytest
import uuid
from httpx import AsyncClient


async def create_user_league(client: AsyncClient, auth_headers) -> tuple[str, str]:
    """Helper to create user, login, and create a league. Returns (token, league_slug)."""
    email = f"player_test_{uuid.uuid4().hex[:8]}@example.com"
    password = "ValidPass123"
    slug = f"player-league-{uuid.uuid4().hex[:8]}"

    await client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "display_name": "Player Test User"
    })
    login_response = await client.post("/api/auth/login", json={
        "email": email,
        "password": password
    })
    token = login_response.json()["data"]["token"]

    await client.post("/api/leagues", json={
        "name": "Player Test League",
        "slug": slug,
        "timezone": "UTC",
        "visibility": "private"
    }, headers=auth_headers(token))

    return token, slug


@pytest.mark.asyncio
async def test_create_guest_player(client: AsyncClient, auth_headers):
    """Test creating a guest player."""
    token, slug = await create_user_league(client, auth_headers)

    response = await client.post(f"/api/leagues/{slug}/players", json={
        "nickname": "Guest Player",
        "is_guest": True
    }, headers=auth_headers(token))

    assert response.status_code == 200
    data = response.json()
    assert data["data"]["player"]["nickname"] == "Guest Player"
    assert data["data"]["player"]["is_guest"] is True


@pytest.mark.asyncio
async def test_create_player_duplicate_nickname(client: AsyncClient, auth_headers):
    """Test creating player with duplicate nickname fails."""
    token, slug = await create_user_league(client, auth_headers)

    # First player
    await client.post(f"/api/leagues/{slug}/players", json={
        "nickname": "Duplicate Name",
        "is_guest": True
    }, headers=auth_headers(token))

    # Duplicate
    response = await client.post(f"/api/leagues/{slug}/players", json={
        "nickname": "Duplicate Name",
        "is_guest": True
    }, headers=auth_headers(token))

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_list_players(client: AsyncClient, auth_headers):
    """Test listing players in a league."""
    token, slug = await create_user_league(client, auth_headers)

    # Create some players
    await client.post(f"/api/leagues/{slug}/players", json={
        "nickname": "Player One",
        "is_guest": True
    }, headers=auth_headers(token))
    await client.post(f"/api/leagues/{slug}/players", json={
        "nickname": "Player Two",
        "is_guest": True
    }, headers=auth_headers(token))

    # List players (owner + 2 guests = at least 3)
    response = await client.get(f"/api/leagues/{slug}/players", headers=auth_headers(token))
    assert response.status_code == 200
    players = response.json()["data"]["players"]
    assert len(players) >= 3


@pytest.mark.asyncio
async def test_get_player(client: AsyncClient, auth_headers):
    """Test getting a specific player."""
    token, slug = await create_user_league(client, auth_headers)

    # Create player
    create_response = await client.post(f"/api/leagues/{slug}/players", json={
        "nickname": "Specific Player",
        "is_guest": True
    }, headers=auth_headers(token))
    player_id = create_response.json()["data"]["player"]["id"]

    # Get player
    response = await client.get(f"/api/leagues/{slug}/players/{player_id}", headers=auth_headers(token))
    assert response.status_code == 200
    assert response.json()["data"]["player"]["nickname"] == "Specific Player"


@pytest.mark.asyncio
async def test_get_nonexistent_player(client: AsyncClient, auth_headers):
    """Test getting nonexistent player returns 404."""
    token, slug = await create_user_league(client, auth_headers)
    fake_id = str(uuid.uuid4())

    response = await client.get(f"/api/leagues/{slug}/players/{fake_id}", headers=auth_headers(token))
    assert response.status_code == 404
