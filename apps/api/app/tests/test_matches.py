"""Match logging and management tests."""
import pytest
import uuid
from httpx import AsyncClient


async def create_league_with_players(client: AsyncClient, auth_headers) -> tuple[str, str, list[str], str]:
    """Create user, league, and players. Returns (token, slug, player_ids, season_id)."""
    email = f"match_test_{uuid.uuid4().hex[:8]}@example.com"
    password = "ValidPass123"
    slug = f"match-league-{uuid.uuid4().hex[:8]}"

    await client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "display_name": "Match Test User"
    })
    login_response = await client.post("/api/auth/login", json={
        "email": email,
        "password": password
    })
    token = login_response.json()["data"]["token"]

    league_response = await client.post("/api/leagues", json={
        "name": "Match Test League",
        "slug": slug,
        "timezone": "UTC",
        "visibility": "private"
    }, headers=auth_headers(token))
    season_id = league_response.json()["data"]["league"]["active_season"]["id"]

    # Get owner's player
    players_response = await client.get(f"/api/leagues/{slug}/players", headers=auth_headers(token))
    owner_player_id = players_response.json()["data"]["players"][0]["id"]

    # Create 3 more players for matches
    player_ids = [owner_player_id]
    for i in range(3):
        response = await client.post(f"/api/leagues/{slug}/players", json={
            "nickname": f"Player {i+2}",
            "is_guest": True
        }, headers=auth_headers(token))
        player_ids.append(response.json()["data"]["player"]["id"])

    return token, slug, player_ids, season_id


@pytest.mark.asyncio
async def test_create_1v1_match(client: AsyncClient, auth_headers):
    """Test creating a 1v1 match."""
    token, slug, player_ids, season_id = await create_league_with_players(client, auth_headers)

    response = await client.post(f"/api/leagues/{slug}/matches", json={
        "season_id": season_id,
        "mode": "1v1",
        "team_a_score": 10,
        "team_b_score": 5,
        "players": [
            {"player_id": player_ids[0], "team": "A", "position": "attack"},
            {"player_id": player_ids[1], "team": "B", "position": "attack"}
        ]
    }, headers=auth_headers(token))

    assert response.status_code == 200
    data = response.json()
    assert data["error"] is None
    assert "match_id" in data["data"]


