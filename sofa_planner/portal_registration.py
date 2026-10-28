"""
TODO-PORTAL: DRAFT registration information. NOT a real registry entry.

The rulebook (section 3) says registration must define: identity,
description, category, entry route, protected routes, navigation
requirements, and default access policy.

We do NOT know the Portal's registry format, so this is a plain Python dict
that lists the information. Nothing reads it. When the Portal team shares
the real format, copy these values into it and delete this file.
"""

DRAFT_REGISTRATION = {
    "identity": "sofa_planner",
    "description": "Plan sectional sofa layouts and save them.",
    "category": "TODO-PORTAL: unknown. Ask the company.",
    "entry_route": "sofa_planner:layout_list",
    "protected_routes": [
        "sofa_planner:layout_list",
        "sofa_planner:layout_new",
        "sofa_planner:layout_edit",
        "sofa_planner:layout_create",
        "sofa_planner:layout_save",
        "sofa_planner:layout_delete",
    ],
    # One primary destination (the list) -> no dedicated module navigation
    # (rulebook section 8 table: "Zero or one").
    "navigation": "none (one primary destination)",
    "default_access_policy": "TODO-PORTAL: unknown. Ask which roles get access by default.",
}
