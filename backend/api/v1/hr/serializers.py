from rest_framework import serializers
from apps.hr.models import EmployeeProfile, EmployeeCustomField, EmployeeCustomFieldValue, EmployeeDocument, EmployeeModulePermission
from apps.users.models import User, UserRole


class EmployeeDocumentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeDocument
        fields = ['id', 'title', 'category', 'file', 'file_url', 'created_at']
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {'file': {'write_only': True}}

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url if obj.file else None


class EmployeeCustomFieldValueSerializer(serializers.ModelSerializer):
    field_id = serializers.IntegerField(source='field.id')
    field_name = serializers.CharField(source='field.name', read_only=True)
    section = serializers.CharField(source='field.section', read_only=True)

    class Meta:
        model = EmployeeCustomFieldValue
        fields = ['id', 'field_id', 'field_name', 'section', 'value']


class EmployeeProfileSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(read_only=True, allow_null=True)
    email = serializers.EmailField(source='user.email')
    first_name = serializers.CharField(source='user.first_name', allow_blank=True, required=False)
    last_name = serializers.CharField(source='user.last_name', allow_blank=True, required=False)
    phone = serializers.CharField(source='user.phone', allow_blank=True, required=False)
    role = serializers.ChoiceField(choices=UserRole.choices, source='user.role', default=UserRole.MEMBER)

    custom_values = EmployeeCustomFieldValueSerializer(many=True, required=False)
    documents = EmployeeDocumentSerializer(many=True, read_only=True)
    tenure = serializers.ReadOnlyField()

    class Meta:
        model = EmployeeProfile
        fields = [
            'id', 'user_id', 'employee_id',
            # user fields
            'email', 'first_name', 'last_name', 'phone', 'role',
            # basic
            'photo', 'date_of_birth', 'gender', 'blood_group',
            # personal
            'address', 'address_proof', 'home_phone', 'reference_phone',
            'emergency_contact_name', 'emergency_contact_phone',
            # company
            'department', 'designation', 'salary',
            # experience
            'experience_details', 'experience_certificate',
            # education
            'education_details', 'qualification_document',
            # official
            'description', 'join_date', 'resigned', 'resign_date', 'tenure',
            # relations
            'documents', 'custom_values',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'tenure', 'documents']

    def create(self, validated_data):
        user_data = validated_data.pop('user', {})
        custom_values_data = validated_data.pop('custom_values', [])

        email = user_data.get('email')
        if not email:
            raise serializers.ValidationError({'email': 'Email is required.'})

        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError({'email': 'A user with this email already exists.'})

        # Resolve current tenant — required for IsTenantScopedUser (employees must have tenant)
        tenant = None
        from django.db import connection
        from django_tenants.utils import schema_context
        from apps.tenants.models import Tenant
        schema_name = connection.schema_name
        if schema_name and schema_name != 'public':
            with schema_context('public'):
                tenant = Tenant.objects.get(schema_name=schema_name)

        # Default password for new employees (user should reset via email link)
        default_password = user_data.get('password') or '123456'
        user = User.objects.create_user(
            email=email,
            password=default_password,
            first_name=user_data.get('first_name', ''),
            last_name=user_data.get('last_name', ''),
            phone=user_data.get('phone', ''),
            role=user_data.get('role', UserRole.MEMBER),
            tenant=tenant,
        )

        profile = EmployeeProfile.objects.create(user=user, **validated_data)
        self._save_custom_values(profile, custom_values_data)
        return profile

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        custom_values_data = validated_data.pop('custom_values', None)

        # Update user fields
        user = instance.user
        for attr in ('first_name', 'last_name', 'phone', 'role'):
            if attr in user_data:
                setattr(user, attr, user_data[attr])
        user.save()

        # Update profile fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update custom values if provided
        if custom_values_data is not None:
            self._save_custom_values(instance, custom_values_data)

        return instance

    def _save_custom_values(self, profile, custom_values_data):
        for cv_data in custom_values_data:
            field_id = cv_data.get('field', {}).get('id') or cv_data.get('field_id')
            value = cv_data.get('value', '')
            if field_id:
                EmployeeCustomFieldValue.objects.update_or_create(
                    employee=profile,
                    field_id=field_id,
                    defaults={'value': value},
                )


class EmployeeCustomFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeCustomField
        fields = '__all__'


class EmployeeModulePermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeModulePermission
        fields = ['module', 'can_view', 'can_create', 'can_edit', 'can_delete']


class EmployeePermissionSummarySerializer(serializers.ModelSerializer):
    """Lightweight employee info used in the Permissions page list."""
    full_name  = serializers.SerializerMethodField()
    email      = serializers.EmailField(source='user.email', read_only=True)
    user_id    = serializers.IntegerField(source='user.id', read_only=True)

    class Meta:
        model  = EmployeeProfile
        fields = ['id', 'employee_id', 'full_name', 'email', 'user_id', 'department', 'designation']

    def get_full_name(self, obj):
        name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return name or obj.user.email
