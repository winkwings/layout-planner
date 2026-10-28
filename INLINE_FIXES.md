# INLINE_FIXES

Source checked: the company's original `sofa-planner.html` (not included in this repo).
Line numbers below are from that original file.

## Summary

| What | Found | Status |
|---|---|---|
| Inline event handlers (`onclick=`, `onchange=` …) | **0** | Nothing to fix. The planner already uses `addEventListener`. |
| Inline `style="…"` attributes | **43** | All fixed. 1 final fix, 42 interim fix (see below). |
| Inline `<style>` block (lines 7–645) | 1 | Moved to `static/sofa_planner/css/sofa-planner.css`. |
| Inline `<script>` block (lines 775–2312) | 1 | Moved to `static/sofa_planner/js/sofa-planner.js`. |
| External CDN / outside links | 0 | Nothing to fix. |

Your count of "about 43" matches: all 43 are `style="…"` attributes.

## How the 43 were fixed

- **#1 (line 767)** is plain HTML. Fixed for good: now `class="accent-dot"`, with one CSS rule
  added at the end of `sofa-planner.css`.
- **#2–#43** are inside JavaScript strings that go into `innerHTML`. The CSP blocks these.
  **Interim fix (done):** each `style="…"` was renamed to `data-style="…"`. Right after each
  `innerHTML` line, one helper call copies it into `element.style` (`csp-helpers.js`).
  The CSP allows that, because a script sets a property; it is not inline markup.
  This is a mechanical change. The planner logic is not rewritten.
- **Proof:** the browser check runs with a strict CSP (no `'unsafe-inline'`).
  Result: 0 CSP violations, 0 JS errors, pieces and dimension lines show correctly
  (`evidence/browser-check-output.txt`). A control test showed that the same CSP *does* block a
  real `style="…"` attribute, so the check really measures something.

## Suggested final fixes (not done yet: needs a planner rewrite)

| Type | Count | Suggested final fix | Effort |
|---|---|---|---|
| Fixed value (no `${…}`) | 4 | Move to a CSS class. | Easy |
| Colour / computed CSS | 6 | CSS class per piece group, or a CSS variable set by script. | Medium |
| Computed position / size | 33 | Create elements with `document.createElement` and set `el.style.left` etc. | Medium |

When all are done, delete `csp-helpers.js` and the 11 `SofaPlannerCSP.applyDataStyles(...)` lines.
`tests/test_csp_rules.py` will keep checking that no `style="` comes back.

## All 43 items

