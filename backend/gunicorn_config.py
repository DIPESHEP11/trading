"""
Gunicorn configuration for production deployment.
Usage: gunicorn config.wsgi:application -c gunicorn_config.py
"""
import multiprocessing
import os

bind = "127.0.0.1:8000"
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
worker_connections = 1000
timeout = 30
keepalive = 2

# Django settings
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")

# Logging (optional - comment out if not using /var/log/gunicorn)
# accesslog = "/var/log/gunicorn/traiding-access.log"
# errorlog = "/var/log/gunicorn/traiding-error.log"
loglevel = "info"

proc_name = "traiding"
