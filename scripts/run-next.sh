#!/bin/bash
# Run the next available backlog item

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Select next item
echo "Selecting next backlog item..."
NEXT_ITEM=$(python3 "$SCRIPT_DIR/select-next.py" 2>&1) || {
    echo "$NEXT_ITEM"
    exit 1
}

# Extract item ID
ITEM_ID=$(echo "$NEXT_ITEM" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

echo "Next item: $ITEM_ID"
echo ""

# Render prompt
python3 "$SCRIPT_DIR/render-prompt.py" "$ITEM_ID"

echo ""
echo "Ticket rendered to: $ROOT_DIR/tickets/$ITEM_ID.md"
echo ""
echo "To mark as done when complete:"
echo "  ./foospulse mark-done"
