# Deployment Guide: Trading (NGINX + Gunicorn + React)

This guide covers deploying the **backend** (Django + Gunicorn) and **frontend** (React/Vite) on a Linux server using NGINX as a reverse proxy.

**Production domain:** `trading.zitrapps.com`

---

## Architecture Overview

```
                    ┌─────────────────────────────────────────┐
                    │              NGINX (port 80/443)         │
                    │  - SSL termination                      │
                    │  - /api/*  → Gunicorn (127.0.0.1:8000)   │
                    │  - /static/*, /media/* → local files    │
                    │  - /*      → Frontend (React build)      │
                    └─────────────────────────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    │                                       │
                    ▼                                       ▼
            ┌───────────────┐                       ┌───────────────┐
            │   Gunicorn   │                       │  Static files │
            │  (Django)    │                       │  (dist/)     │
            │  :8000       │                       │  /static/     │
            └───────┬──────┘                       │  /media/      │
                    │                              └───────────────┘
                    ▼
            ┌───────────────┐
            │  PostgreSQL   │
            │  (django-tenants)
            └───────────────┘
```

---

## Prerequisites

- **Ubuntu 22.04 / Debian 12** (or similar Linux)
- **Root or sudo** access
- **Domain** `trading.zitrapps.com` pointing to your server IP (A record)
- **SSL certificate** (Let's Encrypt via Certbot)

---

## 1. Server Setup

### 1.1 Install system packages

```bash
sudo apt update
sudo apt install -y python3.11 python3.11-venv python3-pip nginx postgresql postgresql-contrib nodejs npm certbot python3-certbot-nginx
```

### 1.2 Create project directory

```bash
sudo mkdir -p /var/www/trading
sudo chown $USER:$USER /var/www/trading
cd /var/www/trading
```

---

## 2. PostgreSQL Database

### 2.1 Create database and user

```bash
sudo -u postgres psql
```

```sql
CREATE USER trading_user WITH PASSWORD 'your_secure_password';
CREATE DATABASE trading_db OWNER trading_user;
\q
```

### 2.2 PostgreSQL config (for django-tenants)

```bash
sudo nano /etc/postgresql/*/main/postgresql.conf
```

Ensure `shared_preload_libraries` includes `pg_trgm` if needed. For django-tenants, standard PostgreSQL is fine.

---

## 3. Backend Deployment

### 3.1 Create virtual environment and install dependencies

```bash
cd /var/www/trading
git clone <your-repo-url> .
# or: rsync your repo files here

cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements/production.txt
```

### 3.2 Environment variables

Create `/var/www/trading/backend/.env`:

```env
# Django
SECRET_KEY=your-very-long-random-secret-key
DJANGO_SETTINGS_MODULE=config.settings.production

# Database
DB_NAME=trading_db
DB_USER=trading_user
DB_PASSWORD=your_secure_password
DB_HOST=localhost
DB_PORT=5432

# Production (trading.zitrapps.com)
ALLOWED_HOSTS=trading.zitrapps.com,www.trading.zitrapps.com
CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=https://trading.zitrapps.com,https://www.trading.zitrapps.com
FRONTEND_CLIENT_URL=https://trading.zitrapps.com

# Optional: Sentry
SENTRY_DSN=
```

### 3.3 Run migrations

```bash
cd /var/www/trading/backend
source venv/bin/activate
python manage.py migrate_schemas
python manage.py collectstatic --noinput
```

### 3.4 Create superuser (optional)

```bash
python manage.py createsuperuser
```

---

## 4. Gunicorn Configuration

### 4.1 Create Gunicorn config file

Create `/var/www/trading/backend/gunicorn_config.py`:

```python
# gunicorn_config.py
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

# Logging
accesslog = "/var/log/gunicorn/trading-access.log"
errorlog = "/var/log/gunicorn/trading-error.log"
loglevel = "info"

# Process naming
proc_name = "trading"
```

### 4.2 Create log directory

```bash
sudo mkdir -p /var/log/gunicorn
sudo chown $USER:$USER /var/log/gunicorn
```

### 4.3 Systemd service

A template is provided at `deploy/trading.service`. Copy and enable:

```bash
sudo cp /var/www/trading/deploy/trading.service /etc/systemd/system/
```

Or create `/etc/systemd/system/trading.service` manually:

```ini
[Unit]
Description=Trading Gunicorn daemon
After=network.target postgresql.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/trading/backend
ExecStart=/var/www/trading/backend/venv/bin/gunicorn config.wsgi:application -c gunicorn_config.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Note:** Replace `user` with your actual deploy user if different. Ensure that user owns `/var/www/trading`.

```bash
sudo systemctl daemon-reload
sudo systemctl enable trading
sudo systemctl start trading
sudo systemctl status trading
```

---

## 5. Frontend Build

### 5.1 Build for production

```bash
cd /var/www/trading/frontend/client
npm ci
VITE_API_BASE_URL=/api/v1 npm run build
```

This creates `dist/` with static files. The relative URL `/api/v1` ensures API calls go to the same domain (NGINX will proxy them).

### 5.2 Copy build to NGINX location

```bash
sudo mkdir -p /var/www/trading/static/frontend
sudo cp -r /var/www/trading/frontend/client/dist/* /var/www/trading/static/frontend/
```

---

## 6. NGINX Configuration

### 6.1 Create site config

A template is at `deploy/nginx-trading.conf`. Copy and edit:

```bash
sudo cp /var/www/trading/deploy/nginx-trading.conf /etc/nginx/sites-available/trading
# Config is pre-set for trading.zitrapps.com
```

Or create `/etc/nginx/sites-available/trading` manually:

```nginx
# Upstream for Gunicorn
upstream trading_backend {
    server 127.0.0.1:8000 fail_timeout=0;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com app.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com app.yourdomain.com;

    # SSL (Let's Encrypt - Certbot will add these)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Logs
    access_log /var/log/nginx/trading-access.log;
    error_log /var/log/nginx/trading-error.log;

    # Max upload size (for file uploads)
    client_max_body_size 20M;

    # API → Gunicorn
    location /api/ {
        proxy_pass http://trading_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Django admin static
    location /static/ {
        alias /var/www/trading/backend/staticfiles/;
    }

    # Media files (uploads)
    location /media/ {
        alias /var/www/trading/backend/media/;
    }

    # Frontend (React SPA)
    location / {
        root /var/www/trading/static/frontend;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
```

### 6.2 Enable site and SSL

```bash
sudo ln -s /etc/nginx/sites-available/trading /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6.3 SSL with Let's Encrypt (Certbot)

```bash
# First, use a temporary HTTP-only config for the initial cert
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d app.yourdomain.com
```

Certbot will modify your NGINX config automatically. After that, ensure your config still has the correct `location` blocks.

---

## 7. Media & Static Directories

```bash
sudo mkdir -p /var/www/trading/backend/media
sudo chown -R www-data:www-data /var/www/trading
# Or your deploy user
```

---

## 8. Deployment Checklist

| Step | Command |
|------|---------|
| Backend deps | `pip install -r requirements/production.txt` |
| Migrations | `python manage.py migrate_schemas` |
| Collect static | `python manage.py collectstatic --noinput` |
| Frontend build | `VITE_API_BASE_URL=/api/v1 npm run build` |
| Copy frontend | `cp -r frontend/client/dist/* static/frontend/` |
| Restart Gunicorn | `sudo systemctl restart trading` |
| Reload NGINX | `sudo systemctl reload nginx` |

---

## 9. Multi-Tenancy (django-tenants)

Your app uses **django-tenants**. Each tenant has its own subdomain or domain:

- **Public schema:** `trading.zitrapps.com` (admin, tenant management)
- **Tenant schemas:** `tenant1.trading.zitrapps.com`, etc. (if using subdomains)

Ensure:

1. **ALLOWED_HOSTS** includes all tenant subdomains: `*.trading.zitrapps.com` or list each explicitly.
2. **CORS_ALLOWED_ORIGINS** includes tenant URLs.
3. **DNS:** Add wildcard `*.trading.zitrapps.com` or individual A records for each tenant.

---

## 10. Troubleshooting

### Gunicorn not starting

```bash
sudo journalctl -u trading -f
```

### NGINX 502 Bad Gateway

- Check Gunicorn is running: `curl http://127.0.0.1:8000/api/v1/`
- Check permissions on `/var/www/trading`

### Frontend shows 404 on refresh

- Ensure `try_files $uri $uri/ /index.html;` is in the `location /` block.

### API CORS errors

- Set `CORS_ALLOWED_ORIGINS` in `.env` to your exact frontend URLs (including `https://`).

### Static files 404

- Run `python manage.py collectstatic --noinput`
- Ensure NGINX `alias` paths match `/var/www/trading/backend/staticfiles/`

---

## 11. Quick Deploy Script (Optional)

Create `deploy.sh` in project root:

```bash
#!/bin/bash
set -e
cd /var/www/trading
git pull
cd backend && source venv/bin/activate
pip install -r requirements/production.txt
python manage.py migrate_schemas
python manage.py collectstatic --noinput
sudo systemctl restart trading
cd ../frontend/client && npm ci && VITE_API_BASE_URL=/api/v1 npm run build
sudo cp -r dist/* /var/www/trading/static/frontend/
echo "Deployment complete."
```

---

## 12. Security Notes

- Use strong `SECRET_KEY` and `DB_PASSWORD`
- Keep `DEBUG=False` in production
- Restrict `ALLOWED_HOSTS` to your domains
- Use HTTPS only
- Consider firewall: `ufw allow 80,443 && ufw enable`
