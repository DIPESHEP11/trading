from rest_framework import generics, status
from rest_framework.views import APIView
from django.db import transaction, IntegrityError
from django.db.models import Exists, OuterRef
from django.utils import timezone
from apps.warehouses.models import (
    Warehouse, StockRecord, StockMovement, InventoryApproval,
    CustomInventoryStatus, InventoryFlowAction,
    StockAlert, StockMonthlySummary,
)
from apps.core.responses import success_response, error_response
from apps.core.permissions import IsStaffOrAbove, IsTenantAdmin
from .serializers import (
    WarehouseSerializer, StockRecordSerializer, StockMovementSerializer,
    InventoryApprovalSerializer, CustomInventoryStatusSerializer,
    InventoryFlowActionSerializer,
)


# ── Seed default inventory statuses ───────────────────────────────────────────
DEFAULT_INVENTORY_STATUSES = [
    {'key': 'pending',    'label': 'Pending',    'color': '#F59E0B', 'order': 1},
    {'key': 'approved',   'label': 'Approved',   'color': '#10B981', 'order': 2},
    {'key': 'processing', 'label': 'Processing', 'color': '#3B82F6', 'order': 3},
    {'key': 'completed',  'label': 'Completed',  'color': '#059669', 'order': 4},
    {'key': 'rejected',   'label': 'Rejected',   'color': '#EF4444', 'order': 5},
]

def _seed_inventory_defaults():
    if CustomInventoryStatus.objects.exists():
        return
    for s in DEFAULT_INVENTORY_STATUSES:
        CustomInventoryStatus.objects.get_or_create(key=s['key'], defaults=s)


def _seed_inventory_flow_defaults():
    """When approval is approved → forward to Invoices (creates invoice from order)."""
    if not InventoryFlowAction.objects.filter(status_key='approved').exists():
        InventoryFlowAction.objects.create(
            status_key='approved',
            target_module='invoices',
            action='forward_invoices',
            is_active=True,
            description='When warehouse approval is approved, create invoice from order and forward to Invoices.',
        )


# ── Inventory Status CRUD ────────────────────────────────────────────────────

class InventoryStatusListCreateView(generics.ListCreateAPIView):
    serializer_class = CustomInventoryStatusSerializer
    permission_classes = [IsTenantAdmin]

    def get_queryset(self):
        return CustomInventoryStatus.objects.all()

    def list(self, request, *args, **kwargs):
        _seed_inventory_defaults()
        data = CustomInventoryStatusSerializer(self.get_queryset(), many=True).data
        return success_response(data={'statuses': data})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(data=serializer.data, message='Status created.',
                                http_status=status.HTTP_201_CREATED)


class InventoryStatusDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CustomInventoryStatusSerializer
    permission_classes = [IsTenantAdmin]
    queryset = CustomInventoryStatus.objects.all()

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(data=serializer.data, message='Status updated.')

    def destroy(self, request, *args, **kwargs):
        self.get_object().delete()
        return success_response(message='Status deleted.')


# ── Inventory Flow Action CRUD ───────────────────────────────────────────────

class InventoryFlowActionListCreateView(generics.ListCreateAPIView):
    serializer_class = InventoryFlowActionSerializer
    permission_classes = [IsTenantAdmin]

    def get_queryset(self):
        return InventoryFlowAction.objects.all()

    def list(self, request, *args, **kwargs):
        data = InventoryFlowActionSerializer(self.get_queryset(), many=True).data
        return success_response(data={'flow_actions': data})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(data=serializer.data, message='Flow action created.',
                                http_status=status.HTTP_201_CREATED)


class InventoryFlowActionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = InventoryFlowActionSerializer
    permission_classes = [IsTenantAdmin]
    queryset = InventoryFlowAction.objects.all()

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(data=serializer.data, message='Flow action updated.')

    def destroy(self, request, *args, **kwargs):
        self.get_object().delete()
        return success_response(message='Flow action deleted.')


