"""
Tracking module: receives data from Dispatch, stores per delivery partner.
Admin can generate a secure form link (one per partner); delivery partner
opens the link to see all assigned shipments and fill allowed fields (POD, etc.).
"""
from django.db import models
from apps.core.models import TimeStampedModel


class TrackingShipment(TimeStampedModel):
    """
    A product/shipment assigned to a delivery partner for tracking.
    Data comes from dispatch; can be extended with POD/tracking number and custom fields.
    """
    tenant = models.ForeignKey(
        'tenants.Tenant', on_delete=models.DO_NOTHING,
        related_name='tracking_shipments', db_constraint=False
    )
    courier_partner = models.ForeignKey(
        'invoices.CourierPartner', on_delete=models.CASCADE, related_name='tracking_shipments'
    )
    dispatch_sticker = models.ForeignKey(
        'invoices.DispatchSticker', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='tracking_shipments'
    )

    product_name = models.CharField(max_length=300)
    product_id = models.CharField(max_length=100, help_text='Product ID or SKU')
    qr_data = models.CharField(max_length=500, blank=True, help_text='QR code data or URL')
    from_address = models.TextField(blank=True)
    to_address = models.TextField(blank=True)
    contact_number = models.CharField(max_length=30, blank=True)
    delivery_partner_details = models.TextField(
        blank=True,
        help_text='Delivery partner name, ID, address, contact (denormalized or summary)',
    )

    pod_tracking_number = models.CharField(
        max_length=100, blank=True,
        help_text='POD / tracking number; can be filled by delivery partner if allowed',
    )
    custom_fields = models.JSONField(
        default=dict, blank=True,
        help_text='Additional key-value fields; partner can fill if allowed',
    )
    status = models.CharField(max_length=50, default='pending')

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.product_name} ({self.product_id}) → {self.courier_partner.name}'


class TrackingFormLink(TimeStampedModel):
    """
    One secure form link per delivery partner. When generated, a unique token
    is created and stored here and in tenants.TrackingFormToken for public lookup.
    New shipments assigned to this partner automatically appear in the same form.
    """
    tenant = models.ForeignKey(
        'tenants.Tenant', on_delete=models.DO_NOTHING,
        related_name='tracking_form_links', db_constraint=False
    )
    courier_partner = models.OneToOneField(
        'invoices.CourierPartner', on_delete=models.CASCADE, related_name='tracking_form_link'
    )
    token = models.CharField(max_length=64, unique=True, db_index=True)
    fillable_fields = models.JSONField(
        default=list,
        help_text='List of field keys the delivery partner can fill, e.g. ["pod_tracking_number"]',
    )

    class Meta:
        ordering = ['courier_partner__name']

    def __str__(self):
        return f'Form link for {self.courier_partner.name}'


class TrackingFormSubmission(TimeStampedModel):
    """Record of delivery partner submitting form data for a shipment."""
    shipment = models.ForeignKey(
        TrackingShipment, on_delete=models.CASCADE, related_name='submissions'
    )
    submitted_data = models.JSONField(
        default=dict,
        help_text='Field keys and values submitted by the partner',
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Submission for {self.shipment.product_id} at {self.created_at}'
