import re
from rest_framework import serializers
from apps.orders.models import Order, OrderItem, OrderStatusHistory, CustomOrderStatus, OrderFlowAction


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = '__all__'
        read_only_fields = ['id', 'total_price']

    def get_product_name(self, obj): return obj.product.name


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = OrderStatusHistory
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'changed_by']

    def get_changed_by_name(self, obj):
        return obj.changed_by.full_name if obj.changed_by else None


def _serialize_lead(lead):
    """Return a compact dict of lead details for display in other modules."""
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


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    status_history = OrderStatusHistorySerializer(many=True, read_only=True)
    customer_name = serializers.SerializerMethodField()
    lead_details = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = '__all__'
        read_only_fields = ['id', 'order_number', 'total_amount', 'created_at',
                            'updated_at', 'approved_by', 'approved_at']

    def get_customer_name(self, obj):
        return obj.customer.full_name if obj.customer else obj.shipping_name

    def get_lead_details(self, obj):
        import re
        from apps.crm.models import Lead
        if not obj.external_id:
            return None
        m = re.match(r'^lead-(\d+)$', str(obj.external_id).strip())
        if not m:
            return None
        try:
            lead = Lead.objects.get(pk=int(m.group(1)))
            return _serialize_lead(lead)
        except (Lead.DoesNotExist, ValueError):
            return None


class OrderListSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    items_summary = serializers.SerializerMethodField()
    lead_details = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = ['id', 'order_number', 'source', 'status', 'customer',
                  'customer_name', 'items_summary', 'lead_details', 'total_amount', 'created_at']

    def get_customer_name(self, obj):
        return obj.customer.full_name if obj.customer else obj.shipping_name

    def get_lead_details(self, obj):
        import re
        from apps.crm.models import Lead
        if not obj.external_id:
            return None
        m = re.match(r'^lead-(\d+)$', str(obj.external_id).strip())
        if not m:
            return None
        try:
            lead = Lead.objects.get(pk=int(m.group(1)))
            return _serialize_lead(lead)
        except (Lead.DoesNotExist, ValueError):
            return None

    def get_items_summary(self, obj):
        parts = []
        for item in obj.items.all()[:5]:
            parts.append(f'{item.product.name} x{item.quantity}')
        if obj.items.count() > 5:
            parts.append(f'+{obj.items.count() - 5} more')
        return parts and ', '.join(parts) or '—'


class CreateOrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)

    class Meta:
        model = Order
        fields = ['source', 'customer', 'shipping_name', 'shipping_phone',
                  'shipping_address', 'shipping_city', 'shipping_state',
                  'shipping_pincode', 'notes', 'items']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        order = Order.objects.create(**validated_data)
        subtotal = 0
        for item_data in items_data:
            item = OrderItem.objects.create(order=order, **item_data)
            subtotal += item.total_price
        order.subtotal = subtotal
        order.total_amount = subtotal + order.tax_amount - order.discount_amount
        order.save()
        return order


class CustomOrderStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomOrderStatus
        fields = ['id', 'key', 'label', 'color', 'order', 'is_active']
        read_only_fields = ['id']


class OrderFlowActionSerializer(serializers.ModelSerializer):
    status_label = serializers.SerializerMethodField()

    class Meta:
        model = OrderFlowAction
        fields = ['id', 'status_key', 'status_label', 'target_module', 'action',
                  'is_active', 'description']
        read_only_fields = ['id']

    def get_status_label(self, obj):
        try:
            return CustomOrderStatus.objects.get(key=obj.status_key).label
        except CustomOrderStatus.DoesNotExist:
            return obj.status_key
