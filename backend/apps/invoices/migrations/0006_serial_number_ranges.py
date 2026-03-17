from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('invoices', '0005_invoicesettings_currency'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoicesettings',
            name='serial_number_ranges',
            field=models.JSONField(blank=True, default=list, help_text='Optional list of {from, to, current?} ranges. Each range is a separate series (e.g. 20k-30k, 40k-80k).'),
        ),
    ]
