from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0007_trackingformtoken'),
    ]

    operations = [
        migrations.AddField(
            model_name='tenant',
            name='crm_phone_regex_presets',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='CRM phone validation options: list of {id, label, pattern}.',
            ),
        ),
    ]
