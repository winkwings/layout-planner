from django.urls import path

from . import views

# All routes live in their own namespace (rulebook sections 2 and 3).
# Use them as {% url "sofa_planner:layout_list" %}.
app_name = "sofa_planner"

urlpatterns = [
    path("", views.layout_list, name="layout_list"),
    path("new/", views.layout_new, name="layout_new"),
    path("<int:pk>/", views.layout_edit, name="layout_edit"),
    path("save/", views.layout_create, name="layout_create"),
    path("<int:pk>/save/", views.layout_save, name="layout_save"),
    path("<int:pk>/delete/", views.layout_delete, name="layout_delete"),
]
