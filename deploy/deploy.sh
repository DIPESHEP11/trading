#!/bin/bash
# Deployment script for Trading
# Run from project root: ./deploy/deploy.sh
# Or: bash deploy/deploy.sh
# Set PROJECT_ROOT if deploying elsewhere:
#   PROJECT_ROOT=/var/www/trading ./deploy/deploy.sh

set -e

PROJECT_ROOT="${PROJECT_ROOT:-/var/www/trading}"
cd "$PROJECT_ROOT"

echo "Deploying Trading..."

# Backend
cd "$PROJECT_ROOT/backend"
source venv/bin/activate
pip install -r requirements/production.txt --quiet
python manage.py migrate_schemas
python manage.py collectstatic --noinput
sudo systemctl restart trading

# Frontend
cd "$PROJECT_ROOT/frontend/client"
npm ci
VITE_API_BASE_URL=/api/v1 npm run build
sudo cp -r dist/* "$PROJECT_ROOT/static/frontend/"

echo "Deployment complete."