# ── Warehouse CRUD ───────────────────────────────────────────────────────────

class WarehouseListCreateView(generics.ListCreateAPIView):
    serializer_class = WarehouseSerializer
    permission_classes = [IsTenantAdmin]

    def get_queryset(self):
        show_all = self.request.query_params.get('all')
        if show_all:
            return Warehouse.objects.all()
        return Warehouse.objects.filter(is_active=True)

    def list(self, request, *args, **kwargs):
        data = WarehouseSerializer(self.get_queryset(), many=True).data
        return success_response(data={'warehouses': data})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            wh = serializer.save()
        except IntegrityError:
            return error_response(
                'A warehouse with this code already exists.',
                http_status=status.HTTP_400_BAD_REQUEST
            )
        return success_response(data=WarehouseSerializer(wh).data,
                                message='Warehouse created.', http_status=status.HTTP_201_CREATED)


class WarehouseDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET PATCH DELETE /api/v1/stock/warehouses/<pk>/"""
    serializer_class = WarehouseSerializer
    permission_classes = [IsTenantAdmin]
    queryset = Warehouse.objects.all()

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        return success_response(data=WarehouseSerializer(instance).data)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', True)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        wh = serializer.save()
        return success_response(data=WarehouseSerializer(wh).data, message='Warehouse updated.')

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save()
        return success_response(message='Warehouse deactivated.')


# ── Public warehouse view (no auth) — for third-party warehouse incharge ─────

from rest_framework.permissions import AllowAny
from decimal import Decimal


class WarehousePublicView(APIView):
    """GET /api/v1/stock/warehouse-view/<token>/ — view stock (no auth)."""
    permission_classes = [AllowAny]

    def get(self, request, token):
        wh = Warehouse.objects.filter(public_access_token=token, is_active=True).first()
        if not wh:
            return error_response('Invalid or expired link.', http_status=404)
        records = StockRecord.objects.filter(warehouse=wh).select_related('product')
        stock = [
            {
                'product_id': r.product_id,
                'product_name': r.product.name,
                'product_sku': r.product.sku or '',
                'quantity': str(r.quantity),
                'available': str(r.quantity - r.reserved_quantity),
            }
            for r in records
        ]
        return success_response(data={
            'warehouse_name': wh.name,
            'warehouse_code': wh.code,
            'stock': stock,
            'count': len(stock),
        })


class WarehousePublicUsageView(APIView):
    """POST /api/v1/stock/warehouse-view/<token>/usage/ — mark stock usage (reduces quantity)."""
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request, token):
        wh = Warehouse.objects.filter(public_access_token=token, is_active=True).first()
        if not wh:
            return error_response('Invalid or expired link.', http_status=404)
        items = request.data.get('items') or []
        if not items:
            return error_response('items required: [{ product_id, quantity }, ...]')
        from apps.products.models import Product
        results = []
        for item in items:
            pid = item.get('product_id')
            try:
                qty = Decimal(str(item.get('quantity', 0)))
            except Exception:
                qty = Decimal(0)
            if not pid or qty <= 0:
                continue
            try:
                product = Product.objects.get(pk=pid)
            except Product.DoesNotExist:
                results.append({'product_id': pid, 'ok': False, 'error': 'Product not found'})
                continue
            record = StockRecord.objects.filter(product=product, warehouse=wh).first()
            if not record:
                results.append({'product_id': pid, 'ok': False, 'error': 'No stock for this product'})
                continue
            available = record.quantity - record.reserved_quantity
            if qty > available:
                results.append({
                    'product_id': pid,
                    'ok': False,
                    'error': f'Only {available} available',
                })
                continue
            record.quantity -= qty
            record.save()
            StockMovement.objects.create(
                product=product,
                warehouse=wh,
                movement_type='out',
                quantity=qty,
                reference=request.data.get('reference', '') or 'Third-party usage',
                notes=request.data.get('notes', '') or 'Marked by warehouse incharge',
                performed_by=None,
            )
            results.append({'product_id': pid, 'ok': True, 'used': str(qty)})
        return success_response(
            data={'results': results},
            message=f'Recorded usage for {len([r for r in results if r.get("ok")])} item(s).',
        )


class StockRecordListView(generics.ListAPIView):
    """GET /api/v1/stock/records/ — current stock levels"""
    serializer_class = StockRecordSerializer
    permission_classes = [IsStaffOrAbove]

    def get_queryset(self):
        return_subquery = StockMovement.objects.filter(
            product=OuterRef('product'),
            warehouse=OuterRef('warehouse'),
            movement_type='return',
        )
        qs = (StockRecord.objects.all()
              .select_related('product', 'warehouse')
              .annotate(has_returns=Exists(return_subquery)))
        warehouse = self.request.query_params.get('warehouse')
        product = self.request.query_params.get('product')
        search = self.request.query_params.get('search')
        low_stock = self.request.query_params.get('low_stock')
        has_returns = self.request.query_params.get('has_returns')
        if warehouse:
            qs = qs.filter(warehouse=warehouse)
        if product:
            qs = qs.filter(product=product)
        if search:
            qs = qs.filter(product__name__icontains=search) | qs.filter(product__sku__icontains=search)
        if low_stock:
            qs = [r for r in qs if r.available_quantity <= 10]
        if has_returns:
            qs = qs.filter(has_returns=True)
        return qs

    def list(self, request, *args, **kwargs):
        data = StockRecordSerializer(self.get_queryset(), many=True).data
        return success_response(data={'stock': data, 'count': len(data)})


class StockMovementListCreateView(generics.ListCreateAPIView):
    """GET POST /api/v1/stock/movements/ — stock movements"""
    serializer_class = StockMovementSerializer
    permission_classes = [IsStaffOrAbove]

    def get_queryset(self):
        qs = StockMovement.objects.all().select_related('product', 'warehouse', 'performed_by')
        movement_type = self.request.query_params.get('movement_type')
        warehouse = self.request.query_params.get('warehouse')
        product = self.request.query_params.get('product')
        search = self.request.query_params.get('search')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if movement_type:
            qs = qs.filter(movement_type=movement_type)
        if warehouse:
            qs = qs.filter(warehouse=warehouse)
        if product:
            qs = qs.filter(product=product)
        if search:
            qs = qs.filter(product__name__icontains=search)
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        return qs

    def list(self, request, *args, **kwargs):
        limit = int(request.query_params.get('limit', 200))
        qs = self.get_queryset()
        data = StockMovementSerializer(qs[:limit], many=True).data
        return success_response(data={'movements': data, 'count': qs.count()})

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        movement = serializer.save(performed_by=request.user)

        record, _ = StockRecord.objects.get_or_create(
            product=movement.product, warehouse=movement.warehouse,
            defaults={'quantity': 0}
        )
        if movement.movement_type == 'in':
            record.quantity += movement.quantity
        elif movement.movement_type == 'return':
            if record.quantity < movement.quantity:
                movement.delete()
                return error_response('Insufficient stock for return.')
            record.quantity -= movement.quantity
            record.returned_quantity += movement.quantity
        elif movement.movement_type == 'out':
            if record.quantity < movement.quantity:
                movement.delete()
                return error_response('Insufficient stock.')
            record.quantity -= movement.quantity
        elif movement.movement_type == 'adjustment':
            record.quantity = movement.quantity
        record.save()

        return success_response(data=StockMovementSerializer(movement).data,
                                message='Stock movement recorded.', http_status=status.HTTP_201_CREATED)


class StockTransferView(APIView):
    """POST /api/v1/stock/transfer/ — transfer between warehouses (single or bulk)"""
    permission_classes = [IsStaffOrAbove]

    @transaction.atomic
    def post(self, request):
        from decimal import Decimal as D
        from apps.products.models import Product
        items = request.data.get('items')  # Bulk: [{ product, quantity }, ...]
        from_wh_id = request.data.get('from_warehouse')
        to_wh_id = request.data.get('to_warehouse')
        ref = request.data.get('reference', '') or ''

        if items:
            # Bulk transfer: same from/to for all items
            if not all([from_wh_id, to_wh_id, isinstance(items, list) and len(items) > 0]):
                return error_response('from_warehouse, to_warehouse, and items (non-empty array) are required.')
            if from_wh_id == to_wh_id:
                return error_response('Source and destination warehouses must be different.')

            try:
                from_wh = Warehouse.objects.get(pk=from_wh_id)
                to_wh = Warehouse.objects.get(pk=to_wh_id)
            except Exception as e:
                return error_response(str(e))

            ref = ref or f'Bulk transfer to {to_wh.name}'
            done = []
            for i, item in enumerate(items):
                product_id = item.get('product')
                try:
                    qty = D(str(item.get('quantity', 0)))
                except Exception:
                    return error_response(f'Item {i + 1}: invalid quantity.')
                if not product_id or qty <= 0:
                    return error_response(f'Item {i + 1}: product and positive quantity required.')

                try:
                    product = Product.objects.get(pk=product_id)
                except Product.DoesNotExist:
                    return error_response(f'Item {i + 1}: product {product_id} not found.')

                src_record, _ = StockRecord.objects.get_or_create(
                    product=product, warehouse=from_wh, defaults={'quantity': 0})
                if src_record.quantity < qty:
                    return error_response(
                        f'{product.name}: only {src_record.quantity} available at {from_wh.name}.')

                dst_record, _ = StockRecord.objects.get_or_create(
                    product=product, warehouse=to_wh, defaults={'quantity': 0})
                src_record.quantity -= qty
                dst_record.quantity += qty
                src_record.save()
                dst_record.save()

                StockMovement.objects.create(
                    product=product, warehouse=from_wh, destination_warehouse=to_wh,
                    movement_type='transfer', quantity=qty,
                    reference=ref, performed_by=request.user
                )
                done.append(f'{product.name}: {int(qty)}')

            return success_response(
                message=f'Transferred {len(done)} product(s) from {from_wh.name} to {to_wh.name}.'
            )

        # Single transfer (backward compatible)
        product_id = request.data.get('product')
        try:
            quantity = D(str(request.data.get('quantity', 0)))
        except Exception:
            return error_response('Invalid quantity.')

        if not all([product_id, from_wh_id, to_wh_id, quantity]):
            return error_response('product, from_warehouse, to_warehouse, quantity are required.')

        try:
            product = Product.objects.get(pk=product_id)
            from_wh = Warehouse.objects.get(pk=from_wh_id)
            to_wh = Warehouse.objects.get(pk=to_wh_id)
        except Exception as e:
            return error_response(str(e))

        src_record, _ = StockRecord.objects.get_or_create(
            product=product, warehouse=from_wh, defaults={'quantity': 0})
        if src_record.quantity < quantity:
            return error_response(f'Only {src_record.quantity} units available at {from_wh.name}.')

        dst_record, _ = StockRecord.objects.get_or_create(
            product=product, warehouse=to_wh, defaults={'quantity': 0})

        src_record.quantity -= quantity
        dst_record.quantity += quantity
        src_record.save()
        dst_record.save()

        ref = ref or f'Transfer to {to_wh.name}'
        StockMovement.objects.create(
            product=product, warehouse=from_wh, destination_warehouse=to_wh,
            movement_type='transfer', quantity=quantity,
            reference=ref, performed_by=request.user
        )
        return success_response(message=f'Transferred {quantity} units from {from_wh.name} to {to_wh.name}.')


# ── Stock Alerts & Monthly Summary ────────────────────────────────────────────

class StockAlertListView(APIView):
    """GET /api/v1/stock/alerts/ — fast-moving and low-stock alerts for client admin."""
    permission_classes = [IsStaffOrAbove]

    def get(self, request):
        unread_count = StockAlert.objects.filter(is_read=False).count()
        qs = StockAlert.objects.select_related('product').order_by('-created_at')[:50]
        data = [
            {
                'id': a.id,
                'product_id': a.product_id,
                'product_name': a.product.name,
                'product_sku': a.product.sku,
                'alert_type': a.alert_type,
                'year_month': a.year_month,
                'message': a.message,
                'is_read': a.is_read,
                'email_sent_at': a.email_sent_at.isoformat() if a.email_sent_at else None,
                'created_at': a.created_at.isoformat(),
            }
            for a in qs
        ]
        return success_response(data={'alerts': data, 'unread_count': unread_count})


class StockAlertMarkReadView(APIView):
    """PATCH /api/v1/stock/alerts/<pk>/read/ — mark alert as read."""
    permission_classes = [IsStaffOrAbove]

    def patch(self, request, pk):
        try:
            alert = StockAlert.objects.get(pk=pk)
            alert.is_read = True
            alert.save(update_fields=['is_read'])
            return success_response(message='Alert marked as read.')
        except StockAlert.DoesNotExist:
            return error_response('Alert not found.', http_status=status.HTTP_404_NOT_FOUND)


class StockMonthlySummaryListView(APIView):
    """GET /api/v1/stock/monthly-summary/ — monthly movement summaries for buffer analysis."""
    permission_classes = [IsStaffOrAbove]

    def get(self, request):
        year_month = request.query_params.get('month')  # YYYY-MM
        qs = StockMonthlySummary.objects.select_related('product').order_by('-year_month', 'product__name')
        if year_month:
            qs = qs.filter(year_month=year_month)
        qs = qs[:100]
        data = [
            {
                'id': s.id,
                'product_id': s.product_id,
                'product_name': s.product.name,
                'product_sku': s.product.sku,
                'year_month': s.year_month,
                'total_in': str(s.total_in),
                'total_out': str(s.total_out),
                'movement_count': s.movement_count,
                'is_fast_moving': s.is_fast_moving,
            }
            for s in qs
        ]
        return success_response(data={'summaries': data})


def _generate_approval_number():
    last = InventoryApproval.objects.order_by('-id').first()
    num = (last.id + 1) if last else 1
    return f'INV-APR-{num:05d}'


class InventoryApprovalListCreateView(generics.ListCreateAPIView):
    """GET POST /api/v1/stock/approvals/"""
    serializer_class = InventoryApprovalSerializer
    permission_classes = [IsStaffOrAbove]

    def get_queryset(self):
        qs = InventoryApproval.objects.all().select_related(
            'warehouse', 'destination_warehouse', 'requested_by', 'approved_by', 'lead'
        )
        status_filter = self.request.query_params.get('status')
        source = self.request.query_params.get('source_module')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if source:
            qs = qs.filter(source_module=source)
        return qs

    def list(self, request, *args, **kwargs):
        _seed_inventory_defaults()
        _seed_inventory_flow_defaults()
        qs = self.get_queryset()
        data = InventoryApprovalSerializer(qs, many=True).data
        counts = {
            'pending': InventoryApproval.objects.filter(status='pending').count(),
            'approved': InventoryApproval.objects.filter(status='approved').count(),
            'rejected': InventoryApproval.objects.filter(status='rejected').count(),
            'total': InventoryApproval.objects.count(),
        }
        return success_response(data={'approvals': data, 'counts': counts})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        approval = serializer.save(
            request_number=_generate_approval_number(),
            requested_by=request.user,
        )
        return success_response(
            data=InventoryApprovalSerializer(approval).data,
            message='Approval request created.',
            http_status=status.HTTP_201_CREATED,
        )


class InventoryApprovalDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET PATCH DELETE /api/v1/stock/approvals/<pk>/"""
    serializer_class = InventoryApprovalSerializer
    permission_classes = [IsStaffOrAbove]
    queryset = InventoryApproval.objects.all()

    def retrieve(self, request, *args, **kwargs):
        return success_response(data=InventoryApprovalSerializer(self.get_object()).data)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(data=serializer.data, message='Request updated.')

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != 'pending':
            return error_response('Only pending requests can be deleted.')
        instance.delete()
        return success_response(message='Request deleted.')


