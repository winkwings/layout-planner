"""One-time converter: split sofa-planner.html into CSS / JS / markup.

Only mechanical edits. Every edit is counted and asserted.
Usage (from the project folder):
    python3 -I tools/convert_planner.py path/to/sofa-planner.html sofa_planner
(The original sofa-planner.html is the company's file and is not in this repo.)
Already run once. Do NOT re-run: the CSS/JS have since been edited (UI redesign),
and re-running would overwrite those edits.
"""
import sys
from pathlib import Path

src, out = Path(sys.argv[1]), Path(sys.argv[2])
lines = src.read_text(encoding="utf8").split("\n")

def block(first, last):  # 1-based inclusive line numbers of the ORIGINAL file
    return lines[first - 1:last]

assert lines[6].strip() == "<style>" and lines[644].strip() == "</style>"
assert lines[774].strip() == "<script>" and lines[2311].strip() == "</script>"

# ---------- CSS (lines 8-644) ----------
css = block(8, 644)
css_text = (
    "/* Sofa Planner styles. Copied AS IS from sofa-planner.html lines 8-644.\n"
    "   Only change: one rule added at the end (INLINE_FIXES.md item #1). */\n"
    + "\n".join(css)
    + "\n\n  /* INLINE_FIXES #1: was style=\"color:var(--accent)\" on the footer dot (HTML line 767). */\n"
    "  .accent-dot{ color:var(--accent); }\n"
)
(out / "static/sofa_planner/css/sofa-planner.css").write_text(css_text, encoding="utf8")

# ---------- JS (lines 776-2311) ----------
# Statement end lines found by scanning each innerHTML assignment forward to its ';'.
# key = innerHTML start line, value = (end line, element variable name)
APPLY_AFTER = {
    1021: (1033, "card"), 1058: (1058, "head"), 1094: (1102, "card"),
    1261: (1268, "el"), 1427: (1431, "wl"), 1437: (1441, "dl"),
    1603: (1608, "el"), 1630: (1635, "wl"), 1643: (1648, "dl"),
    2001: (2012, "sheet"), 2049: (2112, "sheet"),
}
end_lines = {end: (var, start) for start, (end, var) in APPLY_AFTER.items()}
js_out, style_count, apply_count = [], 0, 0
for n in range(776, 2312):
    line = lines[n - 1]
    style_count += line.count(' style="')
    line = line.replace(' style="', ' data-style="')  # CSP: style="" in HTML strings is blocked
    js_out.append(line)
    if n in end_lines:
        var, start = end_lines[n]
        first = lines[start - 1]
        indent = first[: len(first) - len(first.lstrip())]  # same indent as the statement
        js_out.append(f"{indent}SofaPlannerCSP.applyDataStyles({var}); // CSP fix, see INLINE_FIXES.md")
        apply_count += 1
assert style_count == 42, style_count
assert apply_count == 11, apply_count

js = "\n".join(js_out)
n_set, n_get = js.count("localStorage.setItem("), js.count("localStorage.getItem(")
assert (n_set, n_get) == (3, 3), (n_set, n_get)
# TODO-PORTAL stub: all browser storage goes through SofaPlannerStorage (storage-stub.js).
js = js.replace("localStorage.setItem(", "SofaPlannerStorage.setItem(")
js = js.replace("localStorage.getItem(", "SofaPlannerStorage.getItem(")
assert "localStorage" not in js

header = (
    "/* Sofa Planner logic. Copied AS IS from sofa-planner.html lines 776-2311.\n"
    " * Only mechanical changes:\n"
    " *  1. style=\"...\" inside HTML strings -> data-style=\"...\" (42 places), and\n"
    " *     SofaPlannerCSP.applyDataStyles(...) after each innerHTML that uses them (11 places).\n"
    " *     Reason: the Portal CSP blocks inline style attributes. See INLINE_FIXES.md.\n"
    " *  2. localStorage.getItem/setItem -> SofaPlannerStorage.getItem/setItem (6 places).\n"
    " *     TODO-PORTAL stub, see storage-stub.js.\n"
    " * Needs csp-helpers.js and storage-stub.js loaded BEFORE this file.\n"
    " */\n"
)
(out / "static/sofa_planner/js/sofa-planner.js").write_text(header + js + "\n", encoding="utf8")

# ---------- Markup (lines 648-773) for the editor template ----------
markup = "\n".join(block(648, 773))
assert markup.count(' style="') == 1
markup = markup.replace('<span style="color:var(--accent)">', '<span class="accent-dot">')
assert ' style="' not in markup and "<script" not in markup
(out / "templates/sofa_planner/_planner_markup.html").write_text(
    "{% comment %}Planner markup. Copied AS IS from sofa-planner.html lines 648-773.\n"
    "Only change: footer dot inline style -> class \"accent-dot\" (INLINE_FIXES.md #1).{% endcomment %}\n"
    + markup + "\n",
    encoding="utf8",
)
print("ok: css lines", len(css), "| js lines", len(js_out), "| styles", style_count, "| apply calls", apply_count)
