from rest_framework import serializers
from apps.tenants.models import Tenant, Domain
from apps.users.models import User, UserRole
from django.utils.text import slugify


class TenantSerializer(serializers.ModelSerializer):
    domain = serializers.SerializerMethodField(read_only=True)
    update_domain = serializers.CharField(write_only=True, required=False, allow_blank=True)
    logo_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Tenant
        fields = [
            'id', 'name', 'slug', 'subtitle', 'description', 'logo', 'logo_url',
            'contact_email', 'theme_color', 'use_default_theme', 'plan', 'business_model', 'is_active',
            'module_crm', 'module_products', 'module_stock', 'module_orders',
            'module_warehouse', 'module_invoices', 'module_dispatch',
            'module_tracking', 'module_manufacturing', 'module_hr', 'module_analytics',
            'crm_phone_regex_presets', 'created_on', 'domain', 'update_domain',
        ]
        read_only_fields = ['id', 'slug', 'created_on', 'logo_url']
        extra_kwargs = {'logo': {'write_only': True, 'required': False}}

    def get_domain(self, obj):
        domain_obj = obj.domains.filter(is_primary=True).first()
        return domain_obj.domain if domain_obj else ''

    def get_logo_url(self, obj):
        request = self.context.get('request')
        if obj.logo and request:
            return request.build_absolute_uri(obj.logo.url)
        return None

    def validate_name(self, value):
        slug = slugify(value)
        qs = Tenant.objects.filter(slug=slug)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('A client with this name already exists.')
        return value

    def create(self, validated_data):
        validated_data.pop('update_domain', None)
        validated_data['slug'] = slugify(validated_data['name'])
        return super().create(validated_data)

    def update(self, instance, validated_data):
        domain_name = validated_data.pop('update_domain', None)
        instance = super().update(instance, validated_data)

        # Sync any changed module flags into the tenant's own TenantConfig schema,
        # because the client dashboard reads from TenantConfig (not Tenant).
        MODULE_FIELDS = [
            'module_crm', 'module_products', 'module_stock', 'module_orders',
            'module_warehouse', 'module_invoices', 'module_dispatch',
            'module_tracking', 'module_manufacturing', 'module_hr', 'module_analytics',
        ]
        SYNCED_FIELDS = MODULE_FIELDS + ['theme_color', 'use_default_theme']
        updated_sync_fields = {f: validated_data[f] for f in SYNCED_FIELDS if f in validated_data}
        if updated_sync_fields:
            from django_tenants.utils import schema_context
            from apps.config.models import TenantConfig
            with schema_context(instance.schema_name):
                config, _ = TenantConfig.objects.get_or_create(tenant=instance)
                for field, value in updated_sync_fields.items():
                    setattr(config, field, value)
                config.save()

        if domain_name is not None:
            domain_obj = instance.domains.filter(is_primary=True).first()
            if domain_obj:
                domain_obj.domain = domain_name
                domain_obj.save()
            else:
                from apps.tenants.models import Domain
                Domain.objects.create(domain=domain_name, tenant=instance, is_primary=True)
        return instance


class TenantAdminUserSerializer(serializers.Serializer):
    """Embedded admin user to create alongside the tenant."""
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100, required=False, default='')
    phone = serializers.CharField(max_length=20, required=False, default='')
    password = serializers.CharField(min_length=6, write_only=True)


class RegisterClientSerializer(serializers.Serializer):
    """
    Full one-shot client registration payload.
    Carries brand info, module flags, business model, domain, and admin user.
    """
    # Brand
    name = serializers.CharField(max_length=200)
    subtitle = serializers.CharField(max_length=300, required=False, allow_blank=True, default='')
    description = serializers.CharField(required=False, allow_blank=True, default='')
    logo = serializers.ImageField(required=False, allow_null=True)
    contact_email = serializers.EmailField(required=False, allow_blank=True, default='')
    theme_color = serializers.CharField(max_length=20, required=False, default='#0f172a')
    use_default_theme = serializers.BooleanField(required=False, default=True)

    # Plan & Business Model — accepts any slug (plans are managed dynamically)
    plan = serializers.CharField(max_length=50, required=False, allow_blank=True, default='')
    business_model = serializers.ChoiceField(
        choices=['b2b', 'b2c', 'd2c', 'hybrid', 'marketplace', 'saas', 'services', 'other'],
        default='b2b',
    )

    # Modules
    module_crm = serializers.BooleanField(default=True)
    module_products = serializers.BooleanField(default=True)
    module_stock = serializers.BooleanField(default=True)
    module_orders = serializers.BooleanField(default=True)
    module_warehouse = serializers.BooleanField(default=True)
    module_invoices = serializers.BooleanField(default=True)
    module_dispatch = serializers.BooleanField(default=True)
    module_tracking = serializers.BooleanField(default=False)
    module_manufacturing = serializers.BooleanField(default=False)
    module_hr = serializers.BooleanField(default=False)
    module_analytics = serializers.BooleanField(default=True)

    # Domain
    domain = serializers.CharField(required=False, allow_blank=True, default='')

    # Admin user
    admin = TenantAdminUserSerializer()

    crm_phone_regex_presets = serializers.JSONField(required=False, default=list)

    def validate_crm_phone_regex_presets(self, val):
        if val is None:
            return []
        if not isinstance(val, list):
            raise serializers.ValidationError('Expected a JSON array of presets.')
        out = []
        for item in val[:25]:
            if not isinstance(item, dict):
                continue
            pattern = str(item.get('pattern', '')).strip()
            if not pattern:
                continue
            label = str(item.get('label', '')).strip()
            pid = str(item.get('id', '')).strip()
            if not pid:
                pid = slugify(label)[:50] or f'preset_{len(out)}'
            out.append({'id': pid, 'label': label or pid, 'pattern': pattern})
        return out

    def validate(self, attrs):
        if not attrs.get('domain'):
            attrs['domain'] = slugify(attrs['name']) + '.localhost'
        return attrs

    def validate_name(self, value):
        if Tenant.objects.filter(slug=slugify(value)).exists():
            raise serializers.ValidationError('A client with this name already exists.')
        return value


class ClientAdminSerializer(serializers.ModelSerializer):
    """Read serializer for tenant admin users — includes the linked client name."""
    client_name = serializers.SerializerMethodField()
    client_id = serializers.SerializerMethodField()
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'phone', 'is_active', 'date_joined',
            'client_id', 'client_name',
        ]
        read_only_fields = ['id', 'email', 'date_joined', 'full_name', 'client_id', 'client_name']

    def get_client_name(self, obj):
        return obj.tenant.name if obj.tenant_id else '—'

    def get_client_id(self, obj):
        return obj.tenant_id


class DomainSerializer(serializers.ModelSerializer):
    class Meta:
        model = Domain
        fields = ['id', 'domain', 'tenant', 'is_primary']
