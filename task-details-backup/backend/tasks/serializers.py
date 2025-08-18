from rest_framework import serializers
from django.utils import timezone
from .models import Task, TaskTemplate, TaskComment, TaskAttachment, TaskReminder, TaskProgress


class TaskAttachmentSerializer(serializers.ModelSerializer):
    """Serializer for task attachments"""
    uploaded_by_name = serializers.CharField(source='uploaded_by.full_name', read_only=True)
    file_size_mb = serializers.FloatField(read_only=True)
    
    class Meta:
        model = TaskAttachment
        fields = [
            'id', 'file', 'original_filename', 'file_size', 'file_size_mb',
            'mime_type', 'title', 'description', 'attachment_type',
            'uploaded_by_name', 'uploaded_at'
        ]
        read_only_fields = ['file_size', 'mime_type', 'uploaded_at']


class TaskCommentSerializer(serializers.ModelSerializer):
    """Serializer for task comments"""
    author_name = serializers.CharField(source='author.full_name', read_only=True)
    author_avatar = serializers.SerializerMethodField()
    
    class Meta:
        model = TaskComment
        fields = [
            'id', 'content', 'is_status_update', 'old_status', 'new_status',
            'author_name', 'author_avatar', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_author_avatar(self, obj):
        """Get author avatar URL"""
        # In production, you might have actual avatar URLs
        return f"https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-{obj.author.id % 6 + 1}.jpg"


class TaskProgressSerializer(serializers.ModelSerializer):
    """Serializer for task progress logs"""
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    
    class Meta:
        model = TaskProgress
        fields = [
            'id', 'progress_percentage', 'notes', 'hours_worked',
            'milestone_reached', 'blockers_encountered', 'user_name', 'created_at'
        ]
        read_only_fields = ['created_at']


class TaskSerializer(serializers.ModelSerializer):
    """
    Main task serializer matching tracker.html expectations
    """
    assigned_to_name = serializers.CharField(source='assigned_to.full_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    category_icon = serializers.CharField(source='get_category_icon', read_only=True)
    priority_color = serializers.CharField(source='get_priority_color', read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    days_until_due = serializers.IntegerField(read_only=True)
    
    # Related data
    attachments = TaskAttachmentSerializer(many=True, read_only=True)
    comments = TaskCommentSerializer(many=True, read_only=True)
    progress_logs = TaskProgressSerializer(many=True, read_only=True)
    
    # Counts
    attachment_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'task_type', 'category',
            'status', 'priority', 'assigned_to_name', 'due_date',
            'estimated_hours', 'frameworks', 'compliance_context',
            'action_required', 'progress_percentage', 'completion_notes',
            'is_overdue', 'days_until_due', 'category_icon', 'priority_color',
            'created_by_name', 'created_at', 'updated_at', 'started_at',
            'completed_at', 'attachments', 'comments', 'progress_logs',
            'attachment_count', 'comment_count'
        ]
        read_only_fields = [
            'created_at', 'updated_at', 'started_at', 'completed_at',
            'is_overdue', 'days_until_due'
        ]
    
    def get_attachment_count(self, obj):
        """Get number of attachments"""
        return obj.attachments.count()
    
    def get_comment_count(self, obj):
        """Get number of comments"""
        return obj.comments.count()


class TaskCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating tasks"""
    assigned_to_id = serializers.UUIDField(required=False, allow_null=True)
    
    class Meta:
        model = Task
        fields = [
            'title', 'description', 'task_type', 'category',
            'priority', 'assigned_to_id', 'due_date', 'estimated_hours',
            'frameworks', 'compliance_context', 'action_required'
        ]
    
    def validate_due_date(self, value):
        """Ensure due date is in the future"""
        if value and value <= timezone.now():
            raise serializers.ValidationError("Due date must be in the future.")
        return value


class TaskUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating tasks"""
    
    class Meta:
        model = Task
        fields = [
            'title', 'description', 'status', 'priority', 'assigned_to',
            'due_date', 'estimated_hours', 'progress_percentage',
            'completion_notes'
        ]
    
    def update(self, instance, validated_data):
        """Handle status changes with automatic timestamps"""
        old_status = instance.status
        new_status = validated_data.get('status', old_status)
        
        # Handle status transitions
        if old_status != new_status:
            if new_status == 'in_progress' and not instance.started_at:
                instance.started_at = timezone.now()
            elif new_status == 'completed' and not instance.completed_at:
                instance.completed_at = timezone.now()
                validated_data['progress_percentage'] = 100.0
        
        return super().update(instance, validated_data)


class TaskTemplateSerializer(serializers.ModelSerializer):
    """Serializer for task templates"""
    
    class Meta:
        model = TaskTemplate
        fields = [
            'id', 'name', 'description', 'category', 'task_type',
            'priority', 'estimated_hours', 'frameworks',
            'compliance_context', 'action_required', 'applicable_sectors'
        ]


class TaskStatsSerializer(serializers.Serializer):
    """
    Serializer for task statistics (for tracker.html)
    """
    # Overall stats
    total_tasks = serializers.IntegerField()
    completed_tasks = serializers.IntegerField()
    in_progress_tasks = serializers.IntegerField()
    todo_tasks = serializers.IntegerField()
    overdue_tasks = serializers.IntegerField()
    
    # Category breakdown
    environmental_tasks = serializers.DictField()
    social_tasks = serializers.DictField()
    governance_tasks = serializers.DictField()
    
    # Progress percentages
    overall_completion = serializers.FloatField()
    environmental_completion = serializers.FloatField()
    social_completion = serializers.FloatField()
    governance_completion = serializers.FloatField()
    
    # Recent activity
    recent_completed = serializers.ListField()
    upcoming_due = serializers.ListField()


class NextStepsSerializer(serializers.Serializer):
    """
    Serializer for next steps/action items (tracker.html)
    """
    type = serializers.CharField()  # urgent, upload, review, etc.
    title = serializers.CharField()
    description = serializers.CharField()
    action = serializers.CharField()
    priority = serializers.CharField()
    due_date = serializers.DateTimeField(required=False, allow_null=True)
    task_id = serializers.UUIDField(required=False, allow_null=True)
    category = serializers.CharField(required=False)


class TaskBulkActionSerializer(serializers.Serializer):
    """Serializer for bulk task actions"""
    action = serializers.ChoiceField(choices=[
        ('mark_completed', 'Mark as Completed'),
        ('mark_in_progress', 'Mark as In Progress'),
        ('assign_to', 'Assign To User'),
        ('set_priority', 'Set Priority'),
        ('set_due_date', 'Set Due Date'),
        ('delete', 'Delete Tasks'),
    ])
    task_ids = serializers.ListField(child=serializers.UUIDField())
    
    # Optional parameters for specific actions
    assigned_to_id = serializers.UUIDField(required=False, allow_null=True)
    priority = serializers.ChoiceField(
        choices=Task.PRIORITY_CHOICES,
        required=False
    )
    due_date = serializers.DateTimeField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    
    def validate(self, attrs):
        """Validate that required fields are provided for specific actions"""
        action = attrs.get('action')
        
        if action == 'assign_to' and not attrs.get('assigned_to_id'):
            raise serializers.ValidationError(
                "assigned_to_id is required for assign_to action"
            )
        
        if action == 'set_priority' and not attrs.get('priority'):
            raise serializers.ValidationError(
                "priority is required for set_priority action"
            )
        
        if action == 'set_due_date' and not attrs.get('due_date'):
            raise serializers.ValidationError(
                "due_date is required for set_due_date action"
            )
        
        return attrs


class TaskReminderSerializer(serializers.ModelSerializer):
    """Serializer for task reminders"""
    task_title = serializers.CharField(source='task.title', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    should_send = serializers.BooleanField(source='should_send_reminder', read_only=True)
    
    class Meta:
        model = TaskReminder
        fields = [
            'id', 'remind_before_days', 'reminder_sent', 'reminder_sent_at',
            'custom_message', 'task_title', 'user_name', 'should_send', 'created_at'
        ]
        read_only_fields = ['reminder_sent', 'reminder_sent_at', 'created_at']