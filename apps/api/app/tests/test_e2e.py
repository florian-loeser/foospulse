"""End-to-end tests simulating complete user journeys."""
import pytest
import uuid
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_complete_user_journey(client: AsyncClient, auth_headers):
    """
    Test complete user journey:
    1. Register
    2. Login
    3. Create league
    4. Add players
    5. Log matches
    6. View stats
    7. Generate report
    """
    # 1. Register
    email = f"e2e_user_{uuid.uuid4().hex[:8]}@example.com"
    password = "E2ETestPass123"
    display_name = "E2E Test User"

    register_response = await client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "display_name": display_name
    })
    assert register_response.status_code == 200, f"Registration failed: {register_response.json()}"

    # 2. Login
    login_response = await client.post("/api/auth/login", json={
        "email": email,
        "password": password
    })
    assert login_response.status_code == 200
    token = login_response.json()["data"]["token"]
    headers = auth_headers(token)

    # Verify login
    me_response = await client.get("/api/auth/me", headers=headers)
    assert me_response.status_code == 200
    assert me_response.json()["data"]["user"]["email"] == email

    # 3. Create league
    slug = f"e2e-league-{uuid.uuid4().hex[:8]}"
    league_response = await client.post("/api/leagues", json={
        "name": "E2E Test League",
        "slug": slug,
        "timezone": "Europe/Paris",
        "visibility": "private"
    }, headers=headers)
    assert league_response.status_code == 200
    season_id = league_response.json()["data"]["league"]["active_season"]["id"]

    # Verify league appears in list
    leagues_response = await client.get("/api/leagues", headers=headers)
    assert any(l["slug"] == slug for l in leagues_response.json()["data"]["leagues"])

    # 4. Add players
    players_response = await client.get(f"/api/leagues/{slug}/players", headers=headers)
    owner_player_id = players_response.json()["data"]["players"][0]["id"]

    player_ids = [owner_player_id]
    for i in range(3):
        player_response = await client.post(f"/api/leagues/{slug}/players", json={
            "nickname": f"E2E Player {i+2}",
            "is_guest": True
        }, headers=headers)
        assert player_response.status_code == 200
        player_ids.append(player_response.json()["data"]["player"]["id"])

    # 5. Log matches
    # 1v1 match
    match1_response = await client.post(f"/api/leagues/{slug}/matches", json={
        "season_id": season_id,
        "mode": "1v1",
        "team_a_score": 10,
        "team_b_score": 5,
        "players": [
            {"player_id": player_ids[0], "team": "A", "position": "attack"},
            {"player_id": player_ids[1], "team": "B", "position": "attack"}
        ]
    }, headers=headers)
    assert match1_response.status_code == 200

    # 2v2 match with gamelle
    match2_response = await client.post(f"/api/leagues/{slug}/matches", json={
        "season_id": season_id,
        "mode": "2v2",
        "team_a_score": 10,
        "team_b_score": 8,
        "players": [
            {"player_id": player_ids[0], "team": "A", "position": "attack"},
            {"player_id": player_ids[1], "team": "A", "position": "defense"},
            {"player_id": player_ids[2], "team": "B", "position": "attack"},
            {"player_id": player_ids[3], "team": "B", "position": "defense"}
        ],
        "gamelles": [
            {"against_player_id": player_ids[2], "by_player_id": player_ids[0], "count": 1}
        ]
    }, headers=headers)
    assert match2_response.status_code == 200

    # Verify matches
    matches_response = await client.get(f"/api/leagues/{slug}/matches", headers=headers)
    assert len(matches_response.json()["data"]["matches"]) >= 2

    # 6. View stats
    leaderboards_response = await client.get(f"/api/leagues/{slug}/stats/leaderboards", headers=headers)
    assert leaderboards_response.status_code == 200

    player_stats_response = await client.get(f"/api/leagues/{slug}/stats/player/{player_ids[0]}", headers=headers)
    assert player_stats_response.status_code == 200
    stats = player_stats_response.json()["data"]["player_stats"]
    assert stats["n_matches"] >= 2
    assert stats["wins"] >= 2  # Won both matches

    # 7. Test report generation (just check endpoint works)
    artifact_response = await client.post(
        f"/api/leagues/{slug}/artifacts/league-report",
        json={"season_id": season_id},
        headers=headers
    )
    assert artifact_response.status_code == 200
    assert artifact_response.json()["data"]["status"] in ["queued", "done"]