class InventoryApprovalStatusChangeView(APIView):
    """
    POST /api/v1/stock/approvals/<pk>/change-status/
    Body: { "status": "approved", "rejection_reason": "..." (optional) }
    Changes status and executes any configured flow action.
    """
    permission_classes = [IsStaffOrAbove]

    @transaction.atomic
    def post(self, request, pk):
        try:
            approval = InventoryApproval.objects.get(pk=pk)
        except InventoryApproval.DoesNotExist:
            return error_response('Approval request not found.', http_status=404)

        new_status = request.data.get('status', '').strip()
        if not new_status:
            return error_response('Status is required.')

        old_status = approval.status
        approval.status = new_status

        if new_status == 'rejected':
            reason = request.data.get('rejection_reason', '')
            if not reason.strip():
                return error_response('Rejection reason is required.')
            approval.rejection_reason = reason

        if new_status in ('approved', 'rejected', 'completed'):
            approval.approved_by = request.user
            approval.approved_at = timezone.now()

        approval.save()

        flow_result = _execute_inventory_flow(approval, request.user, request)

        return success_response(
            data={
                'approval': InventoryApprovalSerializer(approval).data,
                'flow_result': flow_result,
                'old_status': old_status,
            },
            message=f'Status changed: {old_status} → {new_status}',
        )


