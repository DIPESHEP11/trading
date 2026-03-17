import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.tenants.models import Tenant, Domain
from apps.users.models import User
from django.db import connection

tenant, created = Tenant.objects.get_or_create(
    schema_name='public',
    defaults={'name': 'Public Tenant', 'is_active': True}
)
if created:
    tenant.save()

domain, created = Domain.objects.get_or_create(
    domain='localhost',
    tenant=tenant,
    is_primary=True
)

if not User.objects.filter(email='superadmin@example.com').exists():
    User.objects.create_superuser('superadmin@example.com', 'admin')
    print("Created superadmin@example.com / admin")

