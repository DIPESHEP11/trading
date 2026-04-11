from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.db import models
from django.db.models import Count, Sum
from apps.core.responses import success_response, error_response
from apps.crm.models import Lead
from apps.invoices.models import Invoice

class LeadReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # We assume the product name is stored in custom_data->>'product'
        # Group by this JSON field
        leads_by_product = (
            Lead.objects.values('custom_data__product')
            .annotate(
                total=Count('id'),
                won=Count('id', filter=models.Q(status='order_created') | models.Q(status='won')),
                lost=Count('id', filter=models.Q(status='lost')),
            )
            .order_by('-total')
        )
        
        # Why lost order
        lost_reasons = (
            Lead.objects.filter(status='lost')
            .values('custom_data__lost_reason')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        data = {
            'leads_by_product': list(leads_by_product),
            'lost_reasons': list(lost_reasons)
        }
        return success_response(data=data)

class InvoiceReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        min_amount = request.query_params.get('min_amount')
        max_amount = request.query_params.get('max_amount')
        
        qs = Invoice.objects.all()
        if min_amount:
            qs = qs.filter(grand_total__gte=min_amount)
        if max_amount:
            qs = qs.filter(grand_total__lte=max_amount)
            
        summary = qs.aggregate(
            total_count=Count('id'),
            total_amount=Sum('grand_total')
        )
        
        # range breakdown (e.g. 0-5k, 5k-10k)
        # simplified by returning data to frontend
        invoices = qs.values('invoice_number', 'status', 'grand_total', 'created_at')[:100]
        
        return success_response(data={
            'summary': summary,
            'recent_invoices': list(invoices)
        })
