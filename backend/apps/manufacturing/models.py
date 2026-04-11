from django.db import models
from apps.core.models import TimeStampedModel
from apps.users.models import User


class ManufacturingStatus(TimeStampedModel):
    """Tenant-defined manufacturing statuses."""
    key = models.SlugField(max_length=50, unique=True)
    label = models.CharField(max_length=100)
    color = models.CharField(max_length=20, default='#64748b')
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return self.label


class ManufacturingStatusFlow(TimeStampedModel):
    """
    Defines what happens when a work order status changes to a specific value.
    """
    ACTION_CHOICES = [
        ('notify_only', 'Notify Only'),
        ('mark_complete', 'Mark as Complete'),
    ]

    status_key = models.CharField(max_length=50, unique=True,
        help_text='The manufacturing status key that triggers this flow.')
    action = models.CharField(max_length=30, choices=ACTION_CHOICES, default='notify_only')
    is_active = models.BooleanField(default=True)
    description = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ['status_key']

    def __str__(self):
        return f'{self.status_key} → {self.action}'


class ManufacturingFormSchema(TimeStampedModel):
    """
    Per-tenant manufacturing work order form schema.
    One row per tenant (tenant-scoped via django-tenants).
    custom_fields: list of extra field definitions
    default_field_overrides: {field_key: {order, required, label}}
    """
    custom_fields = models.JSONField(default=list)
    default_field_overrides = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = 'Manufacturing Form Schema'

    def __str__(self):
        return f'Manufacturing schema ({len(self.custom_fields)} custom fields)'


class WorkOrder(TimeStampedModel):
    """A manufacturing work order."""

    SOURCE_CHOICES = [
        ('manual', 'Manual'),
        ('order', 'From Order'),
        ('lead', 'From Lead'),
    ]

    mfg_number = models.CharField(max_length=50, unique=True, blank=True)
    status = models.CharField(max_length=50, default='not_started')
    source_type = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='manual')

    # References to source modules (optional)
    order_ref = models.CharField(max_length=100, blank=True,
        help_text='Order number if sourced from Orders module.')
    lead_ref = models.CharField(max_length=100, blank=True,
        help_text='Lead name/ref if sourced from CRM.')

    # Core fields (mirrors default schema)
    product_name = models.CharField(max_length=200, blank=True)
    product_count = models.PositiveIntegerField(null=True, blank=True)

    assigned_to = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='manufacturing_work_orders', db_constraint=False
    )

    notes = models.TextField(blank=True)

    # Flexible custom fields (from admin-defined schema)
    custom_data = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['status', '-created_at']

    def __str__(self):
        return f'WO {self.mfg_number} — {self.product_name} ({self.status})'

    def save(self, *args, **kwargs):
        if not self.mfg_number:
            # Auto-generate MFG number
            last = WorkOrder.objects.order_by('-id').first()
            next_id = (last.id + 1) if last else 1
            self.mfg_number = f'MFG-{next_id:05d}'
        super().save(*args, **kwargs)