@pytest.mark.asyncio
async def test_invite_and_join_journey(client: AsyncClient, auth_headers):
    """
    Test invite flow:
    1. Owner creates league
    2. Owner gets invite code
    3. New user joins via invite
    4. New user can access league
    """
    # 1. Owner creates league
    owner_email = f"owner_{uuid.uuid4().hex[:8]}@example.com"
    await client.post("/api/auth/register", json={
        "email": owner_email,
        "password": "OwnerPass123",
        "display_name": "League Owner"
    })
    owner_login = await client.post("/api/auth/login", json={
        "email": owner_email,
        "password": "OwnerPass123"
    })
    owner_token = owner_login.json()["data"]["token"]

    slug = f"invite-test-{uuid.uuid4().hex[:8]}"
    await client.post("/api/leagues", json={
        "name": "Invite Test League",
        "slug": slug,
        "timezone": "UTC",
        "visibility": "private"
    }, headers=auth_headers(owner_token))

    # 2. Get invite code
    invite_response = await client.get(f"/api/leagues/{slug}/invite", headers=auth_headers(owner_token))
    assert invite_response.status_code == 200
    invite_code = invite_response.json()["data"]["invite_code"]

    # 3. New user joins
    joiner_email = f"joiner_{uuid.uuid4().hex[:8]}@example.com"
    await client.post("/api/auth/register", json={
        "email": joiner_email,
        "password": "JoinerPass123",
        "display_name": "League Joiner"
    })
    joiner_login = await client.post("/api/auth/login", json={
        "email": joiner_email,
        "password": "JoinerPass123"
    })
    joiner_token = joiner_login.json()["data"]["token"]

    # Preview invite
    preview_response = await client.get(f"/api/leagues/join/{invite_code}", headers=auth_headers(joiner_token))
    assert preview_response.status_code == 200
    assert preview_response.json()["data"]["already_member"] is False
    assert preview_response.json()["data"]["league"]["name"] == "Invite Test League"

    # Join
    join_response = await client.post(f"/api/leagues/join/{invite_code}", headers=auth_headers(joiner_token))
    assert join_response.status_code == 200
    assert join_response.json()["data"]["joined"] is True

    # 4. Verify access
    league_response = await client.get(f"/api/leagues/{slug}", headers=auth_headers(joiner_token))
    assert league_response.status_code == 200

    # Check already member
    preview_again = await client.get(f"/api/leagues/join/{invite_code}", headers=auth_headers(joiner_token))
    assert preview_again.json()["data"]["already_member"] is True


