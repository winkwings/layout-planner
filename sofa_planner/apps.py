from django.apps import AppConfig


class SofaPlannerConfig(AppConfig):
    # Stable module identifier (rulebook section 2). Do not rename later:
    # database tables, permissions and URL names all depend on it.
    name = "sofa_planner"
    label = "sofa_planner"
    verbose_name = "Sofa Planner"
    default_auto_field = "django.db.models.BigAutoField"
