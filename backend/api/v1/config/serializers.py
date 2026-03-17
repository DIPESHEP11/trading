from rest_framework import serializers
from apps.config.models import TenantConfig


class TenantConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = TenantConfig
        exclude = ['tenant']
        read_only_fields = ['id', 'created_at', 'updated_at']


class TenantConfigPublicSerializer(serializers.Serializer):
    """
    Flutter-ready response for GET /api/v1/tenant/config/
    Returns the full module config dict as expected by the mobile app.
    """
    tenant_id = serializers.IntegerField()
    company_name = serializers.CharField()
    description = serializers.CharField(allow_blank=True)
    subtitle = serializers.CharField(allow_blank=True)
    contact_email = serializers.EmailField(allow_blank=True)
    domain = serializers.CharField(allow_null=True)
    theme_color = serializers.CharField()
    logo = serializers.CharField(allow_null=True)
    currency = serializers.CharField()
    timezone = serializers.CharField()
    order_requires_approval = serializers.BooleanField()
    modules = serializers.DictField()
