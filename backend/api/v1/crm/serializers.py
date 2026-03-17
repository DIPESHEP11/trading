from rest_framework import serializers
from apps.crm.models import Lead, Customer, LeadActivity, LeadFormSchema, CustomLeadStatus, CustomLeadSource, StatusFlowAction


class CustomerSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()

    class Meta:
        model = Customer
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class LeadActivitySerializer(serializers.ModelSerializer):
    performed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = LeadActivity
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'performed_by']

    def get_performed_by_name(self, obj):
        return obj.performed_by.full_name if obj.performed_by else None


class LeadSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.SerializerMethodField()
    customer_id = serializers.IntegerField(source='customer.id', read_only=True, allow_null=True)
    customer_name = serializers.SerializerMethodField()
    activities = LeadActivitySerializer(many=True, read_only=True)

    class Meta:
        model = Lead
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_assigned_to_name(self, obj):
        return obj.assigned_to.full_name if obj.assigned_to else None

    def get_customer_name(self, obj):
        return obj.customer.full_name if obj.customer else None


class LeadFormSchemaSerializer(serializers.ModelSerializer):
    """Schema for lead form fields. fields: [{key, label, type, required, order, options?}]"""
    is_locked = serializers.SerializerMethodField()

    class Meta:
        model = LeadFormSchema
        fields = ['id', 'fields', 'is_locked', 'created_at', 'updated_at']

    def get_is_locked(self, obj):
        return Lead.objects.exists()


class LeadListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""
    assigned_to_name = serializers.SerializerMethodField()
    customer_id      = serializers.IntegerField(source='customer.id', read_only=True, allow_null=True)
    customer_name    = serializers.SerializerMethodField()

    class Meta:
        model = Lead
        fields = ['id', 'name', 'phone', 'email', 'source', 'status',
                  'assigned_to', 'assigned_to_name',
                  'customer_id', 'customer_name', 'created_at']

    def get_assigned_to_name(self, obj):
        return obj.assigned_to.full_name if obj.assigned_to else None

    def get_customer_name(self, obj):
        return obj.customer.full_name if obj.customer else None


class CustomLeadStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomLeadStatus
        fields = ['id', 'key', 'label', 'color', 'order', 'is_active']
        read_only_fields = ['id']


class CustomLeadSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomLeadSource
        fields = ['id', 'key', 'label', 'order', 'is_active']
        read_only_fields = ['id']


class StatusFlowActionSerializer(serializers.ModelSerializer):
    status_label = serializers.SerializerMethodField()

    class Meta:
        model = StatusFlowAction
        fields = ['id', 'status_key', 'status_label', 'target_module', 'action',
                  'is_active', 'description']
        read_only_fields = ['id']

    def get_status_label(self, obj):
        try:
            s = CustomLeadStatus.objects.get(key=obj.status_key)
            return s.label
        except CustomLeadStatus.DoesNotExist:
            return obj.status_key
