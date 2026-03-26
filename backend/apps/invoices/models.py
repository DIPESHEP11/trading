from django.db import models
from apps.core.models import TimeStampedModel
from apps.users.models import User


# ── Indian States & Union Territories with GST State Codes ───────────────────
INDIAN_STATES = [
    ('01', 'Jammu & Kashmir'),
    ('02', 'Himachal Pradesh'),
    ('03', 'Punjab'),
    ('04', 'Chandigarh'),
    ('05', 'Uttarakhand'),
    ('06', 'Haryana'),
    ('07', 'Delhi'),
    ('08', 'Rajasthan'),
    ('09', 'Uttar Pradesh'),
    ('10', 'Bihar'),
    ('11', 'Sikkim'),
    ('12', 'Arunachal Pradesh'),
    ('13', 'Nagaland'),
    ('14', 'Manipur'),
    ('15', 'Mizoram'),
    ('16', 'Tripura'),
    ('17', 'Meghalaya'),
    ('18', 'Assam'),
    ('19', 'West Bengal'),
    ('20', 'Jharkhand'),
    ('21', 'Odisha'),
    ('22', 'Chhattisgarh'),
    ('23', 'Madhya Pradesh'),
    ('24', 'Gujarat'),
    ('25', 'Daman & Diu'),
    ('26', 'Dadra & Nagar Haveli'),
    ('27', 'Maharashtra'),
    ('28', 'Andhra Pradesh (Old)'),
    ('29', 'Karnataka'),
    ('30', 'Goa'),
    ('31', 'Lakshadweep'),
    ('32', 'Kerala'),
    ('33', 'Tamil Nadu'),
    ('34', 'Puducherry'),
    ('35', 'Andaman & Nicobar'),
    ('36', 'Telangana'),
    ('37', 'Andhra Pradesh'),
    ('38', 'Ladakh'),
    ('97', 'Other Territory'),
]

GST_TAX_SLABS = [
    (0, '0%'),
    (3, '3% (Gold / Precious metals)'),
    (5, '5%'),
    (12, '12%'),
    (18, '18%'),
    (28, '28%'),
    (40, '40%'),
]


# ── Invoice Settings (per-tenant GST / tax configuration) ────────────────────

class InvoiceSettings(TimeStampedModel):
    """
    Per-tenant invoice configuration.
    Controls whether GST is applied, supplier details, bank info, etc.
    """
    TAX_TYPE_CHOICES = [
        ('no_gst', 'No GST / Non-Taxable'),
        ('indian_gst', 'Indian GST Compliant'),
    ]

    tenant = models.OneToOneField(
        'tenants.Tenant', on_delete=models.DO_NOTHING,
        related_name='invoice_settings', db_constraint=False
    )

    tax_type = models.CharField(max_length=20, choices=TAX_TYPE_CHOICES, default='no_gst')

    # Company branding
    company_logo = models.ImageField(upload_to='invoice_logos/', null=True, blank=True)

    # Supplier / business details
    supplier_name = models.CharField(max_length=200, blank=True)
    supplier_address = models.TextField(blank=True)
    supplier_city = models.CharField(max_length=100, blank=True)
    supplier_state = models.CharField(max_length=5, blank=True,
        help_text='State code from INDIAN_STATES')
    supplier_pincode = models.CharField(max_length=10, blank=True)
    supplier_gstin = models.CharField(max_length=15, blank=True,
        help_text='15-character GSTIN')
    supplier_pan = models.CharField(max_length=10, blank=True)
    supplier_cin = models.CharField(max_length=21, blank=True)
    supplier_phone = models.CharField(max_length=20, blank=True)
    supplier_email = models.EmailField(blank=True)

    # MSME / UDYAM details
    msme_type = models.CharField(max_length=30, blank=True,
        help_text='e.g. Micro, Small, Medium')
    msme_number = models.CharField(max_length=50, blank=True,
        help_text='UDYAM registration number')

    # Authorized signatory
    authorized_signatory = models.CharField(max_length=200, blank=True)
    signature_image = models.ImageField(upload_to='invoice_signatures/', null=True, blank=True)

    # Bank details for invoices
    bank_name = models.CharField(max_length=100, blank=True)
    bank_account_number = models.CharField(max_length=30, blank=True)
    bank_ifsc = models.CharField(max_length=11, blank=True)
    bank_branch = models.CharField(max_length=100, blank=True)
    bank_upi_id = models.CharField(max_length=100, blank=True)

    # Invoice defaults
    invoice_prefix = models.CharField(max_length=10, default='INV')
    next_invoice_number = models.IntegerField(default=1)
    # Optional: multiple serial number ranges e.g. [{"from": 20000, "to": 30000, "current": 20000}, ...]
    # When set, generate_invoice_number() uses the first range with current <= to; else falls back to next_invoice_number.
    serial_number_ranges = models.JSONField(
        default=list,
        blank=True,
        help_text='Optional list of {from, to, current?} ranges. Each range is a separate series (e.g. 20k-30k, 40k-80k).'
    )
    proforma_prefix = models.CharField(max_length=10, default='PI')
    next_proforma_number = models.IntegerField(default=1)
    default_due_days = models.IntegerField(default=30)
    default_terms = models.TextField(blank=True,
        default='Goods once sold will not be taken back or exchanged.')

    # Default currency
    default_currency = models.CharField(max_length=5, default='INR',
        help_text='ISO 4217 currency code')
    currency_symbol = models.CharField(max_length=5, default='₹')

    # E-Invoicing (applicable if turnover > ₹5 Crore)
    e_invoicing_enabled = models.BooleanField(default=False)

    # Default tax slab
    default_tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=18)

    class Meta:
        verbose_name = 'Invoice Settings'
        verbose_name_plural = 'Invoice Settings'

    def __str__(self):
        return f'Invoice Settings (Tenant #{self.tenant_id})'

    def generate_invoice_number(self):
        ranges = self.serial_number_ranges or []
        for i, r in enumerate(ranges):
            from_val = r.get('from')
            to_val = r.get('to')
            current = r.get('current', from_val)
            if from_val is None or to_val is None:
                continue
            if current is None:
                current = from_val
            if current <= to_val:
                num = f'{self.invoice_prefix}-{current}'
                r['current'] = current + 1
                self.serial_number_ranges = ranges
                self.save(update_fields=['serial_number_ranges'])
                return num
        num = f'{self.invoice_prefix}-{self.next_invoice_number:05d}'
        self.next_invoice_number += 1
        self.save(update_fields=['next_invoice_number'])
        return num

    def generate_proforma_number(self):
        num = f'{self.proforma_prefix}-{self.next_proforma_number:05d}'
        self.next_proforma_number += 1
        self.save(update_fields=['next_proforma_number'])
        return num


