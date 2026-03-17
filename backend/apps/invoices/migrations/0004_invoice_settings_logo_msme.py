from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('invoices', '0003_gst_invoice_overhaul'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoicesettings',
            name='company_logo',
            field=models.ImageField(blank=True, null=True, upload_to='invoice_logos/'),
        ),
        migrations.AddField(
            model_name='invoicesettings',
            name='msme_type',
            field=models.CharField(blank=True, max_length=30),
        ),
        migrations.AddField(
            model_name='invoicesettings',
            name='msme_number',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='invoicesettings',
            name='authorized_signatory',
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name='invoicesettings',
            name='signature_image',
            field=models.ImageField(blank=True, null=True, upload_to='invoice_signatures/'),
        ),
    ]
