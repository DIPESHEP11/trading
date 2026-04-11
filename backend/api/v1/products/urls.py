from django.urls import path
from .views import CategoryListCreateView, CategoryDetailView, CategoryTreeView, ProductListCreateView, ProductDetailView

urlpatterns = [
    path('categories/', CategoryListCreateView.as_view(), name='category-list'),
    path('categories/tree/', CategoryTreeView.as_view(), name='category-tree'),
    path('categories/<int:pk>/', CategoryDetailView.as_view(), name='category-detail'),
    path('', ProductListCreateView.as_view(), name='product-list'),
    path('<int:pk>/', ProductDetailView.as_view(), name='product-detail'),
]
