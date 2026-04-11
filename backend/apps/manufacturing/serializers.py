from rest_framework import serializers
from .models import WorkOrder, ManufacturingStatus, ManufacturingStatusFlow, ManufacturingFormSchema


class WorkOrderSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = WorkOrder
        fields = [
            'id', 'mfg_number', 'status', 'source_type',
            'order_ref', 'lead_ref', 'product_name', 'product_count',
            'assigned_to', 'assigned_to_name', 'notes', 'custom_data',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'mfg_number', 'created_at', 'updated_at']

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.full_name or obj.assigned_to.email
        return None


class ManufacturingStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = ManufacturingStatus
        fields = ['id', 'key', 'label', 'color', 'order', 'is_active']


class ManufacturingStatusFlowSerializer(serializers.ModelSerializer):
    class Meta:
        model = ManufacturingStatusFlow
        fields = ['id', 'status_key', 'action', 'is_active', 'description']


class ManufacturingFormSchemaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ManufacturingFormSchema
        fields = ['id', 'custom_fields', 'default_field_overrides']
