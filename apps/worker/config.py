"""Worker configuration."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Worker settings."""
    
    # Database
    database_url: str = "postgresql+psycopg://foospulse:foospulse@postgres:5432/foospulse"
    
    # Redis / Celery - use REDIS_URL from environment
    redis_url: str = "redis://redis:6379/0"

    @property
    def celery_broker_url(self) -> str:
        return self.redis_url

    @property
    def celery_result_backend(self) -> str:
        return self.redis_url
    
    # Artifacts
    artifacts_dir: str = "/data/artifacts"
    
    # LLM
    llm_mode: str = "off"
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
