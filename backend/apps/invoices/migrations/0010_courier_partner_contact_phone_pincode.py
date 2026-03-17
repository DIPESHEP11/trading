# Generated migration: add contact_phone and pincode to CourierPartner

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('invoices', '0009_dispatch_statuses_and_flow'),
    ]

    operations = [
        migrations.AddField(
            model_name='courierpartner',
            name='pincode',
            field=models.CharField(blank=True, help_text='Pin code / postal code', max_length=20),
        ),
        migrations.AddField(
            model_name='courierpartner',
            name='contact_phone',
            field=models.CharField(blank=True, help_text='Contact phone number', max_length=30),
        ),
    ]
