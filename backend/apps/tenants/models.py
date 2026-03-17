from django.db import models
from django_tenants.models import TenantMixin, DomainMixin


BUSINESS_MODEL_CHOICES = [
    ('b2b', 'B2B — Business to Business'),
    ('b2c', 'B2C — Business to Consumer'),
    ('d2c', 'D2C — Direct to Consumer'),
    ('hybrid', 'Hybrid — Mixed Model'),
    ('marketplace', 'Marketplace'),
    ('saas', 'SaaS / Software'),
    ('services', 'Services / Consulting'),
    ('other', 'Other'),
]


class Tenant(TenantMixin):
    """
    Represents a client organisation / tenant.
    Each tenant gets its own PostgreSQL schema.
    """
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    subtitle = models.CharField(max_length=300, blank=True, help_text='Tagline or short description shown in UI')
    description = models.TextField(blank=True)
    logo = models.ImageField(upload_to='tenant_logos/', null=True, blank=True)
    contact_email = models.EmailField(blank=True)

    is_active = models.BooleanField(default=True)
    plan = models.CharField(
        max_length=20,
        choices=[('free', 'Free'), ('basic', 'Basic'), ('pro', 'Pro'), ('enterprise', 'Enterprise')],
        default='free',
    )
    business_model = models.CharField(
        max_length=30,
        choices=BUSINESS_MODEL_CHOICES,
        default='b2b',
    )

    # Module toggles stored at tenant level (mirrors TenantConfig for quick access)
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

    created_on = models.DateField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # django-tenants: auto-create schema on save
    auto_create_schema = True

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Domain(DomainMixin):
    """
    Maps domains / subdomains to a Tenant.
    e.g.  company1.yourdomain.com → Tenant 'Company One'
    """
    class Meta:
        ordering = ['domain']


class TrackingFormToken(models.Model):
    """
    Public-schema lookup: token -> tenant_id.
    Used to resolve which tenant a tracking form link belongs to when the
    delivery partner opens the form URL (no tenant in request).
    """
    token = models.CharField(max_length=64, unique=True, db_index=True)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='+')

    class Meta:
        db_table = 'tenants_trackingformtoken'

    def __str__(self):
        return f"Token…{self.token[-8:]} → {self.tenant_id}"


class Plan(models.Model):
    """
    Subscription plan managed by the superadmin.
    When a client is registered with a plan, the plan's module flags are used as
    defaults and the plan's slug is stored on Tenant.plan (CharField).
    """
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    billing_period = models.CharField(
        max_length=20,
        choices=[('monthly', 'Monthly'), ('yearly', 'Yearly'), ('one_time', 'One-time')],
        default='monthly',
    )
    description = models.TextField(blank=True)
    features = models.JSONField(default=list, help_text='List of feature strings shown on the plan card.')
    max_users = models.IntegerField(null=True, blank=True)

    # Default module flags — pre-selected when a client picks this plan
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

    is_active = models.BooleanField(default=True)
    display_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['display_order', 'name']

    def save(self, *args, **kwargs):
        if not self.slug:
            from django.utils.text import slugify
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} (₹{self.price}/{self.billing_period})"
