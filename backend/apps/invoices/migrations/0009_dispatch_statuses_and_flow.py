# Generated migration: CustomDispatchStatus, DispatchFlowAction, DispatchSticker.status

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0001_initial'),
        ('invoices', '0008_dispatch_settings_tracking_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='dispatchsticker',
            name='status',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
        migrations.CreateModel(
            name='CustomDispatchStatus',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('key', models.SlugField(max_length=50)),
                ('label', models.CharField(max_length=100)),
                ('color', models.CharField(default='#64748b', max_length=20)),
                ('order', models.IntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='dispatch_statuses', to='tenants.tenant')),
            ],
            options={
                'ordering': ['order', 'id'],
                'unique_together': {('tenant', 'key')},
            },
        ),
        migrations.CreateModel(
            name='DispatchFlowAction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('status_key', models.CharField(max_length=50)),
                ('flow_after', models.CharField(
                    choices=[
                        ('none', 'Stay in Dispatch only'),
                        ('notify_only', 'Notify only'),
                        ('mark_delivered', 'Mark as delivered'),
                        ('update_tracking', 'Update tracking status'),
                        ('transfer_to_tracking', 'Transfer to tracking module'),
                    ],
                    default='none',
                    help_text='What happens when this status is set on a dispatch item.',
                    max_length=30,
                )),
                ('default_tracking_status', models.CharField(blank=True, max_length=30)),
                ('is_active', models.BooleanField(default=True)),
                ('description', models.CharField(blank=True, max_length=200)),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='dispatch_flow_actions', to='tenants.tenant')),
            ],
            options={
                'ordering': ['status_key'],
                'unique_together': {('tenant', 'status_key')},
            },
        ),
    ]
