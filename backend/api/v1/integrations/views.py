from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from apps.core.responses import success_response, error_response
from apps.integrations.meta.service import MetaService
from apps.integrations.whatsapp.service import WhatsAppService


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
        """Receive incoming WhatsApp messages from Meta webhook."""
        # TODO: parse and handle incoming message events
        payload = request.data
        return success_response(message='Webhook received.')
