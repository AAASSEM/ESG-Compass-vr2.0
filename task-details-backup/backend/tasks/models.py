from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
import uuid


class Task(models.Model):
    """
    Task model for ESG data collection and evidence upload
    Matches the progress tracking functionality from tracker.html
    """
    STATUS_CHOICES = [
        ('todo', 'To Do'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('blocked', 'Blocked'),
        ('pending_review', 'Pending Review'),
    ]
    
    PRIORITY_CHOICES = [
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
    ]
    
    CATEGORY_CHOICES = [
        ('environmental', 'Environmental'),
        ('social', 'Social'),
        ('governance', 'Governance'),
        ('general', 'General'),
    ]
    
    TYPE_CHOICES = [
        ('data_entry', 'Data Entry'),
        ('evidence_upload', 'Evidence Upload'),
        ('document_review', 'Document Review'),
        ('compliance_check', 'Compliance Check'),
        ('assessment_completion', 'Assessment Completion'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name='tasks'
    )
    
    # Task details
    title = models.CharField(max_length=255)
    description = models.TextField()
    task_type = models.CharField(
        max_length=50,
        choices=TYPE_CHOICES,
        default='data_entry'
    )
    category = models.CharField(
        max_length=50,
        choices=CATEGORY_CHOICES,
        default='general'
    )
    
    # Task status and priority
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='todo'
    )
    priority = models.CharField(
        max_length=20,
        choices=PRIORITY_CHOICES,
        default='medium'
    )
    
    # Assignment and deadlines
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_tasks'
    )
    due_date = models.DateTimeField(null=True, blank=True)
    estimated_hours = models.FloatField(null=True, blank=True)
    
    # ESG Framework context
    frameworks = models.JSONField(
        default=list,
        help_text='List of ESG frameworks this task relates to'
    )
    compliance_context = models.TextField(
        blank=True,
        help_text='Why this task is important for compliance'
    )
    action_required = models.TextField(
        blank=True,
        help_text='Specific action required to complete this task'
    )
    
    # Related ESG elements
    related_question = models.ForeignKey(
        'esg_assessment.ESGQuestion',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tasks'
    )
    related_assessment = models.ForeignKey(
        'esg_assessment.ESGAssessment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tasks'
    )
    
    # Progress tracking
    progress_percentage = models.FloatField(default=0.0)
    completion_notes = models.TextField(blank=True)
    
    # Dependencies
    depends_on = models.ManyToManyField(
        'self',
        symmetrical=False,
        blank=True,
        related_name='dependent_tasks'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # Creator tracking
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_tasks'
    )
    
    # Frontend sync tracking
    external_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text='External ID from frontend task generator for sync purposes'
    )
    framework_tags = models.JSONField(
        default=list,
        help_text='Framework tags from frontend task generation'
    )
    sector = models.CharField(
        max_length=100,
        blank=True,
        help_text='Business sector this task was generated for'
    )
    
    class Meta:
        verbose_name = 'Task'
        verbose_name_plural = 'Tasks'
        ordering = ['-priority', '-created_at']
        indexes = [
            models.Index(fields=['company', 'status']),
            models.Index(fields=['assigned_to', 'status']),
            models.Index(fields=['category', 'priority']),
        ]
    
    def __str__(self):
        return f"{self.company.name} - {self.title}"
    
    @property
    def is_overdue(self):
        """Check if task is overdue"""
        if self.due_date and self.status not in ['completed', 'blocked']:
            return timezone.now() > self.due_date
        return False
    
    @property
    def days_until_due(self):
        """Calculate days until due date"""
        if self.due_date:
            delta = self.due_date.date() - timezone.now().date()
            return delta.days
        return None
    
    def mark_completed(self, user, notes=""):
        """Mark task as completed"""
        self.status = 'completed'
        self.progress_percentage = 100.0
        self.completed_at = timezone.now()
        self.completion_notes = notes
        self.save()
        
        # Update company progress metrics
        self.company.update_progress_metrics()
    
    def mark_in_progress(self, user):
        """Mark task as in progress"""
        self.status = 'in_progress'
        if not self.started_at:
            self.started_at = timezone.now()
        if not self.assigned_to:
            self.assigned_to = user
        self.save()
    
    def get_priority_color(self):
        """Get color for priority display"""
        colors = {
            'high': '#ef4444',    # red
            'medium': '#f59e0b',  # amber
            'low': '#10b981'      # emerald
        }
        return colors.get(self.priority, '#6b7280')
    
    def get_category_icon(self):
        """Get Font Awesome icon for category"""
        icons = {
            'environmental': 'fa-solid fa-leaf',
            'social': 'fa-solid fa-users',
            'governance': 'fa-solid fa-shield-halved',
            'general': 'fa-solid fa-tasks'
        }
        return icons.get(self.category, 'fa-solid fa-task')


