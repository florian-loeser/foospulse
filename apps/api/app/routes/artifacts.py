"""Artifact API routes."""
import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import ulid

from app.database import get_db
from app.models.user import User
from app.models.league import League, LeagueMember, MemberStatus
from app.models.season import Season, SeasonStatus
from app.models.player import Player
from app.models.artifact import Artifact, ArtifactStatus
from app.models.stats import StatsSnapshot
from app.schemas.artifact import ArtifactCreate
from app.security import get_current_user
from app.config import settings
from app.services.queue import enqueue_artifact_generation
from app.services.audit import log_artifact_start

router = APIRouter()


def api_response(data=None, error=None):
    return {"data": data, "error": error}


def api_error(code: str, message: str, details: dict = None):
    return {"code": code, "message": message, "details": details or {}}


async def get_league_membership(league_slug: str, current_user: User, db: AsyncSession):
    result = await db.execute(select(League).where(League.slug == league_slug))
    league = result.scalar_one_or_none()
    if not league:
        raise HTTPException(status_code=404, detail=api_response(error=api_error("NOT_FOUND", "League not found")))
    
    result = await db.execute(
        select(LeagueMember).where(LeagueMember.league_id == league.id)
        .where(LeagueMember.user_id == current_user.id).where(LeagueMember.status == MemberStatus.ACTIVE)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail=api_response(error=api_error("FORBIDDEN", "Not a member")))
    
    return league, member


