"""Test configuration and fixtures."""
import asyncio
import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

# Disable rate limiting for tests
os.environ["DISABLE_RATE_LIMITING"] = "true"

from app.main import app
from app.database import engine


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def client(event_loop):
    """Create test client with fresh database connection per test."""
    # Dispose existing connections to avoid event loop issues
    await engine.dispose()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    # Clean up connections after test
    await engine.dispose()


@pytest.fixture
def auth_headers():
    """Create auth headers helper."""
    def _auth_headers(token: str):
        return {"Authorization": f"Bearer {token}"}
    return _auth_headers
