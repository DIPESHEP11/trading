from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.db import transaction

from apps.core.responses import success_response, error_response
from apps.integrations.meta.service import MetaService
from apps.integrations.whatsapp.service import WhatsAppService
from apps.crm.models import Lead, LeadSource
from apps.crm.assignment import auto_assign_lead_from_bulk_defaults


class MetaUserInfoView(APIView):
    """GET /api/v1/integrations/meta/user/<user_id>/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        try:
            data = MetaService().get_user_info(user_id)
            return success_response(data=data)
        except Exception as e:
            return error_response(str(e))


class WhatsAppSendMessageView(APIView):
    """POST /api/v1/integrations/whatsapp/send/"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        to = request.data.get('to')
        body = request.data.get('body')
        if not to or not body:
            return error_response('`to` and `body` are required.')
        try:
            data = WhatsAppService().send_text_message(to, body)
            return success_response(data=data, message='Message sent.')
        except Exception as e:
            return error_response(str(e))


class WhatsAppWebhookView(APIView):
    """GET POST /api/v1/integrations/whatsapp/webhook/"""
    permission_classes = [AllowAny]

    def get(self, request):
        """Meta webhook verification."""
        mode = request.query_params.get('hub.mode')
        token = request.query_params.get('hub.verify_token')
        challenge = request.query_params.get('hub.challenge')
        try:
            challenge = WhatsAppService().verify_webhook(mode, token, challenge)
            from django.http import HttpResponse
            return HttpResponse(challenge, content_type='text/plain')
        except ValueError as e:
            return error_response(str(e), http_status=403)

    def post(self, request):
        """Receive incoming WhatsApp messages — creates CRM leads (tenant from Host)."""
        from api.v1.crm.views import _auto_link_customer

        payload = request.data if isinstance(request.data, dict) else {}
        created = 0
        entries = payload.get('entry') or []
        for entry in entries:
            for change in entry.get('changes') or []:
                value = change.get('value') or {}
                contacts = value.get('contacts') or []
                by_wa = {}
                for c in contacts:
                    wa_id = c.get('wa_id') or ''
                    prof = c.get('profile') or {}
                    by_wa[wa_id] = (prof.get('name') or '').strip()
                for msg in value.get('messages') or []:
                    if msg.get('type') != 'text':
                        continue
                    from_id = (msg.get('from') or '').strip()
                    body = ((msg.get('text') or {}).get('body') or '').strip()
                    if not from_id:
                        continue
                    name = (by_wa.get(from_id) or f'WhatsApp {from_id}')[:200]
                    ext_id = (msg.get('id') or '')[:200]
                    if ext_id and Lead.objects.filter(external_id=ext_id).exists():
                        continue
                    with transaction.atomic():
                        lead = Lead.objects.create(
                            source=LeadSource.WHATSAPP,
                            status='new',
                            name=name or 'WhatsApp lead',
                            phone=from_id[:20],
                            notes=body[:5000] if body else '',
                            external_id=ext_id,
                            external_data={'raw_message': msg},
                        )
                        _auto_link_customer(lead)
                        auto_assign_lead_from_bulk_defaults(lead)
                    created += 1
        return success_response(data={'leads_created': created}, message='Webhook processed.')


class MetaLeadWebhookView(APIView):
    """
    POST /api/v1/integrations/meta/lead-webhook/
    Meta Lead Ads / Instant Forms — minimal handler (verify signature in production).
    Payload may include field_data: [{name, values: [...]}, ...] or flat name/phone/email.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        from api.v1.crm.views import _auto_link_customer

        data = request.data if isinstance(request.data, dict) else {}
        name, phone, email = '', '', ''

        fd = data.get('field_data')
        if isinstance(fd, list):
            for item in fd:
                n = (item.get('name') or '').lower().replace(' ', '_')
                vals = item.get('values') or []
                v = str(vals[0]).strip() if vals else ''
                if not v:
                    continue
                if 'full_name' in n or n in ('name', 'first_name'):
                    name = v
                elif 'phone' in n or 'mobile' in n:
                    phone = v
                elif 'email' in n:
                    email = v
        name = name or (data.get('name') or data.get('full_name') or '').strip()
        phone = (phone or data.get('phone') or data.get('mobile') or '').strip()
        email = (email or data.get('email') or '').strip()

        if not name and not phone and not email:
            return success_response(data={'leads_created': 0}, message='No lead fields in payload.')

        gen_id = (data.get('leadgen_id') or data.get('id') or '')[:200]
        if gen_id and Lead.objects.filter(external_id=gen_id).exists():
            return success_response(data={'leads_created': 0}, message='Duplicate lead id.')

        display = name or phone or email or 'Meta lead'
        with transaction.atomic():
            lead = Lead.objects.create(
                source=LeadSource.META,
                status='new',
                name=display[:200],
                email=email[:254] if email else '',
                phone=phone[:20] if phone else '',
                notes='From Meta lead webhook',
                external_id=gen_id,
                external_data=data if isinstance(data, dict) else {},
            )
            _auto_link_customer(lead)
            auto_assign_lead_from_bulk_defaults(lead)
        return success_response(data={'leads_created': 1, 'lead_id': lead.id}, message='Lead captured.')
