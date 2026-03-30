from django.urls import path
from .views import (
    MetaUserInfoView, MetaLeadWebhookView,
    WhatsAppSendMessageView, WhatsAppWebhookView,
)

urlpatterns = [
    # Meta
    path('meta/user/<str:user_id>/', MetaUserInfoView.as_view(), name='meta-user-info'),
    path('meta/lead-webhook/', MetaLeadWebhookView.as_view(), name='meta-lead-webhook'),
    # WhatsApp
    path('whatsapp/send/', WhatsAppSendMessageView.as_view(), name='whatsapp-send'),
    path('whatsapp/webhook/', WhatsAppWebhookView.as_view(), name='whatsapp-webhook'),
]
