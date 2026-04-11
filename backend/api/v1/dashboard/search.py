from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from apps.core.responses import success_response, error_response
from apps.crm.models import Lead, Customer
from apps.orders.models import Order
from apps.invoices.models import DispatchSticker

class GlobalSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if not query or len(query) < 3:
            return success_response(data=[])

        results = []

        # 1. Search Leads (by phone, name, email)
        leads = Lead.objects.filter(
            Q(phone__icontains=query) | 
            Q(name__icontains=query) | 
            Q(email__icontains=query)
        )[:5]
        for l in leads:
            results.append({
                'type': 'lead',
                'id': l.id,
                'title': l.name,
                'subtitle': f"Phone: {l.phone} | Status: {l.status}",
                'link': '/dashboard/crm/leads',
                'stage': 'CRM Lead Phase'
            })

        # 2. Search Customers
        customers = Customer.objects.filter(
            Q(phone__icontains=query) | 
            Q(first_name__icontains=query) | 
            Q(last_name__icontains=query)
        )[:5]
        for c in customers:
            results.append({
                'type': 'customer',
                'id': c.id,
                'title': c.full_name,
                'subtitle': f"Phone: {c.phone}",
                'link': '/dashboard/crm/customers',
                'stage': 'Confirmed Customer'
            })

        # 3. Search Orders (by phone, order_number, name)
        orders = Order.objects.filter(
            Q(shipping_phone__icontains=query) | 
            Q(order_number__icontains=query) |
            Q(shipping_name__icontains=query)
        )[:5]
        for o in orders:
            results.append({
                'type': 'order',
                'id': o.id,
                'title': f"Order #{o.order_number}",
                'subtitle': f"For: {o.shipping_name} | Phone: {o.shipping_phone} | Status: {o.status}",
                'link': '/dashboard/orders/list',
                'stage': 'Order Processing'
            })

        # 4. Search Dispatch Stickers
        dispatches = DispatchSticker.objects.filter(
            Q(awb_number__icontains=query) |
            Q(invoice__recipient_phone__icontains=query) |
            Q(invoice__recipient_name__icontains=query)
        )[:5]
        for d in dispatches:
            results.append({
                'type': 'dispatch',
                'id': d.id,
                'title': f"Dispatch AWB: {d.awb_number}",
                'subtitle': f"Courier: {d.get_courier_display()} | Status: {d.status or 'Dispatched'}",
                'link': '/dashboard/dispatch',
                'stage': 'Dispatched'
            })

        return success_response(data=results)
