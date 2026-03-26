from rest_framework import serializers
from decimal import Decimal, ROUND_HALF_UP
from apps.invoices.models import (
    Invoice, InvoiceLineItem, DispatchSticker, InvoiceSettings,
    CustomInvoiceStatus, InvoiceFlowAction, INDIAN_STATES, GST_TAX_SLABS,
    DispatchSettings, CourierPartner, CustomDispatchStatus, DispatchFlowAction,
)


# ── Number to words (Indian system: Lakh, Crore) ─────────────────────────────

def _num_to_words(n):
    """Convert a number to Indian-English words (simplified)."""
    if n == 0:
        return 'Zero'
    ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
            'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen',
            'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
    tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
            'Sixty', 'Seventy', 'Eighty', 'Ninety']

    def _below_hundred(num):
        if num < 20:
            return ones[num]
        return tens[num // 10] + ((' ' + ones[num % 10]) if num % 10 else '')

    def _below_thousand(num):
        if num < 100:
            return _below_hundred(num)
        return ones[num // 100] + ' Hundred' + ((' and ' + _below_hundred(num % 100)) if num % 100 else '')

    n = int(round(n))
    if n < 0:
        return 'Minus ' + _num_to_words(-n)
    if n < 1000:
        return _below_thousand(n)

    result = ''
    crore = n // 10000000
    n %= 10000000
    lakh = n // 100000
    n %= 100000
    thousand = n // 1000
    n %= 1000
    remainder = n

    if crore:
        result += _below_thousand(crore) + ' Crore '
    if lakh:
        result += _below_hundred(lakh) + ' Lakh '
    if thousand:
        result += _below_hundred(thousand) + ' Thousand '
    if remainder:
        result += _below_thousand(remainder)
    return result.strip()


def amount_in_words(amount):
    rupees = int(amount)
    paise = int(round((amount - rupees) * 100))
    words = 'Rupees ' + _num_to_words(rupees)
    if paise:
        words += ' and ' + _num_to_words(paise) + ' Paise'
    words += ' Only'
    return words


# ── GST Calculation ──────────────────────────────────────────────────────────

def calculate_line_item_tax(item_data, is_gst, is_intra_state):
    """
    Compute tax fields for a single line item dict.
    Returns the dict with all tax fields filled in.
    """
    qty = Decimal(str(item_data.get('quantity', 1)))
    rate = Decimal(str(item_data.get('rate', 0)))
    discount = Decimal(str(item_data.get('discount_amount', 0)))
    tax_rate = Decimal(str(item_data.get('tax_rate', 0)))

    taxable = (qty * rate) - discount
    taxable = taxable.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    item_data['taxable_value'] = taxable

    # Reset all tax
    for k in ('cgst_rate', 'cgst_amount', 'sgst_rate', 'sgst_amount',
              'igst_rate', 'igst_amount', 'cess_rate', 'cess_amount'):
        item_data[k] = Decimal('0')

    if is_gst and tax_rate > 0:
        cess_rate = Decimal(str(item_data.get('cess_rate', 0)))
        if is_intra_state:
            half = (tax_rate / 2).quantize(Decimal('0.01'))
            item_data['cgst_rate'] = half
            item_data['sgst_rate'] = half
            item_data['cgst_amount'] = (taxable * half / 100).quantize(Decimal('0.01'))
            item_data['sgst_amount'] = (taxable * half / 100).quantize(Decimal('0.01'))
        else:
            item_data['igst_rate'] = tax_rate
            item_data['igst_amount'] = (taxable * tax_rate / 100).quantize(Decimal('0.01'))

        if cess_rate > 0:
            item_data['cess_amount'] = (taxable * cess_rate / 100).quantize(Decimal('0.01'))
            item_data['cess_rate'] = cess_rate

    total_tax = (
        Decimal(str(item_data.get('cgst_amount', 0))) +
        Decimal(str(item_data.get('sgst_amount', 0))) +
        Decimal(str(item_data.get('igst_amount', 0))) +
        Decimal(str(item_data.get('cess_amount', 0)))
    )
    item_data['total'] = (taxable + total_tax).quantize(Decimal('0.01'))
    return item_data


def calculate_invoice_totals(invoice):
    """Recalculate invoice totals from its line items."""
    items = invoice.line_items.all()
    total_taxable = Decimal('0')
    total_cgst = Decimal('0')
    total_sgst = Decimal('0')
    total_igst = Decimal('0')
    total_cess = Decimal('0')
    total_discount = Decimal('0')

    for item in items:
        total_taxable += item.taxable_value
        total_cgst += item.cgst_amount
        total_sgst += item.sgst_amount
        total_igst += item.igst_amount
        total_cess += item.cess_amount
        total_discount += item.discount_amount

    raw_total = total_taxable + total_cgst + total_sgst + total_igst + total_cess
    rounded = raw_total.quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    round_off = (rounded - raw_total).quantize(Decimal('0.01'))

    invoice.total_taxable_value = total_taxable
    invoice.total_cgst = total_cgst
    invoice.total_sgst = total_sgst
    invoice.total_igst = total_igst
    invoice.total_cess = total_cess
    invoice.total_discount = total_discount
    invoice.round_off = round_off
    invoice.grand_total = rounded
    invoice.grand_total_words = amount_in_words(float(rounded))
    invoice.save()


# ── Serializers ──────────────────────────────────────────────────────────────

class InvoiceSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceSettings
        exclude = ['id', 'tenant', 'created_at', 'updated_at']

    def validate_serial_number_ranges(self, value):
        if not value:
            return []
        out = []
        for r in value:
            if not isinstance(r, dict):
                continue
            from_val = r.get('from')
            to_val = r.get('to')
            if from_val is None or to_val is None:
                continue
            try:
                from_val = int(from_val)
                to_val = int(to_val)
            except (TypeError, ValueError):
                continue
            if from_val > to_val:
                continue
            current = r.get('current')
            if current is None:
                current = from_val
            else:
                try:
                    current = int(current)
                except (TypeError, ValueError):
                    current = from_val
            out.append({'from': from_val, 'to': to_val, 'current': current})
        return out


class InvoiceLineItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceLineItem
        fields = '__all__'
        read_only_fields = ['id', 'invoice', 'created_at', 'updated_at',
                            'taxable_value', 'cgst_rate', 'cgst_amount',
                            'sgst_rate', 'sgst_amount', 'igst_rate', 'igst_amount',
                            'cess_amount', 'total']


class DispatchStickerSerializer(serializers.ModelSerializer):
    class Meta:
        model = DispatchSticker
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'created_by']


class DispatchStickerDetailSerializer(serializers.ModelSerializer):
    """Dispatch sticker with full invoice details for list/detail and PDF."""
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    from_name = serializers.SerializerMethodField()
    from_address = serializers.SerializerMethodField()
    to_name = serializers.CharField(source='invoice.recipient_name', read_only=True)
    to_address = serializers.SerializerMethodField()
    product_names = serializers.SerializerMethodField()
    grand_total = serializers.DecimalField(
        source='invoice.grand_total', max_digits=14, decimal_places=2, read_only=True
    )
    line_items_summary = serializers.SerializerMethodField()
    dispatch_code = serializers.SerializerMethodField()

    class Meta:
        model = DispatchSticker
        fields = [
            'id', 'invoice', 'invoice_number', 'courier', 'courier_name_custom',
            'awb_number', 'weight_kg', 'dimensions', 'dispatched_at', 'tracking_url',
            'from_name', 'from_address', 'to_name', 'to_address',
            'product_names', 'line_items_summary', 'grand_total', 'dispatch_code',
            'created_at', 'created_by',
        ]

    def get_from_address(self, obj):
        has_override_cols = bool(self.context.get('has_sticker_override_columns', True))
        if has_override_cols:
            try:
                if obj.from_address_override:
                    return obj.from_address_override
            except Exception:
                pass
        inv = obj.invoice
        # Some older invoice rows/models may not have supplier_city/supplier_pincode.
        # Use getattr fallback to avoid breaking dispatch list serialization.
        parts = [
            getattr(inv, 'supplier_address', '') or '',
            getattr(inv, 'supplier_city', '') or '',
            getattr(inv, 'supplier_state', '') or '',
            getattr(inv, 'supplier_pincode', '') or '',
        ]
        return ', '.join(p for p in parts if p).strip() or '—'

    def get_from_name(self, obj):
        has_override_cols = bool(self.context.get('has_sticker_override_columns', True))
        if has_override_cols:
            try:
                if obj.from_name_override:
                    return obj.from_name_override
            except Exception:
                pass
        return getattr(obj.invoice, 'supplier_name', '') or '—'

    def get_to_address(self, obj):
        inv = obj.invoice
        parts = [inv.recipient_address, inv.recipient_city or '', inv.recipient_state or '', inv.recipient_pincode or '']
        return ', '.join(p for p in parts if p).strip() or '—'

    def get_product_names(self, obj):
        return [item.description for item in obj.invoice.line_items.all()]

    def get_line_items_summary(self, obj):
        return [
            {'description': item.description, 'quantity': str(item.quantity), 'rate': str(item.rate), 'total': str(item.total)}
            for item in obj.invoice.line_items.all()
        ]

    def get_dispatch_code(self, obj):
        inv = obj.invoice
        awb = obj.awb_number or 'NA'
        return f'DISP-{obj.id}-{inv.invoice_number}-{awb}'


def _serialize_lead_for_invoice(lead):
    """Return lead details dict for Invoice display."""
    if not lead:
        return None
    return {
        'id': lead.id,
        'name': lead.name,
        'email': lead.email or '',
        'phone': lead.phone or '',
        'company': lead.company or '',
        'notes': lead.notes or '',
        'source': lead.source or '',
        'status': lead.status or '',
        'custom_data': lead.custom_data or {},
        'assigned_to_name': lead.assigned_to.full_name if lead.assigned_to else None,
    }


class InvoiceSerializer(serializers.ModelSerializer):
    line_items = InvoiceLineItemSerializer(many=True, read_only=True)
    dispatch_stickers = DispatchStickerSerializer(many=True, read_only=True)
    order_number = serializers.SerializerMethodField()
    lead_details = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = '__all__'
        read_only_fields = ['id', 'invoice_number', 'created_at', 'updated_at', 'created_by',
                            'total_taxable_value', 'total_cgst', 'total_sgst', 'total_igst',
                            'total_cess', 'total_discount', 'round_off', 'grand_total',
                            'grand_total_words', 'subtotal', 'tax_amount', 'discount_amount',
                            'total_amount']

    def get_order_number(self, obj):
        return obj.order.order_number if obj.order else None

    def get_lead_details(self, obj):
        import re
        from apps.crm.models import Lead
        # From inventory_approval.lead if set (e.g. from CRM flow)
        if obj.inventory_approval_id:
            approval = getattr(obj, 'inventory_approval', None)
            if approval and getattr(approval, 'lead_id', None):
                lead = getattr(approval, 'lead', None)
                if lead:
                    return _serialize_lead_for_invoice(lead)
        # From order.external_id (lead-123)
        if obj.order_id:
            order = getattr(obj, 'order', None)
            if order and order.external_id:
                m = re.match(r'^lead-(\d+)$', str(order.external_id).strip())
                if m:
                    try:
                        lead = Lead.objects.get(pk=int(m.group(1)))
                        return _serialize_lead_for_invoice(lead)
                    except (Lead.DoesNotExist, ValueError):
                        pass
        return None


class InvoiceListSerializer(serializers.ModelSerializer):
    order_number = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = ['id', 'invoice_number', 'invoice_type', 'supply_type', 'order',
                  'order_number', 'status', 'is_gst', 'recipient_name', 'recipient_gstin',
                  'grand_total', 'total_amount', 'due_date', 'paid_at', 'created_at']

    def get_order_number(self, obj):
        return obj.order.order_number if obj.order else None


class CustomInvoiceStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomInvoiceStatus
        fields = ['id', 'key', 'label', 'color', 'order', 'is_active']
        read_only_fields = ['id']


class InvoiceFlowActionSerializer(serializers.ModelSerializer):
    status_label = serializers.SerializerMethodField()

    class Meta:
        model = InvoiceFlowAction
        fields = ['id', 'status_key', 'status_label', 'target_module', 'action',
                  'is_active', 'description']
        read_only_fields = ['id']

    def get_status_label(self, obj):
        try:
            return CustomInvoiceStatus.objects.get(key=obj.status_key).label
        except CustomInvoiceStatus.DoesNotExist:
            return obj.status_key


class DispatchSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = DispatchSettings
        fields = ['id', 'flow_after_dispatch', 'default_tracking_status', 'from_address_options', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class CourierPartnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourierPartner
        exclude = ['tenant']
        read_only_fields = ['id', 'created_at', 'updated_at']


class CustomDispatchStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomDispatchStatus
        exclude = ['tenant']
        read_only_fields = ['id', 'created_at', 'updated_at']


class DispatchFlowActionSerializer(serializers.ModelSerializer):
    status_label = serializers.SerializerMethodField()

    class Meta:
        model = DispatchFlowAction
        exclude = ['tenant']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_status_label(self, obj):
        try:
            return CustomDispatchStatus.objects.get(tenant=obj.tenant, key=obj.status_key).label
        except CustomDispatchStatus.DoesNotExist:
            return obj.status_key


class IndianStatesSerializer(serializers.Serializer):
    code = serializers.CharField()
    name = serializers.CharField()


class GSTSlabSerializer(serializers.Serializer):
    rate = serializers.DecimalField(max_digits=5, decimal_places=2)
    label = serializers.CharField()
