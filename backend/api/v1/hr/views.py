from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from apps.hr.models import EmployeeProfile, EmployeeCustomField, EmployeeDocument, EmployeeModulePermission
from apps.users.models import UserRole
from .serializers import (
    EmployeeProfileSerializer, EmployeeCustomFieldSerializer, EmployeeDocumentSerializer,
    EmployeeModulePermissionSerializer, EmployeePermissionSummarySerializer,
)
from apps.core.responses import success_response, error_response
from apps.core.permissions import IsStaffOrAbove, IsTenantAdmin


class EmployeeViewSet(viewsets.ModelViewSet):
    """CRUD for Employee Profiles — GET/POST/PATCH/DELETE /api/v1/hr/employees/"""
    queryset = EmployeeProfile.objects.all().select_related('user').prefetch_related(
        'custom_values__field', 'documents'
    )
    serializer_class = EmployeeProfileSerializer
    permission_classes = [IsStaffOrAbove]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get('search')
        department = self.request.query_params.get('department')
        resigned = self.request.query_params.get('resigned')
        if search:
            qs = qs.filter(
                user__first_name__icontains=search
            ) | qs.filter(
                user__last_name__icontains=search
            ) | qs.filter(
                user__email__icontains=search
            ) | qs.filter(
                employee_id__icontains=search
            )
        if department:
            qs = qs.filter(department__icontains=department)
        if resigned is not None:
            qs = qs.filter(resigned=resigned.lower() == 'true')
        return qs

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return success_response(data={'employees': serializer.data, 'count': queryset.count()})

    def retrieve(self, request, *args, **kwargs):
        return success_response(data=self.get_serializer(self.get_object()).data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return success_response(
            data=serializer.data, message='Employee created successfully.',
            http_status=status.HTTP_201_CREATED
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return success_response(data=serializer.data, message='Employee updated successfully.')

    def destroy(self, request, *args, **kwargs):
        self.perform_destroy(self.get_object())
        return success_response(message='Employee deleted successfully.')


class EmployeeSendResetLinkView(APIView):
    """
    POST /api/v1/hr/employees/<pk>/send-reset-link/
    Tenant admin only. Sends password reset email to the employee.
    """
    permission_classes = [IsTenantAdmin]

    def post(self, request, pk):
        try:
            emp = EmployeeProfile.objects.select_related('user').get(pk=pk)
        except EmployeeProfile.DoesNotExist:
            return error_response('Employee not found.', http_status=status.HTTP_404_NOT_FOUND)

        email = emp.user.email
        user = emp.user

        from django.core.mail import send_mail
        from django.utils import timezone
        from django.conf import settings
        from datetime import timedelta
        from django_tenants.utils import schema_context
        import secrets
        from apps.users.models import PasswordResetToken

        # PasswordResetToken lives in public schema (users app is shared)
        with schema_context('public'):
            PasswordResetToken.objects.filter(user=user).delete()
            token = secrets.token_urlsafe(48)
            expires_at = timezone.now() + timedelta(hours=24)
            PasswordResetToken.objects.create(user=user, token=token, expires_at=expires_at)

        frontend_url = getattr(settings, 'FRONTEND_CLIENT_URL', 'http://localhost:5174').rstrip('/')
        reset_link = f'{frontend_url}/reset-password?token={token}'

        subject = 'Reset your password'
        message = f'''Hi {user.first_name or user.email},

A password reset was requested for your account. Click the link below to set a new password:

{reset_link}

This link expires in 24 hours. If you didn't request this, contact your administrator.
'''
        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@traiding.local'),
                recipient_list=[user.email],
                fail_silently=False,
            )
        except Exception:
            with schema_context('public'):
                PasswordResetToken.objects.filter(user=user, token=token).delete()
            return error_response('Failed to send email.', http_status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return success_response(message=f'Password reset link sent to {email}.')


class EmployeeDocumentUploadView(APIView):
    """POST /api/v1/hr/employees/<pk>/documents/ — upload a document for an employee."""
    permission_classes = [IsStaffOrAbove]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        try:
            employee = EmployeeProfile.objects.get(pk=pk)
        except EmployeeProfile.DoesNotExist:
            return error_response('Employee not found.', http_status=status.HTTP_404_NOT_FOUND)

        serializer = EmployeeDocumentSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(employee=employee)
        return success_response(
            data=serializer.data,
            message='Document uploaded.',
            http_status=status.HTTP_201_CREATED
        )


class EmployeeDocumentDeleteView(APIView):
    """DELETE /api/v1/hr/documents/<pk>/ — delete a specific document."""
    permission_classes = [IsTenantAdmin]

    def delete(self, request, pk):
        try:
            doc = EmployeeDocument.objects.get(pk=pk)
        except EmployeeDocument.DoesNotExist:
            return error_response('Document not found.', http_status=status.HTTP_404_NOT_FOUND)
        doc.file.delete(save=False)
        doc.delete()
        return success_response(message='Document deleted.')


class EmployeePermissionsView(APIView):
    """
    GET  /api/v1/hr/permissions/                   — list all employees (summary)
    GET  /api/v1/hr/permissions/?employee=<id>     — get all module permissions for one employee
    PUT  /api/v1/hr/permissions/?employee=<id>     — bulk-save permissions for an employee
    """
    permission_classes = [IsTenantAdmin]

    def get(self, request):
        employee_id = request.query_params.get('employee')

        if not employee_id:
            employees = EmployeeProfile.objects.select_related('user').all()
            serializer = EmployeePermissionSummarySerializer(employees, many=True)
            return success_response(data=serializer.data)

        try:
            emp = EmployeeProfile.objects.select_related('user').get(pk=employee_id)
        except EmployeeProfile.DoesNotExist:
            return error_response('Employee not found.', http_status=status.HTTP_404_NOT_FOUND)

        perms = EmployeeModulePermission.objects.filter(employee=emp.user)
        serializer = EmployeeModulePermissionSerializer(perms, many=True)
        return success_response(data={
            'employee': EmployeePermissionSummarySerializer(emp).data,
            'permissions': serializer.data,
        })

    def put(self, request):
        employee_id = request.query_params.get('employee')
        if not employee_id:
            return error_response('employee query param is required.')

        try:
            emp = EmployeeProfile.objects.select_related('user').get(pk=employee_id)
        except EmployeeProfile.DoesNotExist:
            return error_response('Employee not found.', http_status=status.HTTP_404_NOT_FOUND)

        permissions = request.data.get('permissions', {})
        for module, flags in permissions.items():
            EmployeeModulePermission.objects.update_or_create(
                employee=emp.user,
                module=module,
                defaults={
                    'can_view':   bool(flags.get('can_view',   False)),
                    'can_create': bool(flags.get('can_create', False)),
                    'can_edit':   bool(flags.get('can_edit',   False)),
                    'can_delete': bool(flags.get('can_delete', False)),
                }
            )
        return success_response(message='Permissions saved successfully.')


class MyPermissionsView(APIView):
    """
    GET /api/v1/hr/permissions/me/
    Returns the current user's module permissions (can_view, etc.).
    Used by the client app to filter nav for employees — only show modules they're assigned to.
    Admins see everything; staff/member see only modules where can_view=True.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        # Tenant admin and super_admin see all — frontend handles this; we return empty to indicate "use tenant config"
        if user.role in (UserRole.TENANT_ADMIN, UserRole.SUPER_ADMIN):
            return success_response(data={'modules': {}})

        perms = EmployeeModulePermission.objects.filter(employee=user, can_view=True)
        modules = {p.module: {'can_view': p.can_view, 'can_create': p.can_create, 'can_edit': p.can_edit, 'can_delete': p.can_delete} for p in perms}
        return success_response(data={'modules': modules})


class EmployeeCustomFieldViewSet(viewsets.ModelViewSet):
    """CRUD for defining custom fields per section — /api/v1/hr/custom-fields/"""
    queryset = EmployeeCustomField.objects.all()
    serializer_class = EmployeeCustomFieldSerializer
    permission_classes = [IsTenantAdmin]
    pagination_class = None

    def list(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.filter_queryset(self.get_queryset()), many=True)
        return success_response(data=serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return success_response(data=serializer.data, message='Custom field defined.', http_status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return success_response(data=serializer.data, message='Custom field updated.')

    def destroy(self, request, *args, **kwargs):
        self.perform_destroy(self.get_object())
        return success_response(message='Custom field deleted.')
