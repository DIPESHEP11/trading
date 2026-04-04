from django.urls import path
from .views import UserListView, UserDetailView, PlatformSuperAdminListCreateView

urlpatterns = [
    path('platform-superadmins/', PlatformSuperAdminListCreateView.as_view(), name='platform-superadmins'),
    path('', UserListView.as_view(), name='user-list'),
    path('<int:pk>/', UserDetailView.as_view(), name='user-detail'),
]
