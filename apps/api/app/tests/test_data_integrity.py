"""Data integrity and reliability tests."""
import pytest
import uuid
import asyncio
from httpx import AsyncClient


async def create_authenticated_user(client: AsyncClient) -> tuple[str, str]:
    """Create and login a user. Returns (token, user_id)."""
    email = f"integrity_{uuid.uuid4().hex[:8]}@example.com"
    password = "ValidPass123"

    await client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "display_name": "Integrity Test"
    })
    response = await client.post("/api/auth/login", json={
        "email": email,
        "password": password
    })
    data = response.json()["data"]
    return data["token"], data["user"]["id"]


@pytest.mark.asyncio
async def test_user_data_persists(client: AsyncClient, auth_headers):
    """Test that user data persists across requests."""
    email = f"persist_{uuid.uuid4().hex[:8]}@example.com"
    password = "ValidPass123"
    display_name = "Persist Test User"

    # Register
    await client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "display_name": display_name
    })

    # Login
    login_response = await client.post("/api/auth/login", json={
        "email": email,
        "password": password
    })
    token = login_response.json()["data"]["token"]

    # Verify data persists
    me_response = await client.get("/api/auth/me", headers=auth_headers(token))
    assert me_response.json()["data"]["user"]["email"] == email
    assert me_response.json()["data"]["user"]["display_name"] == display_name


@pytest.mark.asyncio
async def test_league_data_persists(client: AsyncClient, auth_headers):
    """Test that league data persists correctly."""
    token, _ = await create_authenticated_user(client)
    slug = f"persist-league-{uuid.uuid4().hex[:8]}"
    name = "Persistence Test League"

    # Create league
    await client.post("/api/leagues", json={
        "name": name,
        "slug": slug,
        "timezone": "Asia/Tokyo",
        "visibility": "private"
    }, headers=auth_headers(token))

    # Verify persistence
    response = await client.get(f"/api/leagues/{slug}", headers=auth_headers(token))
    league = response.json()["data"]["league"]
    assert league["name"] == name
    assert league["slug"] == slug
    assert league["timezone"] == "Asia/Tokyo"


@pytest.mark.asyncio
async def test_match_data_integrity(client: AsyncClient, auth_headers):
    """Test that match data maintains integrity."""
    token, _ = await create_authenticated_user(client)
    slug = f"match-integrity-{uuid.uuid4().hex[:8]}"

    # Create league
    league_response = await client.post("/api/leagues", json={
        "name": "Match Integrity League",
        "slug": slug,
        "timezone": "UTC",
        "visibility": "private"
    }, headers=auth_headers(token))
    season_id = league_response.json()["data"]["league"]["active_season"]["id"]

    # Get player
    players_response = await client.get(f"/api/leagues/{slug}/players", headers=auth_headers(token))
    player1_id = players_response.json()["data"]["players"][0]["id"]

    # Create second player
    player2_response = await client.post(f"/api/leagues/{slug}/players", json={
        "nickname": "Integrity Player 2",
        "is_guest": True
    }, headers=auth_headers(token))
    player2_id = player2_response.json()["data"]["player"]["id"]

    # Create match with specific data
    match_response = await client.post(f"/api/leagues/{slug}/matches", json={
        "season_id": season_id,
        "mode": "1v1",
        "team_a_score": 10,
        "team_b_score": 7,
        "players": [
            {"player_id": player1_id, "team": "A", "position": "attack"},
            {"player_id": player2_id, "team": "B", "position": "defense"}
        ],
        "gamelles": [
            {"against_player_id": player2_id, "by_player_id": player1_id, "count": 2}
        ]
    }, headers=auth_headers(token))
    match_id = match_response.json()["data"]["match_id"]

    # Verify all data persisted correctly
    get_response = await client.get(f"/api/leagues/{slug}/matches/{match_id}", headers=auth_headers(token))
    match = get_response.json()["data"]["match"]

    assert match["team_a_score"] == 10
    assert match["team_b_score"] == 7
    assert match["mode"] == "1v1"
    assert len(match["players"]) == 2
    assert len(match["events"]) == 1
    assert match["events"][0]["count"] == 2


