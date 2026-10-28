# SHARED_PLATFORM_CHANGES

Everything here needs the **real Portal code or the Portal team**. I did not have access.
Search the code for `TODO-PORTAL` to find each place.

| # | What | Why | Affected (module side) | How to verify |
|---|---|---|---|---|
| 1 | **Register the module** in the central application registry | Rulebook §3. Registry format unknown. | `sofa_planner/portal_registration.py` (draft values only, nothing reads it) | Module card/route appears only for allowed users; direct URLs still protected. |
| 2 | **Add `sofa_planner` to the Portal's `INSTALLED_APPS` and URL config** | Module must run inside the Portal project. | `test_project/settings.py`, `test_project/urls.py` (test only, do not copy) | `manage.py check`, routes resolve under the registry prefix. |
| 3 | **Run the migration** on the Portal DB | Creates table `sofa_planner_sofalayout` + permission row. | `sofa_planner/migrations/0001_initial.py` | Run on SQLite **and** MySQL/Percona 8.4 test DB. Not tested on MySQL yet. |
| 4 | **Use the Portal's app-access / role check** instead of the placeholder | Rulebook §4, §6. | `sofa_planner/permissions.py`, `module_access_required` in `views.py` | Tests for each role + revoked access + inactive user. |
| 5 | **Use the real shared base layout** and its slot names | Rulebook §7. | Templates extend `levida_placeholder/base.html` (placeholder). Blocks `page_title`, `page_description`, `page_actions`, `content`, `module_css`, `module_js`, `body_class`, `content_class` are guesses. | Pages show Portal header, nav, theme, sign-out. |
| 6 | **Allow (or replace) the planner's own stylesheet** | Rulebook §7 says app-specific stylesheets are "outside the standard contract". The planner needs its CSS (canvas, pieces). | `static/sofa_planner/css/sofa-planner.css`, `editor-page.css` | Design-system review. Possibly propose new shared components (canvas/toolbar). |
| 7 | **Planner CSS styles global tags** (`body`, `header`, `main`, `footer`, `aside`, `*`, `:root` variables) | Will clash with the real layout. Needs scoping to `.sp-editor` or Portal guidance. | `sofa-planner.css` | Visual check of editor and of other Portal pages. |
| 8 | **Central sign-in flow** for expired sessions | Rulebook §5, §14. Test project uses Django's `LoginView`. JSON routes answer 401. | `test_project/urls.py`, `views.module_access_required`, `storage-stub.js` (401 message) | Expire session, then save: must go to Portal sign-in. |
| 9 | **Shared session checks** (sign-out in another tab, user switch, deactivation, permission change while page is open) | Rulebook §5. I added a simple `opened_as` check only. | `views._identity_changed`, `storage-stub.js` | Portal's own session-validation tests. |
| 10 | **Real Content-Security-Policy** | Test project has its own strict CSP middleware. | `test_project/middleware.py` (test only) | Run `tools/browser_check.js` against the real Portal CSP. |
| 11 | **Static files / build** | Rulebook §17: assets must match the central build. Files here are plain CSS/JS, no build step. | `static/sofa_planner/` | `collectstatic` in the Portal pipeline. |
| 12 | **Shared form components / messages / pagination patterns** | Rulebook §9, §15. Templates use plain HTML for now. | `layout_list.html`, `editor.html` | Design review. |
| 13 | **Change history / audit log** (if required) | Rulebook §13. Not built. | `views.layout_save`, `views.layout_delete` | Depends on OPEN_QUESTIONS Q6. |
| 14 | **Redis cache / performance dataset** | Rulebook §1, §16. Not used. | — | Agree a test dataset first. |
