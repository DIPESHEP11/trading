from .base import *
import sentry_sdk

DEBUG = False

# Production domain: trading.zitrapps.com
ALLOWED_HOSTS = config(
    'ALLOWED_HOSTS',
    default='trading.zitrapps.com,www.trading.zitrapps.com',
    cast=lambda v: [s.strip() for s in v.split(',')]
)
CSRF_TRUSTED_ORIGINS = config(
    'CSRF_TRUSTED_ORIGINS',
    default='https://trading.zitrapps.com,https://www.trading.zitrapps.com',
    cast=lambda v: [s.strip() for s in v.split(',')]
)
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='https://trading.zitrapps.com,https://www.trading.zitrapps.com',
    cast=lambda v: [s.strip() for s in v.split(',')]
)
FRONTEND_CLIENT_URL = config('FRONTEND_CLIENT_URL', default='https://trading.zitrapps.com')

CORS_ALLOW_ALL_ORIGINS = False

# Security headers
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True

# Whitenoise for serving static files
MIDDLEWARE = ['whitenoise.middleware.WhiteNoiseMiddleware'] + MIDDLEWARE
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Sentry error tracking
SENTRY_DSN = config('SENTRY_DSN', default='')
if SENTRY_DSN:
    sentry_sdk.init(dsn=SENTRY_DSN, traces_sample_rate=0.2)
