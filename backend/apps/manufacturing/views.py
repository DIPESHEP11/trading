from rest_framework.views import APIView
from rest_framework import generics, status
from rest_framework.response import Response
from apps.core.responses import success_response, error_response
from apps.core.permissions import IsStaffOrAbove, IsTenantAdmin
from .models import WorkOrder, ManufacturingStatus, ManufacturingStatusFlow, ManufacturingFormSchema
from .serializers import (
    WorkOrderSerializer, ManufacturingStatusSerializer,
    ManufacturingStatusFlowSerializer, ManufacturingFormSchemaSerializer,
)
from .constants import DEFAULT_MFG_FIELDS, DEFAULT_STATUSES, STATUS_SORT_ORDER


def _ensure_default_statuses():
    """Seed the 3 built-in statuses if none exist yet."""
    if ManufacturingStatus.objects.exists():
        return
    for s in DEFAULT_STATUSES:
        ManufacturingStatus.objects.get_or_create(key=s['key'], defaults=s)


def _get_schema():
    schema, _ = ManufacturingFormSchema.objects.get_or_create(pk=1, defaults={
        'custom_fields': [],
        'default_field_overrides': {},
    })
    return schema


def _effective_fields(schema):
    """Merge default fields with admin overrides."""
    overrides = schema.default_field_overrides or {}
    merged = []
    for f in DEFAULT_MFG_FIELDS:
        o = overrides.get(f['key'], {})
        merged.append({**f, **o})
    merged.sort(key=lambda x: x.get('order', 999))
    merged += schema.custom_fields or []
    return merged


# ── Work Orders ───────────────────────────────────────────────────────────────

class WorkOrderListCreateView(APIView):
    """GET POST /api/v1/manufacturing/work-orders/"""
    permission_classes = [IsStaffOrAbove]

    def get(self, request):
        _ensure_default_statuses()
        qs = WorkOrder.objects.all().select_related('assigned_to')
        status_filter = request.query_params.get('status')
        search = request.query_params.get('search')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if search:
            qs = qs.filter(product_name__icontains=search) | qs.filter(mfg_number__icontains=search)

        # Sort: processing → not_started → completed → others
        items = list(qs)
        items.sort(key=lambda w: STATUS_SORT_ORDER.get(w.status, 5))

        data = WorkOrderSerializer(items, many=True).data
        return success_response(data={'work_orders': data, 'count': len(data)})

    def post(self, request):
        ser = WorkOrderSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        wo = ser.save()
        return success_response(data=WorkOrderSerializer(wo).data, message='Work order created.',
                                http_status=status.HTTP_201_CREATED)


class WorkOrderDetailView(APIView):
    """GET PUT PATCH DELETE /api/v1/manufacturing/work-orders/<id>/"""
    permission_classes = [IsStaffOrAbove]

    def _get(self, pk):
        try:
            return WorkOrder.objects.select_related('assigned_to').get(pk=pk)
        except WorkOrder.DoesNotExist:
            return None

    def get(self, request, pk):
        wo = self._get(pk)
        if not wo:
            return error_response('Not found.', http_status=404)
        return success_response(data=WorkOrderSerializer(wo).data)

    def patch(self, request, pk):
        wo = self._get(pk)
        if not wo:
            return error_response('Not found.', http_status=404)
        ser = WorkOrderSerializer(wo, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return success_response(data=WorkOrderSerializer(wo).data, message='Work order updated.')

    def delete(self, request, pk):
        wo = self._get(pk)
        if not wo:
            return error_response('Not found.', http_status=404)
        wo.delete()
        return success_response(message='Work order deleted.')


# ── Form Schema ───────────────────────────────────────────────────────────────

class ManufacturingSchemaView(APIView):
    """GET PUT /api/v1/manufacturing/schema/"""

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsStaffOrAbove()]
        return [IsTenantAdmin()]

    def get(self, request):
        _ensure_default_statuses()
        schema = _get_schema()
        fields = _effective_fields(schema)
        return success_response(data={
            'default_fields': DEFAULT_MFG_FIELDS,
            'custom_fields': schema.custom_fields or [],
            'default_field_overrides': schema.default_field_overrides or {},
            'fields': fields,
        })

    def put(self, request):
        schema = _get_schema()
        data = request.data
        if 'custom_fields' in data:
            schema.custom_fields = data['custom_fields']
        if 'default_field_overrides' in data:
            schema.default_field_overrides = data['default_field_overrides']
        schema.save()
        fields = _effective_fields(schema)
        return success_response(data={
            'default_fields': DEFAULT_MFG_FIELDS,
            'custom_fields': schema.custom_fields or [],
            'default_field_overrides': schema.default_field_overrides or {},
            'fields': fields,
        }, message='Schema saved.')


# ── Statuses ─────────────────────────────────────────────────────────────────

class ManufacturingStatusListView(APIView):
    """GET POST /api/v1/manufacturing/statuses/"""
    permission_classes = [IsStaffOrAbove]

    def get(self, request):
        _ensure_default_statuses()
        items = ManufacturingStatus.objects.filter(is_active=True)
        return success_response(data={'statuses': ManufacturingStatusSerializer(items, many=True).data})

    def post(self, request):
        ser = ManufacturingStatusSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save()
        return success_response(data=ManufacturingStatusSerializer(ser.instance).data,
                                message='Status created.', http_status=201)


class ManufacturingStatusDetailView(APIView):
    """PUT DELETE /api/v1/manufacturing/statuses/<id>/"""
    permission_classes = [IsTenantAdmin]

    def _get(self, pk):
        try:
            return ManufacturingStatus.objects.get(pk=pk)
        except ManufacturingStatus.DoesNotExist:
            return None

    def put(self, request, pk):
        obj = self._get(pk)
        if not obj:
            return error_response('Not found.', http_status=404)
        ser = ManufacturingStatusSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return success_response(data=ManufacturingStatusSerializer(obj).data, message='Status updated.')

    def delete(self, request, pk):
        obj = self._get(pk)
        if not obj:
            return error_response('Not found.', http_status=404)
        obj.delete()
        return success_response(message='Status deleted.')


# ── Status Flows ──────────────────────────────────────────────────────────────

class ManufacturingStatusFlowListView(APIView):
    """GET POST /api/v1/manufacturing/status-flows/"""
    permission_classes = [IsStaffOrAbove]

    def get(self, request):
        items = ManufacturingStatusFlow.objects.all()
        return success_response(data={'status_flows': ManufacturingStatusFlowSerializer(items, many=True).data})

    def post(self, request):
        ser = ManufacturingStatusFlowSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save()
        return success_response(data=ManufacturingStatusFlowSerializer(ser.instance).data,
                                message='Status flow created.', http_status=201)


class ManufacturingStatusFlowDetailView(APIView):
    """PUT DELETE /api/v1/manufacturing/status-flows/<id>/"""
    permission_classes = [IsTenantAdmin]

    def _get(self, pk):
        try:
            return ManufacturingStatusFlow.objects.get(pk=pk)
        except ManufacturingStatusFlow.DoesNotExist:
            return None

    def put(self, request, pk):
        obj = self._get(pk)
        if not obj:
            return error_response('Not found.', http_status=404)
        ser = ManufacturingStatusFlowSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return success_response(data=ManufacturingStatusFlowSerializer(obj).data, message='Flow updated.')

    def delete(self, request, pk):
        obj = self._get(pk)
        if not obj:
            return error_response('Not found.', http_status=404)
        obj.delete()
        return success_response(message='Flow deleted.')
