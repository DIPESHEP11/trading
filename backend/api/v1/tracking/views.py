import secrets
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from django.db import connection
from django_tenants.utils import schema_context

from apps.tracking.models import TrackingShipment, TrackingFormLink, TrackingFormSubmission
from apps.tenants.models import TrackingFormToken
from apps.invoices.models import CourierPartner, DispatchSticker
from apps.core.responses import success_response, error_response
from apps.core.permissions import IsStaffOrAbove, IsTenantAdmin
from .serializers import (
    TrackingShipmentSerializer,
    TrackingFormLinkSerializer,
    PublicShipmentSerializer,
    PublicFormSubmitSerializer,
)


def _get_tenant(request):
    return getattr(request, 'tenant', None) or getattr(connection, 'tenant', None)


# ── Authenticated API (tenant-scoped) ───────────────────────────────────────

class TrackingShipmentListCreateView(APIView):
    """GET POST /api/v1/tracking/shipments/"""
    permission_classes = [IsStaffOrAbove]

    def get(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return error_response('Tenant not identified.', http_status=400)
        partner_id = request.query_params.get('partner_id', '').strip()
        qs = TrackingShipment.objects.filter(tenant=tenant).select_related('courier_partner')
        if partner_id:
            try:
                qs = qs.filter(courier_partner_id=int(partner_id))
            except ValueError:
                pass
        data = TrackingShipmentSerializer(qs, many=True).data
        return success_response(data={'shipments': data})

    def post(self, request):
        self.permission_classes = [IsTenantAdmin]
        self.check_permissions(request)
        tenant = _get_tenant(request)
        if not tenant:
            return error_response('Tenant not identified.', http_status=400)
        ser = TrackingShipmentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save(tenant=tenant)
        return success_response(data=ser.data, message='Shipment added.', http_status=status.HTTP_201_CREATED)


class TrackingShipmentFromDispatchView(APIView):
    """
    POST /api/v1/tracking/shipments/from-dispatch/
    Body: { "dispatch_sticker_id": 123, "courier_partner_id": 456 }
    Creates a TrackingShipment from the dispatch sticker and assigns to the delivery partner.
    """
    permission_classes = [IsTenantAdmin]

    def post(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return error_response('Tenant not identified.', http_status=400)
        sticker_id = request.data.get('dispatch_sticker_id')
        partner_id = request.data.get('courier_partner_id')
        if not sticker_id or not partner_id:
            return error_response('dispatch_sticker_id and courier_partner_id are required.', http_status=400)
        try:
            sticker = DispatchSticker.objects.select_related('invoice').get(id=int(sticker_id))
        except (ValueError, DispatchSticker.DoesNotExist):
            return error_response('Dispatch sticker not found.', http_status=404)
        try:
            partner = CourierPartner.objects.get(id=int(partner_id), tenant=tenant)
        except (ValueError, CourierPartner.DoesNotExist):
            return error_response('Delivery partner not found.', http_status=404)
        if TrackingShipment.objects.filter(tenant=tenant, dispatch_sticker=sticker).exists():
            return error_response('A tracking shipment already exists for this dispatch sticker.', http_status=400)
        inv = sticker.invoice
        product_name = ', '.join([li.description for li in inv.line_items.all()[:3]]) or inv.recipient_name or 'Order'
        product_id = f'DISP-{sticker.id}-{getattr(inv, "invoice_number", sticker.id)}'
        qr_data = f'DISP-{sticker.id}-{getattr(inv, "invoice_number", "")}-{sticker.awb_number or "NA"}'
        from_addr = getattr(inv, 'supplier_address', '') or getattr(inv, 'supplier_name', '')
        to_addr = getattr(inv, 'recipient_address', '') or ''
        contact = getattr(inv, 'recipient_phone', '') or getattr(inv, 'recipient_email', '')
        partner_details = f"{partner.name}" + (f" ({partner.courier_id})" if partner.courier_id else "") + (f" — {partner.contact_phone}" if partner.contact_phone else "")
        shipment = TrackingShipment.objects.create(
            tenant=tenant,
            courier_partner=partner,
            dispatch_sticker=sticker,
            product_name=product_name[:300],
            product_id=product_id[:100],
            qr_data=qr_data[:500],
            from_address=from_addr,
            to_address=to_addr,
            contact_number=contact[:30],
            delivery_partner_details=partner_details,
            status='pending',
        )
        return success_response(
            data=TrackingShipmentSerializer(shipment).data,
            message='Shipment added from dispatch.',
            http_status=status.HTTP_201_CREATED,
        )


class TrackingPartnersWithLinksView(APIView):
    """
    GET /api/v1/tracking/partners/
    Returns delivery partners with: has_form_link (bool), link_id, token (if any), shipment_count, fillable_fields.
    Used to show "Generate link" or "Copy link" per partner.
    """
    permission_classes = [IsStaffOrAbove]

    def get(self, request):
        tenant = _get_tenant(request)
        if not tenant:
            return error_response('Tenant not identified.', http_status=400)
        partners = CourierPartner.objects.filter(tenant=tenant)
        result = []
        for p in partners:
            try:
                link = p.tracking_form_link
                result.append({
                    'partner_id': p.id,
                    'partner_name': p.name,
                    'courier_id': p.courier_id or '',
                    'has_form_link': True,
                    'form_link_id': link.id,
                    'token': link.token,
                    'fillable_fields': link.fillable_fields,
                    'shipment_count': p.tracking_shipments.count(),
                })
            except TrackingFormLink.DoesNotExist:
                result.append({
                    'partner_id': p.id,
                    'partner_name': p.name,
                    'courier_id': p.courier_id or '',
                    'has_form_link': False,
                    'form_link_id': None,
                    'token': None,
                    'fillable_fields': [],
                    'shipment_count': p.tracking_shipments.count(),
                })
        return success_response(data={'partners': result})


class TrackingFormLinkGenerateView(APIView):
    """
    POST /api/v1/tracking/partners/<partner_id>/generate-link/
    Creates a unique form link for this delivery partner (one per partner).
    Body: { "fillable_fields": ["pod_tracking_number", ...] }
    """
    permission_classes = [IsTenantAdmin]

    def post(self, request, partner_id):
        tenant = _get_tenant(request)
        if not tenant:
            return error_response('Tenant not identified.', http_status=400)
        try:
            partner = CourierPartner.objects.get(id=int(partner_id), tenant=tenant)
        except (ValueError, CourierPartner.DoesNotExist):
            return error_response('Delivery partner not found.', http_status=404)
        if hasattr(partner, 'tracking_form_link'):
            return error_response('A form link already exists for this partner. Use update to change fillable fields.', http_status=400)
        fillable = request.data.get('fillable_fields') or []
        token = secrets.token_urlsafe(48)
        link = TrackingFormLink.objects.create(
            tenant=tenant,
            courier_partner=partner,
            token=token,
            fillable_fields=fillable,
        )
        with schema_context('public'):
            TrackingFormToken.objects.create(token=link.token, tenant=tenant)
        return success_response(
            data={
                'form_link_id': link.id,
                'token': link.token,
                'fillable_fields': link.fillable_fields,
                'form_url_path': f'/delivery-form/{link.token}',
            },
            message='Form link generated.',
            http_status=status.HTTP_201_CREATED,
        )


class TrackingFormLinkDetailView(APIView):
    """GET PATCH /api/v1/tracking/links/<link_id>/ — get or update fillable_fields."""
    permission_classes = [IsStaffOrAbove]

    def get(self, request, link_id):
        tenant = _get_tenant(request)
        if not tenant:
            return error_response('Tenant not identified.', http_status=400)
        try:
            link = TrackingFormLink.objects.get(id=int(link_id), tenant=tenant)
        except (ValueError, TrackingFormLink.DoesNotExist):
            return error_response('Form link not found.', http_status=404)
        return success_response(data=TrackingFormLinkSerializer(link).data)

    def patch(self, request, link_id):
        self.permission_classes = [IsTenantAdmin]
        self.check_permissions(request)
        tenant = _get_tenant(request)
        if not tenant:
            return error_response('Tenant not identified.', http_status=400)
        try:
            link = TrackingFormLink.objects.get(id=int(link_id), tenant=tenant)
        except (ValueError, TrackingFormLink.DoesNotExist):
            return error_response('Form link not found.', http_status=404)
        fillable = request.data.get('fillable_fields')
        if fillable is not None:
            link.fillable_fields = fillable
            link.save()
        return success_response(data=TrackingFormLinkSerializer(link).data, message='Updated.')


# ── Public form (no auth): resolve tenant from token ───────────────────────

class PublicFormByTokenView(APIView):
    """
    GET /api/v1/tracking/public/form/<token>/
    No auth. Resolves tenant from token (public schema), then returns form config and shipments.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, token):
        with schema_context('public'):
            try:
                token_obj = TrackingFormToken.objects.select_related('tenant').get(token=token)
            except TrackingFormToken.DoesNotExist:
                return error_response('Invalid or expired form link.', http_status=404)
            tenant = token_obj.tenant
        with schema_context(tenant):
            try:
                link = TrackingFormLink.objects.get(token=token)
            except TrackingFormLink.DoesNotExist:
                return error_response('Form link not found.', http_status=404)
            shipments = TrackingShipment.objects.filter(courier_partner=link.courier_partner)
        return success_response(data={
            'fillable_fields': link.fillable_fields,
            'partner_name': link.courier_partner.name,
            'shipments': PublicShipmentSerializer(shipments, many=True).data,
        })


class PublicFormSubmitView(APIView):
    """
    POST /api/v1/tracking/public/form/<token>/submit/
    No auth. Submit delivery partner data (only fillable fields are accepted).
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, token):
        with schema_context('public'):
            try:
                token_obj = TrackingFormToken.objects.select_related('tenant').get(token=token)
            except TrackingFormToken.DoesNotExist:
                return error_response('Invalid or expired form link.', http_status=404)
            tenant = token_obj.tenant
        with schema_context(tenant):
            try:
                link = TrackingFormLink.objects.get(token=token)
            except TrackingFormLink.DoesNotExist:
                return error_response('Form link not found.', http_status=404)
            fillable = set(link.fillable_fields or [])
            ser = PublicFormSubmitSerializer(data=request.data)
            ser.is_valid(raise_exception=True)
            data = ser.validated_data
            shipment_id = data['shipment_id']
            try:
                shipment = TrackingShipment.objects.get(
                    id=shipment_id,
                    courier_partner=link.courier_partner,
                )
            except TrackingShipment.DoesNotExist:
                return error_response('Shipment not found.', http_status=404)
            submitted_data = {}
            if 'pod_tracking_number' in fillable and 'pod_tracking_number' in data:
                shipment.pod_tracking_number = data.get('pod_tracking_number') or ''
                submitted_data['pod_tracking_number'] = shipment.pod_tracking_number
            if 'custom_fields' in fillable and 'custom_fields' in data:
                shipment.custom_fields = {**(shipment.custom_fields or {}), **data.get('custom_fields', {})}
                submitted_data['custom_fields'] = shipment.custom_fields
            shipment.save()
            TrackingFormSubmission.objects.create(shipment=shipment, submitted_data=submitted_data)
            sid = shipment.id
        return success_response(message='Submitted.', data={'shipment_id': sid})
