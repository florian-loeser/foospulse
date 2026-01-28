"""Structured logging configuration using structlog."""
import logging
import sys
from typing import Any

import structlog

from app.logging.context import get_request_id, get_league_id, get_user_id


def add_request_context(
    logger: logging.Logger, method_name: str, event_dict: dict[str, Any]
) -> dict[str, Any]:
    """Add request context to log entries."""
    request_id = get_request_id()
    league_id = get_league_id()
    user_id = get_user_id()

    if request_id:
        event_dict["request_id"] = request_id
    if league_id:
        event_dict["league_id"] = league_id
    if user_id:
        event_dict["user_id"] = user_id

    return event_dict


def configure_logging(json_logs: bool = True, log_level: str = "INFO"):
    """
    Configure structured logging for the application.

    Args:
        json_logs: If True, output JSON formatted logs
        log_level: Log level (DEBUG, INFO, WARNING, ERROR)
    """
    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, log_level.upper()),
    )

    # Define shared processors
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        add_request_context,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    if json_logs:
        # JSON logging for production
        processors = shared_processors + [
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ]
    else:
        # Console logging for development
        processors = shared_processors + [
            structlog.dev.ConsoleRenderer(colors=True),
        ]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str = "foospulse"):
    """Get a structured logger instance."""
    return structlog.get_logger(name)
