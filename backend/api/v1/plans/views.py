from rest_framework import generics, status
from apps.tenants.models import Plan
from apps.core.permissions import IsSuperAdmin
from apps.core.responses import success_response
from .serializers import PlanSerializer


class PlanListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/v1/plans/"""
    serializer_class = PlanSerializer
    permission_classes = [IsSuperAdmin]
    queryset = Plan.objects.all()

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        data = PlanSerializer(qs, many=True).data
        return success_response(data={'plans': data, 'count': len(data)})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        plan = serializer.save()
        return success_response(
            data=PlanSerializer(plan).data,
            message='Plan created successfully.',
            http_status=status.HTTP_201_CREATED,
        )


class PlanDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PATCH/DELETE /api/v1/plans/<id>/"""
    serializer_class = PlanSerializer
    permission_classes = [IsSuperAdmin]
    queryset = Plan.objects.all()

    def retrieve(self, request, *args, **kwargs):
        return success_response(data=PlanSerializer(self.get_object()).data)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        plan = serializer.save()
        return success_response(data=PlanSerializer(plan).data, message='Plan updated.')

    def destroy(self, request, *args, **kwargs):
        self.get_object().delete()
        return success_response(message='Plan deleted.')
