"""Static check: module templates and JS must not contain inline code or styles (CSP rule)."""
import re
from pathlib import Path

from django.test import SimpleTestCase

APP_DIR = Path(__file__).resolve().parent.parent
TEMPLATES = list((APP_DIR / "templates").rglob("*.html"))
SCRIPTS = list((APP_DIR / "static").rglob("*.js"))

INLINE_STYLE = re.compile(r"<[a-z][^<>]*\sstyle\s*=", re.I)  # style= inside a tag (data-style is fine)
INLINE_HANDLER = re.compile(r"<[a-z][^<>]*\son[a-z]+\s*=", re.I)  # e.g. <button onclick=...>
INLINE_SCRIPT = re.compile(r"<script(?![^>]*\bsrc=)[^>]*>", re.I)  # <script> without src
EXTERNAL_URL = re.compile(r"(src|href)\s*=\s*[\"']?(https?:)?//", re.I)


class CspRuleTests(SimpleTestCase):
    def test_files_found(self):
        self.assertTrue(TEMPLATES and SCRIPTS)

    def test_templates_have_no_inline_code_or_style(self):
        for path in TEMPLATES:
            text = path.read_text(encoding="utf-8")
            with self.subTest(file=path.name):
                self.assertIsNone(INLINE_STYLE.search(text), "inline style=")
                self.assertIsNone(INLINE_HANDLER.search(text), "inline event handler")
                self.assertIsNone(INLINE_SCRIPT.search(text), "inline <script>")
                self.assertIsNone(EXTERNAL_URL.search(text), "external URL / CDN")

    def test_scripts_build_no_inline_style_or_handlers(self):
        for path in SCRIPTS:
            text = path.read_text(encoding="utf-8")
            with self.subTest(file=path.name):
                self.assertIsNone(INLINE_STYLE.search(text), "style= inside HTML strings")
                self.assertIsNone(INLINE_HANDLER.search(text), "on...= inside HTML strings")

    def test_planner_uses_storage_stub_not_localstorage(self):
        text = (APP_DIR / "static/sofa_planner/js/sofa-planner.js").read_text(encoding="utf-8")
        self.assertNotIn("localStorage.getItem(", text)
        self.assertNotIn("localStorage.setItem(", text)
