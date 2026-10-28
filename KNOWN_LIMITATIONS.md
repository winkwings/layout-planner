# KNOWN_LIMITATIONS

**This is a standalone test setup. It is NOT verified Portal integration.**
Delivery state (rulebook §18): *implemented + tested locally*. Not integrated, not released.

## Not built yet (skeleton only)

- The planner was **copied, not rebuilt**. Logic is the same as `sofa-planner.html`.
- Uses a **placeholder base layout**, not the real Levida layout, Tailwind or daisyUI.
- Uses **placeholder permissions** (`permissions.py`). No Portal roles.
- **Save is manual.** The "Save layout" button calls the server. Nothing saves automatically.
- **Storage stub** (`storage-stub.js`) is temporary. Browser drafts are still written to
  `localStorage` (see OPEN_QUESTIONS Q11). Drafts stay after sign-out on a shared computer.
- **No change history / audit log.**
- **No protection against a double "create"**: if the first create succeeds but the answer is lost
  (network drop), clicking Save again makes a second layout. Updates are protected by `version`.
- **Version conflict recovery is basic:** the user sees a clear message and must reload.
  There is no merge or "save as copy" yet.
- **Planner state shape:** the server accepts the keys `pieces, room, unit` (required) and
  `uid, scale, origin` (optional). The extra 3 are needed by the old planner code
  (`origin` stops a coordinate shift from being re-applied; `uid` keeps piece ids unique).
- If a saved sofa model name is not in the browser's name list and the user never edited
  that list, the picker falls back to the first default name.

## Problems copied from the original planner (not fixed, on purpose)

- **Inspector panel scrolls away.** It is placed inside the scrolling canvas. After the canvas
  scrolls, the panel moves off-screen. Same in the original file (measured: left = −1303 px).
- **Global CSS selectors** (`body`, `header`, `main`, `footer`, `aside`, `*`) will clash with
  the real Portal layout. The placeholder layout avoids those tags on purpose.
- **Print** depended on `body > header/main/footer`. I added print rules in `editor-page.css`
  so the toolbar is hidden when printing. Print output was only checked for "toolbar hidden",
  not for paper layout.
- **`innerHTML` with user text** (piece names, sofa name). Server now rejects `<` and `>` in these.
  Final fix: build those parts with `textContent`.
- **Not mobile-ready.** At 320 px the editor scrolls sideways (`evidence/module-editor-320px.png`).
- **Accessibility gaps** in the planner: drag-only actions, small touch targets,
  icon buttons without names (for example ✎ and × in the name menu), mouse-only rotation handle.
- Uses `document.execCommand` (old browser API) when renaming.
- Uses device date (`toLocaleDateString`) on the print sheet. Rulebook §12 says device time must
  not decide business values. Only used as a printed date for now.
- Catalogue sizes are hard-coded in JavaScript.

## Not tested

- **MySQL / Percona 8.4.** Code avoids SQLite-only features (JSONField, plain UPDATE with a
  WHERE on version, a normal index). A settings switch exists (`DB_ENGINE=mysql`) but I did
  not run it. Rulebook §11: SQLite tests alone do not prove locking behaviour.
- Real Portal sign-in, sign-out in another tab, account deactivation during an open page,
  permission change during an open page.
- Physical devices, tablets, 200 % zoom, screen readers, dark theme in the planner
  (the planner has light colours only).
- Performance with a large dataset.

## Test evidence (local only)

- Django tests: `evidence/test-output.txt` — 34 tests, all pass.
- Browser check (headless Chromium, strict CSP): `evidence/browser-check-output.txt` — 22/22 pass.
- Screenshots: `evidence/*.png`.
