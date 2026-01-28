"""Artifact request/response schemas."""
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field


class ArtifactCreate(BaseModel):
    """Schema for artifact generation request."""
    season_id: UUID


class ArtifactFileInfo(BaseModel):
    """Schema for file info in manifest."""
    filename: str
    size_bytes: int
    sha256: str


class ArtifactResponse(BaseModel):
    """Schema for artifact data in responses."""
    id: UUID
    status: str
    generator: str
    artifact_set_name: str
    run_id: str
    source_hash: Optional[str] = None
    files: List[ArtifactFileInfo] = []
    created_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class ArtifactListResponse(BaseModel):
    """Schema for list of artifacts."""
    artifacts: List[ArtifactResponse]
