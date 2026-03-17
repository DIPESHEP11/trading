from .base import *

DEBUG = True

ALLOWED_HOSTS = ['*']

# Development: show detailed errors
INSTALLED_APPS += ['debug_toolbar']

MIDDLEWARE = ['debug_toolbar.middleware.DebugToolbarMiddleware'] + MIDDLEWARE

INTERNAL_IPS = ['127.0.0.1']

# Use console email backend in development  
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
