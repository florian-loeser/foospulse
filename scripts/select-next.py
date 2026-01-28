#!/usr/bin/env python3
"""
Select the next available backlog item that has all dependencies satisfied.
"""
import json
import sys
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


def get_next_item(backlog, state):
    """Find the next available item with satisfied dependencies."""
    done = set(state.get("done", []))
    in_progress = set(state.get("in_progress", []))
    
    # Skip done and in_progress items
    skip = done | in_progress
    
    for item in backlog.get("items", []):
        item_id = item["id"]
        
        # Skip if already done or in progress
        if item_id in skip:
            continue
        
        # Check if all dependencies are satisfied
        deps = item.get("depends_on", [])
        if all(dep in done for dep in deps):
            return item
    
    return None


def main():
    backlog = load_backlog()
    state = load_state()
    
    next_item = get_next_item(backlog, state)
    
    if next_item:
        print(json.dumps(next_item, indent=2))
        return 0
    else:
        print("No available items (all done or blocked by dependencies)", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
