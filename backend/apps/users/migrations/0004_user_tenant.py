from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_remove_user_tenant'),
        ('tenants', '0006_plan'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='tenant',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='admin_users',
                to='tenants.tenant',
            ),
        ),
    ]
