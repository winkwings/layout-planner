# ROUTES_AND_PERMISSIONS

Namespace: `sofa_planner` (set by `app_name` in `sofa_planner/urls.py`).
In the test project, the module lives under `/sofa-planner/`. In the Portal, the prefix
comes from the central registry (TODO-PORTAL).

## Routes

| URL name | Path | Method | Page type | What it does | Who may use it (now) |
|---|---|---|---|---|---|
| `sofa_planner:layout_list` | `/sofa-planner/` | GET | Browse | Your layouts, newest first, 25 per page (`?page=N`) | Signed-in, active user with module access. Sees **own** layouts only. |
| `sofa_planner:layout_new` | `/sofa-planner/new/` | GET | Task | Empty editor | Same as above |
| `sofa_planner:layout_edit` | `/sofa-planner/<id>/` | GET | Task | Editor with a saved layout | Module access **and** owner of the layout |
| `sofa_planner:layout_create` | `/sofa-planner/save/` | POST (JSON) | Data | Creates a new layout | Module access. Owner = signed-in user (never taken from the request). |
| `sofa_planner:layout_save` | `/sofa-planner/<id>/save/` | POST (JSON) | Data | Updates a layout. Needs `version`. | Module access **and** owner |
| `sofa_planner:layout_delete` | `/sofa-planner/<id>/delete/` | POST (form) | Data | Deletes a layout | Module access **and** owner |

There are no export, file or upload routes. The planner's **Print** button uses the
browser's print dialog only (no server route).

## Checks on every request (all on the server)

| Check | Pages (GET) | JSON routes (save/create) | Delete |
|---|---|---|---|
| Wrong method | 405 | 405 | 405 |
| Not signed in / inactive | Redirect to sign-in | 401 JSON | Redirect to sign-in |
| No module access | 403 | 403 JSON | 403 |
| Layout belongs to someone else, or does not exist | 404 | 404 | 404 |
| Missing/bad CSRF token | — | 403 | 403 |
| Invalid input | — | 400 JSON with `fields` | — |
| Old `version` (someone saved first) | — | 409 JSON `version_conflict` | — |
| Page opened by a different user (`opened_as`) | — | 409 JSON `identity_changed` | — |

Other users' layouts give **404, not 403**, so a user cannot find out which ids exist.
All pages send `Cache-Control: private, no-store` (Django `never_cache`).

## Where permissions are decided

All rules are in one file: `sofa_planner/permissions.py` (marked TODO-PORTAL).

- **Module access (placeholder):** active user + Django permission
  `sofa_planner.access_sofa_planner`. Stands in for the Portal's app-access system.
  Removing the permission removes access (explicit revocation works).
- **Record access:** owner only. No role sees other users' layouts.
- **Admin is not treated as "can do everything".** One exception from Django itself:
  a Django *superuser* passes `has_perm()`. See OPEN_QUESTIONS.md Q2.

## Portal roles (Owner, Admin, Sales, Employee)

**Not mapped yet.** The role matrix is unknown, so no role gets special rights.
See OPEN_QUESTIONS.md Q1.

## Test identities (synthetic, local only)

Created by `python manage.py seed_sofa_planner`. Password for all: `test-pass-123`.

| Username | Module access | Has layouts |
|---|---|---|
| `alice.test` | Yes | 2 |
| `bob.test` | Yes | 1 |
| `carol.noaccess` | **No** (gets 403) | 0 |

These are test users, **not** Portal roles.
