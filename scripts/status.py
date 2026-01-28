#!/usr/bin/env python3
"""
Show backlog status.
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


def get_next_item(backlog, state):
    """Find the next available item with satisfied dependencies."""
    done = set(state.get("done", []))
    in_progress = set(state.get("in_progress", []))
    skip = done | in_progress
    
    for item in backlog.get("items", []):
        item_id = item["id"]
        if item_id in skip:
            continue
        deps = item.get("depends_on", [])
        if all(dep in done for dep in deps):
            return item
    return None


def main():
    backlog = load_backlog()
    state = load_state()
    
    items = backlog.get("items", [])
    done = state.get("done", [])
    in_progress = state.get("in_progress", [])
    
    # Count by priority
    p0_items = [i for i in items if i.get("priority") == "P0"]
    p1_items = [i for i in items if i.get("priority") == "P1"]
    p2_items = [i for i in items if i.get("priority") == "P2"]
    
    p0_done = len([i for i in p0_items if i["id"] in done])
    p1_done = len([i for i in p1_items if i["id"] in done])
    p2_done = len([i for i in p2_items if i["id"] in done])
    
    print("=" * 50)
    print("FoosPulse Backlog Status")
    print("=" * 50)
    print()
    print(f"Total items: {len(items)}")
    print(f"  P0: {p0_done}/{len(p0_items)}")
    print(f"  P1: {p1_done}/{len(p1_items)}")
    print(f"  P2: {p2_done}/{len(p2_items)}")
    print()
    print(f"Done: {len(done)}")
    print(f"In progress: {len(in_progress)}")
    print(f"Remaining: {len(items) - len(done) - len(in_progress)}")
    print()
    
    if in_progress:
        print("Currently in progress:")
        for item_id in in_progress:
            item = next((i for i in items if i["id"] == item_id), None)
            if item:
                print(f"  [{item_id}] {item['title']}")
        print()
    
    next_item = get_next_item(backlog, state)
    if next_item:
        print("Next available item:")
        print(f"  [{next_item['id']}] {next_item['title']}")
        print(f"  Priority: {next_item['priority']}")
        deps = next_item.get("depends_on", [])
        if deps:
            print(f"  Dependencies: {', '.join(deps)}")
    else:
        print("No available items (all done or blocked)")
    
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
