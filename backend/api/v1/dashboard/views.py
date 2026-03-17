from django.db.models.functions import TruncMonth
from django.db.models import Count
from django.utils import timezone
from datetime import timedelta
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from apps.core.responses import success_response
from apps.crm.models import Lead
from apps.orders.models import Order
from apps.products.models import Product
from apps.hr.models import EmployeeProfile


class DashboardStatsView(APIView):
    """
    GET /api/v1/dashboard/stats/
    Returns tenant-specific quick stats, month summary, and monthly series for charts.
    All queries run inside the current tenant's PostgreSQL schema — no cross-tenant
    data is ever returned.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        six_months_ago = now - timedelta(days=180)

        # Each of these queries runs inside the active tenant schema automatically
        try:
            leads_total = Lead.objects.count()
            leads_new = Lead.objects.filter(status='new').count()
            leads_this_month = Lead.objects.filter(
                created_at__gte=now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            ).count()
        except Exception:
            leads_total = leads_new = leads_this_month = 0

        try:
            orders_total = Order.objects.count()
            orders_pending = Order.objects.filter(status='pending').count()
            orders_this_month = Order.objects.filter(
                created_at__gte=now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            ).count()
        except Exception:
            orders_total = orders_pending = orders_this_month = 0

        try:
            products_total = Product.objects.filter(is_active=True).count()
        except Exception:
            products_total = 0

        try:
            employees_total = EmployeeProfile.objects.count()
            employees_active = EmployeeProfile.objects.filter(resigned=False).count()
        except Exception:
            employees_total = employees_active = 0

        # Monthly breakdown for charts (last 6 months)
        monthly_leads = []
        monthly_orders = []
        try:
            leads_by_month = (
                Lead.objects.filter(created_at__gte=six_months_ago)
                .annotate(month=TruncMonth('created_at'))
                .values('month')
                .annotate(count=Count('id'))
                .order_by('month')
            )
            monthly_leads = [{'month': str(r['month'])[:7], 'count': r['count']} for r in leads_by_month]
        except Exception:
            pass

        try:
            orders_by_month = (
                Order.objects.filter(created_at__gte=six_months_ago)
                .annotate(month=TruncMonth('created_at'))
                .values('month')
                .annotate(count=Count('id'))
                .order_by('month')
            )
            monthly_orders = [{'month': str(r['month'])[:7], 'count': r['count']} for r in orders_by_month]
        except Exception:
            pass

        # Fill gaps for months with zero data (for consistent chart display)
        def fill_months(data, key='month'):
            months_needed = []
            for i in range(5, -1, -1):
                d = now - timedelta(days=30 * i)
                months_needed.append(d.strftime('%Y-%m'))
            lookup = {r[key]: r['count'] for r in data}
            return [{'month': m, 'count': lookup.get(m, 0)} for m in months_needed]

        monthly_leads = fill_months(monthly_leads)
        monthly_orders = fill_months(monthly_orders)

        return success_response(data={
            'leads': {'total': leads_total, 'new': leads_new, 'this_month': leads_this_month},
            'orders': {'total': orders_total, 'pending': orders_pending, 'this_month': orders_this_month},
            'products': {'total': products_total},
            'employees': {'total': employees_total, 'active': employees_active},
            'month_summary': {
                'leads': leads_this_month,
                'orders': orders_this_month,
                'month': now.strftime('%B %Y'),
            },
            'monthly': {
                'leads': monthly_leads,
                'orders': monthly_orders,
            },
        })
