from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0005_remove_tenant_mobile_app_bundle_id_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='Plan',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, unique=True)),
                ('slug', models.SlugField(unique=True)),
                ('price', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('billing_period', models.CharField(
                    choices=[('monthly', 'Monthly'), ('yearly', 'Yearly'), ('one_time', 'One-time')],
                    default='monthly', max_length=20,
                )),
                ('description', models.TextField(blank=True)),
                ('features', models.JSONField(default=list, help_text='List of feature strings shown on the plan card.')),
                ('max_users', models.IntegerField(blank=True, null=True)),
                ('module_crm', models.BooleanField(default=True)),
                ('module_products', models.BooleanField(default=True)),
                ('module_stock', models.BooleanField(default=True)),
                ('module_orders', models.BooleanField(default=True)),
                ('module_warehouse', models.BooleanField(default=True)),
                ('module_invoices', models.BooleanField(default=True)),
                ('module_dispatch', models.BooleanField(default=True)),
                ('module_tracking', models.BooleanField(default=False)),
                ('module_manufacturing', models.BooleanField(default=False)),
                ('module_hr', models.BooleanField(default=False)),
                ('module_analytics', models.BooleanField(default=True)),
                ('is_active', models.BooleanField(default=True)),
                ('display_order', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['display_order', 'name'],
            },
        ),
    ]
