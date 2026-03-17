from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0003_alter_order_source'),
    ]

    operations = [
        migrations.CreateModel(
            name='CustomOrderStatus',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('key', models.SlugField(max_length=50, unique=True)),
                ('label', models.CharField(max_length=100)),
                ('color', models.CharField(default='#64748b', max_length=20)),
                ('order', models.IntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
            ],
            options={'ordering': ['order', 'id']},
        ),
        migrations.CreateModel(
            name='OrderFlowAction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('status_key', models.CharField(max_length=50, unique=True)),
                ('target_module', models.CharField(
                    choices=[
                        ('none', 'Stay in Orders only'),
                        ('warehouse', 'Warehouse / Inventory'),
                        ('invoices', 'Invoices'),
                        ('dispatch', 'Dispatch'),
                        ('crm', 'CRM'),
                    ], default='none', max_length=30)),
                ('action', models.CharField(
                    choices=[
                        ('send_to_warehouse', 'Send to Warehouse'),
                        ('create_invoice', 'Create Invoice'),
                        ('mark_dispatch', 'Mark for Dispatch'),
                        ('notify_only', 'Notify Only'),
                    ], default='notify_only', max_length=30)),
                ('is_active', models.BooleanField(default=True)),
                ('description', models.CharField(blank=True, max_length=200)),
            ],
            options={'ordering': ['status_key']},
        ),
        migrations.AlterField(
            model_name='order',
            name='source',
            field=models.CharField(default='manual', max_length=50),
        ),
        migrations.AlterField(
            model_name='order',
            name='status',
            field=models.CharField(default='pending', max_length=50),
        ),
        migrations.AlterField(
            model_name='orderstatushistory',
            name='from_status',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AlterField(
            model_name='orderstatushistory',
            name='to_status',
            field=models.CharField(max_length=50),
        ),
    ]
