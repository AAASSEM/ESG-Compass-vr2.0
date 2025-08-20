"""
Demo User Database Management Service
Handles creating and cleaning up demo user data
"""
import logging
from django.contrib.auth import get_user_model
from django.db import transaction
from datetime import datetime, timedelta
from django.utils import timezone
import json

from apps.companies.models import Company, Location
from apps.tasks.models import Task, TaskAttachment
from apps.user_management.models import UserProfile

User = get_user_model()
logger = logging.getLogger(__name__)

class DemoUserService:
    """Service for managing demo user data lifecycle"""
    
    DEMO_EMAIL = "demo@esg-platform.com"
    DEMO_COMPANY_NAME = ""
    
    @classmethod
    def is_demo_user(cls, user):
        """Check if user is the demo user"""
        if not user or not hasattr(user, 'email'):
            return False
        return user.email == cls.DEMO_EMAIL
    
    @classmethod
    def get_or_create_demo_user(cls):
        """Get or create the demo user"""
        try:
            user = User.objects.get(email=cls.DEMO_EMAIL)
            logger.info(f"Found existing demo user: {user.email}")
            return user
        except User.DoesNotExist:
            logger.info("Creating new demo user")
            return cls._create_demo_user()
    
    @classmethod
    def _create_demo_user(cls):
        """Create a new demo user with company"""
        with transaction.atomic():
            # Create minimal demo company - user will fill in all details
            company = Company.objects.create(
                name="",  # User will enter company name
                description="",  # User will enter description
                business_sector="",  # User will select industry
                employee_size="",  # User will select size
                main_location="",  # User will enter location
                emirate="",  # User will select emirate
                license_type="",  # User will select license type
                esg_scoping_completed=False,
                onboarding_completed=False,
                setup_step=1,
                scoping_data={},
                overall_esg_score=0.0,
                environmental_score=0.0,
                social_score=0.0,
                governance_score=0.0,
                data_completion_percentage=0.0,
                evidence_completion_percentage=0.0,
                total_fields=0,
                completed_fields=0,
                total_evidence_files=0,
                uploaded_evidence_files=0
            )
            
            # Create demo user
            user = User.objects.create_user(
                username=cls.DEMO_EMAIL,
                email=cls.DEMO_EMAIL,
                full_name="Demo User",
                company=company,
                role="admin",
                phone_number="",
                job_title="",
                department="",
                is_verified=True,
                is_active=True,
                preferences={
                    "notifications": True,
                    "theme": "dark",
                    "dashboard_layout": "grid"
                }
            )
            
            # Set a default password
            user.set_password("demo123")
            user.save()
            
            # Create minimal user profile - user will fill in details
            UserProfile.objects.create(
                user=user,
                bio="",
                job_title="",
                department="",
                phone_number="",
                timezone="Asia/Dubai",
                expertise_areas=[],
                certifications=[],
                email_notifications=True,
                task_notifications=True,
                report_notifications=True,
                weekly_digest=True
            )
            
            logger.info(f"Created demo user: {user.email} with company: {company.name}")
            return user
    
    @classmethod
    def populate_demo_data(cls, user):
        """Populate demo user with sample data"""
        if not cls.is_demo_user(user):
            return
            
        logger.info(f"Populating demo data for user: {user.email}")
        
        with transaction.atomic():
            # Let user enter everything themselves - no pre-populated data
            logger.info("Demo data population completed - user will enter all data")
    
    @classmethod
    def _create_demo_locations(cls, company):
        """Create sample locations for demo company"""
        locations_data = [
            {
                "name": "Main Office",
                "address": "Dubai Marina, Dubai, UAE",
                "emirate": "dubai",
                "total_floor_area": 5000.0,
                "number_of_floors": 3,
                "building_type": "office",
                "ownership_type": "leased",
                "operating_hours": "8:00 AM - 6:00 PM",
                "number_of_employees": 50,
                "has_separate_meters": True,
                "is_primary": True,
                "meters_info": [
                    {
                        "id": "meter_elec_main_001",
                        "type": "electricity",
                        "description": "Main Electricity Meter",
                        "meterNumber": "DEWA-ELC-DEMO-001",
                        "provider": "DEWA"
                    },
                    {
                        "id": "meter_water_main_001", 
                        "type": "water",
                        "description": "Main Water Meter",
                        "meterNumber": "DEWA-WTR-DEMO-001",
                        "provider": "DEWA"
                    }
                ]
            }
        ]
        
        for loc_data in locations_data:
            Location.objects.create(company=company, **loc_data)
        
        logger.info(f"Created {len(locations_data)} demo locations")
    
    @classmethod  
    def _create_demo_tasks(cls, company, user):
        """Create sample tasks for demo company"""
        tasks_data = [
            {
                "title": "Track Monthly Electricity Consumption - Your answer: ✓ Yes",
                "description": "Upload monthly electricity bills and consumption data from DEWA for the main hotel building. This data helps calculate Scope 2 emissions and track energy efficiency improvements.",
                "task_type": "data_collection",
                "category": "environmental", 
                "status": "completed",
                "priority": "high",
                "progress_percentage": 100.0,
                "completion_notes": "March 2024 electricity data uploaded and processed",
                "data_entries": {
                    "electricity_consumption_kwh": 45250,
                    "electricity_cost_aed": 18500,
                    "billing_period": "March 2024",
                    "meter_reading_start": 125680,
                    "meter_reading_end": 170930,
                    "notes": "Peak consumption during summer prep activities"
                },
                "expected_files": ["Electricity Bill", "Meter Reading Log"]
            },
            {
                "title": "Document Water Conservation Measures - Your answer: ✓ Yes", 
                "description": "Provide evidence of low-flow fixtures installation in guest rooms and public areas. This supports water efficiency initiatives and ESG reporting.",
                "task_type": "documentation",
                "category": "environmental",
                "status": "in_progress", 
                "priority": "medium",
                "progress_percentage": 65.0,
                "data_entries": {
                    "total_fixtures_upgraded": 145,
                    "target_fixtures": 200,
                    "water_savings_percentage": 23,
                    "installation_date": "2024-02-15",
                    "notes": "Ongoing installation in remaining guest rooms"
                },
                "expected_files": ["Installation Certificate", "Before/After Photos", "Water Savings Report"]
            },
            {
                "title": "Upload Waste Management Documentation - Your answer: ✓ Yes",
                "description": "Submit recycling program documentation, waste contractor agreements, and monthly waste reports to demonstrate waste reduction efforts.",
                "task_type": "documentation",
                "category": "environmental",
                "status": "todo",
                "priority": "medium", 
                "progress_percentage": 0.0,
                "data_entries": {},
                "expected_files": ["Waste Contractor Agreement", "Monthly Waste Report", "Recycling Program Certificate"]
            },
            {
                "title": "Submit Employee Training Records - Your answer: ✓ Yes",
                "description": "Provide documentation of sustainability training programs for staff members, including training schedules, attendance records, and certification materials.",
                "task_type": "documentation", 
                "category": "social",
                "status": "in_progress",
                "priority": "low",
                "progress_percentage": 30.0,
                "data_entries": {
                    "total_employees_trained": 36,
                    "target_employees": 120,
                    "training_completion_rate": 30,
                    "last_training_date": "2024-03-10",
                    "notes": "Monthly sustainability awareness sessions ongoing"
                },
                "expected_files": ["Training Schedule", "Attendance Records", "Training Materials"]
            },
            {
                "title": "Document Governance Structure - Your answer: ✓ Yes",
                "description": "Upload sustainability policy, organizational charts showing ESG responsibilities, and board meeting minutes discussing sustainability initiatives.",
                "task_type": "documentation",
                "category": "governance", 
                "status": "completed",
                "priority": "high",
                "progress_percentage": 100.0,
                "completion_notes": "All governance documentation submitted and approved",
                "data_entries": {
                    "policy_version": "2.1",
                    "last_board_review": "2024-02-28", 
                    "esg_committee_members": 5,
                    "policy_approval_date": "2024-01-15",
                    "notes": "Updated policy includes new UAE ESG guidelines"
                },
                "expected_files": ["Sustainability Policy", "Organizational Chart", "Board Meeting Minutes"]
            }
        ]
        
        for task_data in tasks_data:
            # Set dates based on status
            due_date = timezone.now() + timedelta(days=30)
            started_at = None
            completed_at = None
            
            if task_data["status"] in ["in_progress", "completed"]:
                started_at = timezone.now() - timedelta(days=10)
                
            if task_data["status"] == "completed":
                completed_at = timezone.now() - timedelta(days=2)
                due_date = timezone.now() - timedelta(days=5)
            
            # Remove fields that aren't part of the model
            expected_files = task_data.pop("expected_files", [])
            
            task = Task.objects.create(
                company=company,
                assigned_to=user,
                created_by=user,
                due_date=due_date,
                started_at=started_at,
                completed_at=completed_at,
                estimated_hours=8.0,
                frameworks=["UAE ESG Guidelines", "GRI Standards"],
                compliance_context="UAE ESG reporting requirements",
                action_required="Upload required documentation and data",
                **task_data
            )
            
        logger.info(f"Created {len(tasks_data)} demo tasks")
    
    @classmethod
    def _get_sample_scoping_data(cls):
        """Get sample ESG scoping questionnaire data"""
        return {}
    
    @classmethod
    def clear_demo_data(cls, user):
        """Clear all demo user data"""
        if not cls.is_demo_user(user):
            return
            
        logger.info(f"Clearing demo data for user: {user.email}")
        
        try:
            with transaction.atomic():
                company = user.company
                if company:
                    # Delete all related data
                    company.locations.all().delete()
                    company.tasks.all().delete()
                    
                    # Reset company data to completely empty
                    company.name = ""
                    company.description = ""
                    company.business_sector = ""
                    company.employee_size = ""
                    company.main_location = ""
                    company.emirate = ""
                    company.license_type = ""
                    company.scoping_data = {}
                    company.esg_scoping_completed = False
                    company.onboarding_completed = False
                    company.setup_step = 1
                    company.overall_esg_score = 0.0
                    company.environmental_score = 0.0
                    company.social_score = 0.0
                    company.governance_score = 0.0
                    company.data_completion_percentage = 0.0
                    company.evidence_completion_percentage = 0.0
                    company.total_fields = 0
                    company.completed_fields = 0
                    company.total_evidence_files = 0
                    company.uploaded_evidence_files = 0
                    company.save()
                
                # Reset user data to empty
                user.phone_number = ""
                user.job_title = ""
                user.department = ""
                user.preferences = {
                    "notifications": True,
                    "theme": "dark",
                    "dashboard_layout": "grid"
                }
                user.save()
                
                # Reset user profile to empty
                try:
                    profile = user.profile
                    profile.bio = ""
                    profile.job_title = ""
                    profile.department = ""
                    profile.phone_number = ""
                    profile.expertise_areas = []
                    profile.certifications = []
                    profile.save()
                except:
                    pass  # Profile might not exist
                
                logger.info("Demo data cleared successfully")
                
        except Exception as e:
            logger.error(f"Error clearing demo data: {e}")
            raise