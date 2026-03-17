from django.urls import path
from .views import (
    OrderListCreateView, OrderDetailView, OrderApproveView, OrderRejectView,
    CustomOrderStatusListCreateView, CustomOrderStatusDetailView,
    OrderFlowActionListCreateView, OrderFlowActionDetailView,
)

urlpatterns = [
    path('', OrderListCreateView.as_view(), name='order-list'),
    path('<int:pk>/', OrderDetailView.as_view(), name='order-detail'),
    path('<int:pk>/approve/', OrderApproveView.as_view(), name='order-approve'),
    path('<int:pk>/reject/', OrderRejectView.as_view(), name='order-reject'),
    path('statuses/', CustomOrderStatusListCreateView.as_view(), name='order-statuses'),
    path('statuses/<int:pk>/', CustomOrderStatusDetailView.as_view(), name='order-status-detail'),
    path('flow-actions/', OrderFlowActionListCreateView.as_view(), name='order-flow-actions'),
    path('flow-actions/<int:pk>/', OrderFlowActionDetailView.as_view(), name='order-flow-action-detail'),
]
