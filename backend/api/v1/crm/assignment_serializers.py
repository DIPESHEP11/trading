from rest_framework import serializers
from apps.crm.models import LeadAssignmentConfig


class LeadAssignmentConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeadAssignmentConfig
        fields = [
            'id', 'strategy', 'pool_batch_size', 'finished_statuses', 'employees',
            'rr_pointer', 'assignments_by_source', 'source_rr_pointers',
            'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'rr_pointer', 'source_rr_pointers', 'created_at', 'updated_at']
