from django.urls import path
from .views import (
    TenantListCreateView,
    TenantDetailView,
    TenantDomainsListView,
    RegisterClientView,
    AssignAdminToTenantView,
    ClientAdminListView,
    ClientAdminDetailView,
    ClientAdminSetPasswordView,
)

urlpatterns = [
    path('domains/', TenantDomainsListView.as_view(), name='tenant-domains-list'),
    path('', TenantListCreateView.as_view(), name='tenant-list-create'),
    path('register/', RegisterClientView.as_view(), name='tenant-register-client'),
    path('<int:tenant_id>/assign-admin/', AssignAdminToTenantView.as_view(), name='tenant-assign-admin'),
    path('admins/', ClientAdminListView.as_view(), name='client-admin-list'),
    path('admins/<int:pk>/set-password/', ClientAdminSetPasswordView.as_view(), name='client-admin-set-password'),
    path('admins/<int:pk>/', ClientAdminDetailView.as_view(), name='client-admin-detail'),
    path('<int:pk>/', TenantDetailView.as_view(), name='tenant-detail'),
]
