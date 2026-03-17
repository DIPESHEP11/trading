from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0004_custom_status_source'),
    ]

    operations = [
        migrations.CreateModel(
            name='StatusFlowAction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('status_key', models.CharField(
                    help_text='The custom lead status key that triggers this flow.',
                    max_length=50, unique=True)),
                ('target_module', models.CharField(
                    choices=[
                        ('none', 'Stay in CRM only'),
                        ('orders', 'Orders'),
                        ('warehouse', 'Warehouse / Inventory'),
                        ('invoices', 'Invoices'),
                        ('dispatch', 'Dispatch'),
                        ('products', 'Products'),
                    ],
                    default='none', max_length=30)),
                ('action', models.CharField(
                    choices=[
                        ('create_order', 'Create Order'),
                        ('send_to_warehouse', 'Send to Warehouse'),
                        ('create_invoice', 'Create Invoice'),
                        ('mark_dispatch', 'Mark for Dispatch'),
                        ('notify_only', 'Notify Only'),
                    ],
                    default='notify_only', max_length=30)),
                ('is_active', models.BooleanField(default=True)),
                ('description', models.CharField(
                    blank=True,
                    help_text='Admin note describing this flow step.',
                    max_length=200)),
            ],
            options={
                'ordering': ['status_key'],
            },
        ),
    ]
