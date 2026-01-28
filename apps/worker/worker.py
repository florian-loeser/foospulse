"""Celery worker application."""
from celery import Celery
from config import settings

app = Celery(
    "foospulse_worker",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "tasks.ratings",
        "tasks.stats",
        "tasks.artifacts",
    ]
)

# Configure Celery
app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_routes={
        "tasks.ratings.*": {"queue": "ratings"},
        "tasks.stats.*": {"queue": "stats"},
        "tasks.artifacts.*": {"queue": "artifacts"},
    },
    task_default_queue="default",
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
)


@app.task(bind=True)
def health_check(self):
    """Health check task."""
    return {"status": "ok", "worker_id": self.request.id}


if __name__ == "__main__":
    app.start()