class TaskTemplate(models.Model):
    """
    Templates for creating common tasks
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField()
    category = models.CharField(
        max_length=50,
        choices=Task.CATEGORY_CHOICES
    )
    task_type = models.CharField(
        max_length=50,
        choices=Task.TYPE_CHOICES
    )
    priority = models.CharField(
        max_length=20,
        choices=Task.PRIORITY_CHOICES,
        default='medium'
    )
    estimated_hours = models.FloatField(null=True, blank=True)
    frameworks = models.JSONField(default=list)
    compliance_context = models.TextField(blank=True)
    action_required = models.TextField(blank=True)
    
    # Template applicability
    applicable_sectors = models.JSONField(
        default=list,
        help_text='Business sectors this template applies to'
    )
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Task Template'
        verbose_name_plural = 'Task Templates'
        ordering = ['category', 'name']
    
    def __str__(self):
        return f"{self.category} - {self.name}"
    
    def create_task_for_company(self, company, created_by, **overrides):
        """Create a task from this template for a specific company"""
        task_data = {
            'company': company,
            'title': self.name,
            'description': self.description,
            'task_type': self.task_type,
            'category': self.category,
            'priority': self.priority,
            'estimated_hours': self.estimated_hours,
            'frameworks': self.frameworks,
            'compliance_context': self.compliance_context,
            'action_required': self.action_required,
            'created_by': created_by,
        }
        
        # Apply any overrides
        task_data.update(overrides)
        
        return Task.objects.create(**task_data)


class TaskComment(models.Model):
    """
    Comments and updates on tasks
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='comments'
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )
    
    content = models.TextField()
    is_status_update = models.BooleanField(default=False)
    old_status = models.CharField(max_length=20, blank=True)
    new_status = models.CharField(max_length=20, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Task Comment'
        verbose_name_plural = 'Task Comments'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Comment on {self.task.title} by {self.author.full_name}"


class TaskAttachment(models.Model):
    """
    File attachments for tasks (evidence, documents, etc.)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='attachments'
    )
    
    # File information
    file = models.FileField(upload_to='task_attachments/')
    original_filename = models.CharField(max_length=255)
    file_size = models.BigIntegerField()
    mime_type = models.CharField(max_length=100)
    
    # Attachment metadata
    title = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    attachment_type = models.CharField(
        max_length=50,
        choices=[
            ('evidence', 'Evidence Document'),
            ('reference', 'Reference Material'),
            ('template', 'Template'),
            ('report', 'Report'),
            ('other', 'Other'),
        ],
        default='evidence'
    )
    
    # Upload tracking
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Task Attachment'
        verbose_name_plural = 'Task Attachments'
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return f"{self.task.title} - {self.original_filename}"
    
    @property
    def file_size_mb(self):
        """Return file size in MB"""
        return self.file_size / (1024 * 1024)


class TaskReminder(models.Model):
    """
    Reminders for tasks approaching due dates
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='reminders'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )
    
    # Reminder settings
    remind_before_days = models.IntegerField(default=3)
    reminder_sent = models.BooleanField(default=False)
    reminder_sent_at = models.DateTimeField(null=True, blank=True)
    
    # Message customization
    custom_message = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Task Reminder'
        verbose_name_plural = 'Task Reminders'
        unique_together = ['task', 'user']
    
    def __str__(self):
        return f"Reminder for {self.task.title} - {self.user.full_name}"
    
    @property
    def should_send_reminder(self):
        """Check if reminder should be sent"""
        if self.reminder_sent or not self.task.due_date:
            return False
        
        days_until_due = (self.task.due_date.date() - timezone.now().date()).days
        return days_until_due <= self.remind_before_days


class TaskProgress(models.Model):
    """
    Track detailed progress on tasks
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='progress_logs'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )
    
    # Progress details
    progress_percentage = models.FloatField()
    notes = models.TextField(blank=True)
    hours_worked = models.FloatField(null=True, blank=True)
    
    # Milestone tracking
    milestone_reached = models.CharField(max_length=255, blank=True)
    blockers_encountered = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Task Progress'
        verbose_name_plural = 'Task Progress Logs'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.task.title} - {self.progress_percentage}% by {self.user.full_name}"