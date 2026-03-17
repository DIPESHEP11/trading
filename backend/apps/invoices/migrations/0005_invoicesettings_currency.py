from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('invoices', '0004_invoice_settings_logo_msme'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoicesettings',
            name='default_currency',
            field=models.CharField(default='INR', max_length=5),
        ),
        migrations.AddField(
            model_name='invoicesettings',
            name='currency_symbol',
            field=models.CharField(default='₹', max_length=5),
        ),
    ]
