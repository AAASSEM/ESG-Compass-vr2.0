from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from .models import Task, TaskTemplate, TaskComment, TaskAttachment, TaskReminder, TaskProgress


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    """Task admin interface"""
    list_display = [
        'title', 'company', 'category', 'status', 'priority',
        'assigned_to', 'progress_percentage', 'is_overdue', 'created_at'
    ]
    list_filter = [
        'status', 'priority', 'category', 'task_type',
        'company__business_sector', 'created_at'
    ]
    search_fields = ['title', 'description', 'company__name', 'assigned_to__full_name']
    ordering = ['-priority', '-created_at']
    readonly_fields = [
        'id', 'is_overdue', 'days_until_due', 'created_at', 
        'updated_at', 'started_at', 'completed_at'
    ]
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('company', 'title', 'description', 'task_type', 'category')
        }),
        ('Status & Assignment', {
            'fields': (
                'status', 'priority', 'assigned_to', 'progress_percentage'
            )
        }),
        ('Scheduling', {
            'fields': ('due_date', 'estimated_hours')
        }),
        ('ESG Context', {
            'fields': (
                'frameworks', 'compliance_context', 'action_required',
                'related_question', 'related_assessment'
            ),
            'classes': ('collapse',)
        }),
        ('Progress', {
            'fields': ('completion_notes',)
        }),
        ('Dependencies', {
            'fields': ('depends_on',),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': (
                'id', 'created_by', 'is_overdue', 'days_until_due',
                'created_at', 'updated_at', 'started_at', 'completed_at'
            ),
            'classes': ('collapse',)
        })
    )
    
    filter_horizontal = ['depends_on']
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'company', 'assigned_to', 'created_by'
        )
    
    def is_overdue(self, obj):
        """Display overdue status"""
        if obj.is_overdue:
            return format_html(
                '<span style="color: red; font-weight: bold;">Yes</span>'
            )
        return 'No'
    is_overdue.short_description = 'Overdue'
    is_overdue.boolean = True


@admin.register(TaskTemplate)
class TaskTemplateAdmin(admin.ModelAdmin):
    """Task template admin interface"""
    list_display = [
        'name', 'category', 'task_type', 'priority',
        'estimated_hours', 'is_active', 'created_at'
    ]
    list_filter = ['category', 'task_type', 'priority', 'is_active', 'created_at']
    search_fields = ['name', 'description']
    ordering = ['category', 'name']
    readonly_fields = ['id', 'created_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'description', 'category', 'task_type')
        }),
        ('Properties', {
            'fields': ('priority', 'estimated_hours', 'is_active')
        }),
        ('ESG Context', {
            'fields': ('frameworks', 'compliance_context', 'action_required')
        }),
        ('Applicability', {
            'fields': ('applicable_sectors',)
        }),
        ('Metadata', {
            'fields': ('id', 'created_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(TaskComment)
class TaskCommentAdmin(admin.ModelAdmin):
    """Task comment admin interface"""
    list_display = [
        'task_title', 'author', 'is_status_update',
        'status_change', 'created_at'
    ]
    list_filter = ['is_status_update', 'created_at']
    search_fields = ['task__title', 'author__full_name', 'content']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Comment', {
            'fields': ('task', 'author', 'content')
        }),
        ('Status Update', {
            'fields': ('is_status_update', 'old_status', 'new_status')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('task', 'author')
    
    def task_title(self, obj):
        """Display task title with link"""
        url = reverse('admin:tasks_task_change', args=[obj.task.id])
        return format_html('<a href="{}">{}</a>', url, obj.task.title)
    task_title.short_description = 'Task'
    
    def status_change(self, obj):
        """Display status change if applicable"""
        if obj.is_status_update and obj.old_status and obj.new_status:
            return f"{obj.old_status} → {obj.new_status}"
        return '-'
    status_change.short_description = 'Status Change'


@admin.register(TaskAttachment)
class TaskAttachmentAdmin(admin.ModelAdmin):
    """Task attachment admin interface"""
    list_display = [
        'original_filename', 'task_title', 'attachment_type',
        'file_size_mb', 'uploaded_by', 'uploaded_at'
    ]
    list_filter = ['attachment_type', 'mime_type', 'uploaded_at']
    search_fields = [
        'original_filename', 'title', 'task__title', 'uploaded_by__full_name'
    ]
    ordering = ['-uploaded_at']
    readonly_fields = ['file_size', 'mime_type', 'uploaded_at']
    
    fieldsets = (
        ('File Information', {
            'fields': ('task', 'file', 'original_filename', 'file_size', 'mime_type')
        }),
        ('Content', {
            'fields': ('title', 'description', 'attachment_type')
        }),
        ('Upload Info', {
            'fields': ('uploaded_by', 'uploaded_at'),
            'classes': ('collapse',)
        })
    )
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('task', 'uploaded_by')
    
    def task_title(self, obj):
        """Display task title with link"""
        url = reverse('admin:tasks_task_change', args=[obj.task.id])
        return format_html('<a href="{}">{}</a>', url, obj.task.title)
    task_title.short_description = 'Task'
    
    def file_size_mb(self, obj):
        """Display file size in MB"""
        return f"{obj.file_size_mb:.2f} MB"
    file_size_mb.short_description = 'Size'


@admin.register(TaskReminder)
class TaskReminderAdmin(admin.ModelAdmin):
    """Task reminder admin interface"""
    list_display = [
        'task_title', 'user', 'remind_before_days',
        'reminder_sent', 'should_send', 'created_at'
    ]
    list_filter = ['remind_before_days', 'reminder_sent', 'created_at']
    search_fields = ['task__title', 'user__full_name']
    ordering = ['-created_at']
    readonly_fields = ['reminder_sent_at', 'should_send', 'created_at']
    
    fieldsets = (
        ('Reminder Settings', {
            'fields': ('task', 'user', 'remind_before_days', 'custom_message')
        }),
        ('Status', {
            'fields': ('reminder_sent', 'reminder_sent_at', 'should_send')
        }),
        ('Metadata', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        })
    )
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('task', 'user')
    
    def task_title(self, obj):
        """Display task title with link"""
        url = reverse('admin:tasks_task_change', args=[obj.task.id])
        return format_html('<a href="{}">{}</a>', url, obj.task.title)
    task_title.short_description = 'Task'
    
    def should_send(self, obj):
        """Display if reminder should be sent"""
        if obj.should_send_reminder:
            return format_html(
                '<span style="color: orange; font-weight: bold;">Yes</span>'
            )
        return 'No'
    should_send.short_description = 'Should Send'
    should_send.boolean = True


@admin.register(TaskProgress)
class TaskProgressAdmin(admin.ModelAdmin):
    """Task progress admin interface"""
    list_display = [
        'task_title', 'user', 'progress_percentage',
        'hours_worked', 'milestone_reached', 'created_at'
    ]
    list_filter = ['created_at']
    search_fields = ['task__title', 'user__full_name', 'notes', 'milestone_reached']
    ordering = ['-created_at']
    readonly_fields = ['created_at']
    
    fieldsets = (
        ('Progress Update', {
            'fields': ('task', 'user', 'progress_percentage', 'hours_worked')
        }),
        ('Details', {
            'fields': ('notes', 'milestone_reached', 'blockers_encountered')
        }),
        ('Metadata', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        })
    )
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('task', 'user')
    
    def task_title(self, obj):
        """Display task title with link"""
        url = reverse('admin:tasks_task_change', args=[obj.task.id])
        return format_html('<a href="{}">{}</a>', url, obj.task.title)
    task_title.short_description = 'Task'