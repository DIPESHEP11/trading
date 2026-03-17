# Generated migration: TrackingShipment, TrackingFormLink, TrackingFormSubmission

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('tenants', '0001_initial'),
        ('invoices', '0007_dispatch_settings_courier_partner'),
    ]

    operations = [
        migrations.CreateModel(
            name='TrackingShipment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('product_name', models.CharField(max_length=300)),
                ('product_id', models.CharField(help_text='Product ID or SKU', max_length=100)),
                ('qr_data', models.CharField(blank=True, help_text='QR code data or URL', max_length=500)),
                ('from_address', models.TextField(blank=True)),
                ('to_address', models.TextField(blank=True)),
                ('contact_number', models.CharField(blank=True, max_length=30)),
                ('delivery_partner_details', models.TextField(blank=True, help_text='Delivery partner name, ID, address, contact (denormalized or summary)')),
                ('pod_tracking_number', models.CharField(blank=True, help_text='POD / tracking number; can be filled by delivery partner if allowed', max_length=100)),
                ('custom_fields', models.JSONField(blank=True, default=dict, help_text='Additional key-value fields; partner can fill if allowed')),
                ('status', models.CharField(default='pending', max_length=50)),
                ('courier_partner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tracking_shipments', to='invoices.courierpartner')),
                ('dispatch_sticker', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='tracking_shipments', to='invoices.dispatchsticker')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tracking_shipments', to='tenants.tenant')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='TrackingFormLink',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('token', models.CharField(db_index=True, max_length=64, unique=True)),
                ('fillable_fields', models.JSONField(default=list, help_text='List of field keys the delivery partner can fill, e.g. ["pod_tracking_number"]')),
                ('courier_partner', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='tracking_form_link', to='invoices.courierpartner')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tracking_form_links', to='tenants.tenant')),
            ],
            options={
                'ordering': ['courier_partner__name'],
            },
        ),
        migrations.CreateModel(
            name='TrackingFormSubmission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('submitted_data', models.JSONField(default=dict, help_text='Field keys and values submitted by the partner')),
                ('shipment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='submissions', to='tracking.trackingshipment')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
