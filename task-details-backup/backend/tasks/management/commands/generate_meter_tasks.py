"""
Django management command to generate ESG tasks with meter enhancement
Usage: python manage.py generate_meter_tasks [--company-id=ID] [--clear]
"""

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from apps.companies.models import Company
from apps.tasks.utils import generate_initial_tasks_for_company
from apps.tasks.models import Task

User = get_user_model()


class Command(BaseCommand):
    help = 'Generate ESG tasks with meter enhancement for a company'

    def add_arguments(self, parser):
        parser.add_argument(
            '--company-id',
            type=str,
            help='Company ID to generate tasks for',
        )
        parser.add_argument(
            '--company-name',
            type=str,
            help='Company name to search for',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing tasks before generating new ones',
        )
        parser.add_argument(
            '--sector',
            type=str,
            help='Only generate tasks for companies with this business sector',
        )

    def handle(self, *args, **options):
        company_id = options.get('company_id')
        company_name = options.get('company_name')
        clear_existing = options.get('clear', False)
        sector_filter = options.get('sector')

        try:
            # Find company
            if company_id:
                try:
                    company = Company.objects.get(id=company_id)
                    self.stdout.write(f"Found company by ID: {company.name}")
                except Company.DoesNotExist:
                    raise CommandError(f'Company with ID "{company_id}" does not exist.')
            elif company_name:
                try:
                    company = Company.objects.get(name__icontains=company_name)
                    self.stdout.write(f"Found company by name: {company.name}")
                except Company.DoesNotExist:
                    raise CommandError(f'Company with name containing "{company_name}" does not exist.')
                except Company.MultipleObjectsReturned:
                    companies = Company.objects.filter(name__icontains=company_name)
                    self.stdout.write("Multiple companies found:")
                    for c in companies:
                        self.stdout.write(f"  - {c.name} (ID: {c.id}, Sector: {c.business_sector})")
                    raise CommandError('Please specify a more specific company name or use --company-id')
            else:
                # Show available companies
                companies = Company.objects.all()
                if sector_filter:
                    companies = companies.filter(business_sector=sector_filter)
                
                if not companies.exists():
                    self.stdout.write("No companies found.")
                    return

                self.stdout.write("Available companies:")
                for company in companies:
                    task_count = Task.objects.filter(company=company).count()
                    self.stdout.write(f"  - {company.name} (ID: {company.id}, Sector: {company.business_sector}, {task_count} tasks)")
                
                self.stdout.write("\nUse --company-id or --company-name to specify which company to generate tasks for.")
                return

            # Filter by sector if specified
            if sector_filter and company.business_sector != sector_filter:
                self.stdout.write(f"Skipping {company.name} - sector {company.business_sector} doesn't match filter {sector_filter}")
                return

            # Get a user for task creation (preferably admin)
            try:
                creator = User.objects.filter(company=company, is_staff=True).first()
                if not creator:
                    creator = User.objects.filter(company=company).first()
                if not creator:
                    # Create a system user for task generation
                    creator = User.objects.create_user(
                        email=f"system@{company.name.lower().replace(' ', '')}.com",
                        full_name="System Task Generator",
                        company=company,
                        is_active=True
                    )
                    self.stdout.write(f"Created system user for task generation: {creator.email}")
            except Exception as e:
                self.stdout.write(f"Warning: Could not find/create user for task generation: {e}")
                creator = None

            # Clear existing tasks if requested
            if clear_existing:
                existing_count = Task.objects.filter(company=company).count()
                if existing_count > 0:
                    Task.objects.filter(company=company).delete()
                    self.stdout.write(f"Cleared {existing_count} existing tasks for {company.name}")

            # Generate tasks with meter enhancement
            self.stdout.write(f"\nGenerating ESG tasks with meter enhancement for {company.name}...")
            self.stdout.write(f"Company sector: {company.business_sector}")
            
            tasks = generate_initial_tasks_for_company(company, created_by=creator)
            
            if tasks:
                self.stdout.write(
                    self.style.SUCCESS(f"✅ Successfully generated {len(tasks)} tasks for {company.name}")
                )
                
                # Show sample tasks with meter information
                meter_tasks = [t for t in tasks if 'Meter' in t.title or 'meter' in (t.action_required or '')]
                if meter_tasks:
                    self.stdout.write(f"\n🔌 Tasks with meter enhancement ({len(meter_tasks)} found):")
                    for task in meter_tasks[:3]:  # Show first 3
                        self.stdout.write(f"  • {task.title}")
                        if task.action_required and 'meter' in task.action_required.lower():
                            # Extract meter info from action_required
                            lines = task.action_required.split('\n')
                            meter_lines = [line for line in lines if 'meter' in line.lower()]
                            if meter_lines:
                                self.stdout.write(f"    └─ {meter_lines[0][:60]}...")
                
                # Show task breakdown
                categories = {}
                priorities = {}
                for task in tasks:
                    categories[task.category] = categories.get(task.category, 0) + 1
                    priorities[task.priority] = priorities.get(task.priority, 0) + 1
                
                self.stdout.write(f"\n📊 Task breakdown:")
                self.stdout.write(f"  Categories: {dict(categories)}")
                self.stdout.write(f"  Priorities: {dict(priorities)}")
                
            else:
                self.stdout.write(
                    self.style.WARNING(f"⚠️ No tasks generated for {company.name}")
                )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"❌ Error: {str(e)}")
            )
            raise CommandError(f'Task generation failed: {e}')