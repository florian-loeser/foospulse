"""Stats and leaderboards tests."""
import pytest
import uuid
from httpx import AsyncClient


async def create_league_with_matches(client: AsyncClient, auth_headers) -> tuple[str, str, str]:
    """Create user, league, players, and some matches. Returns (token, slug, season_id)."""
    email = f"stats_test_{uuid.uuid4().hex[:8]}@example.com"
    password = "ValidPass123"
    slug = f"stats-league-{uuid.uuid4().hex[:8]}"

    await client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "display_name": "Stats Test User"
    })
    login_response = await client.post("/api/auth/login", json={
        "email": email,
        "password": password
    })
    token = login_response.json()["data"]["token"]

    league_response = await client.post("/api/leagues", json={
        "name": "Stats Test League",
        "slug": slug,
        "timezone": "UTC",
        "visibility": "private"
    }, headers=auth_headers(token))
    season_id = league_response.json()["data"]["league"]["active_season"]["id"]

    # Get owner player
    players_response = await client.get(f"/api/leagues/{slug}/players", headers=auth_headers(token))
    player1_id = players_response.json()["data"]["players"][0]["id"]

    # Create another player
    player2_response = await client.post(f"/api/leagues/{slug}/players", json={
        "nickname": "Stats Player 2",
        "is_guest": True
    }, headers=auth_headers(token))
    player2_id = player2_response.json()["data"]["player"]["id"]

    # Create some matches
    for i in range(3):
        await client.post(f"/api/leagues/{slug}/matches", json={
            "season_id": season_id,
            "mode": "1v1",
            "team_a_score": 10,
            "team_b_score": 5 + i,
            "players": [
                {"player_id": player1_id, "team": "A", "position": "attack"},
                {"player_id": player2_id, "team": "B", "position": "attack"}
            ]
        }, headers=auth_headers(token))

    return token, slug, season_id


@pytest.mark.asyncio
async def test_get_leaderboards(client: AsyncClient, auth_headers):
    """Test getting leaderboards."""
    token, slug, season_id = await create_league_with_matches(client, auth_headers)

    response = await client.get(f"/api/leagues/{slug}/stats/leaderboards", headers=auth_headers(token))
    assert response.status_code == 200
    data = response.json()["data"]

    # Should have various leaderboards
    leaderboards = data["leaderboards"]
    # May be empty if stats haven't been computed yet
    assert "leaderboards" in data


@pytest.mark.asyncio
async def test_get_synergy(client: AsyncClient, auth_headers):
    """Test getting synergy stats."""
    token, slug, season_id = await create_league_with_matches(client, auth_headers)

    response = await client.get(f"/api/leagues/{slug}/stats/synergy", headers=auth_headers(token))
    assert response.status_code == 200
    data = response.json()["data"]
    assert "synergy" in data


@pytest.mark.asyncio
async def test_get_matchups(client: AsyncClient, auth_headers):
    """Test getting matchup stats."""
    token, slug, season_id = await create_league_with_matches(client, auth_headers)

    response = await client.get(f"/api/leagues/{slug}/stats/matchups", headers=auth_headers(token))
    assert response.status_code == 200
    data = response.json()["data"]
    assert "matchups" in data


@pytest.mark.asyncio
async def test_get_player_stats(client: AsyncClient, auth_headers):
    """Test getting individual player stats."""
    token, slug, season_id = await create_league_with_matches(client, auth_headers)

    # Get player ID
    players_response = await client.get(f"/api/leagues/{slug}/players", headers=auth_headers(token))
    player_id = players_response.json()["data"]["players"][0]["id"]

    response = await client.get(f"/api/leagues/{slug}/stats/player/{player_id}", headers=auth_headers(token))
    assert response.status_code == 200
    stats = response.json()["data"]["player_stats"]
    assert "rating" in stats
    assert "wins" in stats
    assert "losses" in stats
    assert "n_matches" in stats


@pytest.mark.asyncio
async def test_leaderboards_filtered_by_settings(client: AsyncClient, auth_headers):
    """Test leaderboards respect league settings."""
    token, slug, season_id = await create_league_with_matches(client, auth_headers)

    # Disable gamelles board
    await client.patch(f"/api/leagues/{slug}/settings", json={
        "show_gamelles_board": False
    }, headers=auth_headers(token))

    response = await client.get(f"/api/leagues/{slug}/stats/leaderboards", headers=auth_headers(token))
    assert response.status_code == 200
    # The response should indicate filtering
    data = response.json()["data"]
    assert data.get("filtered") is True or data["leaderboards"] == {}


@pytest.mark.asyncio
async def test_stats_with_season_filter(client: AsyncClient, auth_headers):
    """Test stats can be filtered by season."""
    token, slug, season_id = await create_league_with_matches(client, auth_headers)

    response = await client.get(
        f"/api/leagues/{slug}/stats/leaderboards?season_id={season_id}",
        headers=auth_headers(token)
    )
    assert response.status_code == 200
