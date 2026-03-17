import os
import sys
import django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.tenants.models import Tenant
from apps.config.models import TenantConfig

tenant = Tenant.objects.get(slug="happy-kid")
config = TenantConfig.objects.filter(tenant=tenant).first()
if config:
    print("description in config:", getattr(config, 'description', 'NO DESCRIPTION ATTR'))
    print("description in tenant:", getattr(tenant, 'description', 'NO DESCRIPTION ATTR'))
else:
    print("no config")