| # | Line | Element | Inline style (shortened) | Type | Status now | Suggested final fix |
|---|---|---|---|---|---|---|
| 1 | 767 | `<span>` | `color:var(--accent)` | Fixed value | FIXED (final) → `class="accent-dot"` | Done. |
| 2 | 1023 | `<i>` | `width:32px;height:32px;background:${fill(g.hue)…` | Colour / computed CSS | FIXED (interim) → `data-style` + helper | CSS classes per piece group, or `el.style.setProperty("--hue", …)` + CSS. Medium. |
| 3 | 1058 | `<span.group-dot>` | `background:${dot(g.hue)}` | Colour / computed CSS | FIXED (interim) → `data-style` + helper | CSS classes per piece group, or `el.style.setProperty("--hue", …)` + CSS. Medium. |
| 4 | 1095 | `<i>` | `${thumbStyle}` | Colour / computed CSS | FIXED (interim) → `data-style` + helper | CSS classes per piece group, or `el.style.setProperty("--hue", …)` + CSS. Medium. |
| 5 | 1258 | `<div.room-handle>` | `left:${(hp.x-rb.l)*scale+ROOM_PAD}px;top:${(hp.…` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 6 | 1297 | `<div.op-mull>` | `left:50%;top:2px;bottom:2px;width:1.5px;margin-…` | Fixed value | FIXED (interim) → `data-style` + helper | Move to a CSS class in sofa-planner.css. **Easy.** |
| 7 | 1298 | `<div.op-mull>` | `top:50%;left:2px;right:2px;height:1.5px;margin-…` | Fixed value | FIXED (interim) → `data-style` + helper | Move to a CSS class in sofa-planner.css. **Easy.** |
| 8 | 1302 | `<div.op-body>` | `left:${bx}px;top:${by}px;width:${bw}px;height:$…` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 9 | 1303 | `<div.op-resize>` | `${aPos}` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 10 | 1304 | `<div.op-resize>` | `${bPos}` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 11 | 1305 | `<div.op-del>` | `${cPos}` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 12 | 1428 | `<div.stem>` | `left:${x1}px;top:${y}px;width:${x2-x1}px;height…` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 13 | 1429 | `<div.cap>` | `left:${x1}px;top:${y-4}px;width:1px;height:9px;` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 14 | 1430 | `<div.cap>` | `left:${x2}px;top:${y-4}px;width:1px;height:9px;` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 15 | 1431 | `<div.val>` | `left:${(x1+x2)/2}px;top:${y-10}px;transform:tra…` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 16 | 1438 | `<div.stem>` | `left:${x}px;top:${yy1}px;width:1px;height:${yy2…` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 17 | 1439 | `<div.cap>` | `left:${x-4}px;top:${yy1}px;width:9px;height:1px;` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 18 | 1440 | `<div.cap>` | `left:${x-4}px;top:${yy2}px;width:9px;height:1px;` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 19 | 1441 | `<div.val>` | `left:${x-7}px;top:${(yy1+yy2)/2}px;transform:tr…` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 20 | 1598 | `<div.p-cushion>` | `${seamStyle}` | Colour / computed CSS | FIXED (interim) → `data-style` + helper | CSS classes per piece group, or `el.style.setProperty("--hue", …)` + CSS. Medium. |
| 21 | 1631 | `<div.stem>` | `left:${x1}px;top:${y}px;width:${x2-x1}px;height…` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 22 | 1632 | `<div.cap>` | `left:${x1}px;top:${y-4}px;width:1px;height:9px;` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 23 | 1633 | `<div.cap>` | `left:${x2}px;top:${y-4}px;width:1px;height:9px;` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 24 | 1634 | `<div.val>` | `left:${(x1+x2)/2}px;top:${y-9}px;transform:tran…` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 25 | 1644 | `<div.stem>` | `left:${x}px;top:${y1}px;width:1px;height:${y2-y…` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 26 | 1645 | `<div.cap>` | `left:${x-4}px;top:${y1}px;width:9px;height:1px;` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 27 | 1646 | `<div.cap>` | `left:${x-4}px;top:${y2}px;width:9px;height:1px;` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 28 | 1647 | `<div.val>` | `left:${x-6}px;top:${(y1+y2)/2}px;transform:tran…` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 29 | 1957 | `<div.proom>` | `left:${rx}px;top:${ry}px;width:${ref.w*ps}px;he…` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 30 | 1958 | `<svg>` | `position:absolute;inset:0;overflow:visible` | Fixed value | FIXED (interim) → `data-style` + helper | Move to a CSS class in sofa-planner.css. **Easy.** |
| 31 | 1972 | `<div.pp>` | `left:${x}px;top:${y}px;width:${w}px;height:${h}…` | Colour / computed CSS | FIXED (interim) → `data-style` + helper | CSS classes per piece group, or `el.style.setProperty("--hue", …)` + CSS. Medium. |
| 32 | 1973 | `<div>` | `transform:rotate(${-(p.rot\|\|0)}deg)` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 33 | 1980 | `<div.ln>` | `left:${rdx}px;top:${wy}px;width:${cw}px;height:…` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 34 | 1981 | `<div.ln>` | `left:${rdx}px;top:${wy-4}px;width:1px;height:9px;` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 35 | 1982 | `<div.ln>` | `left:${rdx+cw}px;top:${wy-4}px;width:1px;height…` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 36 | 1983 | `<div.vv>` | `left:${rdx+cw/2}px;top:${wy-8}px;transform:tran…` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 37 | 1984 | `<div.ln>` | `left:${lx}px;top:${rdy}px;width:1px;height:${ch…` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 38 | 1985 | `<div.ln>` | `left:${lx-4}px;top:${rdy}px;width:9px;height:1px;` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 39 | 1986 | `<div.ln>` | `left:${lx-4}px;top:${rdy+ch}px;width:9px;height…` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 40 | 1987 | `<div.vv>` | `left:${lx-7}px;top:${rdy+ch/2}px;transform:tran…` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 41 | 2004 | `<div.p-canvas>` | `width:${fullW+padL+12}px;height:${fullH+padT+12…` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |
| 42 | 2040 | `<div.pp>` | `left:${x}px;top:${y}px;width:${w}px;height:${h}…` | Colour / computed CSS | FIXED (interim) → `data-style` + helper | CSS classes per piece group, or `el.style.setProperty("--hue", …)` + CSS. Medium. |
| 43 | 2041 | `<div>` | `transform:rotate(${-(p.rot\|\|0)}deg)` | Computed position/size | FIXED (interim) → `data-style` + helper | Build with `document.createElement`, set `el.style.left/top/width/height`. Medium. |

## Other notes (not inline code, but related)

- The planner also sets styles with `element.style.x = …` in many places (for example
  `setPaletteCollapsed`). That is allowed by CSP. No change needed.
- **Security:** the planner puts piece names and the sofa name into `innerHTML` without escaping.
  The CSP stops scripts from running, but HTML could still be injected. For now the server
  rejects `<` and `>` in those fields. Final fix: use `textContent` (see KNOWN_LIMITATIONS.md).
