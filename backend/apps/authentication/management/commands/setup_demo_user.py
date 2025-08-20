"""
Management command to set up demo user
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.authentication.demo_service import DemoUserService
from apps.authentication.models import User


class Command(BaseCommand):
    help = 'Set up demo user with sample data'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Reset existing demo user data',
        )
    
    def handle(self, *args, **options):
        self.stdout.write('Setting up demo user...')
        
        try:
            with transaction.atomic():
                if options['reset']:
                    self.stdout.write('Deleting existing demo user completely...')
                    # Delete demo user and company completely
                    try:
                        demo_user = User.objects.get(email=DemoUserService.DEMO_EMAIL)
                        company = demo_user.company
                        if company:
                            company.delete()  # This will cascade delete the user
                        else:
                            demo_user.delete()
                    except User.DoesNotExist:
                        pass
                
                # Create fresh demo user
                self.stdout.write('Creating fresh demo user...')
                demo_user = DemoUserService.get_or_create_demo_user()
                
                # Populate with fresh data
                self.stdout.write('Populating demo data...')
                DemoUserService.populate_demo_data(demo_user)
                
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Demo user setup complete!\n'
                        f'Email: {demo_user.email}\n'
                        f'Password: demo123\n'
                        f'Company: {demo_user.company.name}\n'
                        f'Use /api/auth/demo-login/ endpoint for quick access'
                    )
                )
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error setting up demo user: {e}')
            )
            raise