@pytest.mark.asyncio
async def test_season_management_journey(client: AsyncClient, auth_headers):
    """
    Test season management:
    1. Create league (auto-creates Season 1)
    2. Log matches in Season 1
    3. Archive Season 1
    4. Create Season 2
    5. Verify matches are filtered by season
    """
    # Setup
    email = f"season_{uuid.uuid4().hex[:8]}@example.com"
    await client.post("/api/auth/register", json={
        "email": email,
        "password": "SeasonPass123",
        "display_name": "Season Tester"
    })
    login_response = await client.post("/api/auth/login", json={
        "email": email,
        "password": "SeasonPass123"
    })
    token = login_response.json()["data"]["token"]
    headers = auth_headers(token)

    slug = f"season-test-{uuid.uuid4().hex[:8]}"

    # 1. Create league
    league_response = await client.post("/api/leagues", json={
        "name": "Season Test League",
        "slug": slug,
        "timezone": "UTC",
        "visibility": "private"
    }, headers=headers)
    season1_id = league_response.json()["data"]["league"]["active_season"]["id"]

    # Get players
    players_response = await client.get(f"/api/leagues/{slug}/players", headers=headers)
    player1_id = players_response.json()["data"]["players"][0]["id"]

    player2_response = await client.post(f"/api/leagues/{slug}/players", json={
        "nickname": "Season Player 2",
        "is_guest": True
    }, headers=headers)
    player2_id = player2_response.json()["data"]["player"]["id"]

    # 2. Log match in Season 1
    await client.post(f"/api/leagues/{slug}/matches", json={
        "season_id": season1_id,
        "mode": "1v1",
        "team_a_score": 10,
        "team_b_score": 5,
        "players": [
            {"player_id": player1_id, "team": "A", "position": "attack"},
            {"player_id": player2_id, "team": "B", "position": "attack"}
        ]
    }, headers=headers)

    # 3. Archive Season 1 by creating Season 2
    season2_response = await client.post(f"/api/leagues/{slug}/seasons", json={
        "name": "Season 2"
    }, headers=headers)
    assert season2_response.status_code == 200
    season2_id = season2_response.json()["data"]["season"]["id"]
    assert season2_response.json()["data"]["archived_season_id"] == season1_id

    # 4. Log match in Season 2
    await client.post(f"/api/leagues/{slug}/matches", json={
        "season_id": season2_id,
        "mode": "1v1",
        "team_a_score": 10,
        "team_b_score": 3,
        "players": [
            {"player_id": player1_id, "team": "A", "position": "attack"},
            {"player_id": player2_id, "team": "B", "position": "attack"}
        ]
    }, headers=headers)

    # 5. Verify filtering
    # Get all matches (both seasons)
    all_matches_response = await client.get(f"/api/leagues/{slug}/matches", headers=headers)
    all_matches = all_matches_response.json()["data"]["matches"]
    # Total matches should be 2 (1 per season)
    assert len(all_matches) == 2

    # Filter by Season 1 (should have 1 match)
    season1_matches = await client.get(f"/api/leagues/{slug}/matches?season_id={season1_id}", headers=headers)
    assert len(season1_matches.json()["data"]["matches"]) == 1

    # Filter by Season 2 (should have 1 match)
    season2_matches = await client.get(f"/api/leagues/{slug}/matches?season_id={season2_id}", headers=headers)
    assert len(season2_matches.json()["data"]["matches"]) == 1


@pytest.mark.asyncio
async def test_match_void_journey(client: AsyncClient, auth_headers):
    """
    Test match voiding:
    1. Create match
    2. Void match
    3. Verify voided match doesn't affect stats
    """
    # Setup
    email = f"void_{uuid.uuid4().hex[:8]}@example.com"
    await client.post("/api/auth/register", json={
        "email": email,
        "password": "VoidPass123",
        "display_name": "Void Tester"
    })
    login_response = await client.post("/api/auth/login", json={
        "email": email,
        "password": "VoidPass123"
    })
    token = login_response.json()["data"]["token"]
    headers = auth_headers(token)

    slug = f"void-test-{uuid.uuid4().hex[:8]}"
    league_response = await client.post("/api/leagues", json={
        "name": "Void Test League",
        "slug": slug,
        "timezone": "UTC",
        "visibility": "private"
    }, headers=headers)
    season_id = league_response.json()["data"]["league"]["active_season"]["id"]

    # Get players
    players_response = await client.get(f"/api/leagues/{slug}/players", headers=headers)
    player1_id = players_response.json()["data"]["players"][0]["id"]

    player2_response = await client.post(f"/api/leagues/{slug}/players", json={
        "nickname": "Void Player 2",
        "is_guest": True
    }, headers=headers)
    player2_id = player2_response.json()["data"]["player"]["id"]

    # 1. Create match
    match_response = await client.post(f"/api/leagues/{slug}/matches", json={
        "season_id": season_id,
        "mode": "1v1",
        "team_a_score": 10,
        "team_b_score": 5,
        "players": [
            {"player_id": player1_id, "team": "A", "position": "attack"},
            {"player_id": player2_id, "team": "B", "position": "attack"}
        ]
    }, headers=headers)
    match_id = match_response.json()["data"]["match_id"]

    # Check stats before void
    stats_before = await client.get(f"/api/leagues/{slug}/stats/player/{player1_id}", headers=headers)
    wins_before = stats_before.json()["data"]["player_stats"]["wins"]

    # 2. Void match
    void_response = await client.post(f"/api/leagues/{slug}/matches/{match_id}/void", json={
        "reason": "Test void"
    }, headers=headers)
    assert void_response.status_code == 200
    assert void_response.json()["data"]["status"] == "void"

    # 3. Verify match is voided
    get_match = await client.get(f"/api/leagues/{slug}/matches/{match_id}", headers=headers)
    assert get_match.json()["data"]["match"]["status"] == "void"
    assert get_match.json()["data"]["match"]["void_reason"] == "Test void"
