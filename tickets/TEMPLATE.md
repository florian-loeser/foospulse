# Ticket Template

This template is used by the autopilot system to generate feature tickets.

## Template Variables

- `{item_id}` - Backlog item ID (e.g., APP-0001)
- `{title}` - Item title
- `{type}` - Type (feature, chore, bug)
- `{priority}` - Priority (P0, P1, P2)
- `{depends_on}` - Comma-separated list of dependencies
- `{description}` - Full description
- `{acceptance_criteria}` - Bullet list of acceptance criteria
- `{files_touched_hint}` - Bullet list of files likely to be modified
- `{timestamp}` - ISO timestamp when ticket was generated

## Usage

The `render-prompt.py` script reads `claude_prompts/feature_prompt.md` and 
substitutes these variables to create a complete ticket in `tickets/`.
