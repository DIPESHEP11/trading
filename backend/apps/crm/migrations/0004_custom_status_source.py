from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0003_lead_form_schema_and_custom_data'),
    ]

    operations = [
        migrations.CreateModel(
            name='CustomLeadStatus',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('key', models.SlugField(max_length=50, unique=True)),
                ('label', models.CharField(max_length=100)),
                ('color', models.CharField(default='#64748b', max_length=20)),
                ('order', models.IntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
            ],
            options={
                'ordering': ['order', 'id'],
            },
        ),
        migrations.CreateModel(
            name='CustomLeadSource',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('key', models.SlugField(max_length=50, unique=True)),
                ('label', models.CharField(max_length=100)),
                ('order', models.IntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
            ],
            options={
                'ordering': ['order', 'id'],
            },
        ),
        migrations.AlterField(
            model_name='lead',
            name='source',
            field=models.CharField(default='manual', max_length=50),
        ),
        migrations.AlterField(
            model_name='lead',
            name='status',
            field=models.CharField(default='new', max_length=50),
        ),
    ]
