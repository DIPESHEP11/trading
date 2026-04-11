from django.db import models
from apps.core.models import TimeStampedModel
from apps.users.models import User


class Warehouse(TimeStampedModel):
    """Storage location. Can be 'our' or 'third_party'. Third-party warehouses get a shareable link for incharge."""
    WAREHOUSE_TYPE_CHOICES = [
        ('our', 'Our Warehouse'),
        ('third_party', 'Third Party'),
    ]
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, unique=True)
    warehouse_type = models.CharField(
        max_length=20, choices=WAREHOUSE_TYPE_CHOICES, default='our',
        help_text='Our Warehouse = owned by us. Third Party = external; share link with incharge to view stock & mark usage.',
    )
    public_access_token = models.CharField(
        max_length=64, unique=True, blank=True, null=True,
        help_text='Unique token for third-party warehouse view link. Auto-generated when type is Third Party.',
    )
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    manager = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.DO_NOTHING,
        related_name='managed_warehouses', db_constraint=False
    )
    is_active = models.BooleanField(default=True)
    custom_data = models.JSONField(
        default=list, blank=True,
        help_text='List of {key, label, value} dicts for custom fields.'
    )

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.code})'


class StockRecord(TimeStampedModel):
    """Current stock level for a product in a warehouse."""
    from apps.products.models import Product
    product = models.ForeignKey('products.Product', on_delete=models.CASCADE, related_name='stock_records')
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='stock_records')
    quantity = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    reserved_quantity = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    returned_quantity = models.DecimalField(max_digits=12, decimal_places=3, default=0)

    class Meta:
        unique_together = ('product', 'warehouse')

    def __str__(self):
        return f'{self.product} @ {self.warehouse} — qty: {self.quantity}'

    @property
    def available_quantity(self):
        return self.quantity - self.reserved_quantity


class StockMovement(TimeStampedModel):
    """Audit trail for every stock change."""
    class MovementType(models.TextChoices):
        IN = 'in', 'Stock In'
        OUT = 'out', 'Stock Out'
        TRANSFER = 'transfer', 'Transfer'
        ADJUSTMENT = 'adjustment', 'Adjustment'
        RETURN = 'return', 'Return'

    product = models.ForeignKey('products.Product', on_delete=models.CASCADE, related_name='movements')
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='movements')
    destination_warehouse = models.ForeignKey(
        Warehouse, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='incoming_movements'
    )
    movement_type = models.CharField(max_length=20, choices=MovementType.choices)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    reference = models.CharField(max_length=200, blank=True, help_text='Order no, Invoice no, etc.')
    notes = models.TextField(blank=True)
    custom_data = models.JSONField(
        default=dict, blank=True,
        help_text='Custom key-value fields for this movement.'
    )
    performed_by = models.ForeignKey(User, null=True, on_delete=models.DO_NOTHING, db_constraint=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.movement_type} | {self.product} | qty: {self.quantity}'


class CustomInventoryStatus(TimeStampedModel):
    """Tenant-defined statuses for inventory approval requests."""
    key = models.SlugField(max_length=50, unique=True)
    label = models.CharField(max_length=100)
    color = models.CharField(max_length=20, default='#64748b')
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return self.label


class InventoryFlowAction(TimeStampedModel):
    """
    Defines what happens when an inventory approval reaches a specific status.
    Forwards the request to the next module automatically.
    """
    MODULE_CHOICES = [
        ('none',      'Stay in Inventory only'),
        ('dispatch',  'Dispatch'),
        ('invoices',  'Invoices'),
        ('orders',    'Orders'),
        ('crm',       'CRM'),
    ]
    ACTION_CHOICES = [
        ('forward_dispatch',  'Forward to Dispatch'),
        ('forward_invoices',  'Forward to Invoices'),
        ('forward_orders',    'Forward to Orders'),
        ('execute_stock',     'Execute Stock Movement'),
        ('notify_only',       'Notify Only'),
    ]

    status_key = models.CharField(max_length=50, unique=True)
    target_module = models.CharField(max_length=30, choices=MODULE_CHOICES, default='none')
    action = models.CharField(max_length=30, choices=ACTION_CHOICES, default='notify_only')
    is_active = models.BooleanField(default=True)
    description = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ['status_key']

    def __str__(self):
        return f'{self.status_key} → {self.target_module}/{self.action}'


