from rest_framework import generics, status
from rest_framework.views import APIView
from apps.users.models import User
from apps.core.permissions import IsTenantAdmin
from apps.core.responses import success_response, error_response
from .serializers import UserListSerializer, UserDetailSerializer, UserUpdateSerializer


class UserListView(generics.ListAPIView):
    """GET /api/v1/users/"""
    serializer_class = UserListSerializer
    permission_classes = [IsTenantAdmin]

    def get_queryset(self):
        qs = User.objects.all()
        role = self.request.query_params.get('role')
        is_active = self.request.query_params.get('is_active')
        search = self.request.query_params.get('search')
        if role:
            qs = qs.filter(role=role)
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')
        if search:
            qs = qs.filter(
                email__icontains=search
            ) | qs.filter(first_name__icontains=search) | qs.filter(last_name__icontains=search)
        return qs

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        paginator = self.pagination_class() if self.pagination_class else None
        if paginator:
            page = paginator.paginate_queryset(qs, request)
            data = UserListSerializer(page, many=True).data
            return paginator.get_paginated_response(data)
        data = UserListSerializer(qs, many=True).data
        return success_response(data={'users': data, 'count': len(data)})


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET PUT PATCH DELETE /api/v1/users/<id>/"""
    permission_classes = [IsTenantAdmin]
    queryset = User.objects.all()

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return UserUpdateSerializer
        return UserDetailSerializer

    def retrieve(self, request, *args, **kwargs):
        return success_response(data=UserDetailSerializer(self.get_object()).data)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(data=serializer.data, message='User updated.')

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        user.is_active = False
        user.save()
        return success_response(message='User deactivated.')
