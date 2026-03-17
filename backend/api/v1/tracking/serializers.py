from rest_framework import serializers
from apps.tracking.models import TrackingShipment, TrackingFormLink, TrackingFormSubmission
from apps.invoices.models import CourierPartner


class TrackingShipmentSerializer(serializers.ModelSerializer):
    courier_partner_name = serializers.CharField(source='courier_partner.name', read_only=True)

    class Meta:
        model = TrackingShipment
        exclude = ['tenant']
        read_only_fields = ['id', 'created_at', 'updated_at']


class TrackingFormLinkSerializer(serializers.ModelSerializer):
    courier_partner_name = serializers.CharField(source='courier_partner.name', read_only=True)
    shipment_count = serializers.SerializerMethodField()

    class Meta:
        model = TrackingFormLink
        exclude = ['tenant']
        read_only_fields = ['id', 'token', 'created_at', 'updated_at']

    def get_shipment_count(self, obj):
        return obj.courier_partner.tracking_shipments.count()


class TrackingFormLinkCreateSerializer(serializers.Serializer):
    """Used when generating a new link - only fillable_fields in request."""
    fillable_fields = serializers.ListField(
        child=serializers.CharField(),
        default=list,
        help_text='Field keys the delivery partner can fill',
    )


# ── Public form (no auth): minimal serializers for delivery partner view ───

class PublicShipmentSerializer(serializers.ModelSerializer):
    """Shipment data shown on the delivery partner form (read-only + fillable)."""
    class Meta:
        model = TrackingShipment
        fields = [
            'id', 'product_name', 'product_id', 'qr_data',
            'from_address', 'to_address', 'contact_number', 'delivery_partner_details',
            'pod_tracking_number', 'custom_fields', 'status',
        ]


class PublicFormSubmitSerializer(serializers.Serializer):
    """Delivery partner submission: shipment_id + field updates."""
    shipment_id = serializers.IntegerField()
    pod_tracking_number = serializers.CharField(required=False, allow_blank=True)
    custom_fields = serializers.JSONField(required=False, default=dict)
