from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny
from apps.tenants.models import Tenant, Domain
from apps.users.models import User, UserRole
from apps.core.permissions import IsSuperAdmin
from apps.core.responses import success_response, error_response
from .serializers import TenantSerializer, DomainSerializer, RegisterClientSerializer, ClientAdminSerializer, TenantAdminUserSerializer
from django.utils.text import slugify
from django.db import transaction


class TenantDomainsListView(APIView):
    """
    GET /api/v1/tenants/domains/
    Public endpoint (no auth) — returns active tenants with their primary domains.
    Used by the client selector when user visits localhost to choose which client to access.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        qs = Domain.objects.filter(
            tenant__is_active=True,
            is_primary=True,
        ).exclude(tenant__schema_name='public').select_related('tenant').order_by('tenant__name')
        data = [{'domain': d.domain, 'name': d.tenant.name} for d in qs]
        return success_response(data={'clients': data, 'count': len(data)})


class TenantListCreateView(generics.ListCreateAPIView):
    """GET POST /api/v1/tenants/"""
    serializer_class = TenantSerializer
    permission_classes = [IsSuperAdmin]
    queryset = Tenant.objects.all()

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset().exclude(schema_name='public')
        data = TenantSerializer(qs, many=True, context={'request': request}).data
        return success_response(data={'tenants': data, 'count': len(data)})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        tenant = serializer.save()
        domain_name = request.data.get('domain')
        if domain_name:
            Domain.objects.create(domain=domain_name, tenant=tenant, is_primary=True)
        return success_response(
            data=TenantSerializer(tenant, context={'request': request}).data,
            message='Client created successfully.',
            http_status=status.HTTP_201_CREATED
        )


class TenantDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET PUT PATCH DELETE /api/v1/tenants/<id>/"""
    serializer_class = TenantSerializer
    permission_classes = [IsSuperAdmin]
    queryset = Tenant.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def retrieve(self, request, *args, **kwargs):
        return success_response(data=TenantSerializer(self.get_object(), context={'request': request}).data)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(
            self.get_object(), data=request.data, partial=partial, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(data=serializer.data, message='Client updated.')

    def destroy(self, request, *args, **kwargs):
        self.get_object().delete()
        return success_response(message='Client deleted.')


class ClientAdminListView(APIView):
    """
    GET  /api/v1/tenants/admins/  — list all tenant_admin users with their client info
    """
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        users = User.objects.filter(role=UserRole.TENANT_ADMIN).select_related('tenant').order_by('-date_joined')
        data = ClientAdminSerializer(users, many=True).data
        return success_response(data={'admins': data, 'count': len(data)})


class ClientAdminSetPasswordView(APIView):
    """
    POST /api/v1/tenants/admins/<id>/set-password/
    Superadmin sets a new password for a client admin.
    Body: { password: string }
    """
    permission_classes = [IsSuperAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk, role=UserRole.TENANT_ADMIN)
        except User.DoesNotExist:
            return error_response(message='Client admin not found.', http_status=status.HTTP_404_NOT_FOUND)

        password = request.data.get('password')
        if not password or len(str(password).strip()) < 6:
            return error_response(
                message='Password must be at least 6 characters.',
                http_status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(str(password).strip())
        user.save()
        return success_response(message='Password updated. Share it securely with the client admin.')


class ClientAdminDetailView(APIView):
    """
    PATCH  /api/v1/tenants/admins/<id>/  — update first/last name, phone, is_active
    DELETE /api/v1/tenants/admins/<id>/  — delete the user
    """
    permission_classes = [IsSuperAdmin]

    def _get_user(self, pk):
        try:
            return User.objects.get(pk=pk, role=UserRole.TENANT_ADMIN)
        except User.DoesNotExist:
            return None

    def patch(self, request, pk):
        user = self._get_user(pk)
        if not user:
            return error_response(message='Client admin not found.', http_status=status.HTTP_404_NOT_FOUND)
        allowed = {'first_name', 'last_name', 'phone', 'is_active'}
        for field in allowed:
            if field in request.data:
                setattr(user, field, request.data[field])
        # Allow linking / unlinking the admin to a specific tenant
        if 'tenant_id' in request.data:
            tid = request.data.get('tenant_id')
            if tid:
                try:
                    user.tenant = Tenant.objects.get(pk=tid)
                except Tenant.DoesNotExist:
                    return error_response(message='Tenant not found.', http_status=status.HTTP_400_BAD_REQUEST)
            else:
                user.tenant = None
        user.save()
        return success_response(data=ClientAdminSerializer(user).data, message='Admin updated.')

    def delete(self, request, pk):
        user = self._get_user(pk)
        if not user:
            return error_response(message='Client admin not found.', http_status=status.HTTP_404_NOT_FOUND)
        user.delete()
        return success_response(message='Client admin deleted.')


def _normalize_register_data(data):
    """
    FormData sends flat keys like admin.email or admin[email].
    Build nested 'admin' dict and coerce boolean strings for modules.
    Preserves file objects (e.g. logo) by copying references, not dict(data).
    """
    if data is None:
        return {}
    # Build mutable copy without losing file references (QueryDict values are preserved)
    out = {}
    admin = {}
    for key in data.keys():
        if key.startswith('admin.'):
            subkey = key[6:]
            admin[subkey] = data.get(key)
        elif key.startswith('admin[') and ']' in key:
            subkey = key[6:].split(']')[0]  # admin[email] -> email
            admin[subkey] = data.get(key)
        else:
            out[key] = data.get(key)
    if admin:
        out['admin'] = admin
    for field in (
        'module_crm', 'module_products', 'module_stock', 'module_orders',
        'module_warehouse', 'module_invoices', 'module_dispatch',
        'module_tracking', 'module_manufacturing', 'module_hr', 'module_analytics',
    ):
        if field in out and isinstance(out[field], str):
            out[field] = out[field].lower() in ('true', '1', 'yes')
    if 'crm_phone_regex_presets' in out and isinstance(out['crm_phone_regex_presets'], str):
        import json
        try:
            out['crm_phone_regex_presets'] = json.loads(out['crm_phone_regex_presets'])
        except json.JSONDecodeError:
            out['crm_phone_regex_presets'] = []
    return out


class RegisterClientView(APIView):
    """
    POST /api/v1/tenants/register/
    One-shot endpoint: creates Tenant schema, Domain, and admin User atomically.
    """
    permission_classes = [IsSuperAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @transaction.atomic
    def post(self, request):
        data = _normalize_register_data(request.data)
        serializer = RegisterClientSerializer(data=data, context={'request': request})
        if not serializer.is_valid():
            return error_response(
                message='Please check the form and try again.',
                errors=serializer.errors,
                http_status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data
        admin_data = data.pop('admin')
        domain_name = data.pop('domain')
        phone_presets = data.pop('crm_phone_regex_presets', [])

        # 1. Create the tenant (auto-creates schema via django-tenants)
        tenant = Tenant.objects.create(
            schema_name=slugify(data['name']),
            name=data['name'],
            slug=slugify(data['name']),
            subtitle=data.get('subtitle', ''),
            description=data.get('description', ''),
            logo=data.get('logo'),
            contact_email=data.get('contact_email', ''),
            plan=data.get('plan', 'basic'),
            business_model=data.get('business_model', 'b2b'),
            module_crm=data.get('module_crm', True),
            module_products=data.get('module_products', True),
            module_stock=data.get('module_stock', True),
            module_orders=data.get('module_orders', True),
            module_warehouse=data.get('module_warehouse', True),
            module_invoices=data.get('module_invoices', True),
            module_dispatch=data.get('module_dispatch', True),
            module_tracking=data.get('module_tracking', False),
            module_manufacturing=data.get('module_manufacturing', False),
            module_hr=data.get('module_hr', False),
            module_analytics=data.get('module_analytics', True),
            crm_phone_regex_presets=phone_presets,
            is_active=True,
        )

        # 2. Create primary domain
        Domain.objects.create(domain=domain_name, tenant=tenant, is_primary=True)

        # 3. Create the admin user in public schema
        if User.objects.filter(email=admin_data['email']).exists():
            return error_response(
                message=f"A user with email {admin_data['email']} already exists.",
                http_status=status.HTTP_400_BAD_REQUEST
            )
        admin_user = User.objects.create_user(
            email=admin_data['email'],
            password=admin_data['password'],
            first_name=admin_data.get('first_name', ''),
            last_name=admin_data.get('last_name', ''),
            phone=admin_data.get('phone', ''),
            role=UserRole.TENANT_ADMIN,
            tenant=tenant,
        )

        return success_response(
            data={
                'tenant': TenantSerializer(tenant, context={'request': request}).data,
                'admin_user': {
                    'id': admin_user.id,
                    'email': admin_user.email,
                    'full_name': admin_user.full_name,
                    'role': admin_user.role,
                },
                'domain': domain_name,
            },
            message=f'Client "{tenant.name}" registered successfully.',
            http_status=status.HTTP_201_CREATED,
        )


class AssignAdminToTenantView(APIView):
    """
    POST /api/v1/tenants/<tenant_id>/assign-admin/
    Assign a new client admin user to an existing tenant (superadmin only).
    Body: { email, first_name, last_name?, phone?, password }
    """
    permission_classes = [IsSuperAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, tenant_id):
        try:
            tenant = Tenant.objects.get(pk=tenant_id)
        except Tenant.DoesNotExist:
            return error_response(message='Client not found.', http_status=status.HTTP_404_NOT_FOUND)
        if tenant.schema_name == 'public':
            return error_response(message='Cannot assign admin to public schema.', http_status=status.HTTP_400_BAD_REQUEST)
        # Multipart form uses QueryDict — it is NOT isinstance(..., dict), so we must still flatten admin.* keys.
        raw = request.data
        if any(str(k).startswith(('admin.', 'admin[')) for k in raw.keys()):
            normalized = _normalize_register_data(raw)
            data = normalized.get('admin') or {}
        else:
            data = raw
        serializer = TenantAdminUserSerializer(data=data)
        if not serializer.is_valid():
            return error_response(
                message='Please check the form and try again.',
                errors=serializer.errors,
                http_status=status.HTTP_400_BAD_REQUEST,
            )
        admin_data = serializer.validated_data
        if User.objects.filter(email=admin_data['email']).exists():
            return error_response(
                message=f"A user with email {admin_data['email']} already exists.",
                http_status=status.HTTP_400_BAD_REQUEST,
            )
        admin_user = User.objects.create_user(
            email=admin_data['email'],
            password=admin_data['password'],
            first_name=admin_data.get('first_name', ''),
            last_name=admin_data.get('last_name', ''),
            phone=admin_data.get('phone', ''),
            role=UserRole.TENANT_ADMIN,
            tenant=tenant,
        )
        return success_response(
            data={
                'tenant': TenantSerializer(tenant, context={'request': request}).data,
                'admin_user': {
                    'id': admin_user.id,
                    'email': admin_user.email,
                    'full_name': admin_user.full_name,
                    'role': admin_user.role,
                },
            },
            message=f'Admin assigned to "{tenant.name}" successfully.',
            http_status=status.HTTP_201_CREATED,
        )
