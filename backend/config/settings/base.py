"""
Base Django settings shared across all environments.
"""
from pathlib import Path
from decouple import config
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config('SECRET_KEY', default='change-me-in-production')

DEBUG = False

ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='*', cast=lambda v: [s.strip() for s in v.split(',')])

# ──────────────────────────────────────────────────────────────────────────────
# MULTI-TENANCY (django-tenants)
# ──────────────────────────────────────────────────────────────────────────────
SHARED_APPS = [
    'django_tenants',           # mandatory, must be first
    'apps.tenants',             # contains our Tenant & Domain models

    # standard Django
    'django.contrib.contenttypes',
    'django.contrib.auth',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.admin',

    # 3rd-party (shared across all tenants)
    'rest_framework',
    'corsheaders',
    'apps.users',               # custom user model must be in shared
    'apps.authentication',
]

TENANT_APPS = [
    # Apps that are installed per-tenant (have separate schema tables)
    'django.contrib.contenttypes',
    'apps.core',
    'apps.integrations',
    # Phase 1 — BRD modules (per-tenant data isolation)
    'apps.crm',
    'apps.products',
    'apps.warehouses',
    'apps.orders',
    'apps.invoices',
    'apps.tracking',
    'apps.config',
    'apps.hr',
]

INSTALLED_APPS = list(SHARED_APPS) + [app for app in TENANT_APPS if app not in SHARED_APPS]

TENANT_MODEL = 'tenants.Tenant'
TENANT_DOMAIN_MODEL = 'tenants.Domain'

# ──────────────────────────────────────────────────────────────────────────────
# MIDDLEWARE
# ──────────────────────────────────────────────────────────────────────────────
MIDDLEWARE = [
    'django_tenants.middleware.main.TenantMainMiddleware',  # must be first
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# ──────────────────────────────────────────────────────────────────────────────
# DATABASE  (PostgreSQL required for multi-tenancy)
# ──────────────────────────────────────────────────────────────────────────────
DATABASES = {
    'default': {
        'ENGINE': 'django_tenants.postgresql_backend',
        'NAME': config('DB_NAME', default='traiding_db'),
        'USER': config('DB_USER', default='postgres'),
        'PASSWORD': config('DB_PASSWORD', default='postgres'),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
    }
}

DATABASE_ROUTERS = ('django_tenants.routers.TenantSyncRouter',)

# ──────────────────────────────────────────────────────────────────────────────
# CUSTOM USER MODEL
# ──────────────────────────────────────────────────────────────────────────────
AUTH_USER_MODEL = 'users.User'

# ──────────────────────────────────────────────────────────────────────────────
# REST FRAMEWORK
# ──────────────────────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
    'EXCEPTION_HANDLER': 'apps.core.exceptions.custom_exception_handler',
}

# ──────────────────────────────────────────────────────────────────────────────
# JWT
# ──────────────────────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}

# ──────────────────────────────────────────────────────────────────────────────
# CORS (allow React frontend to call this API)
# ──────────────────────────────────────────────────────────────────────────────
CORS_ALLOW_ALL_ORIGINS = config('CORS_ALLOW_ALL_ORIGINS', default=True, cast=bool)
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:5173,http://localhost:3000',
    cast=lambda v: [s.strip() for s in v.split(',')]
)
CORS_ALLOW_CREDENTIALS = True

# ──────────────────────────────────────────────────────────────────────────────
# STATIC & MEDIA
# ──────────────────────────────────────────────────────────────────────────────
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# ──────────────────────────────────────────────────────────────────────────────
# INTERNATIONALISATION
# ──────────────────────────────────────────────────────────────────────────────
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ──────────────────────────────────────────────────────────────────────────────
# EXTERNAL INTEGRATIONS — loaded from .env
# ──────────────────────────────────────────────────────────────────────────────
META_APP_ID = config('META_APP_ID', default='')
META_APP_SECRET = config('META_APP_SECRET', default='')
META_ACCESS_TOKEN = config('META_ACCESS_TOKEN', default='')

WHATSAPP_PHONE_NUMBER_ID = config('WHATSAPP_PHONE_NUMBER_ID', default='')
WHATSAPP_ACCESS_TOKEN = config('WHATSAPP_ACCESS_TOKEN', default='')
WHATSAPP_VERIFY_TOKEN = config('WHATSAPP_VERIFY_TOKEN', default='whatsapp_verify_token')

# Password reset — base URL for the reset link in emails (client app)
FRONTEND_CLIENT_URL = config('FRONTEND_CLIENT_URL', default='http://localhost:5174')

# Email — used as sender for password reset etc.
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='noreply@traiding.local')
