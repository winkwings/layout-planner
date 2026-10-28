"""
Server-side validation for the save request (rulebook section 9).

The browser's data is never trusted. Owner, version and timestamps are
decided by the server, not by the request.

Limits below are SAFE DEFAULTS, not business rules. The real limits must
come from the company (see OPEN_QUESTIONS.md).
"""
import json
import math

MAX_BODY_BYTES = 256 * 1024  # 256 KB is far more than a real plan needs.
MAX_NAME_LEN = 120
MAX_PIECES = 300
MAX_PIECE_NAME_LEN = 120
UNITS = ("cm", "in")
ROOM_UNITS = ("cm", "ft", "in")
# Keys the planner JavaScript writes today. Anything else is rejected.
ALLOWED_LAYOUT_KEYS = {"pieces", "room", "unit", "uid", "scale", "origin"}
REQUIRED_LAYOUT_KEYS = {"pieces", "room", "unit"}
# Planner sizes are in cm. 1..2000 cm covers every catalog item and room.
SIZE_MIN, SIZE_MAX = 1, 2000
# The copied planner puts piece names and the sofa model name into the page
# with innerHTML. Until that is rewritten (KNOWN_LIMITATIONS.md), refuse
# characters that could inject HTML.
HTML_CHARS = ("<", ">")


def _has_html_chars(text):
    return any(ch in text for ch in HTML_CHARS)


class ValidationFailed(Exception):
    """Raised with a dict of {field: message}."""

    def __init__(self, errors):
        super().__init__("invalid input")
        self.errors = errors


def _is_number(value):
    # bool is a subclass of int in Python, so exclude it explicitly.
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _clean_text(data, key, errors, required):
    value = data.get(key, "")
    if not isinstance(value, str):
        errors[key] = "Must be text."
        return ""
    value = value.strip()
    if required and not value:
        errors[key] = "This field is required."
    elif len(value) > MAX_NAME_LEN:
        errors[key] = f"Must be {MAX_NAME_LEN} characters or fewer."
    return value


def _check_piece(piece, index, errors):
    key = f"layout_data.pieces[{index}]"
    if not isinstance(piece, dict):
        errors[key] = "Each piece must be an object."
        return
    for dim in ("w", "d"):
        if not _is_number(piece.get(dim)) or not SIZE_MIN <= piece[dim] <= SIZE_MAX:
            errors[f"{key}.{dim}"] = f"Must be a number from {SIZE_MIN} to {SIZE_MAX}."
    for pos in ("x", "y"):
        if not _is_number(piece.get(pos)):
            errors[f"{key}.{pos}"] = "Must be a number."
    if "rot" in piece and not _is_number(piece["rot"]):
        errors[f"{key}.rot"] = "Must be a number."
    name = piece.get("name", "")
    if not isinstance(name, str) or len(name) > MAX_PIECE_NAME_LEN:
        errors[f"{key}.name"] = f"Must be text, {MAX_PIECE_NAME_LEN} characters or fewer."
    elif _has_html_chars(name):
        errors[f"{key}.name"] = "Must not contain < or >."


def _check_layout_data(layout, errors):
    if not isinstance(layout, dict):
        errors["layout_data"] = "Must be an object."
        return
    missing = REQUIRED_LAYOUT_KEYS - layout.keys()
    extra = layout.keys() - ALLOWED_LAYOUT_KEYS
    if missing:
        errors["layout_data"] = "Missing: " + ", ".join(sorted(missing)) + "."
        return
    if extra:
        errors["layout_data"] = "Unknown keys: " + ", ".join(sorted(extra)) + "."
        return

    if layout["unit"] not in UNITS:
        errors["layout_data.unit"] = "Must be 'cm' or 'in'."

    pieces = layout["pieces"]
    if not isinstance(pieces, list):
        errors["layout_data.pieces"] = "Must be a list."
    elif len(pieces) > MAX_PIECES:
        errors["layout_data.pieces"] = f"At most {MAX_PIECES} pieces."
    else:
        for i, piece in enumerate(pieces):
            _check_piece(piece, i, errors)

    room = layout["room"]
    if not isinstance(room, dict):
        errors["layout_data.room"] = "Must be an object."
    else:
        for dim in ("w", "d"):
            if dim in room and (not _is_number(room[dim]) or not SIZE_MIN <= room[dim] <= SIZE_MAX):
                errors[f"layout_data.room.{dim}"] = f"Must be a number from {SIZE_MIN} to {SIZE_MAX}."
        if "unit" in room and room["unit"] not in ROOM_UNITS:
            errors["layout_data.room.unit"] = "Must be 'cm', 'ft' or 'in'."


def parse_save_request(body_bytes, is_update):
    """Return a dict of clean values, or raise ValidationFailed."""
    if len(body_bytes) > MAX_BODY_BYTES:
        raise ValidationFailed({"__all__": "Request is too large."})
    try:
        data = json.loads(body_bytes.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise ValidationFailed({"__all__": "Request body must be valid JSON."})
    if not isinstance(data, dict):
        raise ValidationFailed({"__all__": "Request body must be a JSON object."})

    errors = {}
    clean = {
        "name": _clean_text(data, "name", errors, required=True),
        "sofa_model_name": _clean_text(data, "sofa_model_name", errors, required=False),
        "layout_data": data.get("layout_data"),
        "opened_as": data.get("opened_as"),
    }
    if "sofa_model_name" not in errors and _has_html_chars(clean["sofa_model_name"]):
        errors["sofa_model_name"] = "Must not contain < or >."
    _check_layout_data(clean["layout_data"], errors)

    # opened_as = the user id the editor page was opened for (stale-identity check).
    if not isinstance(clean["opened_as"], int) or isinstance(clean["opened_as"], bool):
        errors["opened_as"] = "Missing editor identity."

    if is_update:
        version = data.get("version")
        if not isinstance(version, int) or isinstance(version, bool) or version < 1:
            errors["version"] = "A positive whole-number version is required."
        clean["version"] = version

    if errors:
        raise ValidationFailed(errors)
    return clean