# ── Custom Invoice Status ────────────────────────────────────────────────────

class CustomInvoiceStatus(TimeStampedModel):
    key = models.SlugField(max_length=50, unique=True)
    label = models.CharField(max_length=100)
    color = models.CharField(max_length=20, default='#64748b')
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return self.label


class InvoiceFlowAction(TimeStampedModel):
    MODULE_CHOICES = [
        ('none',      'Stay in Invoices only'),
        ('orders',    'Orders'),
        ('warehouse', 'Warehouse / Inventory'),
        ('dispatch',  'Dispatch'),
        ('crm',       'CRM'),
    ]
    ACTION_CHOICES = [
        ('mark_dispatch',     'Mark for Dispatch'),
        ('send_to_warehouse', 'Send to Warehouse'),
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


# ── Invoice (updated with GST support) ───────────────────────────────────────

class Invoice(TimeStampedModel):
    # Legacy enum for backward compat
    class InvoiceStatus(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        SENT = 'sent', 'Sent'
        PAID = 'paid', 'Paid'
        OVERDUE = 'overdue', 'Overdue'
        CANCELLED = 'cancelled', 'Cancelled'

    INVOICE_TYPE_CHOICES = [
        ('tax_invoice', 'Tax Invoice'),
        ('bill_of_supply', 'Bill of Supply'),
        ('proforma', 'Proforma Invoice'),
        ('cash_memo', 'Cash Memo'),
    ]
    SUPPLY_TYPE_CHOICES = [
        ('b2b', 'B2B (Business to Business)'),
        ('b2c', 'B2C (Business to Consumer)'),
    ]

    invoice_number = models.CharField(max_length=50, unique=True)
    invoice_type = models.CharField(max_length=20, choices=INVOICE_TYPE_CHOICES, default='bill_of_supply')
    supply_type = models.CharField(max_length=5, choices=SUPPLY_TYPE_CHOICES, default='b2b')

    order = models.ForeignKey(
        'orders.Order', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='invoices'
    )
    inventory_approval = models.ForeignKey(
        'warehouses.InventoryApproval', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='invoices'
    )
    status = models.CharField(max_length=50, default='draft')

    # ── Supplier (auto-filled from InvoiceSettings) ──
    supplier_name = models.CharField(max_length=200, blank=True)
    supplier_address = models.TextField(blank=True)
    supplier_gstin = models.CharField(max_length=15, blank=True)
    supplier_state = models.CharField(max_length=5, blank=True)
    supplier_state_code = models.CharField(max_length=5, blank=True)

    # ── Recipient / Buyer ──
    recipient_name = models.CharField(max_length=200)
    recipient_address = models.TextField(blank=True)
    recipient_city = models.CharField(max_length=100, blank=True)
    recipient_state = models.CharField(max_length=5, blank=True,
        help_text='State code')
    recipient_state_code = models.CharField(max_length=5, blank=True)
    recipient_pincode = models.CharField(max_length=10, blank=True)
    recipient_gstin = models.CharField(max_length=15, blank=True)
    recipient_phone = models.CharField(max_length=20, blank=True)
    recipient_email = models.EmailField(blank=True)

    place_of_supply = models.CharField(max_length=5, blank=True,
        help_text='State code — determines CGST+SGST vs IGST')

    # ── GST Flags ──
    is_gst = models.BooleanField(default=False)
    is_reverse_charge = models.BooleanField(default=False)
    is_intra_state = models.BooleanField(default=True)

    # ── Totals ──
    total_taxable_value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_cgst = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_sgst = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_igst = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_cess = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_discount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    round_off = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    grand_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    grand_total_words = models.CharField(max_length=500, blank=True)

    # Legacy fields (kept for backward compat)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # ── Payment & dates ──
    due_date = models.DateField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    payment_method = models.CharField(max_length=50, blank=True)
    payment_reference = models.CharField(max_length=200, blank=True)

    # ── Bank details snapshot (from settings at time of creation) ──
    bank_name = models.CharField(max_length=100, blank=True)
    bank_account_number = models.CharField(max_length=30, blank=True)
    bank_ifsc = models.CharField(max_length=11, blank=True)
    bank_branch = models.CharField(max_length=100, blank=True)

    # ── Terms & notes ──
    terms = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    # ── E-Invoicing ──
    irn = models.CharField(max_length=100, blank=True,
        help_text='Invoice Reference Number for e-invoicing')
    qr_code_data = models.TextField(blank=True)

    created_by = models.ForeignKey(User, null=True, on_delete=models.DO_NOTHING, db_constraint=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.get_invoice_type_display()} #{self.invoice_number}'

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            from django.utils import timezone
            ts = timezone.now().strftime('%Y%m%d%H%M%S')
            self.invoice_number = f'INV-{ts}'
        # Sync legacy fields
        self.total_amount = self.grand_total
        self.subtotal = self.total_taxable_value
        self.tax_amount = self.total_cgst + self.total_sgst + self.total_igst + self.total_cess
        self.discount_amount = self.total_discount
        super().save(*args, **kwargs)


# ── Invoice Line Items ───────────────────────────────────────────────────────

class InvoiceLineItem(TimeStampedModel):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='line_items')

    description = models.CharField(max_length=300)
    hsn_sac = models.CharField(max_length=8, blank=True,
        help_text='HSN/SAC code (6-8 digits, mandatory for GST)')
    quantity = models.DecimalField(max_digits=12, decimal_places=3, default=1)
    unit = models.CharField(max_length=20, default='NOS',
        help_text='UQC — NOS, KGS, MTR, LTR, PCS, etc.')
    rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    taxable_value = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0,
        help_text='GST rate percentage')
    cgst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    cgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    sgst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    sgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    igst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    igst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cess_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    cess_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.description} (₹{self.total})'


