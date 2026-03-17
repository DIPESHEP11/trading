# Generated migration: add TrackingFormToken for public form link lookup

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0006_plan'),
    ]

    operations = [
        migrations.CreateModel(
            name='TrackingFormToken',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.CharField(db_index=True, max_length=64, unique=True)),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='+', to='tenants.tenant')),
            ],
            options={
                'db_table': 'tenants_trackingformtoken',
            },
        ),
    ]
