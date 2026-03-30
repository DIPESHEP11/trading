from rest_framework import generics, status
from rest_framework.views import APIView
from django.utils import timezone
from django.db import connection
from decimal import Decimal
from apps.orders.models import Order, OrderStatusHistory, OrderStatus, CustomOrderStatus, OrderFlowAction
from apps.core.responses import success_response, error_response
from apps.core.permissions import IsStaffOrAbove, IsTenantAdmin
from .serializers import (
    OrderSerializer, OrderListSerializer, CreateOrderSerializer,
    CustomOrderStatusSerializer, OrderFlowActionSerializer,
)


# ── Default seeding ──────────────────────────────────────────────────────────

DEFAULT_ORDER_STATUSES = [
    {'key': 'pending',    'label': 'Pending',          'color': '#f59e0b', 'order': 0},
    {'key': 'approved',   'label': 'Approved',         'color': '#3b82f6', 'order': 1},
    {'key': 'warehouse',  'label': 'In Warehouse',     'color': '#8b5cf6', 'order': 2},
    {'key': 'invoiced',   'label': 'Invoiced',         'color': '#06b6d4', 'order': 3},
    {'key': 'dispatched', 'label': 'Dispatched',       'color': '#10b981', 'order': 4},
    {'key': 'delivered',  'label': 'Delivered',         'color': '#059669', 'order': 5},
    {'key': 'cancelled',  'label': 'Cancelled',        'color': '#ef4444', 'order': 6},
    {'key': 'returned',   'label': 'Returned',         'color': '#dc2626', 'order': 7},
    {'key': 'rejected',   'label': 'Rejected',         'color': '#be123c', 'order': 8},
]


def _seed_order_defaults():
    if not CustomOrderStatus.objects.exists():
        for s in DEFAULT_ORDER_STATUSES:
            CustomOrderStatus.objects.create(**s)
    # Default flow: approved → send to warehouse (so approval creates inventory request)
    if not OrderFlowAction.objects.exists():
        OrderFlowAction.objects.create(
            status_key='approved',
            target_module='warehouse',
            action='send_to_warehouse',
            is_active=True,
            description='When order is approved, create warehouse approval request',
        )


# ── Order flow execution ─────────────────────────────────────────────────────

