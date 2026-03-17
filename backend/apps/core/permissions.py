from rest_framework.permissions import BasePermission
from apps.users.models import UserRole


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == UserRole.SUPER_ADMIN


class IsTenantScopedUser(BasePermission):
    """
    Safety net: ensures the authenticated user actually belongs to the
    tenant whose PostgreSQL schema is currently active.

    - SuperAdmin is always allowed (they manage all tenants).
    - Any other user must have a tenant FK whose schema_name matches
      the current connection.schema_name.
    - Returns 403 if the user tries to access a different tenant's schema
      (e.g., wrong Host header was sent by a misconfigured client).
    """
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        # SuperAdmin can access any tenant
        if request.user.role == UserRole.SUPER_ADMIN:
            return True
        from django.db import connection
        current_schema = connection.schema_name
        # Tenant-scoped views must NOT run in the public schema
        if current_schema == 'public':
            return False
        user_tenant = request.user.tenant
        if not user_tenant:
            return False
        # The user's tenant schema must match the active schema
        return user_tenant.schema_name == current_schema


class IsTenantAdmin(IsTenantScopedUser):
    """Tenant admin or superadmin. Also enforces tenant scope."""
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.user.role in (
            UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN
        )


class IsStaffOrAbove(IsTenantScopedUser):
    """Staff, tenant admin, or superadmin. Also enforces tenant scope."""
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.user.role in (
            UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.STAFF
        )

