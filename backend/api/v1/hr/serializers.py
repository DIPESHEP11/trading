from rest_framework import serializers
from apps.hr.models import Role, EmployeeProfile, EmployeeCustomField, EmployeeCustomFieldValue, EmployeeDocument, EmployeeModulePermission
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
    # Email without source so it stays at top level in validated_data for create
    email = serializers.EmailField(required=True)
    first_name = serializers.CharField(allow_blank=True, required=False)
    last_name = serializers.CharField(allow_blank=True, required=False)
    phone = serializers.CharField(allow_blank=True, required=False)
    # Custom Role (business role) — shown in employee form dropdown
    role = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.filter(is_active=True), required=False, allow_null=True
    )
    role_name = serializers.CharField(source='role.name', read_only=True)
    # Legacy: user.role for system-level (member/staff)
    user_role = serializers.ChoiceField(
        choices=UserRole.choices, source='user.role', default=UserRole.MEMBER, required=False
    )

    custom_values = EmployeeCustomFieldValueSerializer(many=True, required=False)
    documents = EmployeeDocumentSerializer(many=True, read_only=True)
    tenure = serializers.ReadOnlyField()

    class Meta:
        model = EmployeeProfile
        fields = [
            'id', 'user_id', 'employee_id',
            # user fields
            'email', 'first_name', 'last_name', 'phone', 'user_role',
            # custom role (for dropdown)
            'role', 'role_name',
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
        custom_values_data = validated_data.pop('custom_values', [])
        # DRF may nest user fields under 'user' when using source='user.xxx'
        user_data = validated_data.pop('user', {})
        email = (
            validated_data.pop('email', None)
            or user_data.pop('email', None)
            or (self.initial_data.get('email') if isinstance(self.initial_data.get('email'), str) else None)
        )
        first_name = (
            validated_data.pop('first_name', None)
            or user_data.pop('first_name', '')
            or self.initial_data.get('first_name', '')
        )
        last_name = (
            validated_data.pop('last_name', None)
            or user_data.pop('last_name', '')
            or self.initial_data.get('last_name', '')
        )
        phone = (
            validated_data.pop('phone', None)
            or user_data.pop('phone', '')
            or self.initial_data.get('phone', '')
        )
        user_role = (
            validated_data.pop('user_role', None)
            or user_data.pop('user_role', UserRole.MEMBER)
            or self.initial_data.get('user_role', UserRole.MEMBER)
        )

        if not email:
            raise serializers.ValidationError({'email': 'Email is required.'})

        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError({'email': 'A user with this email already exists.'})

        tenant = None
        from django.db import connection
        from django_tenants.utils import schema_context
        from apps.tenants.models import Tenant
        schema_name = connection.schema_name
        if schema_name and schema_name != 'public':
            with schema_context('public'):
                tenant = Tenant.objects.get(schema_name=schema_name)

        user = User.objects.create_user(
            email=email,
            password='123456',
            first_name=first_name,
            last_name=last_name,
            phone=phone or '',
            role=user_role,
            tenant=tenant,
        )

        profile = EmployeeProfile.objects.create(
            user=user,
            **validated_data,
        )
        self._save_custom_values(profile, custom_values_data)
        return profile

    def update(self, instance, validated_data):
        custom_values_data = validated_data.pop('custom_values', None)
        first_name = validated_data.pop('first_name', None)
        last_name = validated_data.pop('last_name', None)
        phone = validated_data.pop('phone', None)
        user_role = validated_data.pop('user_role', None)

        user = instance.user
        if first_name is not None:
            user.first_name = first_name
        if last_name is not None:
            user.last_name = last_name
        if phone is not None:
            user.phone = phone
        if user_role is not None:
            user.role = user_role
        user.save()

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

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


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'name', 'description', 'default_permissions', 'display_order', 'is_active', 'created_at', 'updated_at']


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
    role_id    = serializers.SerializerMethodField()
    role_name  = serializers.SerializerMethodField()

    def get_role_id(self, obj):
        return obj.role_id if obj.role_id else None

    def get_role_name(self, obj):
        return obj.role.name if obj.role else None

    class Meta:
        model  = EmployeeProfile
        fields = ['id', 'employee_id', 'full_name', 'email', 'user_id', 'department', 'designation', 'role_id', 'role_name']

    def get_full_name(self, obj):
        name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return name or obj.user.email
