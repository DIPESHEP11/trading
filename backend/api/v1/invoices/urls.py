from django.urls import path
from .views import (
    InvoiceListCreateView, InvoiceDetailView, InvoiceLineItemsView,
    ConvertProformaView, GSTCalculateView, InvoicePDFView,
    OrdersPendingInvoiceView, CreateInvoiceFromOrderView,
    DispatchListCreateView, DispatchStickerDetailView, DispatchStickerPDFView,
    DispatchStickerQRView,
    DispatchSettingsView, CourierPartnerListCreateView, CourierPartnerDetailView,
    DispatchStatusListCreateView, DispatchStatusDetailView,
    DispatchFlowActionListCreateView, DispatchFlowActionDetailView,
    InvoiceSettingsView, InvoiceLogoUploadView, IndianStatesView, GSTSlabsView,
    CustomInvoiceStatusListCreateView, CustomInvoiceStatusDetailView,
    InvoiceFlowActionListCreateView, InvoiceFlowActionDetailView,
)

urlpatterns = [
    # Orders pending invoice (from order flow)
    path('orders-pending/', OrdersPendingInvoiceView.as_view(), name='invoice-orders-pending'),
    path('from-order/<int:order_id>/', CreateInvoiceFromOrderView.as_view(), name='invoice-from-order'),
    # Invoice CRUD
    path('', InvoiceListCreateView.as_view(), name='invoice-list'),
    path('<int:pk>/', InvoiceDetailView.as_view(), name='invoice-detail'),

    # PDF download
    path('<int:pk>/pdf/', InvoicePDFView.as_view(), name='invoice-pdf'),

    # Line items
    path('<int:invoice_id>/items/', InvoiceLineItemsView.as_view(), name='invoice-items'),
    path('<int:invoice_id>/items/<int:item_id>/', InvoiceLineItemsView.as_view(), name='invoice-item-detail'),

    # Proforma → Invoice conversion
    path('<int:pk>/convert/', ConvertProformaView.as_view(), name='invoice-convert'),

    # GST calculation preview
    path('calculate/', GSTCalculateView.as_view(), name='invoice-calculate'),

    # Dispatch
    path('dispatch/', DispatchListCreateView.as_view(), name='dispatch-list'),
    path('dispatch/settings/', DispatchSettingsView.as_view(), name='dispatch-settings'),
    path('dispatch/statuses/', DispatchStatusListCreateView.as_view(), name='dispatch-statuses'),
    path('dispatch/statuses/<int:pk>/', DispatchStatusDetailView.as_view(), name='dispatch-status-detail'),
    path('dispatch/flow-actions/', DispatchFlowActionListCreateView.as_view(), name='dispatch-flow-actions'),
    path('dispatch/flow-actions/<int:pk>/', DispatchFlowActionDetailView.as_view(), name='dispatch-flow-action-detail'),
    path('dispatch/partners/', CourierPartnerListCreateView.as_view(), name='dispatch-partners'),
    path('dispatch/partners/<int:pk>/', CourierPartnerDetailView.as_view(), name='dispatch-partner-detail'),
    path('dispatch/<int:pk>/', DispatchStickerDetailView.as_view(), name='dispatch-detail'),
    path('dispatch/<int:pk>/pdf/', DispatchStickerPDFView.as_view(), name='dispatch-pdf'),
    path('dispatch/<int:pk>/qr/', DispatchStickerQRView.as_view(), name='dispatch-qr'),

    # Settings
    path('settings/', InvoiceSettingsView.as_view(), name='invoice-settings'),
    path('settings/logo/', InvoiceLogoUploadView.as_view(), name='invoice-logo-upload'),

    # Reference data
    path('ref/states/', IndianStatesView.as_view(), name='indian-states'),
    path('ref/gst-slabs/', GSTSlabsView.as_view(), name='gst-slabs'),

    # Custom statuses
    path('statuses/', CustomInvoiceStatusListCreateView.as_view(), name='invoice-statuses'),
    path('statuses/<int:pk>/', CustomInvoiceStatusDetailView.as_view(), name='invoice-status-detail'),

    # Flow actions
    path('flow-actions/', InvoiceFlowActionListCreateView.as_view(), name='invoice-flow-actions'),
    path('flow-actions/<int:pk>/', InvoiceFlowActionDetailView.as_view(), name='invoice-flow-action-detail'),
]
