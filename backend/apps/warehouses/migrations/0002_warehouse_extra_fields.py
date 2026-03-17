from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('warehouses', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='warehouse',
            name='phone',
            field=models.CharField(blank=True, max_length=30),
        ),
        migrations.AddField(
            model_name='warehouse',
            name='email',
            field=models.EmailField(blank=True, max_length=254),
        ),
        migrations.AddField(
            model_name='warehouse',
            name='custom_data',
            field=models.JSONField(blank=True, default=list,
                                   help_text='List of {key, label, value} dicts for custom fields.'),
        ),
    ]
