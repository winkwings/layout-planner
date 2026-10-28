"""
Permission helpers for sofa_planner.

ALL OF THIS IS PLACEHOLDER LOGIC.  TODO-PORTAL
The real Portal has its own app-access and role system (Owner, Admin, Sales,
Employee). We do not have that code or the role matrix yet. Until we do:

- Module access  = signed in + active + Django permission
                   "sofa_planner.access_sofa_planner".
- Record access  = only the owner may view, change or delete a layout.
- No role gets extra rights. Admin is NOT treated as unrestricted.

Every view calls these helpers on the SERVER. Hidden buttons in the
templates are only a convenience, never the protection.
"""
from .models import SofaLayout

MODULE_PERMISSION = "sofa_planner.access_sofa_planner"


def can_access_module(user):
    """Module-level check.  TODO-PORTAL: replace with the Portal's app-access check."""
    if not user.is_authenticated or not user.is_active:
        return False
    # has_perm() returns True for superusers. TODO-PORTAL: confirm how the
    # Portal treats superusers / Owner for this module (OPEN_QUESTIONS.md).
    return user.has_perm(MODULE_PERMISSION)


def layouts_visible_to(user):
    """Record-level filter for lists, counts and lookups.

    TODO-PORTAL: if the role matrix lets e.g. Sales see other users' layouts,
    change it here (and only here).
    """
    return SofaLayout.objects.filter(owner=user)


def can_change_layout(user, layout):
    """Operation-level check for save.  TODO-PORTAL: role matrix."""
    return layout.owner_id == user.id


def can_delete_layout(user, layout):
    """Operation-level check for delete.  TODO-PORTAL: role matrix."""
    return layout.owner_id == user.id


def can_create_layout(user):
    """Operation-level check for creating.  TODO-PORTAL: role matrix."""
    return can_access_module(user)
