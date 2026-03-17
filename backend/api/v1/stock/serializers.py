from rest_framework import serializers
from apps.warehouses.models import (
    Warehouse, StockRecord, StockMovement, InventoryApproval,
    CustomInventoryStatus, InventoryFlowAction,
)


class WarehouseSerializer(serializers.ModelSerializer):
    public_view_url = serializers.SerializerMethodField()

    class Meta:
        model = Warehouse
        fields = [
            'id', 'name', 'code', 'warehouse_type', 'public_access_token', 'public_view_url',
            'phone', 'email', 'address', 'city', 'is_active', 'custom_data',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'public_access_token', 'created_at', 'updated_at']

    def get_public_view_url(self, obj):
        """Return path only; frontend builds full URL with window.location.origin for copy."""
        if not obj.public_access_token:
            return None
        return f'/warehouse-view/{obj.public_access_token}'

    def create(self, validated_data):
        import secrets
        if validated_data.get('warehouse_type') == 'third_party':
            validated_data['public_access_token'] = secrets.token_urlsafe(32)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        import secrets
        wh_type = validated_data.get('warehouse_type', instance.warehouse_type)
        if wh_type == 'third_party' and not instance.public_access_token:
            validated_data['public_access_token'] = secrets.token_urlsafe(32)
        elif wh_type == 'our':
            validated_data['public_access_token'] = None
        return super().update(instance, validated_data)


class StockRecordSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()
    product_sku = serializers.SerializerMethodField()
    warehouse_name = serializers.SerializerMethodField()
    available_quantity = serializers.ReadOnlyField()
    low_stock_threshold = serializers.SerializerMethodField()
    has_returns = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = StockRecord
        fields = ['id', 'product', 'product_name', 'product_sku',
                  'warehouse', 'warehouse_name', 'quantity',
                  'reserved_quantity', 'available_quantity',
                  'returned_quantity',
                  'low_stock_threshold', 'has_returns', 'updated_at']

    def get_product_name(self, obj): return obj.product.name
    def get_product_sku(self, obj): return obj.product.sku
    def get_warehouse_name(self, obj): return obj.warehouse.name
    def get_low_stock_threshold(self, obj): return obj.product.low_stock_threshold


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()
    warehouse_name = serializers.SerializerMethodField()
    destination_warehouse_name = serializers.SerializerMethodField()
    performed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StockMovement
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'performed_by']

    def get_product_name(self, obj): return obj.product.name
    def get_warehouse_name(self, obj): return obj.warehouse.name
    def get_destination_warehouse_name(self, obj):
        return obj.destination_warehouse.name if obj.destination_warehouse else None
    def get_performed_by_name(self, obj):
        return obj.performed_by.full_name if obj.performed_by else None


def _serialize_lead_for_approval(lead):
    """Return lead details dict for InventoryApproval display."""
    if not lead:
        return None
    return {
        'id': lead.id,
        'name': lead.name,
        'email': lead.email or '',
        'phone': lead.phone or '',
        'company': lead.company or '',
        'notes': lead.notes or '',
        'source': lead.source or '',
        'status': lead.status or '',
        'custom_data': lead.custom_data or {},
        'assigned_to_name': lead.assigned_to.full_name if lead.assigned_to else None,
    }


class InventoryApprovalSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    warehouse_name = serializers.SerializerMethodField()
    destination_warehouse_name = serializers.SerializerMethodField()
    lead_details = serializers.SerializerMethodField()

    class Meta:
        model = InventoryApproval
        fields = [
            'id', 'request_number', 'status',
            'source_module', 'source_reference', 'requested_action',
            'warehouse', 'warehouse_name',
            'destination_warehouse', 'destination_warehouse_name',
            'next_module', 'items', 'notes', 'rejection_reason',
            'lead_details',
            'requested_by', 'requested_by_name',
            'approved_by', 'approved_by_name', 'approved_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'request_number', 'approved_by', 'approved_at', 'created_at', 'updated_at']

    def get_requested_by_name(self, obj):
        return obj.requested_by.full_name if obj.requested_by else None

    def get_approved_by_name(self, obj):
        return obj.approved_by.full_name if obj.approved_by else None

    def get_warehouse_name(self, obj):
        return obj.warehouse.name if obj.warehouse else None

    def get_destination_warehouse_name(self, obj):
        return obj.destination_warehouse.name if obj.destination_warehouse else None

    def get_lead_details(self, obj):
        lead = getattr(obj, 'lead', None)
        if lead:
            return _serialize_lead_for_approval(lead)
        return None


class CustomInventoryStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomInventoryStatus
        fields = ['id', 'key', 'label', 'color', 'order', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class InventoryFlowActionSerializer(serializers.ModelSerializer):
    status_label = serializers.SerializerMethodField()

    class Meta:
        model = InventoryFlowAction
        fields = ['id', 'status_key', 'status_label', 'target_module', 'action',
                  'is_active', 'description', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_status_label(self, obj):
        try:
            return CustomInventoryStatus.objects.get(key=obj.status_key).label
        except CustomInventoryStatus.DoesNotExist:
            return obj.status_key
