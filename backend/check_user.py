import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.tenants.models import Tenant
from apps.users.models import User
from django.db import connection

print("Checking public schema...")
try:
    user = User.objects.get(email__iexact='abishek@gmail.com')
    user.set_password('12345678')
    user.save()
    print(f"Updated password in public schema: User ID {user.id}, is_superuser: {user.is_superuser}")
except User.DoesNotExist:
    pass

for tenant in Tenant.objects.exclude(schema_name='public'):
    try:
        connection.set_schema(tenant.schema_name)
    except:
        continue
    try:
        user = User.objects.get(email__iexact='abishek@gmail.com')
        user.set_password('12345678')
        user.save()
        print(f"Updated password in schema '{tenant.schema_name}': User ID {user.id}")
    except User.DoesNotExist:
        pass
    except Exception as e:
        print(f"Error in schema '{tenant.schema_name}': {e}")
