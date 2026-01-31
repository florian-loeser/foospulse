"""
Application configuration from environment variables.
"""
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    # Database
    database_url: str = "postgresql+psycopg://foospulse:foospulse@postgres:5432/foospulse"

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # Security
    jwt_secret: str = "dev-secret-change-in-production-32chars"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 1 week

    # Artifacts
    artifacts_dir: str = "/data/artifacts"

    # LLM (disabled by default)
    llm_mode: str = "off"  # off | optional | required

    # API
    api_debug: bool = True
    api_cors_origins: str = "http://localhost:3001"

    # Logging
    log_level: str = "INFO"
    json_logs: bool = True  # JSON logs for production, console for dev

    # Integrations
    slack_webhook_url: str = ""  # Slack webhook URL (empty = disabled)
    resend_api_key: str = ""  # Resend API key (empty = disabled)
    email_from: str = "FoosPulse <onboarding@resend.dev>"

    # Password Reset
    password_reset_expire_hours: int = 24

    @property
    def cors_origins(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.api_cors_origins.split(",")]

    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return not self.api_debug

    @property
    def is_jwt_secure(self) -> bool:
        """Check if JWT secret is secure (not default)."""
        return self.jwt_secret != "dev-secret-change-in-production-32chars"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
