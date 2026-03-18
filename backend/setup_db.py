import os


=======
# Setup Django environment

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

django.setup()
 
from apps.tenants.models import Tenant, Domain

from apps.users.models import User

from django.utils import timezone
 
# ✅ Ensure public tenant exists

print("Starting tenant initialization...")

# Create or get the public tenant
tenant, created = Tenant.objects.get_or_create(

    schema_name='public',

 
if created:

    tenant.save()
 
# ✅ Attach main domain
    defaults={
        'name': 'Public Tenant',
        'is_active': True
    }
)

if created:
    print("Public tenant created")
else:
    print("Public tenant already exists")

# Make sure we are using public schema
connection.set_schema_to_public()


# Create or get the main domain
domain, created = Domain.objects.get_or_create(

    domain='trading.zitrapps.com',   # tenant entry domain
    defaults={
        'tenant': tenant,
        'is_primary': True
    }
)
 
# ✅ Create superuser (safe)


if created:
    print("Domain created: trading.zitrapps.com")
else:
    print("Domain already exists")

# Create superuser if not exists
email = "superadmin@example.com"
password = "admin"

if not User.objects.filter(email=email).exists():
    User.objects.create_superuser(
        email=email,
        password=password
    )
    print(f"Superuser created: {email} / {password}")
else:
    print("Superuser already exists")

print("Tenant initialization completed successfully")

