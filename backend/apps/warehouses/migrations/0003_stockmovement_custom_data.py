from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('warehouses', '0002_warehouse_extra_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='stockmovement',
            name='custom_data',
            field=models.JSONField(blank=True, default=dict,
                                   help_text='Custom key-value fields for this movement.'),
        ),
    ]
