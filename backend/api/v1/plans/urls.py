from django.urls import path
from .views import PlanListCreateView, PlanDetailView

urlpatterns = [
    path('', PlanListCreateView.as_view(), name='plan-list'),
    path('<int:pk>/', PlanDetailView.as_view(), name='plan-detail'),
]
