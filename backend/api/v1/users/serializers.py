from rest_framework import serializers
from apps.users.models import User


class UserListSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'first_name', 'last_name', 'phone', 'role', 'is_active', 'date_joined']


class UserDetailSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = '__all__'
        read_only_fields = ['id', 'email', 'date_joined', 'updated_at', 'password']


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'phone', 'avatar', 'role']