@pytest.mark.asyncio
async def test_create_2v2_match(client: AsyncClient, auth_headers):
    """Test creating a 2v2 match."""
    token, slug, player_ids, season_id = await create_league_with_players(client, auth_headers)

    response = await client.post(f"/api/leagues/{slug}/matches", json={
        "season_id": season_id,
        "mode": "2v2",
        "team_a_score": 10,
        "team_b_score": 8,
        "players": [
            {"player_id": player_ids[0], "team": "A", "position": "attack"},
            {"player_id": player_ids[1], "team": "A", "position": "defense"},
            {"player_id": player_ids[2], "team": "B", "position": "attack"},
            {"player_id": player_ids[3], "team": "B", "position": "defense"}
        ]
    }, headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["data"]["match_id"] is not None


@pytest.mark.asyncio
async def test_create_match_with_gamelle(client: AsyncClient, auth_headers):
    """Test creating a match with gamelle event."""
    token, slug, player_ids, season_id = await create_league_with_players(client, auth_headers)

    response = await client.post(f"/api/leagues/{slug}/matches", json={
        "season_id": season_id,
        "mode": "1v1",
        "team_a_score": 10,
        "team_b_score": 3,
        "players": [
            {"player_id": player_ids[0], "team": "A", "position": "attack"},
            {"player_id": player_ids[1], "team": "B", "position": "attack"}
        ],
        "gamelles": [
            {
                "against_player_id": player_ids[1],
                "by_player_id": player_ids[0],
                "count": 2
            }
        ]
    }, headers=auth_headers(token))

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_create_match_with_multiple_gamelles(client: AsyncClient, auth_headers):
    """Test creating a match with multiple gamelle events."""
    token, slug, player_ids, season_id = await create_league_with_players(client, auth_headers)

    response = await client.post(f"/api/leagues/{slug}/matches", json={
        "season_id": season_id,
        "mode": "1v1",
        "team_a_score": 10,
        "team_b_score": 2,
        "players": [
            {"player_id": player_ids[0], "team": "A", "position": "attack"},
            {"player_id": player_ids[1], "team": "B", "position": "attack"}
        ],
        "gamelles": [
            {
                "against_player_id": player_ids[1],
                "by_player_id": player_ids[0],
                "count": 3
            }
        ]
    }, headers=auth_headers(token))

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_list_matches(client: AsyncClient, auth_headers):
    """Test listing matches."""
    token, slug, player_ids, season_id = await create_league_with_players(client, auth_headers)

    # Create a match
    await client.post(f"/api/leagues/{slug}/matches", json={
        "season_id": season_id,
        "mode": "1v1",
        "team_a_score": 10,
        "team_b_score": 5,
        "players": [
            {"player_id": player_ids[0], "team": "A", "position": "attack"},
            {"player_id": player_ids[1], "team": "B", "position": "attack"}
        ]
    }, headers=auth_headers(token))

    # List matches
    response = await client.get(f"/api/leagues/{slug}/matches", headers=auth_headers(token))
    assert response.status_code == 200
    assert len(response.json()["data"]["matches"]) >= 1


@pytest.mark.asyncio
async def test_get_match(client: AsyncClient, auth_headers):
    """Test getting match details."""
    token, slug, player_ids, season_id = await create_league_with_players(client, auth_headers)

    # Create match
    create_response = await client.post(f"/api/leagues/{slug}/matches", json={
        "season_id": season_id,
        "mode": "1v1",
        "team_a_score": 10,
        "team_b_score": 7,
        "players": [
            {"player_id": player_ids[0], "team": "A", "position": "attack"},
            {"player_id": player_ids[1], "team": "B", "position": "attack"}
        ]
    }, headers=auth_headers(token))
    match_id = create_response.json()["data"]["match_id"]

    # Get match
    response = await client.get(f"/api/leagues/{slug}/matches/{match_id}", headers=auth_headers(token))
    assert response.status_code == 200
    match = response.json()["data"]["match"]
    assert match["team_a_score"] == 10
    assert match["team_b_score"] == 7


@pytest.mark.asyncio
async def test_void_match(client: AsyncClient, auth_headers):
    """Test voiding a match."""
    token, slug, player_ids, season_id = await create_league_with_players(client, auth_headers)

    # Create match
    create_response = await client.post(f"/api/leagues/{slug}/matches", json={
        "season_id": season_id,
        "mode": "1v1",
        "team_a_score": 10,
        "team_b_score": 5,
        "players": [
            {"player_id": player_ids[0], "team": "A", "position": "attack"},
            {"player_id": player_ids[1], "team": "B", "position": "attack"}
        ]
    }, headers=auth_headers(token))
    match_id = create_response.json()["data"]["match_id"]

    # Void match
    response = await client.post(f"/api/leagues/{slug}/matches/{match_id}/void", json={
        "reason": "Entered wrong score"
    }, headers=auth_headers(token))
    assert response.status_code == 200
    assert response.json()["data"]["status"] == "void"


@pytest.mark.asyncio
async def test_invalid_match_scores(client: AsyncClient, auth_headers):
    """Test creating match with invalid scores fails."""
    token, slug, player_ids, season_id = await create_league_with_players(client, auth_headers)

    # Score out of range (> 10) - Pydantic validation should reject this
    response = await client.post(f"/api/leagues/{slug}/matches", json={
        "season_id": season_id,
        "mode": "1v1",
        "team_a_score": 15,
        "team_b_score": 5,
        "players": [
            {"player_id": player_ids[0], "team": "A", "position": "attack"},
            {"player_id": player_ids[1], "team": "B", "position": "attack"}
        ]
    }, headers=auth_headers(token))
    assert response.status_code == 422  # Pydantic validation error

    # Negative score
    response = await client.post(f"/api/leagues/{slug}/matches", json={
        "season_id": season_id,
        "mode": "1v1",
        "team_a_score": -1,
        "team_b_score": 5,
        "players": [
            {"player_id": player_ids[0], "team": "A", "position": "attack"},
            {"player_id": player_ids[1], "team": "B", "position": "attack"}
        ]
    }, headers=auth_headers(token))
    assert response.status_code == 422  # Pydantic validation error


@pytest.mark.asyncio
async def test_duplicate_player_in_match(client: AsyncClient, auth_headers):
    """Test same player on both teams fails."""
    token, slug, player_ids, season_id = await create_league_with_players(client, auth_headers)

    response = await client.post(f"/api/leagues/{slug}/matches", json={
        "season_id": season_id,
        "mode": "1v1",
        "team_a_score": 10,
        "team_b_score": 5,
        "players": [
            {"player_id": player_ids[0], "team": "A", "position": "attack"},
            {"player_id": player_ids[0], "team": "B", "position": "attack"}
        ]
    }, headers=auth_headers(token))
    assert response.status_code == 400
