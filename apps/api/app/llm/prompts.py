"""
LLM Prompt Templates.

Contains prompt templates for various LLM-powered features.
These are used when LLM_MODE is set to "optional" or "required".
"""

# Weekly digest narrative prompt
WEEKLY_DIGEST_PROMPT = """
You are a friendly sports commentator for an office foosball league.
Generate a brief, engaging weekly digest based on the following statistics.

League: {league_name}
Season: {season_name}
Period: {period}

Statistics:
- Total matches: {n_matches}
- Most active player: {most_active_player} ({most_active_matches} matches)
- Elo leader: {elo_leader} ({elo_rating})
- Biggest Elo gain this week: {biggest_gainer} (+{elo_gain})
- Best duo: {best_duo_players} ({best_duo_winrate}% win rate)

Notable events:
{notable_events}

Write a 2-3 paragraph narrative summary that:
1. Highlights the week's key developments
2. Mentions standout performances
3. Builds excitement for upcoming competition

Keep the tone fun and collegial. Avoid using player real names, use their nicknames.
"""

# Match summary prompt
MATCH_SUMMARY_PROMPT = """
Summarize this foosball match result in one engaging sentence:

Mode: {mode}
{team_a_players} vs {team_b_players}
Score: {team_a_score} - {team_b_score}
Winner: {winner}
Notable: {notable_events}

Keep it brief, fun, and use the player nicknames provided.
"""

# Player card narrative prompt
PLAYER_CARD_PROMPT = """
Write a brief, fun "player card" description for this foosball player:

Nickname: {nickname}
Elo Rating: {elo_rating} (rank #{elo_rank})
Matches Played: {n_matches}
Win Rate: {win_rate}%
Best Role: {best_role}
Best Partner: {best_partner}
Nemesis: {nemesis}

Write 2-3 sentences that capture their playing style and personality.
Be playful but respectful.
"""

# Rivalry narrative prompt
RIVALRY_PROMPT = """
Describe the rivalry between these two foosball players in 1-2 sentences:

Player 1: {player1_nickname}
Player 2: {player2_nickname}
Head-to-head: {player1_wins}-{player2_wins}
Total matches: {n_matches}

Make it dramatic but friendly.
"""


def format_prompt(template: str, **kwargs) -> str:
    """
    Format a prompt template with provided values.

    Missing values are replaced with "[unknown]".
    """
    try:
        return template.format(**kwargs)
    except KeyError as e:
        # Replace missing keys with placeholder
        for key in kwargs:
            template = template.replace(f"{{{key}}}", str(kwargs[key]))
        return template
