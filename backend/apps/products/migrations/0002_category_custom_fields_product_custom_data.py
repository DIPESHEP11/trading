from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='category',
            name='custom_fields',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='List of field definitions for products in this category. '
                          'e.g. [{"key": "size", "label": "Size", "type": "select", '
                          '"options": ["S","M","L","XL"], "required": true, "order": 1}]',
            ),
        ),
        migrations.AddField(
            model_name='product',
            name='custom_data',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='Values for the category-specific custom fields. '
                          'e.g. {"size": "M", "color": "Red", "fabric": "Cotton"}',
            ),
        ),
    ]