def _execute_order_flow(order, user):
    try:
        flow = OrderFlowAction.objects.get(status_key=order.status, is_active=True)
    except OrderFlowAction.DoesNotExist:
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
        result['message'] = f'Status changed to "{flow.status_key}" (Orders only).'
        return result

    if flow.action == 'send_to_warehouse' and flow.target_module == 'warehouse':
        from apps.warehouses.models import InventoryApproval
        last_apr = InventoryApproval.objects.order_by('-id').first()
        num = (last_apr.id + 1) if last_apr else 1
        req_number = f'INV-APR-{num:05d}'
        # Include order items so approvers know what they're approving
        order_items = []
        for oi in order.items.select_related('product').all():
            order_items.append({
                'product_id': oi.product_id,
                'product_name': oi.product.name,
                'quantity': float(oi.quantity),
                'notes': f'₹{oi.unit_price}/unit',
            })
        InventoryApproval.objects.create(
            request_number=req_number,
            source_module='orders',
            source_reference=order.order_number,
            requested_action='stock_out',
            next_module='dispatch',
            notes=f'Auto from order flow. Order: {order.order_number} — {order.shipping_name or (order.customer.full_name if order.customer else "Customer")} — Total: ₹{order.total_amount}',
            items=order_items,
            requested_by=user,
        )
        order.status = 'warehouse'
        order.save(update_fields=['status'])
        OrderStatusHistory.objects.create(
            order=order, from_status='approved', to_status='warehouse',
            changed_by=user, note=f'Flow: Inventory approval {req_number} created')
        result['executed'] = True
        result['message'] = f'Inventory approval {req_number} created — awaiting warehouse approval.'
        return result

    if flow.action == 'create_invoice' and flow.target_module == 'invoices':
        # Create a real invoice/proforma from order so it appears in Invoice module.
        from apps.invoices.models import Invoice, InvoiceLineItem, InvoiceSettings
        from api.v1.invoices.serializers import calculate_line_item_tax, calculate_invoice_totals

        existing = Invoice.objects.filter(order=order).first()
        if existing:
            old = order.status
            order.status = 'invoiced'
            order.save(update_fields=['status'])
            OrderStatusHistory.objects.create(
                order=order, from_status=old, to_status='invoiced',
                changed_by=user, note=f'Flow: Existing invoice {existing.invoice_number} linked')
            result['executed'] = True
            result['message'] = f'Order linked to existing invoice {existing.invoice_number}.'
            return result

        tenant = getattr(connection, 'tenant', None) or getattr(user, 'tenant', None)
        settings, _ = InvoiceSettings.objects.get_or_create(tenant=tenant)
        is_gst = settings.tax_type == 'indian_gst'
        inv_type = 'proforma'
        inv_number = settings.generate_proforma_number()
        recipient_name = order.shipping_name or (order.customer.full_name if order.customer else 'Customer')
        recipient_phone = order.shipping_phone or (order.customer.phone if order.customer else '')
        recipient_email = order.customer.email if order.customer else ''
        recipient_address = order.shipping_address or ''
        recipient_city = order.shipping_city or ''
        recipient_state = order.shipping_state or ''
        recipient_pincode = order.shipping_pincode or ''
        place_of_supply = recipient_state
        supplier_state = settings.supplier_state or ''
        is_intra = supplier_state == place_of_supply if (supplier_state and place_of_supply) else True

        invoice = Invoice.objects.create(
            invoice_number=inv_number,
            invoice_type=inv_type,
            supply_type='b2b',
            order=order,
            status='proforma',
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
            created_by=user,
        )
        for oi in order.items.select_related('product').all():
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

        old = order.status
        order.status = 'invoiced'
        order.save(update_fields=['status'])
        OrderStatusHistory.objects.create(
            order=order, from_status=old, to_status='invoiced',
            changed_by=user, note=f'Flow: Proforma {invoice.invoice_number} created from order')
        result['executed'] = True
        result['message'] = f'Order moved to invoiced and proforma {invoice.invoice_number} created.'
        return result

    if flow.action == 'mark_dispatch' and flow.target_module == 'dispatch':
        old = order.status
        order.status = 'dispatched'
        order.save(update_fields=['status'])
        OrderStatusHistory.objects.create(
            order=order, from_status=old, to_status='dispatched',
            changed_by=user, note='Flow: Marked for dispatch')
        result['executed'] = True
        result['message'] = 'Order marked for dispatch.'
        return result

    result['message'] = f'Flow configured but action not yet implemented.'
    return result


# ── Order CRUD views ─────────────────────────────────────────────────────────

class OrderListCreateView(generics.ListCreateAPIView):
    """GET POST /api/v1/orders/"""
    permission_classes = [IsStaffOrAbove]

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return OrderListSerializer
        return CreateOrderSerializer

    def get_queryset(self):
        qs = Order.objects.all().select_related('customer', 'assigned_to').prefetch_related('items__product')
        status_filter = self.request.query_params.get('status')
        source = self.request.query_params.get('source')
        search = self.request.query_params.get('search')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if source:
            qs = qs.filter(source=source)
        if search:
            qs = qs.filter(order_number__icontains=search) | qs.filter(
                shipping_name__icontains=search)
        return qs

    def list(self, request, *args, **kwargs):
        _seed_order_defaults()
        qs = self.get_queryset()
        data = OrderListSerializer(qs, many=True).data
        all_statuses = CustomOrderStatus.objects.filter(is_active=True)
        stats = {}
        for s in all_statuses:
            stats[s.key] = Order.objects.filter(status=s.key).count()
        return success_response(data={'orders': data, 'count': len(data), 'stats': stats})

    def create(self, request, *args, **kwargs):
        serializer = CreateOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save(assigned_to=request.user)
        OrderStatusHistory.objects.create(
            order=order, from_status='', to_status=order.status, changed_by=request.user,
            note='Order created'
        )
        return success_response(data=OrderSerializer(order).data,
                                message='Order created.', http_status=status.HTTP_201_CREATED)


