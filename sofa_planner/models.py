from django.conf import settings
from django.db import models


class SofaLayout(models.Model):
    """One saved sofa plan, owned by one Portal user."""

    # Uses the existing user model. No separate user system (rulebook section 4).
    # PROTECT: a user with layouts cannot be hard-deleted by accident.
    # Deletion/retention rules are still an open question (OPEN_QUESTIONS.md).
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="sofa_layouts",
    )
    name = models.CharField(max_length=120)
    sofa_model_name = models.CharField(max_length=120, blank=True)
    # Planner state: {"pieces": [...], "room": {...}, "unit": "cm"|"in", ...}
    # JSONField works on SQLite and MySQL/Percona 8.4.
    layout_data = models.JSONField(default=dict)
    # Optimistic locking: every successful save adds 1.
    # A save that sends an old number is rejected (no silent overwrite).
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)  # timezone-aware (USE_TZ=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]
        indexes = [
            # Speeds up "my layouts, newest first" on both databases.
            models.Index(fields=["owner", "-updated_at"], name="sofa_layout_owner_upd_idx"),
        ]
        permissions = [
            # TODO-PORTAL: placeholder for the Portal's own app-access mechanism.
            ("access_sofa_planner", "Can open the Sofa Planner module"),
        ]

    def __str__(self):
        return self.name
