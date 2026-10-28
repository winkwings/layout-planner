"""URLs for the STANDALONE TEST PROJECT only."""
from django.contrib.auth import views as auth_views
from django.urls import include, path

urlpatterns = [
    # TODO-PORTAL: stand-in for the Portal's central sign-in / sign-out.
    path("accounts/login/", auth_views.LoginView.as_view(), name="login"),
    path("accounts/logout/", auth_views.LogoutView.as_view(), name="logout"),
    # The module. In the Portal, the prefix comes from the central registry.
    path("sofa-planner/", include("sofa_planner.urls")),
]
