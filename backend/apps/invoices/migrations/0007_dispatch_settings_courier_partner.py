# Generated manually for Dispatch Settings and Courier Partners

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0001_initial'),
        ('invoices', '0006_serial_number_ranges'),
    ]

    operations = [
        migrations.CreateModel(
            name='DispatchSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('flow_after_dispatch', models.CharField(
                    choices=[
                        ('notify_only', 'Notify only'),
                        ('mark_delivered', 'Mark as delivered when confirmed'),
                        ('update_tracking', 'Update tracking status'),
                        ('none', 'No automatic next step'),
                    ],
                    default='notify_only',
                    help_text='Next step after an order/invoice is dispatched.',
                    max_length=30,
                )),
                ('tenant', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='dispatch_settings', to='tenants.tenant')),
            ],
            options={
                'verbose_name': 'Dispatch Settings',
                'verbose_name_plural': 'Dispatch Settings',
            },
        ),
        migrations.CreateModel(
            name='CourierPartner',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('name', models.CharField(help_text='Courier / delivery partner name', max_length=200)),
                ('courier_id', models.CharField(blank=True, help_text='Partner ID or code', max_length=100)),
                ('address', models.TextField(blank=True)),
                ('contact_person_name', models.CharField(blank=True, help_text='Contact person name', max_length=200)),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='courier_partners', to='tenants.tenant')),
            ],
            options={
                'ordering': ['name'],
                'unique_together': {('tenant', 'name')},
            },
        ),
    ]
