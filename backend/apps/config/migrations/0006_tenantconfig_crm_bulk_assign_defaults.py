from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('config', '0005_buffer_stock_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='tenantconfig',
            name='crm_bulk_assign_defaults',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='Last saved bulk-assign UI: assignment_type, pool_batch_size, filter_unassigned, employees.',
            ),
        ),
    ]
