from django.db import models
from apps.core.models import TimeStampedModel


class Category(TimeStampedModel):
    name = models.CharField(max_length=200)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='children')
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    custom_fields = models.JSONField(
        default=list, blank=True,
        help_text='List of field definitions for products in this category. '
                  'e.g. [{"key": "size", "label": "Size", "type": "select", '
                  '"options": ["S","M","L","XL"], "required": true, "order": 1}]'
    )

    class Meta:
        verbose_name_plural = 'Categories'
        ordering = ['name']

    def __str__(self):
        return self.name


class Product(TimeStampedModel):
    """Core product / SKU definition."""
    sku = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    category = models.ForeignKey(Category, null=True, blank=True, on_delete=models.SET_NULL, related_name='products')

    unit = models.CharField(max_length=50, default='piece',
                            help_text='e.g. piece, box, kg, litre')
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    image = models.ImageField(upload_to='products/', null=True, blank=True)

    is_active = models.BooleanField(default=True)
    low_stock_threshold = models.PositiveIntegerField(default=10)
    custom_data = models.JSONField(
        default=dict, blank=True,
        help_text='Values for the category-specific custom fields. '
                  'e.g. {"size": "M", "color": "Red", "fabric": "Cotton"}'
    )

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'[{self.sku}] {self.name}'
