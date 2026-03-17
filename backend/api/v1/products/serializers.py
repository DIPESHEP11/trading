from rest_framework import serializers
from apps.products.models import Product, Category


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
