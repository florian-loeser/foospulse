#!/usr/bin/env python3
"""
Render a Claude prompt for a specific backlog item.
"""
import json
import sys
from datetime import datetime
from pathlib import Path

import yaml


def load_backlog():
    """Load BACKLOG.yml"""
    backlog_path = Path(__file__).parent.parent / "BACKLOG.yml"
    with open(backlog_path) as f:
        return yaml.safe_load(f)


def load_state():
    """Load BACKLOG_STATE.json"""
    state_path = Path(__file__).parent.parent / "BACKLOG_STATE.json"
    with open(state_path) as f:
        return json.load(f)


def save_state(state):
    """Save BACKLOG_STATE.json"""
    state_path = Path(__file__).parent.parent / "BACKLOG_STATE.json"
    with open(state_path, "w") as f:
        json.dump(state, f, indent=2)


def load_template():
    """Load the feature prompt template"""
    template_path = Path(__file__).parent.parent / "claude_prompts" / "feature_prompt.md"
    with open(template_path) as f:
        return f.read()


def find_item(backlog, item_id):
    """Find a specific item by ID"""
    for item in backlog.get("items", []):
        if item["id"] == item_id:
            return item
    return None


def render_prompt(item, template):
    """Render the prompt template with item data"""
    acceptance = "\n".join(f"- {ac}" for ac in item.get("acceptance_criteria", []))
    files = "\n".join(f"- {f}" for f in item.get("files_touched_hint", []))
    deps = ", ".join(item.get("depends_on", [])) or "None"
    
    return template.format(
        item_id=item["id"],
        title=item["title"],
        type=item["type"],
        priority=item["priority"],
        depends_on=deps,
        description=item["description"],
        acceptance_criteria=acceptance,
        files_touched_hint=files,
        timestamp=datetime.utcnow().isoformat() + "Z"
    )


def main():
    if len(sys.argv) < 2:
        print("Usage: render-prompt.py <ITEM_ID>", file=sys.stderr)
        return 1
    
    item_id = sys.argv[1]
    backlog = load_backlog()
    state = load_state()
    
    item = find_item(backlog, item_id)
    if not item:
        print(f"Item {item_id} not found in backlog", file=sys.stderr)
        return 1
    
    # Mark as in_progress
    if item_id not in state.get("in_progress", []):
        state.setdefault("in_progress", []).append(item_id)
        save_state(state)
    
    # Load and render template
    template = load_template()
    prompt = render_prompt(item, template)
    
    # Save to tickets folder
    tickets_dir = Path(__file__).parent.parent / "tickets"
    tickets_dir.mkdir(exist_ok=True)
    ticket_path = tickets_dir / f"{item_id}.md"
    
    with open(ticket_path, "w") as f:
        f.write(prompt)
    
    print(f"Rendered prompt to: {ticket_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
