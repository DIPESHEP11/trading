from .base import *

DEBUG = True

ALLOWED_HOSTS = ['*']

# django-tenants: API calls use Host: 127.0.0.1:8000 or localhost:8000. If no Domain row exists for
# that hostname, fall back to public schema so /api/v1/auth/* still works (avoids broken responses + CORS errors).
SHOW_PUBLIC_IF_NO_TENANT_FOUND = True

# CORS — explicit dev origins (required when CORS_ALLOW_CREDENTIALS=True; do not rely on ALLOW_ALL alone)
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
]
CORS_ALLOWED_ORIGIN_REGEXES = [
    r'^http://localhost:\d+$',
    r'^http://127\.0\.0\.1:\d+$',
    # Tenant dev hosts (e.g. saypal.localhost:5174) — django-tenants Domain rows
    r'^http://[a-zA-Z0-9_.-]+\.localhost:\d+$',
]

# Development: show detailed errors
INSTALLED_APPS += ['debug_toolbar']

MIDDLEWARE = ['debug_toolbar.middleware.DebugToolbarMiddleware'] + MIDDLEWARE

INTERNAL_IPS = ['127.0.0.1']

# Use console email backend in development  
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
