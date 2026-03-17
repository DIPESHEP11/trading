from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('hr', '0001_initial'),
    ]

    operations = [
        # ── New fields on EmployeeProfile ──────────────────────────────────────
        migrations.AddField(
            model_name='employeeprofile',
            name='date_of_birth',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='employeeprofile',
            name='gender',
            field=models.CharField(
                blank=True, max_length=10,
                choices=[('male', 'Male'), ('female', 'Female'), ('other', 'Other')],
            ),
        ),
        migrations.AddField(
            model_name='employeeprofile',
            name='blood_group',
            field=models.CharField(blank=True, max_length=5, help_text='e.g. A+, B-, O+'),
        ),
        migrations.AddField(
            model_name='employeeprofile',
            name='emergency_contact_name',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='employeeprofile',
            name='emergency_contact_phone',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name='employeeprofile',
            name='department',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='employeeprofile',
            name='designation',
            field=models.CharField(blank=True, max_length=100, help_text='Job title'),
        ),
        migrations.AddField(
            model_name='employeeprofile',
            name='salary',
            field=models.DecimalField(blank=True, null=True, max_digits=12, decimal_places=2),
        ),
        migrations.AddField(
            model_name='employeeprofile',
            name='education_details',
            field=models.TextField(blank=True, help_text='Education summary'),
        ),

        # ── New EmployeeDocument model ─────────────────────────────────────────
        migrations.CreateModel(
            name='EmployeeDocument',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('title', models.CharField(max_length=200)),
                ('category', models.CharField(
                    max_length=20, default='other',
                    choices=[
                        ('id_proof', 'ID Proof'),
                        ('address_proof', 'Address Proof'),
                        ('education', 'Education'),
                        ('experience', 'Experience'),
                        ('other', 'Other'),
                    ],
                )),
                ('file', models.FileField(upload_to='employee_docs/')),
                ('employee', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='documents',
                    to='hr.employeeprofile',
                )),
            ],
            options={
                'ordering': ['category', 'title'],
            },
        ),
    ]
