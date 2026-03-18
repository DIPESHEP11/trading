import os

import django
 
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

django.setup()
 
from apps.tenants.models import Tenant, Domain

from apps.users.models import User

from django.utils import timezone
 
# ✅ Ensure public tenant exists

tenant, created = Tenant.objects.get_or_create(

    schema_name='public',

    defaults={

        'name': 'Public Tenant',

        'is_active': True,

        'paid_until': timezone.now().date(),

        'on_trial': True

    }

)
 
if created:

    tenant.save()
 
# ✅ Attach main domain

domain, created = Domain.objects.get_or_create(

    domain='trading.zitrapps.com',

    defaults={

        'tenant': tenant,

        'is_primary': True

    }

)
 
# ✅ Create superuser (safe)

if not User.objects.filter(email='superadmin@example.com').exists():

    User.objects.create_superuser(

        email='superadmin@example.com',

        password='admin'

    )

    print("Created superadmin@example.com / admin")
 