class OrderDetailView(generics.RetrieveUpdateAPIView):
    """GET PUT PATCH /api/v1/orders/<id>/"""
    serializer_class = OrderSerializer
    permission_classes = [IsStaffOrAbove]
    queryset = Order.objects.all()

    def retrieve(self, request, *args, **kwargs):
        return success_response(data=OrderSerializer(self.get_object()).data)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        order = self.get_object()
        old_status = order.status
        serializer = self.get_serializer(order, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        flow_result = None
        if old_status != order.status:
            note = request.data.get('status_note', '')
            OrderStatusHistory.objects.create(
                order=order, from_status=old_status, to_status=order.status,
                changed_by=request.user, note=note
            )
            flow_result = _execute_order_flow(order, request.user)
        data = OrderSerializer(order).data
        if flow_result:
            data['flow_result'] = flow_result
        return success_response(data=data, message='Order updated.')


class OrderApproveView(APIView):
    """POST /api/v1/orders/<id>/approve/"""
    permission_classes = [IsTenantAdmin]

    def post(self, request, pk):
        try:
            order = Order.objects.get(pk=pk)
        except Order.DoesNotExist:
            return error_response('Order not found.', http_status=404)

        if order.status != 'pending':
            return error_response(f'Cannot approve order with status: {order.status}')

        old_status = order.status
        order.status = 'approved'
        order.approved_by = request.user
        order.approved_at = timezone.now()
        order.save()

        OrderStatusHistory.objects.create(
            order=order, from_status=old_status, to_status=order.status,
            changed_by=request.user, note='Order approved by admin'
        )
        flow_result = _execute_order_flow(order, request.user)
        data = OrderSerializer(order).data
        if flow_result:
            data['flow_result'] = flow_result
        return success_response(data=data, message='Order approved.')


class OrderRejectView(APIView):
    """POST /api/v1/orders/<id>/reject/ — reject and revert to previous status."""
    permission_classes = [IsTenantAdmin]

    def post(self, request, pk):
        try:
            order = Order.objects.get(pk=pk)
        except Order.DoesNotExist:
            return error_response('Order not found.', http_status=404)

        reason = request.data.get('reason', '').strip()
        if not reason:
            return error_response('Rejection reason is required.')

        revert_to = request.data.get('revert_to', '').strip()
        old_status = order.status

        if revert_to:
            order.status = revert_to
        else:
            prev = OrderStatusHistory.objects.filter(order=order).exclude(
                to_status=old_status).order_by('-created_at').first()
            order.status = prev.from_status if prev and prev.from_status else 'pending'

        order.save()
        OrderStatusHistory.objects.create(
            order=order, from_status=old_status, to_status=order.status,
            changed_by=request.user,
            note=f'Rejected: {reason}'
        )
        return success_response(
            data=OrderSerializer(order).data,
            message=f'Order rejected. Reverted to "{order.status}".')


# ── Custom Order Statuses CRUD ───────────────────────────────────────────────

class CustomOrderStatusListCreateView(generics.ListCreateAPIView):
    serializer_class = CustomOrderStatusSerializer
    permission_classes = [IsStaffOrAbove]

    def get_queryset(self):
        return CustomOrderStatus.objects.all()

    def list(self, request, *args, **kwargs):
        _seed_order_defaults()
        data = CustomOrderStatusSerializer(self.get_queryset(), many=True).data
        return success_response(data={'statuses': data})

    def create(self, request, *args, **kwargs):
        self.permission_classes = [IsTenantAdmin]
        self.check_permissions(request)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()
        return success_response(
            data=CustomOrderStatusSerializer(obj).data,
            message='Status created.', http_status=status.HTTP_201_CREATED)


class CustomOrderStatusDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CustomOrderStatusSerializer
    permission_classes = [IsTenantAdmin]
    queryset = CustomOrderStatus.objects.all()

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()
        return success_response(data=CustomOrderStatusSerializer(obj).data, message='Status updated.')

    def destroy(self, request, *args, **kwargs):
        self.get_object().delete()
        return success_response(message='Status deleted.')


# ── Order Flow Actions CRUD ──────────────────────────────────────────────────

class OrderFlowActionListCreateView(generics.ListCreateAPIView):
    serializer_class = OrderFlowActionSerializer
    permission_classes = [IsStaffOrAbove]

    def get_queryset(self):
        return OrderFlowAction.objects.all()

    def list(self, request, *args, **kwargs):
        data = OrderFlowActionSerializer(self.get_queryset(), many=True).data
        return success_response(data={'flow_actions': data})

    def create(self, request, *args, **kwargs):
        self.permission_classes = [IsTenantAdmin]
        self.check_permissions(request)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()
        return success_response(
            data=OrderFlowActionSerializer(obj).data,
            message='Flow action created.', http_status=status.HTTP_201_CREATED)


class OrderFlowActionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = OrderFlowActionSerializer
    permission_classes = [IsTenantAdmin]
    queryset = OrderFlowAction.objects.all()

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()
        return success_response(data=OrderFlowActionSerializer(obj).data, message='Flow action updated.')

    def destroy(self, request, *args, **kwargs):
        self.get_object().delete()
        return success_response(message='Flow action deleted.')
