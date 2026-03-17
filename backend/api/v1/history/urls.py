from django.urls import path
from .views import ModuleHistoryListView, ModuleHistoryDeleteView, ModuleHistoryExportView

urlpatterns = [
    path('', ModuleHistoryListView.as_view(), name='history-list'),
    path('export/', ModuleHistoryExportView.as_view(), name='history-export'),
    path('<int:pk>/', ModuleHistoryDeleteView.as_view(), name='history-delete'),
]
