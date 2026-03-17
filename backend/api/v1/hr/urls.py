from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    EmployeeViewSet, EmployeeCustomFieldViewSet,
    EmployeeDocumentUploadView, EmployeeDocumentDeleteView,
    EmployeePermissionsView, MyPermissionsView,
    EmployeeSendResetLinkView,
)

router = DefaultRouter()
router.register(r'employees', EmployeeViewSet, basename='employee')
router.register(r'custom-fields', EmployeeCustomFieldViewSet, basename='employee-custom-field')

urlpatterns = [
    path('', include(router.urls)),
    path('employees/<int:pk>/send-reset-link/', EmployeeSendResetLinkView.as_view(), name='employee-send-reset-link'),
    path('employees/<int:pk>/documents/', EmployeeDocumentUploadView.as_view(), name='employee-doc-upload'),
    path('documents/<int:pk>/', EmployeeDocumentDeleteView.as_view(), name='employee-doc-delete'),
    path('permissions/me/', MyPermissionsView.as_view(), name='my-permissions'),
    path('permissions/', EmployeePermissionsView.as_view(), name='employee-permissions'),
]
