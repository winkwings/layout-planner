"""
Views for sofa_planner.

Every view checks, on the server:
  1. signed in            (else sign-in page, or 401 for JSON)
  2. module access        (else 403)
  3. record access        (other users' layouts -> 404, so we don't reveal they exist)
  4. operation access     (save / delete)
"""
from functools import wraps

from django.contrib import messages
from django.contrib.auth.views import redirect_to_login
from django.core.exceptions import PermissionDenied
from django.core.paginator import Paginator
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET, require_POST

from . import permissions
from .models import SofaLayout
from .validation import ValidationFailed, parse_save_request

PAGE_SIZE = 25  # Rulebook section 16 default.


def module_access_required(api=False):
    """Login + module permission check.  TODO-PORTAL: swap for Portal's own decorator.

    api=True: answer with JSON (401/403) instead of a redirect, because the
    browser script cannot follow a sign-in redirect.
    """

    def decorator(view):
        @wraps(view)
        def wrapper(request, *args, **kwargs):
            user = request.user
            if not user.is_authenticated:
                if api:
                    return JsonResponse(
                        {"error": "not_authenticated", "message": "Please sign in again."},
                        status=401,
                    )
                return redirect_to_login(request.get_full_path())
            if not permissions.can_access_module(user):
                if api:
                    return JsonResponse(
                        {"error": "forbidden", "message": "You do not have access to this module."},
                        status=403,
                    )
                raise PermissionDenied
            return view(request, *args, **kwargs)

        return wrapper

    return decorator


# ---------- Browse page ----------

@never_cache  # private page: no browser/proxy caching (rulebook section 5)
@require_GET
@module_access_required()
def layout_list(request):
    # defer(): the list does not need the (possibly large) JSON column.
    layouts = permissions.layouts_visible_to(request.user).defer("layout_data")
    page = Paginator(layouts, PAGE_SIZE).get_page(request.GET.get("page"))
    return render(request, "sofa_planner/layout_list.html", {"page_obj": page})


# ---------- Task pages ----------

def _editor_context(request, layout):
    return {
        "layout": layout,
        # Sent to the page with json_script (a data block, not executable script).
        "layout_data": layout.layout_data if layout else None,
        "save_url": (
            reverse("sofa_planner:layout_save", args=[layout.pk])
            if layout
            else reverse("sofa_planner:layout_create")
        ),
        "version": layout.version if layout else 0,
        "opened_as": request.user.pk,  # used to detect "user switched in another tab"
    }


@never_cache
@require_GET
@module_access_required()
def layout_new(request):
    if not permissions.can_create_layout(request.user):
        raise PermissionDenied
    return render(request, "sofa_planner/editor.html", _editor_context(request, None))


@never_cache
@require_GET
@module_access_required()
def layout_edit(request, pk):
    # Lookup goes through the visibility filter: another user's id -> 404.
    layout = get_object_or_404(permissions.layouts_visible_to(request.user), pk=pk)
    return render(request, "sofa_planner/editor.html", _editor_context(request, layout))


# ---------- Data-changing operations (POST only, CSRF checked by middleware) ----------

def _error(code, message, status, **extra):
    return JsonResponse({"error": code, "message": message, **extra}, status=status)


def _identity_changed(request, clean):
    # The page was opened by a different user than the one signed in now.
    return clean["opened_as"] != request.user.pk


def _saved_response(layout, status):
    return JsonResponse(
        {
            "ok": True,
            "id": layout.pk,
            "version": layout.version,
            "updated_at": timezone.localtime(layout.updated_at).isoformat(),
            "edit_url": reverse("sofa_planner:layout_edit", args=[layout.pk]),
            "save_url": reverse("sofa_planner:layout_save", args=[layout.pk]),
        },
        status=status,
    )


@never_cache
@require_POST
@module_access_required(api=True)
def layout_create(request):
    if not permissions.can_create_layout(request.user):
        return _error("forbidden", "You may not create layouts.", 403)
    try:
        clean = parse_save_request(request.body, is_update=False)
    except ValidationFailed as exc:
        return _error("invalid", "Please fix the highlighted fields.", 400, fields=exc.errors)
    if _identity_changed(request, clean):
        return _error("identity_changed", "You are now signed in as a different user. Reload the page.", 409)

    layout = SofaLayout.objects.create(
        owner=request.user,  # owner comes from the session, never from the request body
        name=clean["name"],
        sofa_model_name=clean["sofa_model_name"],
        layout_data=clean["layout_data"],
    )
    return _saved_response(layout, status=201)


@never_cache
@require_POST
@module_access_required(api=True)
def layout_save(request, pk):
    layout = get_object_or_404(permissions.layouts_visible_to(request.user), pk=pk)
    if not permissions.can_change_layout(request.user, layout):
        return _error("forbidden", "You may not change this layout.", 403)
    try:
        clean = parse_save_request(request.body, is_update=True)
    except ValidationFailed as exc:
        return _error("invalid", "Please fix the highlighted fields.", 400, fields=exc.errors)
    if _identity_changed(request, clean):
        return _error("identity_changed", "You are now signed in as a different user. Reload the page.", 409)

    with transaction.atomic():
        # Optimistic lock: ONE UPDATE that only matches if the version is still
        # the one the browser loaded. Works the same on SQLite and MySQL.
        # .update() skips auto_now, so updated_at is set by hand.
        changed = SofaLayout.objects.filter(pk=layout.pk, version=clean["version"]).update(
            name=clean["name"],
            sofa_model_name=clean["sofa_model_name"],
            layout_data=clean["layout_data"],
            version=clean["version"] + 1,
            updated_at=timezone.now(),
        )
    if changed == 0:
        current = SofaLayout.objects.filter(pk=layout.pk).values_list("version", flat=True).first()
        return _error(
            "version_conflict",
            "This layout was changed somewhere else. Your changes were NOT saved. "
            "Reload to see the latest version.",
            409,
            current_version=current,
            your_version=clean["version"],
        )
    layout.refresh_from_db()
    return _saved_response(layout, status=200)


@never_cache
@require_POST
@module_access_required()
def layout_delete(request, pk):
    layout = get_object_or_404(permissions.layouts_visible_to(request.user), pk=pk)
    if not permissions.can_delete_layout(request.user, layout):
        raise PermissionDenied
    name = layout.name
    layout.delete()  # Hard delete for now. Retention rules: OPEN_QUESTIONS.md
    messages.success(request, f'Layout "{name}" was deleted.')
    return redirect("sofa_planner:layout_list")