class InventoryApprovalActionView(APIView):
    """
    Legacy endpoints — kept for backward compatibility.
    POST /api/v1/stock/approvals/<pk>/approve/
    POST /api/v1/stock/approvals/<pk>/reject/
    """
    permission_classes = [IsTenantAdmin]

    @transaction.atomic
    def post(self, request, pk, action):
        try:
            approval = InventoryApproval.objects.get(pk=pk)
        except InventoryApproval.DoesNotExist:
            return error_response('Approval request not found.', http_status=404)

        if action == 'approve':
            old_status = approval.status
            approval.status = 'approved'
            approval.approved_by = request.user
            approval.approved_at = timezone.now()
            approval.save()

            flow_result = _execute_inventory_flow(approval, request.user, request)

            return success_response(
                data={
                    'approval': InventoryApprovalSerializer(approval).data,
                    'flow_result': flow_result,
                },
                message=f'Request {approval.request_number} approved.',
            )

        elif action == 'reject':
            reason = request.data.get('rejection_reason', '')
            if not reason.strip():
                return error_response('Rejection reason is required.')
            approval.status = 'rejected'
            approval.rejection_reason = reason
            approval.approved_by = request.user
            approval.approved_at = timezone.now()
            approval.save()

            return success_response(
                data=InventoryApprovalSerializer(approval).data,
                message=f'Request {approval.request_number} rejected.',
            )

        return error_response('Invalid action. Use approve or reject.')


