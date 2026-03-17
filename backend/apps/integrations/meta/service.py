"""
Meta Graph API service stub.
Replace placeholder config values in .env to activate.
Docs: https://developers.facebook.com/docs/graph-api/
"""
import httpx
from django.conf import settings


GRAPH_API_BASE = 'https://graph.facebook.com/v19.0'


class MetaService:
    def __init__(self):
        self.app_id = settings.META_APP_ID
        self.app_secret = settings.META_APP_SECRET
        self.access_token = settings.META_ACCESS_TOKEN
        self.headers = {'Authorization': f'Bearer {self.access_token}'}

    def get_user_info(self, user_id: str) -> dict:
        """Fetch Meta user info by ID."""
        url = f'{GRAPH_API_BASE}/{user_id}'
        params = {'fields': 'id,name,email', 'access_token': self.access_token}
        with httpx.Client() as client:
            response = client.get(url, params=params)
            response.raise_for_status()
            return response.json()

    def get_page_insights(self, page_id: str, metric: str = 'page_impressions') -> dict:
        """Fetch Page Insights for a given metric."""
        url = f'{GRAPH_API_BASE}/{page_id}/insights'
        params = {'metric': metric, 'access_token': self.access_token}
        with httpx.Client() as client:
            response = client.get(url, params=params)
            response.raise_for_status()
            return response.json()

    def post_to_page(self, page_id: str, message: str) -> dict:
        """Post a message to a Meta page."""
        url = f'{GRAPH_API_BASE}/{page_id}/feed'
        data = {'message': message, 'access_token': self.access_token}
        with httpx.Client() as client:
            response = client.post(url, data=data)
            response.raise_for_status()
            return response.json()
