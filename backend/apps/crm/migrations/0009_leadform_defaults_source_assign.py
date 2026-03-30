from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0008_add_inventoryapproval_lead'),
    ]

    operations = [
        migrations.AddField(
            model_name='leadformschema',
            name='default_field_overrides',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='Per-tenant overrides for built-in fields: order, required, label, pattern (phone regex).',
            ),
        ),
        migrations.AddField(
            model_name='leadassignmentconfig',
            name='assignments_by_source',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='e.g. {"meta": [user_id, ...], "whatsapp": [...]} — round-robin per source for new leads.',
            ),
        ),
        migrations.AddField(
            model_name='leadassignmentconfig',
            name='source_rr_pointers',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='Internal round-robin index per source key.',
            ),
        ),
    ]
