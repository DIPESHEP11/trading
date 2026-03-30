from django.urls import path
from .views import (
    LeadListCreateView, LeadDetailView, LeadAssignView, LeadBulkAssignView,
    LeadAssignmentConfigView,
    LeadFormSchemaView, LeadFormPublicView, LeadSubmitView,
    LeadFormTemplateView, LeadFormImportView,
    CustomerListCreateView, CustomerDetailView, CustomerLeadsView,
    CustomLeadStatusListCreateView, CustomLeadStatusDetailView,
    CustomLeadSourceListCreateView, CustomLeadSourceDetailView,
    StatusFlowActionListCreateView, StatusFlowActionDetailView,
)

urlpatterns = [
    path('leads/', LeadListCreateView.as_view(), name='lead-list'),
    path('leads/bulk-assign/', LeadBulkAssignView.as_view(), name='lead-bulk-assign'),
    path('lead-assignment/', LeadAssignmentConfigView.as_view(), name='lead-assignment-config'),
    path('leads/<int:pk>/', LeadDetailView.as_view(), name='lead-detail'),
    path('leads/<int:pk>/assign/', LeadAssignView.as_view(), name='lead-assign'),
    path('lead-form-schema/', LeadFormSchemaView.as_view(), name='lead-form-schema'),
    path('lead-form-schema/template/', LeadFormTemplateView.as_view(), name='lead-form-template'),
    path('lead-form-schema/import/', LeadFormImportView.as_view(), name='lead-form-import'),
    path('lead-form-public/', LeadFormPublicView.as_view(), name='lead-form-public'),
    path('lead-submit/', LeadSubmitView.as_view(), name='lead-submit'),
    path('customers/', CustomerListCreateView.as_view(), name='customer-list'),
    path('customers/<int:pk>/', CustomerDetailView.as_view(), name='customer-detail'),
    path('customers/<int:pk>/leads/', CustomerLeadsView.as_view(), name='customer-leads'),
    path('statuses/', CustomLeadStatusListCreateView.as_view(), name='lead-statuses'),
    path('statuses/<int:pk>/', CustomLeadStatusDetailView.as_view(), name='lead-status-detail'),
    path('sources/', CustomLeadSourceListCreateView.as_view(), name='lead-sources'),
    path('sources/<int:pk>/', CustomLeadSourceDetailView.as_view(), name='lead-source-detail'),
    path('flow-actions/', StatusFlowActionListCreateView.as_view(), name='flow-actions'),
    path('flow-actions/<int:pk>/', StatusFlowActionDetailView.as_view(), name='flow-action-detail'),
]
