from django.db import models
from django.conf import settings
import uuid


class Company(models.Model):
    """
    Company model matching the onboard.html business information form
    """
    SECTOR_CHOICES = [
        ('hospitality', 'Hospitality & Tourism'),
        ('construction', 'Construction & Real Estate'),
        ('logistics', 'Logistics & Transportation'),
        ('retail', 'Retail & E-commerce'),
        ('manufacturing', 'Manufacturing'),
        ('technology', 'Technology & Software'),
        ('finance', 'Finance & Banking'),
        ('healthcare', 'Healthcare'),
        ('education', 'Education'),
        ('other', 'Other'),
    ]
    
    EMPLOYEE_SIZE_CHOICES = [
        ('1-10', '1-10 employees'),
        ('11-50', '11-50 employees'),
        ('51-200', '51-200 employees'),
        ('201-500', '201-500 employees'),
        ('500+', '500+ employees'),
    ]
    
    EMIRATE_CHOICES = [
        ('abu-dhabi', 'Abu Dhabi'),
        ('dubai', 'Dubai'),
        ('sharjah', 'Sharjah'),
        ('ajman', 'Ajman'),
        ('umm-al-quwain', 'Umm Al Quwain'),
        ('ras-al-khaimah', 'Ras Al Khaimah'),
        ('fujairah', 'Fujairah'),
    ]
    
    LICENSE_TYPE_CHOICES = [
        ('commercial', 'Commercial'),
        ('professional', 'Professional'),
        ('industrial', 'Industrial'),
        ('tourism', 'Tourism'),
        ('free-zone', 'Free Zone'),
    ]
    
    # Basic Information (from onboard.html step 1)
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, verbose_name='Business Name')
    description = models.TextField(
        blank=True, 
        null=True, 
        verbose_name='Company Description',
        help_text='Brief description of the company and its activities'
    )
    business_sector = models.CharField(
        max_length=50, 
        choices=SECTOR_CHOICES,
        verbose_name='Industry'
    )
    employee_size = models.CharField(
        max_length=20,
        choices=EMPLOYEE_SIZE_CHOICES,
        verbose_name='Number of Employees',
        null=True,
        blank=True
    )
    
    # Location Information
    main_location = models.CharField(
        max_length=255, 
        default='Dubai, UAE',
        verbose_name='Main Location'
    )
    emirate = models.CharField(
        max_length=50,
        choices=EMIRATE_CHOICES,
        null=True,
        blank=True,
        verbose_name='Emirates Location'
    )
    license_type = models.CharField(
        max_length=50,
        choices=LICENSE_TYPE_CHOICES,
        null=True,
        blank=True,
        verbose_name='Business License Type'
    )
    
    # ESG Setup Status
    esg_scoping_completed = models.BooleanField(default=False)
    onboarding_completed = models.BooleanField(default=False)
    setup_step = models.IntegerField(default=1)  # Tracks current setup step (1-4)
    
    # ESG Data
    scoping_data = models.JSONField(
        default=dict, 
        blank=True,
        help_text='ESG scoping questionnaire responses'
    )
    
    # Company Metrics (calculated from ESG data)
    overall_esg_score = models.FloatField(default=0.0)
    environmental_score = models.FloatField(default=0.0)
    social_score = models.FloatField(default=0.0)
    governance_score = models.FloatField(default=0.0)
    
    # Progress Tracking (matching tracker.html)
    data_completion_percentage = models.FloatField(default=0.0)
    evidence_completion_percentage = models.FloatField(default=0.0)
    total_fields = models.IntegerField(default=0)
    completed_fields = models.IntegerField(default=0)
    total_evidence_files = models.IntegerField(default=0)
    uploaded_evidence_files = models.IntegerField(default=0)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Company'
        verbose_name_plural = 'Companies'
        ordering = ['-created_at']
    
    def __str__(self):
        return self.name
    
    @property
    def admin_users(self):
        """Get company admin users"""
        return self.users.filter(role='admin')
    
    @property
    def total_users(self):
        """Get total number of users"""
        return self.users.count()
    
    def update_esg_scores(self):
        """Update ESG scores based on actual data entries and file uploads"""
        from apps.tasks.models import Task, TaskAttachment
        from django.db.models import Count
        from apps.dashboard.views import _get_task_data_entries
        
        # Get all tasks for this company
        all_tasks = Task.objects.filter(company=self)
        
        if not all_tasks.exists():
            # No tasks yet, set to default scores
            self.environmental_score = 0.0
            self.social_score = 0.0
            self.governance_score = 0.0
            self.overall_esg_score = 0.0
            self.save(update_fields=['environmental_score', 'social_score', 'governance_score', 'overall_esg_score'])
            return
        
        # Get actual data entries and file uploads
        task_data = _get_task_data_entries(self)
        
        # Calculate Environmental Score based on actual data
        env_tasks = all_tasks.filter(category__icontains='environmental')
        env_score = self._calculate_data_based_score(env_tasks, task_data, 'environmental')
        
        # Calculate Social Score based on actual data
        social_tasks = all_tasks.filter(category__icontains='social')
        social_score = self._calculate_data_based_score(social_tasks, task_data, 'social')
        
        # Calculate Governance Score based on actual data
        gov_tasks = all_tasks.filter(category__icontains='governance') 
        gov_score = self._calculate_data_based_score(gov_tasks, task_data, 'governance')
        
        # Calculate Overall Score (weighted average)
        # Environmental: 40%, Social: 30%, Governance: 30%
        overall_score = (env_score * 0.4) + (social_score * 0.3) + (gov_score * 0.3)
        
        # Update the scores
        self.environmental_score = round(env_score, 1)
        self.social_score = round(social_score, 1)
        self.governance_score = round(gov_score, 1)
        self.overall_esg_score = round(overall_score, 1)
        
        # Save without triggering signals to avoid recursion
        self.save(update_fields=['environmental_score', 'social_score', 'governance_score', 'overall_esg_score'])
        
        print(f"🔄 Updated ESG scores for {self.name} based on data entries:")
        print(f"   Environmental: {self.environmental_score}")
        print(f"   Social: {self.social_score}")
        print(f"   Governance: {self.governance_score}")
        print(f"   Overall: {self.overall_esg_score}")
    
    def _calculate_data_based_score(self, tasks, task_data, category):
        """Calculate ESG score based on actual data entries and file uploads"""
        if not tasks.exists():
            return 0.0  # No tasks = no score
        
        total_score = 0.0
        total_tasks = tasks.count()
        
        # Score based on data entries per task
        for task in tasks:
            task_score = 0.0
            
            # Points for data entries (50% of task score)
            data_entries = task.data_entries or {}
            if data_entries:
                # Each data entry field gives points
                data_fields = len([v for v in data_entries.values() if v and str(v).strip()])
                if data_fields > 0:
                    task_score += min(50, data_fields * 10)  # Up to 50 points for data
            
            # Points for file uploads (50% of task score)
            file_count = task.attachments.count()
            if file_count > 0:
                task_score += min(50, file_count * 15)  # Up to 50 points for files
            
            total_score += task_score
        
        # Average score per task, then scale to 0-100
        if total_tasks > 0:
            avg_score = total_score / total_tasks
            final_score = min(100, avg_score)
        else:
            final_score = 0.0
        
        # Bonus for having actual meter data (environmental category only)
        if category == 'environmental':
            energy_data = task_data.get('energy_consumption_kwh', 0)
            water_data = task_data.get('water_usage_m3', 0)
            gas_data = task_data.get('gas_usage_m3', 0)
            
            if energy_data > 0 or water_data > 0 or gas_data > 0:
                final_score = min(100, final_score + 15)  # 15 point bonus for real meter data
        
        return final_score
    
    def _calculate_data_boost(self, task_data):
        """Calculate bonus points for having real meter data entries"""
        data_points = task_data.get('data_entries_count', 0)
        energy_data = task_data.get('energy_consumption_kwh', 0)
        water_data = task_data.get('water_usage_m3', 0)
        gas_data = task_data.get('gas_usage_m3', 0)
        
        boost = 0
        
        # Bonus for number of data entries (up to 10 points)
        if data_points > 0:
            boost += min(10, data_points * 2)
        
        # Bonus for actual consumption data (up to 10 points)
        if energy_data > 0 or water_data > 0 or gas_data > 0:
            boost += 10
        
        return boost
    
    def update_progress_metrics(self):
        """Update progress tracking metrics"""
        # Calculate data completion
        if self.total_fields > 0:
            self.data_completion_percentage = (self.completed_fields / self.total_fields) * 100
        
        # Calculate evidence completion  
        if self.total_evidence_files > 0:
            self.evidence_completion_percentage = (self.uploaded_evidence_files / self.total_evidence_files) * 100
        
        self.save()


