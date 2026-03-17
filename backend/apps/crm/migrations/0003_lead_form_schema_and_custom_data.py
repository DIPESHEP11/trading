# Generated manually for LeadFormSchema and Lead.custom_data

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0002_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='LeadFormSchema',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('fields', models.JSONField(default=list)),
            ],
            options={
                'verbose_name': 'Lead Form Schema',
            },
        ),
        migrations.AddField(
            model_name='lead',
            name='custom_data',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AlterField(
            model_name='lead',
            name='source',
            field=models.CharField(
                choices=[
                    ('meta', 'Meta / Facebook'),
                    ('shopify', 'Shopify'),
                    ('online', 'Online Order'),
                    ('manual', 'Manual Entry'),
                    ('whatsapp', 'WhatsApp'),
                    ('referral', 'Referral'),
                    ('form', 'Form Submission'),
                    ('excel', 'Excel Import'),
                ],
                default='manual',
                max_length=20,
            ),
        ),
    ]
