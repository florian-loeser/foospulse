"""Worker configuration."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Worker settings."""
    
    # Database
    database_url: str = "postgresql+psycopg://foospulse:foospulse@postgres:5432/foospulse"
    
    # Redis / Celery
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/0"
    celery_result_backend: str = "redis://redis:6379/0"
    
    # Artifacts
    artifacts_dir: str = "/data/artifacts"
    
    # LLM
    llm_mode: str = "off"
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
