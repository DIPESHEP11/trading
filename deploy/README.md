# Deployment Configs

Templates for NGINX, Gunicorn, and systemd.

| File | Purpose |
|------|---------|
| `nginx-trading.conf` | NGINX site config – copy to `/etc/nginx/sites-available/` |
| `trading.service` | systemd unit – copy to `/etc/systemd/system/` |
| `deploy.sh` | Post-deploy script for updates |

See [DEPLOYMENT.md](../DEPLOYMENT.md) for the full hosting guide.
