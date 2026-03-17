from django.db import models
from apps.core.models import TimeStampedModel
from apps.users.models import User


# Legacy enums kept for backward compatibility with existing data
class LeadSource(models.TextChoices):
    META = 'meta', 'Meta / Facebook'
    SHOPIFY = 'shopify', 'Shopify'
    ONLINE = 'online', 'Online Order'
    MANUAL = 'manual', 'Manual Entry'
    WHATSAPP = 'whatsapp', 'WhatsApp'
    REFERRAL = 'referral', 'Referral'
    FORM = 'form', 'Form Submission'
    EXCEL = 'excel', 'Excel Import'


class LeadStatus(models.TextChoices):
    NEW = 'new', 'New'
    CONTACTED = 'contacted', 'Contacted'
    QUALIFIED = 'qualified', 'Qualified'
    ORDER_CREATED = 'order_created', 'Order Created'
    LOST = 'lost', 'Lost'


class CustomLeadStatus(TimeStampedModel):
    """Tenant-defined lead statuses."""
    key = models.SlugField(max_length=50, unique=True)
    label = models.CharField(max_length=100)
    color = models.CharField(max_length=20, default='#64748b')
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return self.label


class CustomLeadSource(TimeStampedModel):
    """Tenant-defined lead sources."""
    key = models.SlugField(max_length=50, unique=True)
    label = models.CharField(max_length=100)
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return self.label


class Customer(TimeStampedModel):
    """A confirmed customer of the tenant."""
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    company = models.CharField(max_length=200, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True, default='India')
    tags = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.first_name} {self.last_name}'.strip()

    @property
    def full_name(self):
        return f'{self.first_name} {self.last_name}'.strip()


class Lead(TimeStampedModel):
    """A sales lead — may be converted to a Customer + Order."""
    source = models.CharField(max_length=50, default='manual')
    status = models.CharField(max_length=50, default='new')

    # Contact info (before becoming a customer)
    name = models.CharField(max_length=200)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    company = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)

    # Assignment
    assigned_to = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.DO_NOTHING,
        related_name='assigned_leads', db_constraint=False
    )

    # If converted, link to customer
    customer = models.ForeignKey(
        Customer, null=True, blank=True, on_delete=models.SET_NULL, related_name='leads'
    )

    # External reference (Shopify order ID, Meta lead ID, etc.)
    external_id = models.CharField(max_length=200, blank=True)
    external_data = models.JSONField(default=dict, blank=True)

    # Admin-defined custom fields (customer name, address, product details, size, quantity, etc.)
    custom_data = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.source}) — {self.status}'


class LeadFormSchema(TimeStampedModel):
    """
    Per-tenant lead form schema. One row per tenant (tenant-scoped via django-tenants).
    Defines which custom fields a lead has. Locked once any lead exists.
    fields: [{"key": "customer_name", "label": "Customer Name", "type": "text", "required": true, "order": 1}, ...]
    Supported types: text, email, phone, number, textarea, select (options in definition).
    """
    fields = models.JSONField(default=list)  # list of field definitions

    class Meta:
        verbose_name = 'Lead Form Schema'

    def __str__(self):
        return f'Lead form schema ({len(self.fields)} fields)'


class StatusFlowAction(TimeStampedModel):
    """
    Defines what happens when a lead's status changes to a specific value.
    The client admin configures these flows in CRM Settings.
    If no flow is defined for a status, the status only changes within CRM.
    """
    MODULE_CHOICES = [
        ('none',      'Stay in CRM only'),
        ('orders',    'Orders'),
        ('warehouse', 'Warehouse / Inventory'),
        ('invoices',  'Invoices'),
        ('dispatch',  'Dispatch'),
        ('products',  'Products'),
    ]
    ACTION_CHOICES = [
        ('create_order',    'Create Order'),
        ('send_to_warehouse', 'Send to Warehouse'),
        ('create_invoice',  'Create Invoice'),
        ('mark_dispatch',   'Mark for Dispatch'),
        ('notify_only',     'Notify Only'),
    ]

    status_key = models.CharField(max_length=50, unique=True,
        help_text='The custom lead status key that triggers this flow.')
    target_module = models.CharField(max_length=30, choices=MODULE_CHOICES, default='none')
    action = models.CharField(max_length=30, choices=ACTION_CHOICES, default='notify_only')
    is_active = models.BooleanField(default=True)
    description = models.CharField(max_length=200, blank=True,
        help_text='Admin note describing this flow step.')

    class Meta:
        ordering = ['status_key']

    def __str__(self):
        return f'{self.status_key} → {self.target_module} ({self.action})'


class LeadAssignmentConfig(TimeStampedModel):
    """
    Per-tenant persistent config for automatic lead assignment.
    One row per tenant (tenant-scoped via django-tenants).
    """
    STRATEGY_CHOICES = [
        ('round_robin', 'Round Robin — equal rotation'),
        ('pool',        'Pool — fixed batch, refill on finish'),
        ('custom',      'Custom — admin-defined count per employee'),
        ('off',         'Off — no auto-assignment'),
    ]

    strategy = models.CharField(max_length=20, choices=STRATEGY_CHOICES, default='off')
    pool_batch_size = models.IntegerField(default=4)

    # Status keys that mean "work finished" — triggers pool refill
    finished_statuses = models.JSONField(default=list,
        help_text='List of status keys that count as finished (e.g. ["order_created","lost"])')

    # Selected employees + optional per-employee counts for custom mode
    # Format: [{"user_id": 5, "count": 10}, {"user_id": 8, "count": 5}]
    employees = models.JSONField(default=list)

    # Round-robin pointer: index of the next employee to assign
    rr_pointer = models.IntegerField(default=0)

    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Lead Assignment Config'

    def __str__(self):
        return f'Assignment config: {self.strategy}'


class LeadActivity(TimeStampedModel):
    """Activity log on a lead — calls, notes, follow-ups."""
    class ActivityType(models.TextChoices):
        CALL = 'call', 'Call'
        EMAIL = 'email', 'Email'
        WHATSAPP = 'whatsapp', 'WhatsApp'
        NOTE = 'note', 'Note'
        FOLLOW_UP = 'follow_up', 'Follow-up Scheduled'
        STATUS_CHANGE = 'status_change', 'Status Changed'

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='activities')
    activity_type = models.CharField(max_length=20, choices=ActivityType.choices)
    description = models.TextField()
    performed_by = models.ForeignKey(User, on_delete=models.DO_NOTHING, null=True, db_constraint=False)
    follow_up_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.lead} — {self.get_activity_type_display()}'