class InventoryApproval(TimeStampedModel):
    """
    Approval gateway for inventory operations.
    Requests arrive from other modules (Orders, CRM, Dispatch, etc.)
    and must be approved before proceeding to the next step.
    """
    SOURCE_MODULE_CHOICES = [
        ('orders',    'Orders'),
        ('crm',       'CRM / Leads'),
        ('invoices',  'Invoices'),
        ('dispatch',  'Dispatch'),
        ('manual',    'Manual Entry'),
        ('other',     'Other'),
    ]
    ACTION_CHOICES = [
        ('stock_in',     'Stock In'),
        ('stock_out',    'Stock Out'),
        ('reserve',      'Reserve Stock'),
        ('transfer',     'Transfer'),
        ('dispatch',     'Send to Dispatch'),
        ('other',        'Other'),
    ]

    request_number = models.CharField(max_length=30, unique=True)
    status = models.CharField(max_length=50, default='pending')

    source_module = models.CharField(max_length=30, choices=SOURCE_MODULE_CHOICES, default='manual')
    source_reference = models.CharField(max_length=200, blank=True,
        help_text='Reference ID from source module (order number, lead ID, etc.)')

    requested_action = models.CharField(max_length=30, choices=ACTION_CHOICES, default='stock_out')
    warehouse = models.ForeignKey(Warehouse, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='approval_requests')
    destination_warehouse = models.ForeignKey(Warehouse, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='approval_incoming')

    # What to do after approval — which module to forward to
    next_module = models.CharField(max_length=30, blank=True, default='',
        help_text='Module to forward to after approval (dispatch, invoices, etc.)')

    items = models.JSONField(default=list,
        help_text='[{"product_id":1,"product_name":"...","quantity":5,"notes":""},...]')

    # Full snapshot of upstream custom data — leads custom_data, order extra fields, etc.
    extra_data = models.JSONField(
        default=dict, blank=True,
        help_text='Full snapshot of upstream data from source module (lead custom fields, order data, etc.).',
    )

    notes = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)

    # When source_module is 'crm', link to the originating lead for full context
    lead = models.ForeignKey(
        'crm.Lead', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='inventory_approvals', db_constraint=False
    )

    requested_by = models.ForeignKey(User, null=True, on_delete=models.DO_NOTHING,
        db_constraint=False, related_name='inventory_requests')
    approved_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.DO_NOTHING,
        db_constraint=False, related_name='inventory_approvals')
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.request_number} — {self.status} ({self.source_module})'


class StockMonthlySummary(TimeStampedModel):
    """
    Per-product monthly stock movement summary. Populated by manage.py analyze_stock_monthly.
    Used for buffer stock suggestions and fast-moving alerts.
    """
    product = models.ForeignKey(
        'products.Product', on_delete=models.CASCADE, related_name='stock_monthly_summaries'
    )
    year_month = models.CharField(max_length=7, db_index=True)  # YYYY-MM
    total_in = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    total_out = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    movement_count = models.PositiveIntegerField(default=0)
    is_fast_moving = models.BooleanField(default=False,
        help_text='True when out-movements are in top percentile for the month.')

    class Meta:
        ordering = ['-year_month', 'product']
        unique_together = ('product', 'year_month')
        verbose_name_plural = 'Stock Monthly Summaries'

    def __str__(self):
        return f'{self.product.sku} | {self.year_month} | out: {self.total_out}'


class StockAlert(TimeStampedModel):
    """
    Alerts for client admin: fast-moving products, low stock, etc.
    Shown on website + optionally emailed.
    """
    ALERT_TYPE_CHOICES = [
        ('fast_moving', 'Fast Moving'),
        ('low_stock', 'Low Stock'),
    ]

    product = models.ForeignKey(
        'products.Product', on_delete=models.CASCADE, related_name='stock_alerts'
    )
    alert_type = models.CharField(max_length=20, choices=ALERT_TYPE_CHOICES, db_index=True)
    year_month = models.CharField(max_length=7, blank=True)  # YYYY-MM for monthly alerts
    message = models.CharField(max_length=500)
    email_sent_at = models.DateTimeField(null=True, blank=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.alert_type} | {self.product.sku} | {self.message[:50]}'
