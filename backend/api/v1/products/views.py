from rest_framework import generics, status
from apps.products.models import Product, Category
from apps.core.responses import success_response, error_response
from apps.core.permissions import IsStaffOrAbove, IsTenantAdmin
from .serializers import ProductSerializer, ProductListSerializer, CategorySerializer


class CategoryListCreateView(generics.ListCreateAPIView):
    serializer_class = CategorySerializer
    permission_classes = [IsStaffOrAbove]
    queryset = Category.objects.filter(is_active=True)

    def list(self, request, *args, **kwargs):
        data = CategorySerializer(self.get_queryset(), many=True).data
        return success_response(data={'categories': data})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cat = serializer.save()
        return success_response(data=CategorySerializer(cat).data,
                                message='Category created.', http_status=status.HTTP_201_CREATED)


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET PATCH DELETE /api/v1/products/categories/<id>/ — Edit or soft-delete a category."""
    serializer_class = CategorySerializer
    permission_classes = [IsTenantAdmin]
    queryset = Category.objects.all()

    def retrieve(self, request, *args, **kwargs):
        return success_response(data=CategorySerializer(self.get_object()).data)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        cat = serializer.save()
        return success_response(data=CategorySerializer(cat).data, message='Category updated.')

    def destroy(self, request, *args, **kwargs):
        cat = self.get_object()
        cat.is_active = False
        cat.save()
        return success_response(message='Category deactivated.')


class ProductListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsStaffOrAbove]

    def get_serializer_class(self):
        return ProductListSerializer if self.request.method == 'GET' else ProductSerializer

    def get_queryset(self):
        qs = Product.objects.filter(is_active=True)
        category = self.request.query_params.get('category')
        search = self.request.query_params.get('search')
        if category:
            qs = qs.filter(category=category)
        if search:
            qs = qs.filter(name__icontains=search) | qs.filter(sku__icontains=search)
        return qs.select_related('category')

    def list(self, request, *args, **kwargs):
        data = ProductListSerializer(self.get_queryset(), many=True).data
        return success_response(data={'products': data, 'count': len(data)})

    def create(self, request, *args, **kwargs):
        serializer = ProductSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = serializer.save()
        return success_response(data=ProductSerializer(product).data,
                                message='Product created.', http_status=status.HTTP_201_CREATED)


class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProductSerializer
    permission_classes = [IsStaffOrAbove]
    queryset = Product.objects.all()

    def retrieve(self, request, *args, **kwargs):
        return success_response(data=ProductSerializer(self.get_object()).data)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(data=serializer.data, message='Product updated.')

    def destroy(self, request, *args, **kwargs):
        product = self.get_object()
        product.is_active = False
        product.save()
        return success_response(message='Product deactivated.')
