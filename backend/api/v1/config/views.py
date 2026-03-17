from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from apps.config.models import TenantConfig
from apps.core.responses import success_response, error_response
from apps.core.permissions import IsTenantAdmin
from .serializers import TenantConfigSerializer
from django.db import connection
from django.db.utils import OperationalError, ProgrammingError


class TenantConfigView(APIView):
    """
    GET  /api/v1/tenant/config/ — Flutter mobile app reads this on login
    PUT  /api/v1/tenant/config/ — Tenant admin updates modules + branding
    """

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsTenantAdmin()]

    def _get_or_create_config(self):
        tenant = getattr(connection, 'tenant', None)
        if tenant is None:
            raise ValueError(
                'Tenant not identified. Ensure the request is made using your tenant domain '
                '(e.g. happy-kid-.localhost in development) so the API can load your settings.'
            )
        config, created = TenantConfig.objects.get_or_create(tenant=tenant)
        # On first creation, copy module flags from the Tenant model
        # (the Tenant model is the source of truth set by the superadmin).
        if created:
            MODULE_FIELDS = [
                'module_crm', 'module_products', 'module_stock', 'module_orders',
                'module_warehouse', 'module_invoices', 'module_dispatch',
                'module_tracking', 'module_manufacturing', 'module_hr', 'module_analytics',
            ]
            for field in MODULE_FIELDS:
                if hasattr(tenant, field):
                    setattr(config, field, getattr(tenant, field))
            config.save()
        return config, tenant

    def get(self, request):
        try:
            config, tenant = self._get_or_create_config()
            return success_response(data={
                'tenant_id': tenant.id,
                **config.as_dict()
            })
        except ValueError as e:
            return error_response(str(e), http_status=400)
        except (OperationalError, ProgrammingError) as e:
            err = str(e)
            if 'company_rules' in err or 'custom_fields' in err or 'does not exist' in err:
                return error_response(
                    'Settings database schema is outdated. Run: python manage.py migrate_schemas',
                    http_status=503
                )
            return error_response(err, http_status=503)
        except Exception as e:
            return error_response(str(e), http_status=500)

    def put(self, request):
        try:
            config, tenant = self._get_or_create_config()
        except ValueError as e:
            return error_response(str(e), http_status=400)
        except (OperationalError, ProgrammingError) as e:
            err = str(e)
            if 'company_rules' in err or 'custom_fields' in err or 'does not exist' in err:
                return error_response(
                    'Settings database schema is outdated. Run: python manage.py migrate_schemas',
                    http_status=503
                )
            return error_response(err, http_status=503)

        data = request.data.copy()

        # Profile fields: company_name -> config override; rest -> tenant (remove from data so serializer doesn't see them)
        if 'company_name' in data:
            config.company_name_override = (data.pop('company_name') or '')[:200]
        for key in ('subtitle', 'description', 'contact_email'):
            if key in data:
                value = data.pop(key)
                if hasattr(tenant, key):
                    setattr(tenant, key, value if value is not None else '')
        tenant.save()

        serializer = TenantConfigSerializer(config, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        from apps.config.utils import log_module_history
        log_module_history(request, 'settings', 'settings_change', 'Tenant configuration updated', 'tenant_config', str(config.pk), {})
        return success_response(data=config.as_dict(), message='Configuration updated.')
