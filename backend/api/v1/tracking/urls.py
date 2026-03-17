from django.urls import path
from .views import (
    TrackingShipmentListCreateView,
    TrackingShipmentFromDispatchView,
    TrackingPartnersWithLinksView,
    TrackingFormLinkGenerateView,
    TrackingFormLinkDetailView,
    PublicFormByTokenView,
    PublicFormSubmitView,
)

urlpatterns = [
    path('shipments/', TrackingShipmentListCreateView.as_view(), name='tracking-shipments'),
    path('shipments/from-dispatch/', TrackingShipmentFromDispatchView.as_view(), name='tracking-shipments-from-dispatch'),
    path('partners/', TrackingPartnersWithLinksView.as_view(), name='tracking-partners'),
    path('partners/<int:partner_id>/generate-link/', TrackingFormLinkGenerateView.as_view(), name='tracking-generate-link'),
    path('links/<int:link_id>/', TrackingFormLinkDetailView.as_view(), name='tracking-link-detail'),
    path('public/form/<str:token>/', PublicFormByTokenView.as_view(), name='tracking-public-form'),
    path('public/form/<str:token>/submit/', PublicFormSubmitView.as_view(), name='tracking-public-submit'),
]
