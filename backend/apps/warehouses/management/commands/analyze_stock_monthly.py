"""
Monthly stock analysis: aggregate movements, detect fast-moving products, create alerts.
Run: python manage.py analyze_stock_monthly [--month YYYY-MM]
Schedule via cron on 1st of each month: 0 2 1 * * python manage.py analyze_stock_monthly
"""
from decimal import Decimal
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db.models import Sum
from django.core.mail import send_mail
from django.conf import settings
from django_tenants.utils import schema_context, get_tenant_model


class Command(BaseCommand):
    help = 'Analyze stock movements per month, store summaries, detect fast-moving products, send alerts'

    def add_arguments(self, parser):
        parser.add_argument('--month', type=str, help='YYYY-MM to analyze (default: previous month)')
        parser.add_argument('--dry-run', action='store_true', help='Do not create records or send emails')

    def handle(self, *args, **options):
        month = options.get('month')
        dry_run = options.get('dry_run')
        if not month:
            prev = timezone.now().replace(day=1) - timezone.timedelta(days=1)
            month = prev.strftime('%Y-%m')
        self.stdout.write(f'Analyzing stock for {month} (dry_run={dry_run})')

        Tenant = get_tenant_model()
        tenants = Tenant.objects.exclude(schema_name='public')
        total_alerts = 0
        for tenant in tenants:
            with schema_context(tenant.schema_name):
                count = self._analyze_tenant(tenant, month, dry_run)
                total_alerts += count
        self.stdout.write(self.style.SUCCESS(f'Done. Created {total_alerts} fast-moving alerts.'))

    def _analyze_tenant(self, tenant, year_month, dry_run):
        from apps.warehouses.models import StockMovement, StockMonthlySummary, StockAlert
        from apps.products.models import Product
        from apps.config.models import TenantConfig

        # Aggregate movements by product for the month
        year, month_num = map(int, year_month.split('-'))
        from datetime import date
        import calendar
        last_day_num = calendar.monthrange(year, month_num)[1]
        last_day = date(year, month_num, last_day_num)

        movements = StockMovement.objects.filter(
            created_at__date__gte=first_day,
            created_at__date__lte=last_day,
        )
        by_product = defaultdict(lambda: {'in': Decimal(0), 'out': Decimal(0), 'count': 0})
        for m in movements:
            key = m.product_id
            qty = m.quantity
            if m.movement_type in ('in', 'return'):
                by_product[key]['in'] += qty
            elif m.movement_type == 'out':
                by_product[key]['out'] += qty
            by_product[key]['count'] += 1

        # Build list of (product_id, total_out) for fast-moving percentile
        out_list = [(pid, data['out']) for pid, data in by_product.items() if data['out'] > 0]
        out_list.sort(key=lambda x: x[1], reverse=True)
        # Top 20% by out volume = fast-moving
        fast_count = max(1, len(out_list) // 5) if out_list else 0
        fast_product_ids = set(pid for pid, _ in out_list[:fast_count])

        # Get config
        config = TenantConfig.objects.filter(tenant=tenant).first()
        if not config:
            config = type('Config', (), {'fast_moving_alert_enabled': True})()

        alerts_created = 0
        for product_id, data in by_product.items():
            product = Product.objects.filter(pk=product_id).first()
            if not product:
                continue
            if dry_run:
                self.stdout.write(f'  [DRY] {product.sku} | in={data["in"]} out={data["out"]}')
                continue
            sms, _ = StockMonthlySummary.objects.update_or_create(
                product=product,
                year_month=year_month,
                defaults={
                    'total_in': data['in'],
                    'total_out': data['out'],
                    'movement_count': data['count'],
                    'is_fast_moving': product_id in fast_product_ids,
                },
            )
            if product_id in fast_product_ids and getattr(config, 'fast_moving_alert_enabled', True):
                msg = f'{product.name} ({product.sku}) had high out-movement ({data["out"]}) in {year_month}. Consider increasing buffer stock.'
                alert, created = StockAlert.objects.get_or_create(
                    product=product,
                    alert_type='fast_moving',
                    year_month=year_month,
                    defaults={'message': msg[:500]},
                )
                if created:
                    alerts_created += 1
                    # Send email to tenant admins (User lives in public schema)
                    from apps.users.models import User, UserRole
                    with schema_context('public'):
                        admin_emails = list(User.objects.filter(
                            role=UserRole.TENANT_ADMIN,
                            tenant_id=tenant.id,
                            is_active=True,
                        ).values_list('email', flat=True))
                    if admin_emails and not dry_run:
                        try:
                            send_mail(
                                subject=f'[Buffer Stock] Fast-moving product: {product.name}',
                                message=msg,
                                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@trading.local'),
                                recipient_list=admin_emails,
                                fail_silently=True,
                            )
                            alert.email_sent_at = timezone.now()
                            alert.save(update_fields=['email_sent_at'])
                        except Exception:
                            pass
        return alerts_created
