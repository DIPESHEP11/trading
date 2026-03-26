from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.http import HttpResponse
from django.utils import timezone
from django.db import connection
from decimal import Decimal
from apps.invoices.models import (
    Invoice, InvoiceLineItem, DispatchSticker, InvoiceSettings,
    CustomInvoiceStatus, InvoiceFlowAction, INDIAN_STATES, GST_TAX_SLABS,
    DispatchSettings, CourierPartner, CustomDispatchStatus, DispatchFlowAction,
)
from apps.invoices.pdf_generator import generate_invoice_pdf, generate_dispatch_sticker_pdf, qrcode_png_bytes
from apps.core.responses import success_response, error_response
from apps.core.permissions import IsStaffOrAbove, IsTenantAdmin
from .serializers import (
    InvoiceSerializer, InvoiceListSerializer, InvoiceLineItemSerializer,
    DispatchStickerSerializer, DispatchStickerDetailSerializer, InvoiceSettingsSerializer,
    CustomInvoiceStatusSerializer, InvoiceFlowActionSerializer,
    DispatchSettingsSerializer, CourierPartnerSerializer,
    CustomDispatchStatusSerializer, DispatchFlowActionSerializer,
    calculate_line_item_tax, calculate_invoice_totals,
)


# ── Defaults ─────────────────────────────────────────────────────────────────

DEFAULT_INVOICE_STATUSES = [
    {'key': 'draft',     'label': 'Draft',     'color': '#64748b', 'order': 0},
    {'key': 'sent',      'label': 'Sent',      'color': '#3b82f6', 'order': 1},
    {'key': 'paid',      'label': 'Paid',      'color': '#10b981', 'order': 2},
    {'key': 'overdue',   'label': 'Overdue',   'color': '#ef4444', 'order': 3},
    {'key': 'cancelled', 'label': 'Cancelled', 'color': '#dc2626', 'order': 4},
    {'key': 'proforma',  'label': 'Proforma',  'color': '#8b5cf6', 'order': 5},
]


def _seed_invoice_defaults():
    if not CustomInvoiceStatus.objects.exists():
        for s in DEFAULT_INVOICE_STATUSES:
            CustomInvoiceStatus.objects.create(**s)


def _get_or_create_settings(tenant):
    settings, _ = InvoiceSettings.objects.get_or_create(tenant=tenant)
    return settings


def _get_tenant(request):
    return getattr(request, 'tenant', None) or getattr(connection, 'tenant', None)


def _get_or_create_dispatch_settings(tenant):
    if tenant is None:
        return None
    settings, _ = DispatchSettings.objects.get_or_create(tenant=tenant)
    return settings


def _has_dispatch_from_options_column():
    """Return True if tenant schema has dispatch from_address_options column."""
    table_name = DispatchSettings._meta.db_table
    with connection.cursor() as cursor:
        cols = connection.introspection.get_table_description(cursor, table_name)
    return any(getattr(c, 'name', None) == 'from_address_options' for c in cols)


def _has_dispatch_sticker_override_columns():
    """Return True if tenant schema has dispatch sticker override columns."""
    table_name = DispatchSticker._meta.db_table
    with connection.cursor() as cursor:
        cols = connection.introspection.get_table_description(cursor, table_name)
    names = {getattr(c, 'name', None) for c in cols}
    return 'from_name_override' in names and 'from_address_override' in names


# ── Reference data endpoints ─────────────────────────────────────────────────

class IndianStatesView(APIView):
    """GET /api/v1/invoices/ref/states/"""
    permission_classes = [IsStaffOrAbove]

    def get(self, request):
        data = [{'code': c, 'name': n} for c, n in INDIAN_STATES]
        return success_response(data={'states': data})


class GSTSlabsView(APIView):
    """GET /api/v1/invoices/ref/gst-slabs/"""
    permission_classes = [IsStaffOrAbove]

    def get(self, request):
        data = [{'rate': r, 'label': l} for r, l in GST_TAX_SLABS]
        return success_response(data={'slabs': data})


# ── Invoice Settings ─────────────────────────────────────────────────────────

class InvoiceSettingsView(APIView):
    """GET PUT /api/v1/invoices/settings/"""
    permission_classes = [IsStaffOrAbove]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        settings = _get_or_create_settings(request.tenant)
        return success_response(data=InvoiceSettingsSerializer(settings).data)

    def put(self, request):
        self.permission_classes = [IsTenantAdmin]
        self.check_permissions(request)
        settings = _get_or_create_settings(request.tenant)
        serializer = InvoiceSettingsSerializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(data=serializer.data, message='Invoice settings updated.')


