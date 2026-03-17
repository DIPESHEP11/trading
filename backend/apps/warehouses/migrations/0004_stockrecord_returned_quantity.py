from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('warehouses', '0003_stockmovement_custom_data'),
    ]

    operations = [
        migrations.AddField(
            model_name='stockrecord',
            name='returned_quantity',
            field=models.DecimalField(decimal_places=3, default=0, max_digits=12),
        ),
    ]
