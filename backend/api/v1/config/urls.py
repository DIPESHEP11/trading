from django.urls import path
from .views import TenantConfigView

urlpatterns = [
    path('', TenantConfigView.as_view(), name='tenant-config'),
]