class InvoiceLogoUploadView(APIView):
    """POST /api/v1/invoices/settings/logo/ — upload company logo."""
    permission_classes = [IsTenantAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        settings = _get_or_create_settings(request.tenant)
        logo = request.FILES.get('company_logo')
        sig = request.FILES.get('signature_image')
        if logo:
            settings.company_logo = logo
        if sig:
            settings.signature_image = sig
        settings.save()
        return success_response(
            data=InvoiceSettingsSerializer(settings).data,
            message='Logo/signature uploaded.')


class InvoicePDFView(APIView):
    """GET /api/v1/invoices/<id>/pdf/ — download invoice as PDF."""
    permission_classes = [IsStaffOrAbove]

    def get(self, request, pk):
        try:
            invoice = Invoice.objects.prefetch_related('line_items').get(pk=pk)
        except Invoice.DoesNotExist:
            return error_response('Invoice not found.', http_status=404)

        inv_settings = _get_or_create_settings(request.tenant)
        try:
            pdf_bytes = generate_invoice_pdf(invoice, inv_settings)
        except Exception as e:
            return error_response(f'PDF generation failed: {str(e)}', http_status=500)

        filename = f'{invoice.invoice_number}.pdf'
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response


# ── Invoice CRUD ─────────────────────────────────────────────────────────────

class InvoiceListCreateView(generics.ListCreateAPIView):
    """GET POST /api/v1/invoices/"""
    permission_classes = [IsStaffOrAbove]

    def get_serializer_class(self):
        return InvoiceListSerializer if self.request.method == 'GET' else InvoiceSerializer

    def get_queryset(self):
        qs = Invoice.objects.all().select_related('order')
        status_filter = self.request.query_params.get('status')
        invoice_type = self.request.query_params.get('type')
        search = self.request.query_params.get('search')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if invoice_type:
            qs = qs.filter(invoice_type=invoice_type)
        if search:
            qs = qs.filter(invoice_number__icontains=search) | qs.filter(
                recipient_name__icontains=search)
        return qs

    def list(self, request, *args, **kwargs):
        _seed_invoice_defaults()
        qs = self.get_queryset()
        data = InvoiceListSerializer(qs, many=True).data
        all_statuses = CustomInvoiceStatus.objects.filter(is_active=True)
        stats = {s.key: Invoice.objects.filter(status=s.key).count() for s in all_statuses}
        return success_response(data={'invoices': data, 'count': len(data), 'stats': stats})

    def create(self, request, *args, **kwargs):
        settings = _get_or_create_settings(request.tenant)
        data = request.data.copy()
        line_items_data = data.pop('line_items', [])

        # Accept is_gst from request or fall back to settings
        if 'is_gst' not in data:
            data['is_gst'] = settings.tax_type == 'indian_gst'
        else:
            data['is_gst'] = str(data['is_gst']).lower() in ('true', '1', 'yes')

        if data.get('is_gst'):
            if data.get('invoice_type') not in ('proforma',):
                data.setdefault('invoice_type', 'tax_invoice')
        else:
            if data.get('invoice_type') not in ('proforma',):
                data.setdefault('invoice_type', 'bill_of_supply')

        # Auto-fill supplier info from settings
        data.setdefault('supplier_name', settings.supplier_name)
        data.setdefault('supplier_address', settings.supplier_address)
        data.setdefault('supplier_state', settings.supplier_state)
        data.setdefault('supplier_state_code', settings.supplier_state)
        if data.get('is_gst'):
            data.setdefault('supplier_gstin', settings.supplier_gstin)

        # Determine intra-state
        supplier_state = data.get('supplier_state') or settings.supplier_state
        place_of_supply = data.get('place_of_supply') or data.get('recipient_state', '')
        is_intra = supplier_state == place_of_supply if (supplier_state and place_of_supply) else True
        data['is_intra_state'] = is_intra

        # Bank details snapshot
        data.setdefault('bank_name', settings.bank_name)
        data.setdefault('bank_account_number', settings.bank_account_number)
        data.setdefault('bank_ifsc', settings.bank_ifsc)
        data.setdefault('bank_branch', settings.bank_branch)
        data.setdefault('terms', settings.default_terms)

        # Generate number
        is_proforma = data.get('invoice_type') == 'proforma'
        if is_proforma:
            data['invoice_number'] = settings.generate_proforma_number()
            data['status'] = 'proforma'
        else:
            data['invoice_number'] = settings.generate_invoice_number()

        # Due date
        if not data.get('due_date') and settings.default_due_days:
            from datetime import timedelta
            data['due_date'] = (timezone.now().date() + timedelta(days=settings.default_due_days)).isoformat()

        serializer = InvoiceSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        invoice = serializer.save(created_by=request.user)

        # Create line items with tax calculation
        for item_data in line_items_data:
            item_data = calculate_line_item_tax(item_data, invoice.is_gst, is_intra)
            InvoiceLineItem.objects.create(invoice=invoice, **item_data)

        calculate_invoice_totals(invoice)

        # E-invoicing placeholder
        if settings.e_invoicing_enabled and invoice.is_gst:
            invoice.irn = f'IRN-PLACEHOLDER-{invoice.invoice_number}'
            invoice.qr_code_data = f'upi://pay?pa={settings.bank_upi_id}&am={invoice.grand_total}'
            invoice.save(update_fields=['irn', 'qr_code_data'])

        return success_response(
            data=InvoiceSerializer(invoice).data,
            message='Invoice created.', http_status=status.HTTP_201_CREATED)


class InvoiceDetailView(generics.RetrieveUpdateAPIView):
    """GET PUT PATCH /api/v1/invoices/<id>/"""
    serializer_class = InvoiceSerializer
    permission_classes = [IsStaffOrAbove]
    queryset = Invoice.objects.select_related(
        'order', 'inventory_approval', 'inventory_approval__lead'
    )

    def retrieve(self, request, *args, **kwargs):
        return success_response(data=InvoiceSerializer(self.get_object()).data)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        invoice = self.get_object()
        old_status = invoice.status
        serializer = self.get_serializer(invoice, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        invoice = serializer.save()

        flow_result = None
        if old_status != invoice.status:
            flow_result = _execute_invoice_flow(invoice, request.user)

        data = InvoiceSerializer(invoice).data
        if flow_result:
            data['flow_result'] = flow_result
        return success_response(data=data, message='Invoice updated.')


# ── Orders pending invoice (from order flow → invoices) ─────────────────────

class OrdersPendingInvoiceView(APIView):
    """GET /api/v1/invoices/orders-pending/ — orders assigned to invoice module but no invoice yet."""
    permission_classes = [IsStaffOrAbove]

    def get(self, request):
        try:
            from apps.orders.models import Order
            # Orders with status invoiced or warehouse that have no linked invoice
            order_ids_with_invoice = Invoice.objects.filter(order_id__isnull=False).values_list('order_id', flat=True)
            qs = Order.objects.filter(
                status__in=['invoiced', 'warehouse']
            ).exclude(
                id__in=order_ids_with_invoice
            ).select_related('customer').prefetch_related('items__product').order_by('-created_at')
            data = []
            for o in qs:
                items_data = [
                    {'product_id': i.product_id, 'product_name': i.product.name, 'quantity': float(i.quantity),
                     'unit_price': str(i.unit_price), 'total_price': str(i.total_price)}
                    for i in o.items.all()
                ]
                data.append({
                    'id': o.id, 'order_number': o.order_number, 'source': o.source, 'status': o.status,
                    'customer': o.customer_id,
                    'customer_name': o.customer.full_name if o.customer else (o.shipping_name or ''),
                    'shipping_name': o.shipping_name, 'shipping_phone': o.shipping_phone,
                    'shipping_address': o.shipping_address, 'shipping_city': o.shipping_city,
                    'shipping_state': o.shipping_state, 'shipping_pincode': o.shipping_pincode,
                    'total_amount': str(o.total_amount), 'subtotal': str(o.subtotal),
                    'tax_amount': str(o.tax_amount), 'discount_amount': str(o.discount_amount),
                    'notes': o.notes or '', 'items': items_data,
                    'lead_details': None,  # optional; frontend can derive from external_id if needed
                    'created_at': o.created_at.isoformat() if o.created_at else None,
                })
            return success_response(data={'orders': data, 'count': len(data)})
        except Exception as e:
            return error_response(f'Orders pending: {str(e)}', http_status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CreateInvoiceFromOrderView(APIView):
    """POST /api/v1/invoices/from-order/<order_id>/ — create proforma or invoice from order."""
    permission_classes = [IsStaffOrAbove]

    def post(self, request, order_id):
        from apps.orders.models import Order
        try:
            order = Order.objects.select_related('customer').prefetch_related('items__product').get(pk=order_id)
        except Order.DoesNotExist:
            return error_response('Order not found.', http_status=404)

        existing = Invoice.objects.filter(order=order).first()
        if existing:
            return error_response(f'Order already has an invoice: {existing.invoice_number}', http_status=400)

        if order.status not in ('invoiced', 'warehouse'):
            return error_response('Order must be in Invoiced or In Warehouse status.', http_status=400)

        settings = _get_or_create_settings(request.tenant)
        invoice_type = (request.data.get('invoice_type') or 'proforma').strip()
        if invoice_type not in ('proforma', 'tax_invoice', 'bill_of_supply'):
            invoice_type = 'proforma'

        is_gst = settings.tax_type == 'indian_gst'
        if invoice_type == 'proforma':
            inv_type = 'proforma'
            status_val = 'proforma'
            inv_number = settings.generate_proforma_number()
        else:
            inv_type = 'tax_invoice' if is_gst else 'bill_of_supply'
            status_val = 'draft'
            inv_number = settings.generate_invoice_number()

        recipient_name = order.shipping_name or (order.customer.full_name if order.customer else 'Customer')
        recipient_phone = order.shipping_phone or (order.customer.phone if order.customer else '')
        recipient_email = order.customer.email if order.customer else ''
        recipient_address = order.shipping_address or ''
        recipient_city = order.shipping_city or ''
        recipient_state = order.shipping_state or ''
        recipient_pincode = order.shipping_pincode or ''
        place_of_supply = recipient_state

        supplier_state = settings.supplier_state
        is_intra = supplier_state == place_of_supply if (supplier_state and place_of_supply) else True

        due_days = getattr(settings, 'default_due_days', 30) or 30
        from datetime import timedelta
        due_date = (timezone.now().date() + timedelta(days=due_days)).isoformat()

        invoice = Invoice.objects.create(
            invoice_number=inv_number,
            invoice_type=inv_type,
            supply_type='b2b',
            order=order,
            status=status_val,
            is_gst=is_gst,
            is_intra_state=is_intra,
            supplier_name=settings.supplier_name or '',
            supplier_address=settings.supplier_address or '',
            supplier_state=settings.supplier_state or '',
            supplier_state_code=settings.supplier_state or '',
            supplier_gstin=settings.supplier_gstin or '',
            recipient_name=recipient_name,
            recipient_address=recipient_address,
            recipient_city=recipient_city,
            recipient_state=recipient_state,
            recipient_state_code=recipient_state,
            recipient_pincode=recipient_pincode,
            recipient_gstin='',
            recipient_phone=recipient_phone,
            recipient_email=recipient_email,
            place_of_supply=place_of_supply,
            bank_name=settings.bank_name or '',
            bank_account_number=settings.bank_account_number or '',
            bank_ifsc=settings.bank_ifsc or '',
            bank_branch=settings.bank_branch or '',
            terms=settings.default_terms or '',
            due_date=due_date,
            created_by=request.user,
        )

        for oi in order.items.all():
            item_data = {
                'description': oi.product.name,
                'hsn_sac': '9983',
                'quantity': oi.quantity,
                'unit': 'NOS',
                'rate': oi.unit_price,
                'discount_amount': Decimal('0'),
                'tax_rate': settings.default_tax_rate if is_gst else Decimal('0'),
            }
            item_data = calculate_line_item_tax(item_data, is_gst, is_intra)
            InvoiceLineItem.objects.create(invoice=invoice, **item_data)

        calculate_invoice_totals(invoice)

        return success_response(
            data=InvoiceSerializer(invoice).data,
            message=f'{inv_type.replace("_", " ").title()} created from order.',
            http_status=status.HTTP_201_CREATED,
        )


# ── Line Items CRUD (add / update / delete from an invoice) ──────────────────

class InvoiceLineItemsView(APIView):
    """
    POST /api/v1/invoices/<invoice_id>/items/    — add item
    PUT  /api/v1/invoices/<invoice_id>/items/<item_id>/ — update item
    DELETE /api/v1/invoices/<invoice_id>/items/<item_id>/ — delete item
    """
    permission_classes = [IsStaffOrAbove]

    def post(self, request, invoice_id):
        try:
            invoice = Invoice.objects.get(pk=invoice_id)
        except Invoice.DoesNotExist:
            return error_response('Invoice not found.', http_status=404)

        item_data = calculate_line_item_tax(
            request.data.copy(), invoice.is_gst, invoice.is_intra_state)
        item = InvoiceLineItem.objects.create(invoice=invoice, **item_data)
        calculate_invoice_totals(invoice)
        return success_response(
            data=InvoiceLineItemSerializer(item).data,
            message='Line item added.', http_status=status.HTTP_201_CREATED)

    def put(self, request, invoice_id, item_id=None):
        try:
            item = InvoiceLineItem.objects.get(pk=item_id, invoice_id=invoice_id)
        except InvoiceLineItem.DoesNotExist:
            return error_response('Line item not found.', http_status=404)

        item_data = calculate_line_item_tax(
            request.data.copy(), item.invoice.is_gst, item.invoice.is_intra_state)
        for k, v in item_data.items():
            setattr(item, k, v)
        item.save()
        calculate_invoice_totals(item.invoice)
        return success_response(data=InvoiceLineItemSerializer(item).data, message='Line item updated.')

    def delete(self, request, invoice_id, item_id=None):
        try:
            item = InvoiceLineItem.objects.get(pk=item_id, invoice_id=invoice_id)
        except InvoiceLineItem.DoesNotExist:
            return error_response('Line item not found.', http_status=404)
        invoice = item.invoice
        item.delete()
        calculate_invoice_totals(invoice)
        return success_response(message='Line item deleted.')


# ── Convert Proforma to Tax Invoice ──────────────────────────────────────────

class ConvertProformaView(APIView):
    """POST /api/v1/invoices/<id>/convert/"""
    permission_classes = [IsStaffOrAbove]

    def post(self, request, pk):
        try:
            invoice = Invoice.objects.get(pk=pk)
        except Invoice.DoesNotExist:
            return error_response('Invoice not found.', http_status=404)

        if invoice.invoice_type != 'proforma':
            return error_response('Only proforma invoices can be converted.')

        settings = _get_or_create_settings(request.tenant)
        invoice.invoice_number = settings.generate_invoice_number()
        invoice.invoice_type = 'tax_invoice' if invoice.is_gst else 'bill_of_supply'
        invoice.status = 'draft'
        invoice.save()
        return success_response(
            data=InvoiceSerializer(invoice).data,
            message='Proforma converted to invoice.')


# ── GST Calculate Preview ────────────────────────────────────────────────────

class GSTCalculateView(APIView):
    """POST /api/v1/invoices/calculate/ — preview calculation without saving."""
    permission_classes = [IsStaffOrAbove]

    def post(self, request):
        is_gst = request.data.get('is_gst', False)
        supplier_state = request.data.get('supplier_state', '')
        place_of_supply = request.data.get('place_of_supply', '')
        is_intra = supplier_state == place_of_supply if (supplier_state and place_of_supply) else True

        items = request.data.get('line_items', [])
        calculated_items = []
        total_taxable = Decimal('0')
        total_cgst = Decimal('0')
        total_sgst = Decimal('0')
        total_igst = Decimal('0')

        for item in items:
            result = calculate_line_item_tax(item.copy(), is_gst, is_intra)
            calculated_items.append(result)
            total_taxable += Decimal(str(result.get('taxable_value', 0)))
            total_cgst += Decimal(str(result.get('cgst_amount', 0)))
            total_sgst += Decimal(str(result.get('sgst_amount', 0)))
            total_igst += Decimal(str(result.get('igst_amount', 0)))

        raw_total = total_taxable + total_cgst + total_sgst + total_igst
        from decimal import ROUND_HALF_UP
        rounded = raw_total.quantize(Decimal('1'), rounding=ROUND_HALF_UP)

        return success_response(data={
            'is_intra_state': is_intra,
            'line_items': calculated_items,
            'total_taxable_value': str(total_taxable),
            'total_cgst': str(total_cgst),
            'total_sgst': str(total_sgst),
            'total_igst': str(total_igst),
            'round_off': str(rounded - raw_total),
            'grand_total': str(rounded),
        })


# ── Flow execution ───────────────────────────────────────────────────────────

def _execute_invoice_flow(invoice, user):
    try:
        flow = InvoiceFlowAction.objects.get(status_key=invoice.status, is_active=True)
    except InvoiceFlowAction.DoesNotExist:
        return None

    result = {
        'status_key': flow.status_key,
        'target_module': flow.target_module,
        'action': flow.action,
        'executed': False,
        'message': '',
    }

    if flow.target_module == 'none' or flow.action == 'notify_only':
        result['executed'] = True
        result['message'] = f'Status changed to "{flow.status_key}" (Invoices only).'
        return result

    if flow.action == 'mark_dispatch' and flow.target_module == 'dispatch':
        result['executed'] = True
        result['message'] = 'Invoice marked for dispatch.'
        return result

    if flow.action == 'send_to_warehouse' and flow.target_module == 'warehouse':
        from apps.warehouses.models import InventoryApproval
        last_apr = InventoryApproval.objects.order_by('-id').first()
        num = (last_apr.id + 1) if last_apr else 1
        req_number = f'INV-APR-{num:05d}'
        items = []
        for li in invoice.line_items.all():
            items.append({
                'product_id': None,
                'product_name': li.description,
                'quantity': float(li.quantity),
                'notes': f'₹{li.rate}/unit',
            })
        InventoryApproval.objects.create(
            request_number=req_number,
            source_module='invoices',
            source_reference=invoice.invoice_number,
            requested_action='stock_out',
            next_module='dispatch',
            notes=f'Auto from invoice. Invoice: {invoice.invoice_number} — {invoice.recipient_name}',
            items=items,
            requested_by=user,
        )
        result['executed'] = True
        result['message'] = f'Inventory approval {req_number} created — awaiting approval.'
        return result

    result['message'] = 'Flow configured but action not yet fully implemented.'
    return result


# ── Dispatch ─────────────────────────────────────────────────────────────────

class DispatchListCreateView(generics.ListCreateAPIView):
    """GET POST /api/v1/invoices/dispatch/ — list with full details, create sticker."""
    permission_classes = [IsStaffOrAbove]

    def get_queryset(self):
        qs = DispatchSticker.objects.all().select_related('invoice').prefetch_related('invoice__line_items')
        if not _has_dispatch_sticker_override_columns():
            qs = qs.defer('from_name_override', 'from_address_override')
        return qs

    def get_serializer_class(self):
        return DispatchStickerDetailSerializer if self.request.method == 'GET' else DispatchStickerSerializer

    def list(self, request, *args, **kwargs):
        data = DispatchStickerDetailSerializer(
            self.get_queryset(),
            many=True,
            context={'has_sticker_override_columns': _has_dispatch_sticker_override_columns()},
        ).data
        return success_response(data={'dispatch': data, 'count': len(data)})

    def create(self, request, *args, **kwargs):
        if not _has_dispatch_sticker_override_columns():
            return error_response(
                'Dispatch schema update pending for this tenant. Please run tenant migrations and try again.',
                http_status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = DispatchStickerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sticker = serializer.save(created_by=request.user, dispatched_at=timezone.now())
        return success_response(
            data=DispatchStickerSerializer(sticker).data,
            message='Dispatch sticker created.', http_status=status.HTTP_201_CREATED)


class DispatchStickerDetailView(APIView):
    """GET /api/v1/invoices/dispatch/<id>/ — single sticker with full invoice details."""
    permission_classes = [IsStaffOrAbove]

    def get(self, request, pk):
        try:
            qs = DispatchSticker.objects.select_related('invoice').prefetch_related('invoice__line_items')
            if not _has_dispatch_sticker_override_columns():
                qs = qs.defer('from_name_override', 'from_address_override')
            sticker = qs.get(pk=pk)
        except DispatchSticker.DoesNotExist:
            return error_response('Dispatch sticker not found.', http_status=404)
        return success_response(data=DispatchStickerDetailSerializer(
            sticker,
            context={'has_sticker_override_columns': _has_dispatch_sticker_override_columns()},
        ).data)


class DispatchStickerPDFView(APIView):
    """GET /api/v1/invoices/dispatch/<id>/pdf/ — download dispatch sticker as PDF."""
    permission_classes = [IsStaffOrAbove]

    def get(self, request, pk):
        try:
            qs = DispatchSticker.objects.select_related('invoice').prefetch_related('invoice__line_items')
            if not _has_dispatch_sticker_override_columns():
                qs = qs.defer('from_name_override', 'from_address_override')
            sticker = qs.get(pk=pk)
        except DispatchSticker.DoesNotExist:
            return error_response('Dispatch sticker not found.', http_status=404)
        inv_settings = _get_or_create_settings(request.tenant)
        try:
            pdf_bytes = generate_dispatch_sticker_pdf(sticker, inv_settings)
        except Exception as e:
            return error_response(f'PDF generation failed: {str(e)}', http_status=500)
        filename = f'dispatch-{sticker.invoice.invoice_number}-{sticker.awb_number or sticker.id}.pdf'
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class DispatchStickerQRView(APIView):
    """GET /api/v1/invoices/dispatch/<id>/qr/ — Product/Dispatch ID as QR code PNG."""
    permission_classes = [IsStaffOrAbove]

    def get(self, request, pk):
        try:
            sticker = DispatchSticker.objects.select_related('invoice').get(pk=pk)
        except DispatchSticker.DoesNotExist:
            return error_response('Dispatch sticker not found.', http_status=404)
        dispatch_code = f'DISP-{sticker.id}-{sticker.invoice.invoice_number}-{sticker.awb_number or "NA"}'
        png_bytes = qrcode_png_bytes(dispatch_code)
        if not png_bytes:
            return error_response('QR generation not available.', http_status=503)
        return HttpResponse(png_bytes, content_type='image/png')


# ── Dispatch Settings & Courier Partners ─────────────────────────────────────

class DispatchSettingsView(APIView):
    """GET PUT /api/v1/invoices/dispatch/settings/ — flow after dispatch."""
    permission_classes = [IsStaffOrAbove]

    def get(self, request):
        tenant = _get_tenant(request)
        if tenant is None:
            return error_response(
                'Tenant not identified. Use your tenant domain or ensure you are logged in.',
                http_status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            has_from_options = _has_dispatch_from_options_column()
            if has_from_options:
                settings = _get_or_create_dispatch_settings(tenant)
                return success_response(data=DispatchSettingsSerializer(settings).data)

            # Compatibility mode for tenants where new migration is not applied yet.
            settings = DispatchSettings.objects.only(
                'id', 'tenant', 'flow_after_dispatch', 'default_tracking_status', 'created_at', 'updated_at'
            ).filter(tenant=tenant).first()
            if settings is None:
                return success_response(data={
                    'id': None,
                    'flow_after_dispatch': 'notify_only',
                    'default_tracking_status': '',
                    'from_address_options': [],
                    'created_at': None,
                    'updated_at': None,
                })
            return success_response(data={
                'id': settings.id,
                'flow_after_dispatch': settings.flow_after_dispatch,
                'default_tracking_status': settings.default_tracking_status,
                'from_address_options': [],
                'created_at': settings.created_at,
                'updated_at': settings.updated_at,
            })
        except Exception as e:
            return error_response(
                f'Could not load dispatch settings: {str(e)}. Ensure tenant migrations are run.',
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def put(self, request):
        self.permission_classes = [IsTenantAdmin]
        self.check_permissions(request)
        tenant = _get_tenant(request)
        if tenant is None:
            return error_response(
                'Tenant not identified. Use your tenant domain or ensure you are logged in.',
                http_status=status.HTTP_400_BAD_REQUEST,
            )
        has_from_options = _has_dispatch_from_options_column()
        if has_from_options:
            settings = _get_or_create_dispatch_settings(tenant)
            if settings is None:
                return error_response('Dispatch settings not available.', http_status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            serializer = DispatchSettingsSerializer(settings, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return success_response(data=serializer.data, message='Dispatch settings updated.')

        # Compatibility mode: ignore from_address_options when column does not exist yet.
        settings = DispatchSettings.objects.only(
            'id', 'tenant', 'flow_after_dispatch', 'default_tracking_status', 'created_at', 'updated_at'
        ).filter(tenant=tenant).first()
        if settings is None:
            return error_response('Dispatch settings not found for this tenant. Run tenant migrations first.', http_status=400)

        if 'flow_after_dispatch' in request.data:
            settings.flow_after_dispatch = request.data.get('flow_after_dispatch') or settings.flow_after_dispatch
        if 'default_tracking_status' in request.data:
            settings.default_tracking_status = request.data.get('default_tracking_status') or ''
        settings.save(update_fields=['flow_after_dispatch', 'default_tracking_status', 'updated_at'])
        return success_response(data={
            'id': settings.id,
            'flow_after_dispatch': settings.flow_after_dispatch,
            'default_tracking_status': settings.default_tracking_status,
            'from_address_options': [],
            'created_at': settings.created_at,
            'updated_at': settings.updated_at,
        }, message='Dispatch settings updated.')


class CourierPartnerListCreateView(APIView):
    """GET POST /api/v1/invoices/dispatch/partners/"""
    permission_classes = [IsStaffOrAbove]

    def get(self, request):
        tenant = _get_tenant(request)
        if tenant is None:
            return error_response(
                'Tenant not identified. Use your tenant domain or ensure you are logged in.',
                http_status=status.HTTP_400_BAD_REQUEST,
            )
        partners = CourierPartner.objects.filter(tenant=tenant)
        return success_response(data={'partners': CourierPartnerSerializer(partners, many=True).data})

    def post(self, request):
        self.permission_classes = [IsTenantAdmin]
        self.check_permissions(request)
        tenant = _get_tenant(request)
        if tenant is None:
            return error_response(
                'Tenant not identified. Use your tenant domain or ensure you are logged in.',
                http_status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = CourierPartnerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(tenant=tenant)
        return success_response(
            data=CourierPartnerSerializer(serializer.instance).data,
            message='Courier partner added.', http_status=status.HTTP_201_CREATED)


class CourierPartnerDetailView(APIView):
    """GET PUT DELETE /api/v1/invoices/dispatch/partners/<id>/"""
    permission_classes = [IsStaffOrAbove]

    def _get_tenant_or_fail(self, request):
        tenant = _get_tenant(request)
        if tenant is None:
            return None, error_response(
                'Tenant not identified. Use your tenant domain or ensure you are logged in.',
                http_status=status.HTTP_400_BAD_REQUEST,
            )
        return tenant, None

    def _get_partner(self, request, pk):
        tenant = _get_tenant(request)
        return CourierPartner.objects.get(pk=pk, tenant=tenant)

    def get(self, request, pk):
        tenant, err = self._get_tenant_or_fail(request)
        if err is not None:
            return err
        try:
            partner = self._get_partner(request, pk)
        except CourierPartner.DoesNotExist:
            return error_response('Courier partner not found.', http_status=404)
        return success_response(data=CourierPartnerSerializer(partner).data)

    def put(self, request, pk):
        self.permission_classes = [IsTenantAdmin]
        self.check_permissions(request)
        tenant, err = self._get_tenant_or_fail(request)
        if err is not None:
            return err
        try:
            partner = self._get_partner(request, pk)
        except CourierPartner.DoesNotExist:
            return error_response('Courier partner not found.', http_status=404)
        serializer = CourierPartnerSerializer(partner, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(data=serializer.data, message='Courier partner updated.')

    def delete(self, request, pk):
        self.permission_classes = [IsTenantAdmin]
        self.check_permissions(request)
        tenant, err = self._get_tenant_or_fail(request)
        if err is not None:
            return err
        try:
            partner = self._get_partner(request, pk)
        except CourierPartner.DoesNotExist:
            return error_response('Courier partner not found.', http_status=404)
        partner.delete()
        return success_response(message='Courier partner deleted.')


# ── Dispatch Statuses & Flow Actions ──────────────────────────────────────────

def _dispatch_tenant_or_fail(request):
    tenant = _get_tenant(request)
    if tenant is None:
        return None, error_response(
            'Tenant not identified. Use your tenant domain or ensure you are logged in.',
            http_status=status.HTTP_400_BAD_REQUEST,
        )
    return tenant, None


class DispatchStatusListCreateView(APIView):
    """GET POST /api/v1/invoices/dispatch/statuses/"""
    permission_classes = [IsStaffOrAbove]

    def get(self, request):
        tenant, err = _dispatch_tenant_or_fail(request)
        if err is not None:
            return err
        statuses = CustomDispatchStatus.objects.filter(tenant=tenant)
        return success_response(data={'statuses': CustomDispatchStatusSerializer(statuses, many=True).data})

    def post(self, request):
        self.permission_classes = [IsTenantAdmin]
        self.check_permissions(request)
        tenant, err = _dispatch_tenant_or_fail(request)
        if err is not None:
            return err
        serializer = CustomDispatchStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(tenant=tenant)
        return success_response(
            data=CustomDispatchStatusSerializer(serializer.instance).data,
            message='Dispatch status added.', http_status=status.HTTP_201_CREATED)


class DispatchStatusDetailView(APIView):
    """GET PUT DELETE /api/v1/invoices/dispatch/statuses/<id>/"""
    permission_classes = [IsStaffOrAbove]

    def get(self, request, pk):
        tenant, err = _dispatch_tenant_or_fail(request)
        if err is not None:
            return err
        try:
            obj = CustomDispatchStatus.objects.get(pk=pk, tenant=tenant)
        except CustomDispatchStatus.DoesNotExist:
            return error_response('Dispatch status not found.', http_status=404)
        return success_response(data=CustomDispatchStatusSerializer(obj).data)

    def put(self, request, pk):
        self.permission_classes = [IsTenantAdmin]
        self.check_permissions(request)
        tenant, err = _dispatch_tenant_or_fail(request)
        if err is not None:
            return err
        try:
            obj = CustomDispatchStatus.objects.get(pk=pk, tenant=tenant)
        except CustomDispatchStatus.DoesNotExist:
            return error_response('Dispatch status not found.', http_status=404)
        serializer = CustomDispatchStatusSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(data=serializer.data, message='Dispatch status updated.')

    def delete(self, request, pk):
        self.permission_classes = [IsTenantAdmin]
        self.check_permissions(request)
        tenant, err = _dispatch_tenant_or_fail(request)
        if err is not None:
            return err
        try:
            obj = CustomDispatchStatus.objects.get(pk=pk, tenant=tenant)
        except CustomDispatchStatus.DoesNotExist:
            return error_response('Dispatch status not found.', http_status=404)
        obj.delete()
        return success_response(message='Dispatch status deleted.')


class DispatchFlowActionListCreateView(APIView):
    """GET POST /api/v1/invoices/dispatch/flow-actions/"""
    permission_classes = [IsStaffOrAbove]

    def get(self, request):
        tenant, err = _dispatch_tenant_or_fail(request)
        if err is not None:
            return err
        actions = DispatchFlowAction.objects.filter(tenant=tenant)
        return success_response(data={'flow_actions': DispatchFlowActionSerializer(actions, many=True).data})

    def post(self, request):
        self.permission_classes = [IsTenantAdmin]
        self.check_permissions(request)
        tenant, err = _dispatch_tenant_or_fail(request)
        if err is not None:
            return err
        serializer = DispatchFlowActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(tenant=tenant)
        return success_response(
            data=DispatchFlowActionSerializer(serializer.instance).data,
            message='Flow action added.', http_status=status.HTTP_201_CREATED)


class DispatchFlowActionDetailView(APIView):
    """GET PUT DELETE /api/v1/invoices/dispatch/flow-actions/<id>/"""
    permission_classes = [IsStaffOrAbove]

    def get(self, request, pk):
        tenant, err = _dispatch_tenant_or_fail(request)
        if err is not None:
            return err
        try:
            obj = DispatchFlowAction.objects.get(pk=pk, tenant=tenant)
        except DispatchFlowAction.DoesNotExist:
            return error_response('Flow action not found.', http_status=404)
        return success_response(data=DispatchFlowActionSerializer(obj).data)

    def put(self, request, pk):
        self.permission_classes = [IsTenantAdmin]
        self.check_permissions(request)
        tenant, err = _dispatch_tenant_or_fail(request)
        if err is not None:
            return err
        try:
            obj = DispatchFlowAction.objects.get(pk=pk, tenant=tenant)
        except DispatchFlowAction.DoesNotExist:
            return error_response('Flow action not found.', http_status=404)
        serializer = DispatchFlowActionSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(data=serializer.data, message='Flow action updated.')

    def delete(self, request, pk):
        self.permission_classes = [IsTenantAdmin]
        self.check_permissions(request)
        tenant, err = _dispatch_tenant_or_fail(request)
        if err is not None:
            return err
        try:
            obj = DispatchFlowAction.objects.get(pk=pk, tenant=tenant)
        except DispatchFlowAction.DoesNotExist:
            return error_response('Flow action not found.', http_status=404)
        obj.delete()
        return success_response(message='Flow action deleted.')


# ── Custom Invoice Statuses CRUD ─────────────────────────────────────────────

class CustomInvoiceStatusListCreateView(generics.ListCreateAPIView):
    serializer_class = CustomInvoiceStatusSerializer
    permission_classes = [IsStaffOrAbove]

    def get_queryset(self):
        return CustomInvoiceStatus.objects.all()

    def list(self, request, *args, **kwargs):
        _seed_invoice_defaults()
        data = CustomInvoiceStatusSerializer(self.get_queryset(), many=True).data
        return success_response(data={'statuses': data})

    def create(self, request, *args, **kwargs):
        self.permission_classes = [IsTenantAdmin]
        self.check_permissions(request)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()
        return success_response(
            data=CustomInvoiceStatusSerializer(obj).data,
            message='Status created.', http_status=status.HTTP_201_CREATED)


class CustomInvoiceStatusDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CustomInvoiceStatusSerializer
    permission_classes = [IsTenantAdmin]
    queryset = CustomInvoiceStatus.objects.all()

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()
        return success_response(data=CustomInvoiceStatusSerializer(obj).data, message='Status updated.')

    def destroy(self, request, *args, **kwargs):
        self.get_object().delete()
        return success_response(message='Status deleted.')


# ── Invoice Flow Actions CRUD ────────────────────────────────────────────────

class InvoiceFlowActionListCreateView(generics.ListCreateAPIView):
    serializer_class = InvoiceFlowActionSerializer
    permission_classes = [IsStaffOrAbove]

    def get_queryset(self):
        return InvoiceFlowAction.objects.all()

    def list(self, request, *args, **kwargs):
        data = InvoiceFlowActionSerializer(self.get_queryset(), many=True).data
        return success_response(data={'flow_actions': data})

    def create(self, request, *args, **kwargs):
        self.permission_classes = [IsTenantAdmin]
        self.check_permissions(request)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()
        return success_response(
            data=InvoiceFlowActionSerializer(obj).data,
            message='Flow action created.', http_status=status.HTTP_201_CREATED)


class InvoiceFlowActionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = InvoiceFlowActionSerializer
    permission_classes = [IsTenantAdmin]
    queryset = InvoiceFlowAction.objects.all()

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()
        return success_response(data=InvoiceFlowActionSerializer(obj).data, message='Flow action updated.')

    def destroy(self, request, *args, **kwargs):
        self.get_object().delete()
        return success_response(message='Flow action deleted.')
