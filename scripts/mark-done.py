#!/usr/bin/env python3
"""
Mark a backlog item as done.
"""
import json
import sys
from pathlib import Path


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


def main():
    if len(sys.argv) < 2:
        # If no ID provided, try to get current in_progress item
        state = load_state()
        in_progress = state.get("in_progress", [])
        if not in_progress:
            print("No item in progress and no ID provided", file=sys.stderr)
            return 1
        item_id = in_progress[0]
        print(f"Marking current in-progress item: {item_id}")
    else:
        item_id = sys.argv[1]
    
    state = load_state()
    
    # Remove from in_progress if present
    if item_id in state.get("in_progress", []):
        state["in_progress"].remove(item_id)
    
    # Add to done if not already there
    if item_id not in state.get("done", []):
        state.setdefault("done", []).append(item_id)
    
    save_state(state)
    print(f"Marked {item_id} as done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