# ── Dispatch Sticker (unchanged) ─────────────────────────────────────────────

class DispatchSticker(TimeStampedModel):
    """Dispatch / shipping label linked to an invoice/order."""
    class CourierChoice(models.TextChoices):
        DELHIVERY = 'delhivery', 'Delhivery'
        DTDC = 'dtdc', 'DTDC'
        BLUEDART = 'bluedart', 'BlueDart'
        ECOM = 'ecom_express', 'Ecom Express'
        AMAZON = 'amazon', 'Amazon Logistics'
        CUSTOM = 'custom', 'Custom Courier'

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='dispatch_stickers')
    courier = models.CharField(max_length=30, choices=CourierChoice.choices, default=CourierChoice.CUSTOM)
    courier_name_custom = models.CharField(max_length=200, blank=True)
    awb_number = models.CharField(max_length=100, blank=True, verbose_name='AWB / Tracking Number')
    weight_kg = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)
    dimensions = models.CharField(max_length=100, blank=True, help_text='L x W x H in cm')
    dispatched_at = models.DateTimeField(null=True, blank=True)
    tracking_url = models.URLField(blank=True)
    # Optional override for "From" block shown on dispatch sticker/PDF.
    from_name_override = models.CharField(max_length=200, blank=True)
    from_address_override = models.TextField(blank=True)
    created_by = models.ForeignKey(User, null=True, on_delete=models.DO_NOTHING, db_constraint=False)
    # Status within dispatch (e.g. processing, delivered). When set, DispatchFlowAction can move data to tracking.
    status = models.CharField(max_length=50, blank=True, default='')

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Dispatch: {self.awb_number or "—"} ({self.invoice})'


