from rest_framework import serializers
from apps.products.models import Product, Category


class CategoryTreeSerializer(serializers.ModelSerializer):
    """Recursive serializer — children are serialized as nested objects."""
    children = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'parent', 'is_active', 'unit', 'custom_fields', 'children']

    def get_children(self, obj):
        qs = obj.children.filter(is_active=True)
        return CategoryTreeSerializer(qs, many=True).data


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_category_name(self, obj):
        return obj.category.name if obj.category else None


class ProductListSerializer(serializers.ModelSerializer):
    category_name = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ['id', 'sku', 'name', 'category', 'category_name', 'unit', 'price', 'is_active', 'custom_data', 'low_stock_threshold']

    def get_category_name(self, obj):
        return obj.category.name if obj.category else None
