"""
Create SYNTHETIC test users and fake layouts. Local testing only.

    python manage.py seed_sofa_planner

Safe to run twice: it updates the same users and does not duplicate layouts.
All names, emails and passwords are fake.
"""
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from sofa_planner.models import SofaLayout

# Fake password shared by all test users. Test project only.
TEST_PASSWORD = "test-pass-123"

# (username, gets module access?)
# NOTE: these are test identities, NOT Portal roles. Role mapping is an open question.
TEST_USERS = [
    ("alice.test", True),
    ("bob.test", True),
    ("carol.noaccess", False),  # signed in, but no module access -> sees 403
]


def _piece(pid, ptype, name, w, d, x, y, rot=0):
    return {"id": pid, "type": ptype, "name": name, "w": w, "d": d, "x": x, "y": y, "rot": rot}


def _layout(pieces, unit="cm", room_on=False):
    # Same shape the planner JavaScript writes (origin "v2" = current coordinate system).
    return {
        "pieces": pieces,
        "uid": len(pieces) + 1,
        "scale": 2.4,
        "unit": unit,
        "room": {
            "on": room_on, "w": 400, "d": 300, "unit": "ft",
            "notches": {k: {"x": 0, "y": 0} for k in ("tl", "tr", "br", "bl")},
            "openings": [],
        },
        "origin": "v2",
    }


FAKE_LAYOUTS = {
    "alice.test": [
        ("Demo living room A", "Alvric Sofa", _layout([
            _piece(1, "arm", "Arm (S)", 12, 82, 190, 110),
            _piece(2, "single", "Single Seat (S)", 80, 82, 202, 110),
            _piece(3, "single", "Single Seat (S)", 80, 82, 282, 110),
            _piece(4, "arm", "Arm (S)", 12, 82, 362, 110),
        ])),
        ("Demo corner with chaise", "Nelson Sectional Sofa with chaise", _layout([
            _piece(1, "arm", "Arm (L)", 20, 105, 160, 90),
            _piece(2, "single", "Single Seat (L)", 90, 105, 180, 90),
            _piece(3, "chaise", "Chaise", 105, 180, 270, 90),
        ], room_on=True)),
    ],
    "bob.test": [
        ("Bob demo power bed", "Polar Power Sleeper Sofa bed", _layout([
            _piece(1, "arm", "Arm (S)", 12, 82, 190, 110),
            _piece(2, "power", "Power Bed (M)", 160, 130, 202, 110),
            _piece(3, "arm", "Arm (S)", 12, 82, 362, 110),
        ], unit="in")),
    ],
}


class Command(BaseCommand):
    help = "Create synthetic test users and fake sofa layouts (local testing only)."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            # Extra safety: never seed fake accounts on a server.
            raise CommandError("Refusing to run with DEBUG off. This command is for local testing only.")

        User = get_user_model()
        perm = Permission.objects.get(codename="access_sofa_planner", content_type__app_label="sofa_planner")

        with transaction.atomic():  # all or nothing
            for username, has_access in TEST_USERS:
                user, created = User.objects.get_or_create(
                    username=username, defaults={"email": f"{username}@example.invalid"}
                )
                user.set_password(TEST_PASSWORD)
                user.is_active = True
                user.save()
                if has_access:
                    user.user_permissions.add(perm)
                else:
                    user.user_permissions.remove(perm)
                self.stdout.write(f"{'Created' if created else 'Updated'} user {username} (module access: {has_access})")

                for name, model_name, data in FAKE_LAYOUTS.get(username, []):
                    _, made = SofaLayout.objects.get_or_create(
                        owner=user, name=name,
                        defaults={"sofa_model_name": model_name, "layout_data": data},
                    )
                    if made:
                        self.stdout.write(f"  + layout '{name}'")

        self.stdout.write(self.style.SUCCESS(f"Done. Password for all test users: {TEST_PASSWORD}"))
