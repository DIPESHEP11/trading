from .base import *
import sentry_sdk
from decouple import config

DEBUG = False

# ✅ Hosts (IMPORTANT for tenants)
ALLOWED_HOSTS = [
    "*",
]

# ✅ Frontend domain
FRONTEND_CLIENT_URL = "https://trading.zitrapps.com"

# ✅ CORS (frontend → backend)
CORS_ALLOW_ALL_ORIGINS = False

CORS_ALLOWED_ORIGINS = [
    "*",
]

# ✅ Allow all tenant subdomains
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://.*\.trading\.zitrapps\.com$",
]

# ✅ CSRF
CSRF_TRUSTED_ORIGINS = [
    "https://trading.zitrapps.com",
    "https://*.trading.zitrapps.com",
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

MIDDLEWARE = ["whitenoise.middleware.WhiteNoiseMiddleware"] + MIDDLEWARE

# ✅ Sentry
SENTRY_DSN = config("SENTRY_DSN", default="")
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        traces_sample_rate=0.2,
    )