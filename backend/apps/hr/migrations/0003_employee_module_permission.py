from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('hr', '0002_employee_extra_fields'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='EmployeeModulePermission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('module', models.CharField(
                    max_length=50,
                    choices=[
                        ('crm', 'CRM'), ('products', 'Products'), ('stock', 'Stock'),
                        ('orders', 'Orders'), ('invoices', 'Invoices'), ('dispatch', 'Dispatch'),
                        ('hr', 'HR'), ('warehouse', 'Warehouse'), ('analytics', 'Analytics'),
                        ('tracking', 'Tracking'), ('manufacturing', 'Manufacturing'),
                    ]
                )),
                ('can_view',   models.BooleanField(default=False)),
                ('can_create', models.BooleanField(default=False)),
                ('can_edit',   models.BooleanField(default=False)),
                ('can_delete', models.BooleanField(default=False)),
                ('employee', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='module_permissions',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['employee', 'module'],
                'unique_together': {('employee', 'module')},
            },
        ),
    ]