def _execute_inventory_flow(approval, user, request=None):
    """
    Check InventoryFlowAction for the approval's current status.
    Execute the configured action + forward to next module.
    Also handles stock movements for approved requests.
    When flow is forward_invoices, creates a draft Invoice linked to the approval.
    """
    result = {
        'executed': False,
        'message': '',
        'next_module': '',
        'status_key': approval.status,
        'invoice_number': None,
    }

    # Execute stock movements if the approval has items + warehouse
    if approval.status in ('approved', 'completed') and approval.warehouse:
        if approval.requested_action in ('stock_in', 'stock_out'):
            from apps.products.models import Product
            from decimal import Decimal as D
            for item in (approval.items or []):
                try:
                    product = Product.objects.get(pk=item.get('product_id'))
                    qty = D(str(item.get('quantity', 0)))
                    record, _ = StockRecord.objects.get_or_create(
                        product=product, warehouse=approval.warehouse, defaults={'quantity': 0})
                    if approval.requested_action == 'stock_in':
                        record.quantity += qty
                    else:
                        record.quantity = max(record.quantity - qty, 0)
                    record.save()
                    StockMovement.objects.create(
                        product=product, warehouse=approval.warehouse,
                        movement_type='in' if approval.requested_action == 'stock_in' else 'out',
                        quantity=qty, reference=approval.request_number,
                        notes=f'Auto from approval {approval.request_number}',
                        performed_by=user,
                    )
                except Exception:
                    continue
            result['executed'] = True
            result['message'] = f'Stock {"in" if approval.requested_action == "stock_in" else "out"} processed.'

        elif approval.requested_action == 'reserve':
            from apps.products.models import Product
            from decimal import Decimal as D
            for item in (approval.items or []):
                try:
                    product = Product.objects.get(pk=item.get('product_id'))
                    qty = D(str(item.get('quantity', 0)))
                    record, _ = StockRecord.objects.get_or_create(
                        product=product, warehouse=approval.warehouse, defaults={'quantity': 0})
                    record.reserved_quantity += qty
                    record.save()
                except Exception:
                    continue
            result['executed'] = True
            result['message'] = 'Stock reserved.'

    # Check for a configured flow action for this status
    try:
        flow = InventoryFlowAction.objects.get(status_key=approval.status, is_active=True)
    except InventoryFlowAction.DoesNotExist:
        return result if result['executed'] else None

    result['next_module'] = flow.target_module

    if flow.target_module == 'none' or flow.action == 'notify_only':
        result['executed'] = True
        if not result['message']:
            result['message'] = f'Status changed to "{approval.status}" (Inventory only).'
        return result

    if flow.action == 'forward_dispatch':
        result['executed'] = True
        result['message'] = (result['message'] + ' → ' if result['message'] else '') + 'Forwarded to Dispatch.'
    elif flow.action == 'forward_invoices':
        # Create a draft Invoice linked to this approval (visible in Invoices module)
        inv_created = False
        if request:
            try:
                from apps.invoices.models import Invoice, InvoiceLineItem, InvoiceSettings
                from apps.invoices.serializers import calculate_line_item_tax, calculate_invoice_totals
                from apps.products.models import Product
                from decimal import Decimal as D
                from datetime import timedelta

                tenant = getattr(request, 'tenant', None)
                if not tenant:
                    from django.db import connection
                    tenant = getattr(connection, 'tenant', None)
                if not tenant:
                    from django.db import connection
                    schema = getattr(connection, 'schema_name', None)
                    if schema and schema != 'public':
                        from django_tenants.utils import get_tenant_model
                        try:
                            tenant = get_tenant_model().objects.get(schema_name=schema)
                        except Exception:
                            pass
                if tenant:
                    existing = Invoice.objects.filter(inventory_approval=approval).first()
                    if not existing:
                        inv_settings, _ = InvoiceSettings.objects.get_or_create(tenant=tenant)
                        order = None
                        if approval.source_module == 'orders' and approval.source_reference:
                            Order = __import__('apps.orders.models', fromlist=['Order']).Order
                            ref = str(approval.source_reference).strip()
                            # Normalize: strip "Order #" prefix if user entered it manually
                            if ref.upper().startswith('ORDER #'):
                                ref = ref[7:].strip()
                            order = Order.objects.filter(order_number=ref).first()
                            if not order and ref.isdigit():
                                order = Order.objects.filter(id=int(ref)).first()

                        recipient_name = 'Customer'
                        recipient_address = recipient_city = recipient_state = ''
                        recipient_phone = recipient_email = ''
                        place_of_supply = ''
                        if order:
                            recipient_name = order.shipping_name or (order.customer.full_name if order.customer else 'Customer')
                            recipient_address = order.shipping_address or ''
                            recipient_city = order.shipping_city or ''
                            recipient_state = order.shipping_state or ''
                            recipient_phone = order.shipping_phone or ''
                            recipient_email = getattr(order.customer, 'email', '') if order.customer else ''
                            place_of_supply = recipient_state or inv_settings.supplier_state

                        inv_number = inv_settings.generate_invoice_number()
                        is_gst = inv_settings.tax_type == 'indian_gst'
                        is_intra = True
                        if inv_settings.supplier_state and place_of_supply:
                            is_intra = inv_settings.supplier_state == place_of_supply

                        invoice = Invoice.objects.create(
                            invoice_number=inv_number,
                            invoice_type='proforma' if is_gst else 'bill_of_supply',
                            status='draft',
                            order=order,
                            inventory_approval=approval,
                            supplier_name=inv_settings.supplier_name or '',
                            supplier_address=inv_settings.supplier_address or '',
                            supplier_gstin=inv_settings.supplier_gstin or '',
                            supplier_state=inv_settings.supplier_state or '',
                            supplier_state_code=inv_settings.supplier_state or '',
                            recipient_name=recipient_name or 'Customer',
                            recipient_address=recipient_address,
                            recipient_city=recipient_city,
                            recipient_state=recipient_state,
                            recipient_state_code=place_of_supply,
                            place_of_supply=place_of_supply,
                            is_gst=is_gst,
                            is_intra_state=is_intra,
                            bank_name=inv_settings.bank_name or '',
                            bank_account_number=inv_settings.bank_account_number or '',
                            bank_ifsc=inv_settings.bank_ifsc or '',
                            bank_branch=inv_settings.bank_branch or '',
                            terms=inv_settings.default_terms or '',
                            created_by=user,
                        )
                        if inv_settings.default_due_days:
                            from django.utils import timezone
                            invoice.due_date = timezone.now().date() + timedelta(days=inv_settings.default_due_days)
                            invoice.save(update_fields=['due_date'])

                        for item in (approval.items or []):
                            pid = item.get('product_id')
                            qty = D(str(item.get('quantity', 0)))
                            if not pid or qty <= 0:
                                continue
                            try:
                                product = Product.objects.get(pk=pid)
                                rate = product.price
                                item_data = {
                                    'description': item.get('product_name') or product.name,
                                    'quantity': qty,
                                    'rate': rate,
                                    'tax_rate': 0,
                                    'discount_amount': 0,
                                }
                                item_data = calculate_line_item_tax(
                                    item_data, invoice.is_gst, invoice.is_intra_state
                                )
                                InvoiceLineItem.objects.create(invoice=invoice, **item_data)
                            except Product.DoesNotExist:
                                continue
                        calculate_invoice_totals(invoice)
                        inv_created = True
                        result['invoice_number'] = invoice.invoice_number
                        if order:
                            order.status = 'invoiced'
                            order.save(update_fields=['status'])
            except Exception as e:
                result['message'] = (result['message'] + ' ' if result['message'] else '') + f'Invoice creation failed: {e}'
        result['executed'] = True
        result['message'] = (result['message'] + ' → ' if result['message'] else '') + (
            f'Invoice #{result.get("invoice_number", "?")} created.' if inv_created else 'Forwarded to Invoices.'
        )
    elif flow.action == 'forward_orders':
        result['executed'] = True
        result['message'] = (result['message'] + ' → ' if result['message'] else '') + 'Forwarded to Orders.'
    elif flow.action == 'execute_stock':
        if not result['executed']:
            result['executed'] = True
            result['message'] = 'Stock movement executed.'

    return result
