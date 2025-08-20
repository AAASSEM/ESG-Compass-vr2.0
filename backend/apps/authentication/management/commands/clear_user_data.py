"""
Management command to clear all user data except specified users
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.authentication.models import User


class Command(BaseCommand):
    help = 'Clear all user data except specified users, resetting them to fresh signup state'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--except',
            nargs='+',
            help='User full names to exclude from clearing (e.g., "ali ali")',
            default=[]
        )
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Confirm the data clearing operation',
        )
    
    def handle(self, *args, **options):
        excluded_users = options['except'] if options['except'] else []
        
        if not options['confirm']:
            self.stdout.write(
                self.style.WARNING(
                    'This will clear ALL user data except for the following users:'
                )
            )
            for user in excluded_users:
                self.stdout.write(f'  - {user}')
            self.stdout.write('')
            self.stdout.write('Run with --confirm to proceed.')
            return
        
        self.stdout.write('Clearing user data...')
        
        try:
            with transaction.atomic():
                # Get all users except excluded ones and demo user
                users_to_clear = User.objects.exclude(
                    email='demo@esg-platform.com'
                )
                
                # Filter out excluded users (case insensitive)
                if excluded_users:
                    excluded_users_lower = [name.lower() for name in excluded_users]
                    users_to_clear = users_to_clear.exclude(
                        full_name__in=[u.full_name for u in User.objects.all() 
                                     if u.full_name.lower() in excluded_users_lower]
                    )
                
                cleared_count = 0
                
                for user in users_to_clear:
                    self.stdout.write(f'Clearing data for: {user.full_name} ({user.email})')
                    
                    # Clear company data
                    if user.company:
                        company = user.company
                        
                        # Delete all related data
                        company.locations.all().delete()
                        company.tasks.all().delete()
                        
                        # Reset company to fresh state
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
                    
                    # Reset user data to fresh signup state
                    user.phone_number = ""
                    user.job_title = ""
                    user.department = ""
                    user.preferences = {
                        "notifications": True,
                        "theme": "dark",
                        "dashboard_layout": "grid"
                    }
                    user.save()
                    
                    # Reset user profile
                    try:
                        if hasattr(user, 'profile') and user.profile:
                            profile = user.profile
                            profile.bio = ""
                            profile.job_title = ""
                            profile.department = ""
                            profile.phone_number = ""
                            profile.expertise_areas = []
                            profile.certifications = []
                            profile.save()
                    except:
                        pass
                    
                    cleared_count += 1
                
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Successfully cleared data for {cleared_count} users'
                    )
                )
                
                # Show excluded users
                if excluded_users:
                    self.stdout.write('')
                    self.stdout.write('Excluded users (data preserved):')
                    for excluded in excluded_users:
                        try:
                            user = User.objects.get(full_name__iexact=excluded)
                            self.stdout.write(f'  - {user.full_name} ({user.email})')
                        except User.DoesNotExist:
                            self.stdout.write(f'  - {excluded} (not found)')
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error clearing user data: {e}')
            )
            raise