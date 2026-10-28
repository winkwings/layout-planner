# Sofa Planner module (`sofa_planner`) 

A module for Levida Portal. First skeleton, not finished.

> **This was built and tested in a small standalone test project (`test_project/`).
> It is NOT verified Portal integration.**
> Anything that needs the real Portal is a placeholder marked `TODO-PORTAL`.

Python 3.13 · Django 5.2 · Django Templates · SQLite (local) / MySQL-Percona compatible · America/Toronto

## What to take into the Portal

Only the `sofa_planner/` folder. Do **not** copy `test_project/` (placeholder layout, sign-in and CSP for local testing only).

Search the code for `TODO-PORTAL` to see every place that needs the real Portal.
`SHARED_PLATFORM_CHANGES.md` lists them with how to verify each one.

## Login

The module has **no login of its own**. Users sign in to the Portal first. The views only use the
signed-in user from the request. The login page in `test_project/` is a stand-in for local testing.

The module still checks login, access and ownership on every request. The rulebook (sections 3 and 6)
says hiding a card is not protection, so a direct URL must be checked too.
The checks are in `sofa_planner/permissions.py` and are marked `TODO-PORTAL`
until they are connected to the Portal's real access rules.

## Tests

```bash
python manage.py test sofa_planner
```

34 tests. They run in the standalone test project, so they prove the module's own rules, not Portal integration.

## Folder map

| Path | What |
|---|---|
| `sofa_planner/` | **The module.** |
| `sofa_planner/models.py` | `SofaLayout` model |
| `sofa_planner/permissions.py` | All permission rules (placeholder, TODO-PORTAL) |
| `sofa_planner/validation.py` | Server-side checks for the save request |
| `sofa_planner/views.py`, `urls.py` | Pages and routes (namespace `sofa_planner`) |
| `sofa_planner/static/sofa_planner/` | Planner CSS/JS (moved out of the HTML) + storage stub |
| `sofa_planner/templates/sofa_planner/` | List page, editor page, planner markup |
| `sofa_planner/management/commands/seed_sofa_planner.py` | Synthetic test data command |
| `sofa_planner/tests/` | Tests |
| `test_project/` | **Test only.** Do not copy into the Portal. |
| `tools/` | One-time converter script and browser check script |
| `evidence/` | Test output and screenshots |

## Documents

- `ROUTES_AND_PERMISSIONS.md` — routes, methods, who may use them
- `SHARED_PLATFORM_CHANGES.md` — what needs the real Portal
- `OPEN_QUESTIONS.md` — questions for the company
- `INLINE_FIXES.md` — the 43 inline styles and how they were fixed
- `KNOWN_LIMITATIONS.md` — what is unfinished
