from .base import *
import sentry_sdk
from decouple import config

DEBUG = False

# Central API hostname (e.g. trading.zitrapps.com) should have a Domain row, or we fall back to
# public schema routing so /api/ keeps working and CORS preflight is not lost on tenant 404.
SHOW_PUBLIC_IF_NO_TENANT_FOUND = True
PUBLIC_SCHEMA_URLCONF = ROOT_URLCONF

# ✅ Hosts (IMPORTANT for tenants)
ALLOWED_HOSTS = [
    # "*",
    'trade.zitrapps.com', 
    'www.trade.zitrapps.com', 
    'trading.zitrapps.com',
    '127.0.0.1', 
    'localhost',
    '*.trade.zitrapps.com', 

]

# ✅ Frontend domain
FRONTEND_CLIENT_URL = "https://trade.zitrapps.com"

# ✅ CORS (frontend on *.trade.zitrapps.com → API on trading.zitrapps.com)
# Cannot use Access-Control-Allow-Origin: * with credentials; use an explicit allow-list + regex.
CORS_ALLOW_ALL_ORIGINS = False

CORS_ALLOWED_ORIGINS = [
    'https://trade.zitrapps.com',
    'https://www.trade.zitrapps.com',
    'https://trading.zitrapps.com',
]

# Tenant client sites (e.g. https://aaaa.trade.zitrapps.com)
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://[a-z0-9-]+\.trade\.zitrapps\.com$",
]

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'authorization',
    'content-type',
    'origin',
    'x-requested-with',
]

CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

# ✅ CSRF (Django does not expand wildcards; use regex via customisation or list real hosts)
CSRF_TRUSTED_ORIGINS = [
    'https://trade.zitrapps.com',
    'https://www.trade.zitrapps.com',
    'https://trading.zitrapps.com',
]

# ✅ Security
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True

# ✅ Required for Nginx reverse proxy
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True

# ✅ Static files
STATIC_ROOT = "/home/omadmin/hef/trading/backend/static/"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# Insert WhiteNoise AFTER SecurityMiddleware (index 2 in base list)
# but NEVER before CorsMiddleware, to avoid breaking CORS preflight.
MIDDLEWARE.insert(
    MIDDLEWARE.index('django.middleware.security.SecurityMiddleware') + 1,
    'whitenoise.middleware.WhiteNoiseMiddleware',
)

# ✅ Sentry
SENTRY_DSN = config("SENTRY_DSN", default="")
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        traces_sample_rate=0.2,
    )