@pytest.mark.asyncio
async def test_concurrent_match_creation(client: AsyncClient, auth_headers):
    """Test that concurrent match creation doesn't cause data corruption."""
    token, _ = await create_authenticated_user(client)
    slug = f"concurrent-{uuid.uuid4().hex[:8]}"

    # Create league
    league_response = await client.post("/api/leagues", json={
        "name": "Concurrent Test League",
        "slug": slug,
        "timezone": "UTC",
        "visibility": "private"
    }, headers=auth_headers(token))
    season_id = league_response.json()["data"]["league"]["active_season"]["id"]

    # Get player and create opponent
    players_response = await client.get(f"/api/leagues/{slug}/players", headers=auth_headers(token))
    player1_id = players_response.json()["data"]["players"][0]["id"]

    player2_response = await client.post(f"/api/leagues/{slug}/players", json={
        "nickname": "Concurrent Player",
        "is_guest": True
    }, headers=auth_headers(token))
    player2_id = player2_response.json()["data"]["player"]["id"]

    # Create multiple matches concurrently
    async def create_match(score_b):
        return await client.post(f"/api/leagues/{slug}/matches", json={
            "season_id": season_id,
            "mode": "1v1",
            "team_a_score": 10,
            "team_b_score": score_b,
            "players": [
                {"player_id": player1_id, "team": "A", "position": "attack"},
                {"player_id": player2_id, "team": "B", "position": "attack"}
            ]
        }, headers=auth_headers(token))

    # Run 5 concurrent match creations
    tasks = [create_match(i) for i in range(5)]
    responses = await asyncio.gather(*tasks)

    # All should succeed
    success_count = sum(1 for r in responses if r.status_code == 200)
    assert success_count == 5

    # Verify all matches exist
    list_response = await client.get(f"/api/leagues/{slug}/matches", headers=auth_headers(token))
    matches = list_response.json()["data"]["matches"]
    assert len(matches) >= 5


@pytest.mark.asyncio
async def test_transaction_rollback_on_error(client: AsyncClient, auth_headers):
    """Test that failed operations don't leave partial data."""
    token, _ = await create_authenticated_user(client)
    slug = f"rollback-{uuid.uuid4().hex[:8]}"

    # Create league
    league_response = await client.post("/api/leagues", json={
        "name": "Rollback Test League",
        "slug": slug,
        "timezone": "UTC",
        "visibility": "private"
    }, headers=auth_headers(token))
    season_id = league_response.json()["data"]["league"]["active_season"]["id"]

    # Get player
    players_response = await client.get(f"/api/leagues/{slug}/players", headers=auth_headers(token))
    player_id = players_response.json()["data"]["players"][0]["id"]

    # Try to create invalid match (same player on both teams)
    invalid_response = await client.post(f"/api/leagues/{slug}/matches", json={
        "season_id": season_id,
        "mode": "1v1",
        "team_a_score": 10,
        "team_b_score": 5,
        "players": [
            {"player_id": player_id, "team": "A", "position": "attack"},
            {"player_id": player_id, "team": "B", "position": "attack"}
        ]
    }, headers=auth_headers(token))
    assert invalid_response.status_code == 400

    # Verify no partial match was created
    list_response = await client.get(f"/api/leagues/{slug}/matches", headers=auth_headers(token))
    matches = list_response.json()["data"]["matches"]
    assert len(matches) == 0


@pytest.mark.asyncio
async def test_foreign_key_integrity(client: AsyncClient, auth_headers):
    """Test that foreign key relationships are maintained."""
    token, _ = await create_authenticated_user(client)
    slug = f"fk-integrity-{uuid.uuid4().hex[:8]}"

    # Create league
    league_response = await client.post("/api/leagues", json={
        "name": "FK Integrity League",
        "slug": slug,
        "timezone": "UTC",
        "visibility": "private"
    }, headers=auth_headers(token))
    season_id = league_response.json()["data"]["league"]["active_season"]["id"]

    # Try to create match with non-existent player
    fake_player_id = str(uuid.uuid4())
    response = await client.post(f"/api/leagues/{slug}/matches", json={
        "season_id": season_id,
        "mode": "1v1",
        "team_a_score": 10,
        "team_b_score": 5,
        "players": [
            {"player_id": fake_player_id, "team": "A", "position": "attack"},
            {"player_id": fake_player_id, "team": "B", "position": "attack"}
        ]
    }, headers=auth_headers(token))

    # Should fail due to invalid player
    assert response.status_code in [400, 404]


@pytest.mark.asyncio
async def test_membership_required_for_access(client: AsyncClient, auth_headers):
    """Test that non-members cannot access private league data."""
    # Create owner and league
    owner_token, _ = await create_authenticated_user(client)
    slug = f"private-{uuid.uuid4().hex[:8]}"

    await client.post("/api/leagues", json={
        "name": "Private League",
        "slug": slug,
        "timezone": "UTC",
        "visibility": "private"
    }, headers=auth_headers(owner_token))

    # Create another user (not a member)
    non_member_token, _ = await create_authenticated_user(client)

    # Try to access league
    response = await client.get(f"/api/leagues/{slug}", headers=auth_headers(non_member_token))
    assert response.status_code == 403

    # Try to access players
    response = await client.get(f"/api/leagues/{slug}/players", headers=auth_headers(non_member_token))
    assert response.status_code == 403

    # Try to access matches
    response = await client.get(f"/api/leagues/{slug}/matches", headers=auth_headers(non_member_token))
    assert response.status_code == 403