class Location(models.Model):
    """
    Company locations/facilities (from onboard.html step 2)
    Supports multiple locations per company
    """
    BUILDING_TYPE_CHOICES = [
        ('office', 'Office Building'),
        ('retail', 'Retail Space'),
        ('warehouse', 'Warehouse'),
        ('manufacturing', 'Manufacturing Facility'),
        ('hotel', 'Hotel'),
        ('restaurant', 'Restaurant'),
        ('mixed', 'Mixed Use'),
        ('other', 'Other'),
    ]
    
    OWNERSHIP_TYPE_CHOICES = [
        ('owned', 'Owned'),
        ('leased', 'Leased'),
        ('managed', 'Managed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        Company, 
        on_delete=models.CASCADE, 
        related_name='locations'
    )
    
    # Basic Information
    name = models.CharField(max_length=255, verbose_name='Location Name')
    address = models.TextField(verbose_name='Full Address')
    emirate = models.CharField(
        max_length=50,
        choices=Company.EMIRATE_CHOICES,
        verbose_name='Emirate'
    )
    
    # Building Details
    total_floor_area = models.FloatField(
        help_text='Total floor area in square meters',
        null=True,
        blank=True
    )
    number_of_floors = models.IntegerField(null=True, blank=True)
    building_type = models.CharField(
        max_length=50,
        choices=BUILDING_TYPE_CHOICES,
        null=True,
        blank=True
    )
    ownership_type = models.CharField(
        max_length=20,
        choices=OWNERSHIP_TYPE_CHOICES,
        null=True,
        blank=True
    )
    
    # Operational Details
    operating_hours = models.CharField(
        max_length=100,
        blank=True,
        help_text='e.g., 8:00 AM - 6:00 PM'
    )
    number_of_employees = models.IntegerField(null=True, blank=True)
    
    # Utility Information
    has_separate_meters = models.BooleanField(default=False)
    meters_info = models.JSONField(
        default=list,
        blank=True,
        help_text='Information about utility meters (electricity, water, gas)'
    )
    
    # ESG Relevance
    is_primary = models.BooleanField(
        default=False,
        help_text='Primary location for ESG reporting'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Location'
        verbose_name_plural = 'Locations'
        ordering = ['-is_primary', 'name']
    
    def __str__(self):
        return f"{self.company.name} - {self.name}"


class CompanySettings(models.Model):
    """
    Company-specific settings and preferences
    """
    REPORT_FREQUENCY_CHOICES = [
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
        ('semi-annual', 'Semi-Annual'),
        ('annual', 'Annual'),
    ]
    
    company = models.OneToOneField(
        Company,
        on_delete=models.CASCADE,
        related_name='settings'
    )
    
    # Reporting Preferences
    default_report_frequency = models.CharField(
        max_length=20,
        choices=REPORT_FREQUENCY_CHOICES,
        default='quarterly'
    )
    
    # Notification Settings
    email_notifications = models.BooleanField(default=True)
    task_reminders = models.BooleanField(default=True)
    report_reminders = models.BooleanField(default=True)
    
    # Framework Preferences
    active_frameworks = models.JSONField(
        default=list,
        help_text='List of active ESG frameworks'
    )
    
    # Target Settings
    targets = models.JSONField(
        default=dict,
        help_text='Company ESG targets and goals'
    )
    
    # Custom Fields
    custom_fields = models.JSONField(
        default=dict,
        help_text='Company-specific custom fields'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Company Settings'
        verbose_name_plural = 'Company Settings'
    
    def __str__(self):
        return f"{self.company.name} Settings"


class CompanyInvitation(models.Model):
    """
    Handle user invitations to join companies
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
        ('expired', 'Expired'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='invitations'
    )
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='company_sent_invitations'
    )
    
    # Invitation Details
    email = models.EmailField()
    ROLE_CHOICES = [
        ('admin', 'Administrator'),
        ('manager', 'ESG Manager'),
        ('contributor', 'Contributor'),
        ('viewer', 'Viewer'),
    ]
    
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='contributor'
    )
    message = models.TextField(blank=True)
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    
    # Security
    token = models.CharField(max_length=255, unique=True)
    expires_at = models.DateTimeField()
    
    # Response
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='company_accepted_invitations'
    )
    accepted_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Company Invitation'
        verbose_name_plural = 'Company Invitations'
        ordering = ['-created_at']
        unique_together = ['company', 'email']
    
    def __str__(self):
        return f"Invitation to {self.email} for {self.company.name}"