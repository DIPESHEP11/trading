# Generated migration: add default_tracking_status to DispatchSettings

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('invoices', '0007_dispatch_settings_courier_partner'),
    ]

    operations = [
        migrations.AddField(
            model_name='dispatchsettings',
            name='default_tracking_status',
            field=models.CharField(
                blank=True,
                choices=[
                    ('', '— No default —'),
                    ('in_transit', 'In transit'),
                    ('out_for_delivery', 'Out for delivery'),
                    ('delivered', 'Delivered'),
                ],
                default='',
                help_text='Default status to set when transferring to tracking or updating tracking.',
                max_length=30,
            ),
        ),
    ]
