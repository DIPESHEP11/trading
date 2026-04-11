from django.urls import path
from .views import DashboardStatsView
from .reports import LeadReportView, InvoiceReportView
from .search import GlobalSearchView

urlpatterns = [
    path('stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('search/', GlobalSearchView.as_view(), name='dashboard-global-search'),
    path('reports/leads/', LeadReportView.as_view(), name='dashboard-reports-leads'),
    path('reports/invoices/', InvoiceReportView.as_view(), name='dashboard-reports-invoices'),
]
