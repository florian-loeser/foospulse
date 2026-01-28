"""CLI entry point."""
import asyncio
import sys

from app.cli.seed import seed_demo


def main():
    if len(sys.argv) < 2:
        print("Usage: python -m app.cli <command>")
        print("Commands: seed_demo")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "seed_demo":
        asyncio.run(seed_demo())
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
