from django.urls import path
from .views import (
    WarehouseListCreateView, WarehouseDetailView,
    WarehousePublicView, WarehousePublicUsageView,
    StockRecordListView, StockMovementListCreateView, StockTransferView,
    StockAlertListView, StockAlertMarkReadView, StockMonthlySummaryListView,
    InventoryApprovalListCreateView, InventoryApprovalDetailView,
    InventoryApprovalActionView, InventoryApprovalStatusChangeView,
    InventoryStatusListCreateView, InventoryStatusDetailView,
    InventoryFlowActionListCreateView, InventoryFlowActionDetailView,
)

urlpatterns = [
    path('warehouses/', WarehouseListCreateView.as_view(), name='warehouse-list'),
    path('warehouses/<int:pk>/', WarehouseDetailView.as_view(), name='warehouse-detail'),
    path('warehouse-view/<str:token>/', WarehousePublicView.as_view(), name='warehouse-public-view'),
    path('warehouse-view/<str:token>/usage/', WarehousePublicUsageView.as_view(), name='warehouse-public-usage'),
    path('records/', StockRecordListView.as_view(), name='stock-records'),
    path('movements/', StockMovementListCreateView.as_view(), name='stock-movements'),
    path('transfer/', StockTransferView.as_view(), name='stock-transfer'),
    path('alerts/', StockAlertListView.as_view(), name='stock-alerts'),
    path('alerts/<int:pk>/read/', StockAlertMarkReadView.as_view(), name='stock-alert-mark-read'),
    path('monthly-summary/', StockMonthlySummaryListView.as_view(), name='stock-monthly-summary'),

    # Inventory Statuses & Flow
    path('statuses/', InventoryStatusListCreateView.as_view(), name='inventory-status-list'),
    path('statuses/<int:pk>/', InventoryStatusDetailView.as_view(), name='inventory-status-detail'),
    path('flow-actions/', InventoryFlowActionListCreateView.as_view(), name='inventory-flow-list'),
    path('flow-actions/<int:pk>/', InventoryFlowActionDetailView.as_view(), name='inventory-flow-detail'),

    # Inventory Approvals
    path('approvals/', InventoryApprovalListCreateView.as_view(), name='approval-list'),
    path('approvals/<int:pk>/', InventoryApprovalDetailView.as_view(), name='approval-detail'),
    path('approvals/<int:pk>/change-status/',
         InventoryApprovalStatusChangeView.as_view(), name='approval-change-status'),
    path('approvals/<int:pk>/approve/',
         InventoryApprovalActionView.as_view(), {'action': 'approve'}, name='approval-approve'),
    path('approvals/<int:pk>/reject/',
         InventoryApprovalActionView.as_view(), {'action': 'reject'}, name='approval-reject'),
]
