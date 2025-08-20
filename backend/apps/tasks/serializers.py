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
    
    # User answer from onboarding
    user_answer = serializers.SerializerMethodField()
    
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
            'attachment_count', 'comment_count', 'user_answer', 'data_entries', 'expected_files'
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
    
    def get_user_answer(self, obj):
        """Get user's answer from onboarding scoping data"""
        try:
            # Get the company's scoping data
            company = obj.company
            if not company.scoping_data:
                return None
            
            scoping_data = company.scoping_data
            
            # Priority 1: Check if answers are stored in 'esg_answers' object (new format)
            if 'esg_answers' in scoping_data:
                return self._find_answer_by_task_content(obj, scoping_data['esg_answers'])
            
            # Priority 2: Check if answers are stored in esg_assessment.answers (current format)
            if 'esg_assessment' in scoping_data and 'answers' in scoping_data['esg_assessment']:
                return self._find_answer_by_task_content(obj, scoping_data['esg_assessment']['answers'])
            
            # Priority 3: Check if task has a related question (ideal case)
            if obj.related_question:
                question_id = str(obj.related_question.id)
                
                # Check various locations for the question ID
                if question_id in scoping_data:
                    return scoping_data[question_id]
                
                if 'responses' in scoping_data and question_id in scoping_data['responses']:
                    response_data = scoping_data['responses'][question_id]
                    if isinstance(response_data, dict) and 'response_data' in response_data:
                        return response_data['response_data']
                    return response_data
                
                if 'answers' in scoping_data and question_id in scoping_data['answers']:
                    return scoping_data['answers'][question_id]
            
            return None
            
        except Exception as e:
            # Log the error but don't break the serialization
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Error getting user answer for task {obj.id}: {e}")
            return None
    
    def _find_answer_by_task_content(self, task, answers_dict):
        """Find answer by matching task content to question patterns"""
        try:
            task_title_lower = task.title.lower()
            
            # Common question patterns and their mapping to likely question IDs
            question_patterns = {
                # Energy related
                'electricity': ['hosp_energy_1', 'edu_energy_1', 'health_energy_1'],
                'energy consumption': ['hosp_energy_1', 'edu_energy_1', 'health_energy_1'],
                'led lighting': ['hosp_energy_2', 'edu_energy_2', 'hosp_energy_5'],
                'lighting': ['hosp_energy_2', 'edu_energy_2', 'hosp_energy_5'],
                'light bulbs': ['hosp_energy_2', 'hosp_energy_5'],
                'energy-efficient': ['hosp_energy_2', 'hosp_energy_5'],
                'fuel': ['hosp_energy_3', 'logistics_fuel_1'],
                'generator': ['hosp_energy_3'],
                'liquefied petroleum gas': ['hosp_energy_3'],
                'lpg': ['hosp_energy_3'],
                'cooking': ['hosp_energy_3'],
                'district cooling': ['hosp_energy_4'],
                'cooling': ['hosp_energy_4'],
                
                # Water related  
                'water consumption': ['hosp_water_1', 'edu_water_1', 'health_water_1'],
                'water': ['hosp_water_1', 'edu_water_1', 'health_water_1'],
                'shower': ['hosp_water_2'],
                'low-flow': ['hosp_water_2'],
                'towel': ['hosp_water_3'],
                'linen': ['hosp_water_3'],
                'reuse': ['hosp_water_3'],
                
                # Waste related
                'waste': ['hosp_waste_1', 'edu_waste_1', 'health_waste_1'],
                'recycling': ['hosp_waste_2', 'edu_waste_2', 'health_waste_2'],
                'plastic': ['hosp_waste_3', 'health_waste_3'],
                'bulk': ['hosp_waste_3'],
                'dispenser': ['hosp_waste_3'],
                'toiletries': ['hosp_waste_3'],
                
                # Supply Chain
                'supplier': ['hosp_supply_1', 'health_supply_1'],
                'procurement': ['hosp_supply_1', 'health_supply_1'],
                'local': ['hosp_supply_1'],
                'preference': ['hosp_supply_1'],
                
                # Governance
                'sustainability policy': ['hosp_gov_1', 'edu_gov_1', 'health_gov_1'],
                'policy': ['hosp_gov_1', 'edu_gov_1', 'health_gov_1'],
                'strategy': ['hosp_gov_1', 'edu_gov_1', 'health_gov_1'],
                'training': ['hosp_gov_2', 'edu_gov_2'],
                'staff': ['hosp_gov_2', 'edu_gov_2'],
                'team': ['hosp_gov_3', 'hosp_gov_1'],
                'person': ['hosp_gov_3'],
                'designated': ['hosp_gov_3'],
                
                # Health & Environment
                'air quality': ['edu_health_1'],
                'food policy': ['edu_health_2'],
            }
            
            # Try to match task title to question patterns
            for pattern, question_ids in question_patterns.items():
                if pattern in task_title_lower:
                    # Try each potential question ID
                    for question_id in question_ids:
                        if question_id in answers_dict:
                            return answers_dict[question_id]
            
            # If no pattern match, try direct key matching with task keywords
            task_words = task_title_lower.replace('?', '').split()
            for question_id, answer in answers_dict.items():
                # Simple heuristic: if question_id contains similar keywords
                for word in task_words:
                    if len(word) > 3 and word in question_id.lower():
                        return answer
            
            return None
            
        except Exception as e:
            return None


class TaskCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating tasks"""
    assigned_to_id = serializers.UUIDField(required=False, allow_null=True)
    
    class Meta:
        model = Task
        fields = [
            'title', 'description', 'task_type', 'category',
            'priority', 'assigned_to_id', 'due_date', 'estimated_hours',
            'frameworks', 'compliance_context', 'action_required', 'data_entries'
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
            'completion_notes', 'data_entries'
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