"""
Settings for the STANDALONE TEST PROJECT only.

This is NOT the Levida Portal. It exists so the sofa_planner module can run
and be tested locally. In the real Portal, the module is added to the
Portal's own settings instead (see SHARED_PLATFORM_CHANGES.md).
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Environment-specific values come from environment variables, not source code.
# The fallback key is for local testing only. Never use it on a server.
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "local-test-only-not-secret")
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = ["127.0.0.1", "localhost", "testserver"]

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "sofa_planner",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # Test-only strict CSP, so inline scripts/styles fail here like they would
    # in the Portal. TODO-PORTAL: the real Portal has its own CSP.
    "test_project.middleware.StrictCSPMiddleware",
]

ROOT_URLCONF = "test_project.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "test_project" / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "test_project.wsgi.application"

# SQLite for local development (rulebook section 1).
# Optional MySQL/Percona switch for compatibility testing. NOT tested yet.
if os.environ.get("DB_ENGINE") == "mysql":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.mysql",
            "NAME": os.environ.get("DB_NAME", "sofa_planner_test"),
            "USER": os.environ.get("DB_USER", ""),
            "PASSWORD": os.environ.get("DB_PASSWORD", ""),
            "HOST": os.environ.get("DB_HOST", "127.0.0.1"),
            "PORT": os.environ.get("DB_PORT", "3306"),
            "OPTIONS": {"charset": "utf8mb4"},
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_PASSWORD_VALIDATORS = []  # Test project only: synthetic users with simple passwords.

LANGUAGE_CODE = "en"  # Product interface is English (rulebook section 7).
TIME_ZONE = "America/Toronto"  # Operational timezone (rulebook section 12).
USE_I18N = True
USE_TZ = True  # Store timezone-aware datetimes.

STATIC_URL = "static/"
STATICFILES_DIRS = [BASE_DIR / "test_project" / "static"]

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# TODO-PORTAL: the real Portal owns the central sign-in flow.
LOGIN_URL = "login"
LOGIN_REDIRECT_URL = "sofa_planner:layout_list"
LOGOUT_REDIRECT_URL = "login"
