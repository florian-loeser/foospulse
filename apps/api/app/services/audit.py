"""Audit logging service."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog, AuditAction


async def write_audit_log(
    db: AsyncSession,
    action: AuditAction,
    entity_type: str,
    entity_id: uuid.UUID,
    actor_user_id: Optional[uuid.UUID] = None,
    actor_player_id: Optional[uuid.UUID] = None,
    league_id: Optional[uuid.UUID] = None,
    payload: Optional[dict] = None,
    description: Optional[str] = None
) -> AuditLog:
    """
    Write an audit log entry.

    Args:
        db: Database session
        action: The action being audited
        entity_type: Type of entity (e.g., "match", "artifact")
        entity_id: UUID of the affected entity
        actor_user_id: User who performed the action (if applicable)
        actor_player_id: Player who performed the action (if applicable)
        league_id: League context (if applicable)
        payload: Additional JSON data about the action
        description: Human-readable description

    Returns:
        The created AuditLog entry
    """
    audit_entry = AuditLog(
        action=action.value,
        entity_type=entity_type,
        entity_id=entity_id,
        actor_user_id=actor_user_id,
        actor_player_id=actor_player_id,
        league_id=league_id,
        payload_json=payload,
        description=description,
        created_at=datetime.utcnow()
    )
    db.add(audit_entry)
    # Don't commit - let the caller manage the transaction
    return audit_entry


async def log_match_create(
    db: AsyncSession,
    match_id: uuid.UUID,
    league_id: uuid.UUID,
    actor_user_id: uuid.UUID,
    actor_player_id: Optional[uuid.UUID],
    match_data: dict
) -> AuditLog:
    """Log a match creation event."""
    return await write_audit_log(
        db=db,
        action=AuditAction.MATCH_CREATE,
        entity_type="match",
        entity_id=match_id,
        actor_user_id=actor_user_id,
        actor_player_id=actor_player_id,
        league_id=league_id,
        payload={
            "mode": match_data.get("mode"),
            "team_a_score": match_data.get("team_a_score"),
            "team_b_score": match_data.get("team_b_score"),
            "player_count": len(match_data.get("players", []))
        },
        description=f"Match created: {match_data.get('mode')} {match_data.get('team_a_score')}-{match_data.get('team_b_score')}"
    )


async def log_match_void(
    db: AsyncSession,
    match_id: uuid.UUID,
    league_id: uuid.UUID,
    actor_user_id: uuid.UUID,
    reason: str
) -> AuditLog:
    """Log a match void event."""
    return await write_audit_log(
        db=db,
        action=AuditAction.MATCH_VOID,
        entity_type="match",
        entity_id=match_id,
        actor_user_id=actor_user_id,
        league_id=league_id,
        payload={"reason": reason},
        description=f"Match voided: {reason}"
    )


async def log_artifact_start(
    db: AsyncSession,
    artifact_id: uuid.UUID,
    league_id: uuid.UUID,
    actor_user_id: Optional[uuid.UUID],
    actor_player_id: Optional[uuid.UUID],
    artifact_type: str
) -> AuditLog:
    """Log artifact generation start."""
    return await write_audit_log(
        db=db,
        action=AuditAction.ARTIFACT_START,
        entity_type="artifact",
        entity_id=artifact_id,
        actor_user_id=actor_user_id,
        actor_player_id=actor_player_id,
        league_id=league_id,
        payload={"artifact_type": artifact_type},
        description=f"Artifact generation started: {artifact_type}"
    )


async def log_artifact_complete(
    db: AsyncSession,
    artifact_id: uuid.UUID,
    league_id: uuid.UUID,
    source_hash: str,
    files_generated: list
) -> AuditLog:
    """Log artifact generation completion."""
    return await write_audit_log(
        db=db,
        action=AuditAction.ARTIFACT_COMPLETE,
        entity_type="artifact",
        entity_id=artifact_id,
        league_id=league_id,
        payload={
            "source_hash": source_hash,
            "files": files_generated
        },
        description=f"Artifact generation completed: {len(files_generated)} files"
    )


async def log_artifact_fail(
    db: AsyncSession,
    artifact_id: uuid.UUID,
    league_id: uuid.UUID,
    error_message: str
) -> AuditLog:
    """Log artifact generation failure."""
    return await write_audit_log(
        db=db,
        action=AuditAction.ARTIFACT_FAIL,
        entity_type="artifact",
        entity_id=artifact_id,
        league_id=league_id,
        payload={"error": error_message},
        description=f"Artifact generation failed: {error_message[:100]}"
    )
