from rest_framework import serializers
from django.utils.text import slugify
from apps.tenants.models import Plan


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = [
            'id', 'name', 'slug', 'price', 'billing_period',
            'description', 'features', 'max_users',
            'module_crm', 'module_products', 'module_stock', 'module_orders',
            'module_warehouse', 'module_invoices', 'module_dispatch',
            'module_tracking', 'module_manufacturing', 'module_hr', 'module_analytics',
            'is_active', 'display_order', 'created_at',
        ]
        read_only_fields = ['id', 'slug', 'created_at']

    def validate_name(self, value):
        slug = slugify(value)
        qs = Plan.objects.filter(slug=slug)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('A plan with this name already exists.')
        return value

    def create(self, validated_data):
        validated_data['slug'] = slugify(validated_data['name'])
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'name' in validated_data:
            validated_data['slug'] = slugify(validated_data['name'])
        return super().update(instance, validated_data)