@router.post("/{league_slug}/artifacts/league-report")
async def create_artifact(
    league_slug: str,
    artifact_data: ArtifactCreate,
    force: bool = Query(False, description="Force regeneration even if source unchanged"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    league, member = await get_league_membership(league_slug, current_user, db)

    result = await db.execute(
        select(Season).where(Season.id == artifact_data.season_id).where(Season.league_id == league.id)
    )
    season = result.scalar_one_or_none()
    if not season:
        raise HTTPException(status_code=400, detail=api_response(error=api_error("VALIDATION_ERROR", "Invalid season")))

    # Get current source_hash from stats snapshot
    result = await db.execute(
        select(StatsSnapshot)
        .where(StatsSnapshot.league_id == league.id)
        .where(StatsSnapshot.season_id == season.id)
        .where(StatsSnapshot.snapshot_type == "leaderboards")
        .order_by(StatsSnapshot.computed_at.desc())
    )
    stats_snapshot = result.scalar_one_or_none()
    current_source_hash = stats_snapshot.source_hash if stats_snapshot else None

    # Check for existing artifact with same source_hash (if not forcing regeneration)
    if not force and current_source_hash:
        result = await db.execute(
            select(Artifact)
            .where(Artifact.league_id == league.id)
            .where(Artifact.season_id == season.id)
            .where(Artifact.source_hash == current_source_hash)
            .where(Artifact.status == ArtifactStatus.DONE)
            .order_by(Artifact.created_at.desc())
        )
        existing_artifact = result.scalar_one_or_none()

        if existing_artifact:
            return api_response(data={
                "artifact_id": str(existing_artifact.id),
                "status": "unchanged",
                "run_id": existing_artifact.run_id,
                "source_hash": current_source_hash,
                "message": "No changes since last report. Use force=true to regenerate."
            })

    result = await db.execute(
        select(Player).where(Player.league_id == league.id).where(Player.user_id == current_user.id)
    )
    current_player = result.scalar_one_or_none()

    run_id = str(ulid.new())

    artifact = Artifact(
        league_id=league.id,
        season_id=season.id,
        generator="deterministic_v1",
        artifact_set_name="league_report",
        status=ArtifactStatus.QUEUED,
        run_id=run_id,
        created_by_player_id=current_player.id if current_player else None
    )
    db.add(artifact)
    await db.flush()

    # Audit log
    await log_artifact_start(
        db=db,
        artifact_id=artifact.id,
        league_id=league.id,
        actor_user_id=current_user.id,
        actor_player_id=current_player.id if current_player else None,
        artifact_type="league_report"
    )

    await enqueue_artifact_generation(str(artifact.id))

    return api_response(data={"artifact_id": str(artifact.id), "status": "queued", "run_id": run_id})


@router.get("/{league_slug}/artifacts")
async def list_artifacts(
    league_slug: str,
    season_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    league, _ = await get_league_membership(league_slug, current_user, db)
    
    query = select(Artifact).where(Artifact.league_id == league.id).order_by(Artifact.created_at.desc())
    
    if season_id:
        try:
            query = query.where(Artifact.season_id == uuid.UUID(season_id))
        except ValueError:
            pass
    
    result = await db.execute(query.limit(50))
    artifacts = result.scalars().all()
    
    return api_response(data={
        "artifacts": [{
            "id": str(a.id),
            "status": a.status.value,
            "generator": a.generator,
            "artifact_set_name": a.artifact_set_name,
            "run_id": a.run_id,
            "source_hash": a.source_hash,
            "files": [{"filename": f["filename"], "size_bytes": f["size_bytes"], "sha256": f["sha256"]} for f in (a.manifest_json or {}).get("files", [])],
            "created_at": a.created_at.isoformat(),
            "completed_at": a.completed_at.isoformat() if a.completed_at else None,
            "error_message": a.error_message
        } for a in artifacts]
    })


@router.get("/{league_slug}/artifacts/{artifact_id}")
async def get_artifact(
    league_slug: str,
    artifact_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    league, _ = await get_league_membership(league_slug, current_user, db)
    
    try:
        artifact_uuid = uuid.UUID(artifact_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=api_response(error=api_error("VALIDATION_ERROR", "Invalid artifact ID")))
    
    result = await db.execute(select(Artifact).where(Artifact.id == artifact_uuid).where(Artifact.league_id == league.id))
    artifact = result.scalar_one_or_none()
    
    if not artifact:
        raise HTTPException(status_code=404, detail=api_response(error=api_error("NOT_FOUND", "Artifact not found")))
    
    return api_response(data={
        "artifact": {
            "id": str(artifact.id),
            "status": artifact.status.value,
            "generator": artifact.generator,
            "artifact_set_name": artifact.artifact_set_name,
            "run_id": artifact.run_id,
            "source_hash": artifact.source_hash,
            "files": [{"filename": f["filename"], "size_bytes": f["size_bytes"], "sha256": f["sha256"]} for f in (artifact.manifest_json or {}).get("files", [])],
            "created_at": artifact.created_at.isoformat(),
            "completed_at": artifact.completed_at.isoformat() if artifact.completed_at else None,
            "error_message": artifact.error_message
        }
    })


@router.get("/{league_slug}/artifacts/{artifact_id}/download")
async def download_artifact_file(
    league_slug: str,
    artifact_id: str,
    file: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    league, _ = await get_league_membership(league_slug, current_user, db)
    
    try:
        artifact_uuid = uuid.UUID(artifact_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=api_response(error=api_error("VALIDATION_ERROR", "Invalid artifact ID")))
    
    result = await db.execute(select(Artifact).where(Artifact.id == artifact_uuid).where(Artifact.league_id == league.id))
    artifact = result.scalar_one_or_none()
    
    if not artifact:
        raise HTTPException(status_code=404, detail=api_response(error=api_error("NOT_FOUND", "Artifact not found")))
    
    if artifact.status != ArtifactStatus.DONE:
        raise HTTPException(status_code=400, detail=api_response(error=api_error("VALIDATION_ERROR", "Artifact not ready")))
    
    # Validate file is in manifest
    manifest_files = [f["filename"] for f in (artifact.manifest_json or {}).get("files", [])]
    if file not in manifest_files:
        raise HTTPException(status_code=404, detail=api_response(error=api_error("NOT_FOUND", "File not in manifest")))
    
    # Sanitize filename to prevent path traversal
    safe_filename = os.path.basename(file)
    if safe_filename != file or ".." in file or file.startswith("/"):
        raise HTTPException(status_code=400, detail=api_response(error=api_error("VALIDATION_ERROR", "Invalid filename")))
    
    file_path = Path(artifact.output_path) / safe_filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=api_response(error=api_error("NOT_FOUND", "File not found on disk")))
    
    return FileResponse(
        path=str(file_path),
        filename=safe_filename,
        media_type="application/octet-stream"
    )
