from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('config', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='tenantconfig',
            name='company_rules',
            field=models.TextField(blank=True, help_text='Company rules, policies, or notes set by the client admin.'),
        ),
        migrations.AddField(
            model_name='tenantconfig',
            name='custom_fields',
            field=models.JSONField(blank=True, default=dict, help_text='Custom key-value fields (e.g. {"Tax ID": "12AB", "License": "XYZ"}).'),
        ),
    ]
