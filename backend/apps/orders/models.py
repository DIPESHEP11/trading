from django.db import models
from apps.core.models import TimeStampedModel
from apps.users.models import User
from apps.crm.models import Customer, LeadSource


# Legacy enum kept for backward compat
class OrderStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    APPROVED = 'approved', 'Approved'
    SENT_TO_WAREHOUSE = 'warehouse', 'Sent to Warehouse'
    INVOICED = 'invoiced', 'Invoiced'
    DISPATCHED = 'dispatched', 'Dispatched'
    DELIVERED = 'delivered', 'Delivered'
    CANCELLED = 'cancelled', 'Cancelled'
    RETURNED = 'returned', 'Returned'


class CustomOrderStatus(TimeStampedModel):
    """Tenant-defined order statuses."""
    key = models.SlugField(max_length=50, unique=True)
    label = models.CharField(max_length=100)
    color = models.CharField(max_length=20, default='#64748b')
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return self.label


class OrderFlowAction(TimeStampedModel):
    """
    Defines what happens when an order's status changes to a specific value.
    Also supports rejection: if rejected, order reverts to previous_status_key.
    """
    MODULE_CHOICES = [
        ('none',      'Stay in Orders only'),
        ('warehouse', 'Warehouse / Inventory'),
        ('invoices',  'Invoices'),
        ('dispatch',  'Dispatch'),
        ('crm',       'CRM'),
    ]
    ACTION_CHOICES = [
        ('send_to_warehouse', 'Send to Warehouse'),
        ('create_invoice',    'Create Invoice'),
        ('mark_dispatch',     'Mark for Dispatch'),
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
        return f'{self.status_key} → {self.target_module} ({self.action})'


class Order(TimeStampedModel):
    """Multi-source order — Meta lead, Shopify, Online, Manual."""
    order_number = models.CharField(max_length=50, unique=True)
    source = models.CharField(max_length=50, default='manual')
    status = models.CharField(max_length=50, default='pending')

    customer = models.ForeignKey(
        Customer, null=True, blank=True, on_delete=models.SET_NULL, related_name='orders'
    )

    # Shipping address (may differ from customer address)
    shipping_name = models.CharField(max_length=200, blank=True)
    shipping_phone = models.CharField(max_length=20, blank=True)
    shipping_address = models.TextField(blank=True)
    shipping_city = models.CharField(max_length=100, blank=True)
    shipping_state = models.CharField(max_length=100, blank=True)
    shipping_pincode = models.CharField(max_length=20, blank=True)

    # Financials
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    notes = models.TextField(blank=True)

    # Workflow tracking
    assigned_to = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.DO_NOTHING,
        related_name='assigned_orders', db_constraint=False
    )
    approved_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.DO_NOTHING,
        related_name='approved_orders', db_constraint=False
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    # External reference (Shopify order, Meta lead)
    external_id = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Order #{self.order_number} — {self.status}'

    def save(self, *args, **kwargs):
        if not self.order_number:
            from django.utils import timezone
            ts = timezone.now().strftime('%Y%m%d%H%M%S')
            self.order_number = f'ORD-{ts}'
        self.total_amount = self.subtotal + self.tax_amount - self.discount_amount
        super().save(*args, **kwargs)


class OrderItem(TimeStampedModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey('products.Product', on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    tax_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    total_price = models.DecimalField(max_digits=12, decimal_places=2)

    def save(self, *args, **kwargs):
        disc = self.unit_price * self.quantity * (self.discount_percent / 100)
        tax = (self.unit_price * self.quantity - disc) * (self.tax_percent / 100)
        self.total_price = self.unit_price * self.quantity - disc + tax
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.product} x {self.quantity}'


class OrderStatusHistory(TimeStampedModel):
    """Full audit trail of order status transitions."""
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='status_history')
    from_status = models.CharField(max_length=50, blank=True)
    to_status = models.CharField(max_length=50)
    changed_by = models.ForeignKey(User, null=True, on_delete=models.DO_NOTHING, db_constraint=False)
    note = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']
