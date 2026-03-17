"""
WhatsApp Business API service stub.
Replace placeholder config values in .env to activate.
Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/
"""
import httpx
from django.conf import settings


WA_API_BASE = 'https://graph.facebook.com/v19.0'


class WhatsAppService:
    def __init__(self):
        self.phone_number_id = settings.WHATSAPP_PHONE_NUMBER_ID
        self.access_token = settings.WHATSAPP_ACCESS_TOKEN
        self.verify_token = settings.WHATSAPP_VERIFY_TOKEN
        self.headers = {
            'Authorization': f'Bearer {self.access_token}',
            'Content-Type': 'application/json',
        }

    def send_text_message(self, to: str, body: str) -> dict:
        """Send a plain text WhatsApp message."""
        url = f'{WA_API_BASE}/{self.phone_number_id}/messages'
        payload = {
            'messaging_product': 'whatsapp',
            'to': to,
            'type': 'text',
            'text': {'body': body},
        }
        with httpx.Client() as client:
            response = client.post(url, json=payload, headers=self.headers)
            response.raise_for_status()
            return response.json()

    def send_template_message(self, to: str, template_name: str, language_code: str = 'en_US') -> dict:
        """Send a pre-approved template message."""
        url = f'{WA_API_BASE}/{self.phone_number_id}/messages'
        payload = {
            'messaging_product': 'whatsapp',
            'to': to,
            'type': 'template',
            'template': {
                'name': template_name,
                'language': {'code': language_code},
            },
        }
        with httpx.Client() as client:
            response = client.post(url, json=payload, headers=self.headers)
            response.raise_for_status()
            return response.json()

    def verify_webhook(self, mode: str, token: str, challenge: str):
        """Webhook verification handshake."""
        if mode == 'subscribe' and token == self.verify_token:
            return challenge
        raise ValueError('Webhook verification failed.')
