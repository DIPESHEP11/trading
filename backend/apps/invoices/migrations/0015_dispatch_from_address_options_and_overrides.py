from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('invoices', '0014_add_inventory_approval_fk'),
    ]

    operations = [
        migrations.AddField(
            model_name='dispatchsettings',
            name='from_address_options',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='dispatchsticker',
            name='from_address_override',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='dispatchsticker',
            name='from_name_override',
            field=models.CharField(blank=True, max_length=200),
        ),
    ]
