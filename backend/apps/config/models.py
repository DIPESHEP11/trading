from django.db import models
from apps.core.models import TimeStampedModel


class TenantConfig(TimeStampedModel):
    """
    Per-tenant configuration:
    - which modules are enabled
    - branding (theme color, logo)
    
    This is the source-of-truth for the Flutter app's dynamic UI.
    Endpoint: GET /api/v1/tenant/config/
    """
    tenant = models.OneToOneField(
        'tenants.Tenant', on_delete=models.DO_NOTHING,
        related_name='config', db_constraint=False
    )

    # ── Module Flags ──────────────────────────────────────────────────────────
    module_crm = models.BooleanField(default=True)
    module_products = models.BooleanField(default=True)
    module_stock = models.BooleanField(default=True)
    module_orders = models.BooleanField(default=True)
    module_warehouse = models.BooleanField(default=True)
    module_invoices = models.BooleanField(default=True)
    module_dispatch = models.BooleanField(default=True)
    module_tracking = models.BooleanField(default=False)
    module_manufacturing = models.BooleanField(default=False)
    module_hr = models.BooleanField(default=False)
    module_analytics = models.BooleanField(default=True)

    # ── Branding ──────────────────────────────────────────────────────────────
    theme_color = models.CharField(max_length=20, default='#2563eb')
    logo = models.ImageField(upload_to='tenant_logos/', null=True, blank=True)
    company_name_override = models.CharField(max_length=200, blank=True)

    # ── Business settings ────────────────────────────────────────────────────
    currency = models.CharField(max_length=5, default='INR')
    timezone = models.CharField(max_length=50, default='Asia/Kolkata')
    order_requires_approval = models.BooleanField(default=True,
        help_text='If True, online orders require admin approval before warehouse processing.')

    # ── Client-customizable (Settings page) ───────────────────────────────────
    company_rules = models.TextField(blank=True,
        help_text='Company rules, policies, or notes set by the client admin.')
    custom_fields = models.JSONField(default=dict, blank=True,
        help_text='Custom key-value fields (e.g. {"Tax ID": "12AB", "License": "XYZ"}).')

    # ── Buffer stock (client-configurable) ────────────────────────────────────
    buffer_stock_default = models.PositiveIntegerField(null=True, blank=True,
        help_text='Default buffer stock when product has none. Manual per-product overrides this.')
    buffer_stock_auto_enabled = models.BooleanField(default=False,
        help_text='When True, monthly analysis suggests buffer from movement history.')
    fast_moving_alert_enabled = models.BooleanField(default=True,
        help_text='Send email + show in-app alert when product is fast-moving in a month.')

    class Meta:
        verbose_name = 'Tenant Configuration'

    def __str__(self):
        return f'Config for {self.tenant}'

    def as_dict(self):
        """Returns the Flutter-ready module config dict."""
        from apps.tenants.models import Domain
        domain_obj = Domain.objects.filter(tenant=self.tenant, is_primary=True).first()
        domain_name = domain_obj.domain if domain_obj else None

        return {
            'company_name': self.company_name_override or self.tenant.name,
            'description': self.tenant.description,
            'subtitle': self.tenant.subtitle,
            'contact_email': self.tenant.contact_email,
            'domain': domain_name,
            'theme_color': self.theme_color,
            'logo': self.logo.url if self.logo else None,
            'currency': self.currency,
            'timezone': self.timezone,
            'order_requires_approval': self.order_requires_approval,
            'company_rules': getattr(self, 'company_rules', '') or '',
            'custom_fields': getattr(self, 'custom_fields', None) or {},
            'modules': {
                'crm': self.module_crm,
                'products': self.module_products,
                'stock': self.module_stock,
                'orders': self.module_orders,
                'warehouse': self.module_warehouse,
                'invoices': self.module_invoices,
                'dispatch': self.module_dispatch,
                'tracking': self.module_tracking,
                'manufacturing': self.module_manufacturing,
                'hr': self.module_hr,
                'analytics': self.module_analytics,
            },
            'buffer_stock_default': getattr(self, 'buffer_stock_default', None),
            'buffer_stock_auto_enabled': getattr(self, 'buffer_stock_auto_enabled', False),
            'fast_moving_alert_enabled': getattr(self, 'fast_moving_alert_enabled', True),
        }


# ── Module History (Client Admin audit trail) ─────────────────────────────────

MODULE_HISTORY_CHOICES = [
    ('crm', 'CRM'),
    ('products', 'Products'),
    ('inventory', 'Inventory'),
    ('orders', 'Orders'),
    ('invoices', 'Invoices'),
    ('dispatch', 'Dispatch'),
    ('settings', 'Settings'),
    ('hr', 'HR'),
    ('warehouses', 'Warehouses'),
    ('tracking', 'Tracking'),
]


class ModuleHistory(TimeStampedModel):
    """
    Per-module activity history. Client admin can view, export PDF, and delete.
    When admin deletes, an AuditSummary is created (permanent).
    """
    module = models.CharField(max_length=50, choices=MODULE_HISTORY_CHOICES, db_index=True)
    action = models.CharField(max_length=30)  # create, update, delete, settings_change
    entity_type = models.CharField(max_length=80, blank=True)  # lead, order, invoice, etc.
    entity_id = models.CharField(max_length=100, blank=True)
    title = models.CharField(max_length=255)
    details = models.JSONField(default=dict, blank=True)
    performed_by = models.ForeignKey(
        'users.User', null=True, blank=True, on_delete=models.SET_NULL,
        db_constraint=False, related_name='+'
    )
    performed_by_email = models.CharField(max_length=254, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Module History'
        verbose_name_plural = 'Module Histories'

    def __str__(self):
        return f'{self.module}: {self.title}'


class AuditSummary(TimeStampedModel):
    """
    Immutable summary when admin deletes history. Never deleted — permanent audit trail.
    """
    module = models.CharField(max_length=50, choices=MODULE_HISTORY_CHOICES, db_index=True)
    action = models.CharField(max_length=30, default='history_deleted')
    summary_text = models.CharField(max_length=500)
    records_deleted = models.PositiveIntegerField(default=1)
    performed_by = models.ForeignKey(
        'users.User', null=True, blank=True, on_delete=models.SET_NULL,
        db_constraint=False, related_name='+'
    )
    performed_by_email = models.CharField(max_length=254, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Audit Summary'
        verbose_name_plural = 'Audit Summaries'

    def __str__(self):
        return f'{self.module}: {self.summary_text[:50]}'