# ── Dispatch Settings (flow after dispatch, etc.) ─────────────────────────────

class DispatchSettings(TimeStampedModel):
    """Per-tenant: flow after dispatch and other dispatch defaults."""
    tenant = models.OneToOneField(
        'tenants.Tenant', on_delete=models.DO_NOTHING,
        related_name='dispatch_settings', db_constraint=False
    )
    FLOW_AFTER_CHOICES = [
        ('notify_only', 'Notify only'),
        ('mark_delivered', 'Mark as delivered when confirmed'),
        ('update_tracking', 'Update tracking status'),
        ('transfer_to_tracking', 'Transfer to tracking module'),
        ('none', 'No automatic next step'),
    ]
    flow_after_dispatch = models.CharField(
        max_length=30, choices=FLOW_AFTER_CHOICES, default='notify_only',
        help_text='Next step after an order/invoice is dispatched.'
    )
    # When flow is update_tracking or transfer_to_tracking, client admin can set default status in tracking
    TRACKING_STATUS_CHOICES = [
        ('', '— No default —'),
        ('in_transit', 'In transit'),
        ('out_for_delivery', 'Out for delivery'),
        ('delivered', 'Delivered'),
    ]
    default_tracking_status = models.CharField(
        max_length=30, blank=True, choices=TRACKING_STATUS_CHOICES, default='',
        help_text='Default status to set when transferring to tracking or updating tracking.'
    )
    # Optional list of selectable "From" addresses for dispatch stickers.
    # Format: [{ "label": "Warehouse A", "name": "Happy Kid - A", "address": "Street, City" }, ...]
    from_address_options = models.JSONField(default=list, blank=True)

    class Meta:
        verbose_name = 'Dispatch Settings'
        verbose_name_plural = 'Dispatch Settings'

    def __str__(self):
        return f'Dispatch settings (Tenant #{self.tenant_id})'


class CustomDispatchStatus(TimeStampedModel):
    """Per-tenant dispatch statuses (e.g. Processing, Delivered). Client admin creates these."""
    tenant = models.ForeignKey(
        'tenants.Tenant', on_delete=models.DO_NOTHING,
        related_name='dispatch_statuses', db_constraint=False
    )
    key = models.SlugField(max_length=50)
    label = models.CharField(max_length=100)
    color = models.CharField(max_length=20, default='#64748b')
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'id']
        unique_together = [['tenant', 'key']]

    def __str__(self):
        return self.label


class DispatchFlowAction(TimeStampedModel):
    """
    Per-status flow: when a dispatch item's status is set to this status_key,
    perform the configured action (e.g. transfer to tracking). If no flow is set
    for a status, it only applies within the dispatch module.
    """
    tenant = models.ForeignKey(
        'tenants.Tenant', on_delete=models.DO_NOTHING,
        related_name='dispatch_flow_actions', db_constraint=False
    )
    status_key = models.CharField(max_length=50)
    FLOW_CHOICES = [
        ('none', 'Stay in Dispatch only'),
        ('notify_only', 'Notify only'),
        ('mark_delivered', 'Mark as delivered'),
        ('update_tracking', 'Update tracking status'),
        ('transfer_to_tracking', 'Transfer to tracking module'),
    ]
    flow_after = models.CharField(
        max_length=30, choices=FLOW_CHOICES, default='none',
        help_text='What happens when this status is set on a dispatch item.',
    )
    default_tracking_status = models.CharField(
        max_length=30, blank=True,
        help_text='When flow is update_tracking or transfer_to_tracking, default status in tracking.',
    )
    is_active = models.BooleanField(default=True)
    description = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ['status_key']
        unique_together = [['tenant', 'status_key']]

    def __str__(self):
        return f'{self.status_key} → {self.get_flow_after_display()}'


class CourierPartner(TimeStampedModel):
    """Courier / delivery partner details configured by client admin."""
    tenant = models.ForeignKey(
        'tenants.Tenant', on_delete=models.DO_NOTHING,
        related_name='courier_partners', db_constraint=False
    )
    name = models.CharField(max_length=200, help_text='Courier / delivery partner name')
    courier_id = models.CharField(max_length=100, blank=True, help_text='Partner ID or code')
    address = models.TextField(blank=True)
    pincode = models.CharField(max_length=20, blank=True, help_text='Pin code / postal code')
    contact_person_name = models.CharField(max_length=200, blank=True, help_text='Contact person name')
    contact_phone = models.CharField(max_length=30, blank=True, help_text='Contact phone number')

    class Meta:
        ordering = ['name']
        unique_together = [['tenant', 'name']]

    def __str__(self):
        return self.name
