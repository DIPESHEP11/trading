from django.db import models
from apps.core.models import TimeStampedModel
from django.conf import settings
from datetime import date
from dateutil.relativedelta import relativedelta

class EmployeeProfile(TimeStampedModel):
    """
    Extends the shared User model with tenant-specific HR / Employee details.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.DO_NOTHING,
        null=True, blank=True,
        related_name='employee_profile',
        db_constraint=False
    )
    
    # ── Basic Details ──
    employee_id = models.CharField(max_length=50, unique=True, help_text="e.g. EMP-0001")
    photo = models.ImageField(upload_to='employee_photos/', null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(
        max_length=10, blank=True,
        choices=[('male', 'Male'), ('female', 'Female'), ('other', 'Other')]
    )
    blood_group = models.CharField(max_length=5, blank=True, help_text="e.g. A+, B-, O+")

    # ── Personal ──
    address = models.TextField(blank=True)
    address_proof = models.FileField(upload_to='employee_docs/', null=True, blank=True)
    home_phone = models.CharField(max_length=20, blank=True)
    reference_phone = models.CharField(max_length=20, blank=True)
    emergency_contact_name = models.CharField(max_length=100, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)

    # ── Company Details ──
    department = models.CharField(max_length=100, blank=True)
    designation = models.CharField(max_length=100, blank=True, help_text="Job title")
    salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # ── Experience ──
    experience_details = models.TextField(blank=True, help_text="Past experience summary")
    experience_certificate = models.FileField(upload_to='employee_docs/', null=True, blank=True)

    # ── Education Details ──
    education_details = models.TextField(blank=True, help_text="Education summary")
    qualification_document = models.FileField(upload_to='employee_docs/', null=True, blank=True)

    # ── Official Purpose ──
    description = models.TextField(blank=True, help_text="Role or additional remarks")
    join_date = models.DateField(default=date.today)
    resigned = models.BooleanField(default=False)
    resign_date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.employee_id} - {self.user.email}"
        
    @property
    def tenure(self) -> str:
        """
        Calculates the length of service. 
        If resigned, calculates from join_date to resign_date.
        Otherwise, calculates from join_date to today.
        """
        end_date = self.resign_date if self.resigned and self.resign_date else date.today()
        diff = relativedelta(end_date, self.join_date)
        parts = []
        if diff.years > 0:
            parts.append(f"{diff.years} year{'s' if diff.years > 1 else ''}")
        if diff.months > 0:
            parts.append(f"{diff.months} month{'s' if diff.months > 1 else ''}")
        if not parts:
            if diff.days > 0:
                parts.append(f"{diff.days} day{'s' if diff.days > 1 else ''}")
            else:
                return "0 days"
        return ", ".join(parts)


class EmployeeCustomField(TimeStampedModel):
    """
    Defines a custom field for the Employee form (e.g. 'Blood Group', 'Emergency Contact')
    """
    SECTION_CHOICES = [
        ('basic', 'Basic Details'),
        ('personal', 'Personal'),
        ('experience', 'Experience'),
        ('education', 'Education Details'),
        ('official', 'Official Purpose'),
    ]
    
    name = models.CharField(max_length=100)
    section = models.CharField(max_length=20, choices=SECTION_CHOICES, default='personal')
    
    class Meta:
        ordering = ['section', 'name']

    def __str__(self):
        return f"{self.name} ({self.get_section_display()})"


class EmployeeCustomFieldValue(TimeStampedModel):
    """
    The actual value entered for a given EmployeeCustomField for a specific Employee.
    """
    employee = models.ForeignKey(EmployeeProfile, on_delete=models.CASCADE, related_name='custom_values')
    field = models.ForeignKey(EmployeeCustomField, on_delete=models.CASCADE, related_name='values')
    value = models.TextField(blank=True)

    class Meta:
        unique_together = ('employee', 'field')

    def __str__(self):
        return f"{self.employee.employee_id} - {self.field.name}: {self.value}"


class EmployeeModulePermission(TimeStampedModel):
    """
    Per-employee, per-module CRUD permission flags.
    Tenant admin assigns these to control what each staff member can do.
    """
    MODULE_CHOICES = [
        ('crm',           'CRM'),
        ('products',      'Products'),
        ('stock',         'Stock'),
        ('orders',        'Orders'),
        ('invoices',      'Invoices'),
        ('dispatch',      'Dispatch'),
        ('hr',            'HR'),
        ('warehouse',     'Warehouse'),
        ('analytics',     'Analytics'),
        ('tracking',      'Tracking'),
        ('manufacturing', 'Manufacturing'),
    ]

    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.DO_NOTHING,
        null=True, blank=True,
        related_name='module_permissions',
        db_constraint=False
    )
    module    = models.CharField(max_length=50, choices=MODULE_CHOICES)
    can_view   = models.BooleanField(default=False)
    can_create = models.BooleanField(default=False)
    can_edit   = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)

    class Meta:
        unique_together = ['employee', 'module']
        ordering = ['employee', 'module']

    def __str__(self):
        return f"{self.employee.email} — {self.module}"


class EmployeeDocument(TimeStampedModel):
    """
    Multiple documents per employee (ID proofs, certificates, etc.).
    """
    CATEGORY_CHOICES = [
        ('id_proof', 'ID Proof'),
        ('address_proof', 'Address Proof'),
        ('education', 'Education'),
        ('experience', 'Experience'),
        ('other', 'Other'),
    ]
    employee = models.ForeignKey(EmployeeProfile, on_delete=models.CASCADE, related_name='documents')
    title = models.CharField(max_length=200)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='other')
    file = models.FileField(upload_to='employee_docs/')

    class Meta:
        ordering = ['category', 'title']

    def __str__(self):
        return f"{self.employee.employee_id} — {self.title}"
