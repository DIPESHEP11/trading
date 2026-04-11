from django.urls import path
from .views import (
    WorkOrderListCreateView, WorkOrderDetailView,
    ManufacturingSchemaView,
    ManufacturingStatusListView, ManufacturingStatusDetailView,
    ManufacturingStatusFlowListView, ManufacturingStatusFlowDetailView,
)

urlpatterns = [
    path('work-orders/',       WorkOrderListCreateView.as_view()),
    path('work-orders/<int:pk>/', WorkOrderDetailView.as_view()),
    path('schema/',            ManufacturingSchemaView.as_view()),
    path('statuses/',          ManufacturingStatusListView.as_view()),
    path('statuses/<int:pk>/', ManufacturingStatusDetailView.as_view()),
    path('status-flows/',          ManufacturingStatusFlowListView.as_view()),
    path('status-flows/<int:pk>/', ManufacturingStatusFlowDetailView.as_view()),
]
