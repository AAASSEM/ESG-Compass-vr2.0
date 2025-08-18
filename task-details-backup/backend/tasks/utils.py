"""
Task generation utilities for ESG compliance
V1-style markdown-driven task generation adapted for v3
"""
from datetime import datetime, timedelta
from django.utils import timezone
from apps.tasks.models import Task
from apps.companies.models import Company
from .markdown_parser import ESGContentParser, parse_sector_questions
import uuid
import logging

logger = logging.getLogger(__name__)


def generate_initial_tasks_for_company(company, created_by=None):
    """
    Generate initial ESG tasks for a company based on their business sector
    using the v1-style markdown-driven approach.
    
    This reads ESG questions from the UAE SME markdown document and creates
    tasks directly from the structured questions, similar to v1 system.
    Includes specific meter information when available.
    """
    print("\n" + "="*80)
    print("🚀 [TASK GENERATION] V1-Style Markdown-Driven Task Generation")
    print("="*80)
    
    try:
        # Handle created_by None case - use the first admin user from the company
        if created_by is None:
            from apps.authentication.models import User
            # Try to get the first user associated with the company
            company_user = company.users.first()
            if company_user:
                created_by = company_user
            else:
                # If no company user exists, create a system user
                created_by, _ = User.objects.get_or_create(
                    username='system',
                    defaults={
                        'email': 'system@esg-platform.local',
                        'first_name': 'System',
                        'last_name': 'Generated',
                        'is_staff': True
                    }
                )
        
        # Check if tasks already exist
        existing_tasks = Task.objects.filter(company=company).count()
        if existing_tasks > 0:
            print(f"⚠️  Company {company.name} already has {existing_tasks} tasks. Skipping generation.")
            return []
        
        print(f"📋 Generating tasks for company: {company.name}")
        print(f"   • Sector: {company.business_sector}")
        print(f"   • Location: {company.main_location}")
        
        # Get location and meter information
        from apps.companies.models import Location
        locations = Location.objects.filter(company=company)
        print(f"   • Locations: {locations.count()}")
        
        # Collect meter information from all locations
        meter_info = _collect_meter_information(locations)
        print(f"   • Meters: {len(meter_info)} found")
        
        # Parse ESG questions for company's sector using markdown parser
        print(f"\n📚 Loading ESG questions from UAE SME document...")
        esg_questions = parse_sector_questions(company.business_sector)
        
        if not esg_questions:
            print(f"⚠️  No ESG questions found for sector: {company.business_sector}")
            print("   Available sectors should include: hospitality, construction, manufacturing, logistics, education, health, retail, technology")
            return []
        
        print(f"✅ Found {len(esg_questions)} ESG questions for {company.business_sector}")
        
        # Generate tasks from questions
        print(f"\n🔧 Creating tasks from questions...")
        tasks = []
        
        for i, question in enumerate(esg_questions, 1):
            try:
                print(f"   📝 Processing Question {i}/{len(esg_questions)}: {question.wizard_question[:60]}...")
                
                # Calculate due date based on priority
                due_date = _calculate_due_date_for_question(question)
                
                # Map category to task category choices (analyze both category and question text)
                task_category = _map_question_category(question.category, question.wizard_question)
                
                # Enhance task with specific meter information if relevant
                enhanced_title, enhanced_description, enhanced_action = _enhance_task_with_meter_info(
                    question, meter_info
                )
                
                # Create task
                task = Task.objects.create(
                    company=company,
                    title=enhanced_title,
                    description=enhanced_description,
                    compliance_context=question.frameworks,
                    action_required=enhanced_action,
                    category=task_category,
                    priority=_determine_task_priority(question),
                    status='todo',
                    due_date=due_date,
                    created_by=created_by,
                    assigned_to=created_by,  # Auto-assign to creator
                    external_id=question.id,  # Store question ID for reference
                    framework_tags=_extract_framework_tags(question.frameworks),
                    sector=company.business_sector,
                    task_type='esg_assessment',
                    estimated_hours=_estimate_task_hours(question)
                )
                
                tasks.append(task)
                print(f"      ✅ Created task: {task.id}")
                
            except Exception as e:
                print(f"      ❌ Error creating task: {e}")
                logger.warning(f"Error creating task from question '{question.wizard_question}': {e}")
                continue
        
        print(f"\n🎉 TASK GENERATION COMPLETED")
        print(f"   • Total tasks generated: {len(tasks)}")
        print(f"   • Company: {company.name}")
        print(f"   • Sector: {company.business_sector}")
        
        # Summary by category
        category_stats = {}
        priority_stats = {}
        for task in tasks:
            category_stats[task.category] = category_stats.get(task.category, 0) + 1
            priority_stats[task.priority] = priority_stats.get(task.priority, 0) + 1
        
        print(f"   • By Category: {dict(category_stats)}")
        print(f"   • By Priority: {dict(priority_stats)}")
        print("="*80)
        
        logger.info(f"Generated {len(tasks)} tasks for company {company.id} using v1-style markdown approach")
        return tasks
        
    except Exception as e:
        print(f"❌ ERROR in task generation: {e}")
        print("="*80)
        logger.error(f"Error generating tasks for company {company.id}: {e}")
        return []


def _calculate_due_date_for_question(question):
    """Calculate due date based on question priority and frameworks."""
    # Check if question is high priority (mandatory frameworks)
    frameworks_text = question.frameworks.lower()
    
    if any(keyword in frameworks_text for keyword in ['mandatory', 'required', 'mandates']):
        # High priority: 30 days
        return timezone.now() + timedelta(days=30)
    elif any(keyword in frameworks_text for keyword in ['voluntary', 'recommended']):
        # Low priority: 90 days
        return timezone.now() + timedelta(days=90)
    else:
        # Medium priority: 60 days
        return timezone.now() + timedelta(days=60)


def _map_question_category(category, question_text=""):
    """Map question category to Django model category choices based on ESG principles."""
    if not category:
        category = ""
    
    # Combine category and question text for analysis
    combined_text = f"{category} {question_text}".lower()
    
    # Priority 1: Social keywords (food/health override environmental context)
    if any(keyword in combined_text for keyword in [
        'cafeteria', 'food service', 'healthy food', 'locally sourced', 'nutrition',
        'health', 'safety', 'employee', 'staff', 'training', 'community', 'social', 
        'welfare', 'student', 'curriculum', 'education', 'guest', 'customer',
        'medical waste', 'hazardous', 'single-use plastics', 'paper use', 'digital'
    ]):
        return 'social'
    
    # Priority 2: Environmental keywords
    elif any(keyword in combined_text for keyword in [
        'electricity', 'water consumption', 'track consumption', 'utility bills',
        'recycling', 'waste', 'air quality', 'monitor', 'environmental',
        'resource', 'energy', 'consumption', 'emission', 'carbon', 'reuse'
    ]):
        return 'environmental'
    
    # Priority 3: Governance keywords  
    elif any(keyword in combined_text for keyword in [
        'policy', 'strategy', 'sustainability plan', 'formal', 'written',
        'governance', 'management', 'compliance', 'documentation', 'audit', 'reporting',
        'designated person', 'team responsible', 'signed by senior', 'certification',
        'assessment', 'impact assessment', 'contract', 'licensed company'
    ]):
        return 'governance'
    
    else:
        return 'environmental'  # Default for ambiguous cases


def _determine_task_priority(question):
    """Determine task priority based on frameworks and question content."""
    frameworks_text = question.frameworks.lower()
    question_text = question.wizard_question.lower()
    
    # High priority: mandatory frameworks
    high_priority_keywords = [
        'mandatory', 'required', 'mandates', 'dst carbon calculator',
        'al sa\'fat', 'estidama', 'federal law', 'climate law'
    ]
    
    # Medium priority: training, monitoring, voluntary standards
    medium_priority_keywords = [
        'training', 'monitoring', 'tracking', 'reporting', 'voluntary',
        'green key', 'leed', 'breeam'
    ]
    
    if any(keyword in frameworks_text for keyword in high_priority_keywords):
        return 'high'
    elif any(keyword in frameworks_text for keyword in medium_priority_keywords):
        return 'medium'
    else:
        return 'low'


def _extract_framework_tags(frameworks_text):
    """Extract simplified framework tags from frameworks text."""
    if not frameworks_text:
        return []
    
    tags = []
    
    # Split by comma or semicolon to handle multiple frameworks
    framework_parts = frameworks_text.split(',') if ',' in frameworks_text else [frameworks_text]
    
    for part in framework_parts:
        part = part.strip()
        if not part:
            continue
            
        # Extract framework name and status
        framework_name = ""
        status = ""
        
        # Common framework patterns
        if 'ADEK' in part:
            framework_name = 'ADEK Sustainability Policy'
        elif 'Emirates Coalition' in part:
            framework_name = 'Emirates Coalition for Green Schools'
        elif 'DST' in part or 'Dubai Sustainable Tourism' in part:
            framework_name = 'Dubai Sustainable Tourism'
        elif 'Green Key' in part:
            framework_name = 'Green Key Global'
        elif 'Al Sa\'fat' in part:
            framework_name = 'Al Sa\'fat Dubai'
        elif 'Estidama' in part:
            framework_name = 'Estidama Pearl'
        elif 'LEED' in part:
            framework_name = 'LEED'
        elif 'BREEAM' in part:
            framework_name = 'BREEAM'
        elif 'Federal Law' in part or 'Climate Law' in part:
            framework_name = 'UAE Federal Law'
        elif 'MOHAP' in part:
            framework_name = 'MOHAP Hospital Regulation'
        else:
            # Extract first part as framework name if pattern not recognized
            # Clean up cryptic references and numbers - Enhanced cleaning
            cleaned_part = part.replace('\\1', '').replace('\\2', '').replace('\\3', '')
            # Remove numbers, dots, and policy references at the end
            import re
            cleaned_part = re.sub(r'\.\d+$', '', cleaned_part)  # Remove .63, .42, etc.
            cleaned_part = re.sub(r'^\d+\.\d+\s*&?\s*\d*\.\d*\s*', '', cleaned_part)  # Remove 2.1 & 2.6, 1.1, etc.
            # Remove criterion references per user request
            cleaned_part = re.sub(r'imperative\s+criterion\s+\d+\.\d+', '', cleaned_part, flags=re.IGNORECASE)
            cleaned_part = re.sub(r'criterion\s+\d+\.\d+', '', cleaned_part, flags=re.IGNORECASE)
            cleaned_part = re.sub(r'\([IGC]\)', '', cleaned_part)  # Remove (I), (G), (C) markers
            cleaned_part = cleaned_part.strip()
            
            if ':' in cleaned_part:
                framework_name = cleaned_part.split(':')[0].strip()
            else:
                framework_name = cleaned_part.split('(')[0].strip()
            
            # If framework name is too generic or short, use a default
            if not framework_name or len(framework_name) < 3:
                if 'curriculum' in part.lower():
                    framework_name = 'ADEK Sustainability Policy'
                elif 'reuse' in part.lower():
                    framework_name = 'ADEK Sustainability Policy'
                elif 'sustainability strategy' in part.lower():
                    framework_name = 'ADEK Sustainability Policy'
                else:
                    framework_name = 'Framework Requirement'
        
        # Determine status
        part_lower = part.lower()
        if 'mandatory' in part_lower or 'required' in part_lower or 'mandates' in part_lower:
            status = 'Mandatory'
        elif 'voluntary' in part_lower or 'recommends' in part_lower or 'optional' in part_lower:
            status = 'Recommends'
        else:
            status = 'Required'  # Default
        
        # Create simplified tag
        if framework_name:
            tag = f"{framework_name}: {status}"
            tags.append(tag)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_tags = []
    for tag in tags:
        if tag not in seen:
            seen.add(tag)
            unique_tags.append(tag)
    
    return unique_tags


def _estimate_task_hours(question):
    """Estimate hours required based on question complexity."""
    data_source = question.data_source.lower() if question.data_source else ""
    
    if any(keyword in data_source for keyword in ['bills', 'invoices', 'records', 'monitoring']):
        return 8  # Data collection tasks
    elif any(keyword in data_source for keyword in ['policy', 'plan', 'assessment']):
        return 16  # Policy/planning tasks
    elif any(keyword in data_source for keyword in ['training', 'committee', 'system']):
        return 12  # Implementation tasks
    else:
        return 4  # Simple tasks


def _collect_meter_information(locations):
    """
    Collect meter information from all company locations.
    Returns list of meter dictionaries with specific meter IDs.
    """
    meters = []
    
    # If no locations exist, create default meters for the company
    if not locations.exists():
        print(f"   📍 No locations found, generating default meters...")
        default_meters = [
            {
                'id': 'ELE001',
                'number': 'ELE001',
                'type': 'electricity',
                'provider': 'DEWA',
                'location': 'Main Building',
                'location_id': 'default'
            },
            {
                'id': 'WAT001',
                'number': 'WAT001',
                'type': 'water',
                'provider': 'DEWA',
                'location': 'Main Building',
                'location_id': 'default'
            }
        ]
        meters.extend(default_meters)
        print(f"   🔌 Generated {len(default_meters)} default meters")
        return meters
    
    for location in locations:
        if location.has_separate_meters and location.meters_info:
            # Process existing meter info from frontend format
            for meter in location.meters_info:
                meter_data = {
                    'id': meter.get('id', meter.get('meter_id')),
                    'number': meter.get('meterNumber', meter.get('meter_number', meter.get('number'))),  # Frontend uses 'meterNumber'
                    'type': meter.get('type', meter.get('meter_type')),
                    'provider': meter.get('provider', 'DEWA'),
                    'description': meter.get('description', ''),
                    'location': location.name,
                    'location_id': str(location.id)
                }
                meters.append(meter_data)
        else:
            # Check if meter data exists even without separate meters flag
            if location.meters_info:
                # Use meter data from frontend (same as above)
                for meter in location.meters_info:
                    meter_data = {
                        'id': meter.get('id', meter.get('meter_id')),
                        'number': meter.get('meterNumber', meter.get('meter_number', meter.get('number'))),
                        'type': meter.get('type', meter.get('meter_type')),
                        'provider': meter.get('provider', 'DEWA'),
                        'description': meter.get('description', ''),
                        'location': location.name,
                        'location_id': str(location.id)
                    }
                    meters.append(meter_data)
            else:
                # Generate default meter IDs based on location for demo purposes
                location_prefix = location.name.upper().replace(' ', '')[:3]
                
                # Standard utility meters for UAE businesses
                default_meters = [
                    {
                        'id': f'ELE{location_prefix}{str(location.id)[-4:]}',
                        'number': f'ELE{location_prefix}{str(location.id)[-4:]}',
                        'type': 'electricity',
                        'provider': 'DEWA',
                        'location': location.name,
                        'location_id': str(location.id)
                    },
                    {
                        'id': f'WAT{location_prefix}{str(location.id)[-4:]}',
                        'number': f'WAT{location_prefix}{str(location.id)[-4:]}',
                        'type': 'water',
                        'provider': 'DEWA', 
                        'location': location.name,
                        'location_id': str(location.id)
                    }
                ]
                meters.extend(default_meters)
    
    return meters


def _enhance_task_with_meter_info(question, meter_info):
    """
    Enhance task title, description, and action_required with specific meter information
    when the question relates to utility consumption tracking.
    
    This is the KEY FEATURE from v1 that you specifically requested.
    """
    original_title = question.wizard_question
    original_description = question.rationale or question.wizard_question
    original_action = question.data_source
    
    # Check if question relates to meter readings or utility consumption
    question_lower = original_title.lower()
    data_source_lower = original_action.lower() if original_action else ""
    
    # Keywords that indicate meter-related tasks - More specific to avoid false positives
    meter_keywords = [
        'electricity consumption', 'water consumption', 'energy consumption',
        'monthly electricity', 'monthly water', 'monthly energy',
        'utility bills', 'meter reading', 'kwh', 'm³', 'cubic meters',
        'track.*consumption', 'monitor.*consumption', 'record.*consumption'
    ]
    
    # More precise meter task detection to avoid adding meters to irrelevant tasks
    is_meter_task = False
    
    # Check for exact utility consumption patterns
    for keyword in meter_keywords:
        if keyword in question_lower or keyword in data_source_lower:
            is_meter_task = True
            break
    
    # Additional check for specific utility-related questions
    if not is_meter_task and meter_info:
        utility_patterns = [
            'track.*utility', 'monitor.*utility', 'electricity.*track', 'water.*track',
            'consumption.*month', 'monthly.*bill', 'utility.*meter'
        ]
        import re
        combined_text = f"{question_lower} {data_source_lower}"
        for pattern in utility_patterns:
            if re.search(pattern, combined_text):
                is_meter_task = True
                break
    
    if not is_meter_task or not meter_info:
        # Return original content if not meter-related or no meters available
        return original_title, original_description, original_action
    
    # Determine which meters apply to this question
    relevant_meters = []
    
    if 'electricity' in question_lower or 'energy' in question_lower or 'kwh' in question_lower:
        relevant_meters = [m for m in meter_info if m['type'] == 'electricity']
    elif 'water' in question_lower or 'm³' in question_lower or 'cubic meters' in question_lower:
        relevant_meters = [m for m in meter_info if m['type'] == 'water']
    else:
        # General consumption question - include all meters
        relevant_meters = meter_info
    
    if not relevant_meters:
        return original_title, original_description, original_action
    
    # Enhance title with specific meter references
    enhanced_title = original_title
    if len(relevant_meters) == 1:
        meter = relevant_meters[0]
        enhanced_title = f"{original_title} (Meter: {meter['number']})"
    elif len(relevant_meters) > 1:
        meter_list = ", ".join([m['number'] for m in relevant_meters])
        enhanced_title = f"{original_title} (Meters: {meter_list})"
    
    # Enhance description with meter details
    enhanced_description = original_description
    if relevant_meters:
        meter_details = "\n\nSpecific Meters to Track:\n"
        for meter in relevant_meters:
            meter_details += f"• {meter['type'].title()} Meter {meter['number']} at {meter['location']} ({meter['provider']})\n"
        
        enhanced_description = f"{original_description}{meter_details}"
    
    # Enhance action_required with specific meter instructions and clear file requirements
    enhanced_action = original_action
    if relevant_meters:
        if len(relevant_meters) == 1:
            meter = relevant_meters[0]
            enhanced_action = f"{original_action}\n\nSpecific Action: Read meter {meter['number']} ({meter['type']}) at {meter['location']} and record monthly consumption from {meter['provider']} bills.\n\nFiles to Upload:\n1. {meter['provider']} utility bill for current month\n2. {meter['provider']} utility bill for previous month\n3. {meter['provider']} utility bill for month before that\n\nTotal: 3 monthly bills showing {meter['type']} consumption"
        else:
            meter_list = "\n".join([f"- {m['number']} ({m['type']}) at {m['location']}" for m in relevant_meters])
            enhanced_action = f"{original_action}\n\nSpecific Meters to Track:\n{meter_list}\n\nFiles to Upload:\n• 3 months of utility bills for each meter\n• Bills should show monthly consumption readings\n• Upload bills from your utility provider ({relevant_meters[0]['provider']})\n\nTotal files needed: {len(relevant_meters) * 3} bills"
    
    return enhanced_title, enhanced_description, enhanced_action


def _get_environmental_tasks(company, sector):
    """Generate environmental tasks based on company sector"""
    base_tasks = [
        {
            'title': 'Establish Energy Monitoring System',
            'description': 'Set up monthly energy consumption tracking for all facilities',
            'category': 'environmental',
            'priority': 'high',
            'status': 'todo',
            'due_date': timezone.now() + timedelta(days=30),
            'estimated_hours': 16,
            'compliance_context': 'UAE Climate Law: Energy efficiency reporting requirement',
            'action_required': 'Install energy meters and establish tracking spreadsheet/system'
        },
        {
            'title': 'Water Usage Assessment',
            'description': 'Document current water consumption and identify conservation opportunities',
            'category': 'environmental',
            'priority': 'medium',
            'status': 'todo',
            'due_date': timezone.now() + timedelta(days=45),
            'estimated_hours': 8,
            'compliance_context': 'UAE Water Security Strategy 2036',
            'action_required': 'Review water bills and conduct facility water audit'
        },
        {
            'title': 'Waste Management Plan',
            'description': 'Develop comprehensive waste sorting and reduction strategy',
            'category': 'environmental',
            'priority': 'high',
            'status': 'todo',
            'due_date': timezone.now() + timedelta(days=60),
            'estimated_hours': 12,
            'compliance_context': 'Federal Law No. 12 of 2018 on Integrated Waste Management',
            'action_required': 'Create waste audit and implement sorting system'
        }
    ]
    
    # Add sector-specific tasks
    if sector in ['manufacturing', 'construction']:
        base_tasks.append({
            'title': 'Emissions Inventory Setup',
            'description': 'Calculate and document Scope 1 and 2 greenhouse gas emissions',
            'category': 'environmental',
            'priority': 'high', 
            'status': 'todo',
            'due_date': timezone.now() + timedelta(days=90),
            'estimated_hours': 20,
            'compliance_context': 'UAE Climate Law: GHG reporting requirement',
            'action_required': 'Collect fuel and electricity data, calculate emissions using approved methodology'
        })
    
    return base_tasks


def _get_social_tasks(company, sector):
    """Generate social tasks based on company characteristics"""
    employee_size = company.scoping_data.get('employee_size', '1-10')
    
    tasks = [
        {
            'title': 'Employee Health & Safety Policy',
            'description': 'Develop and implement workplace health and safety guidelines',
            'category': 'social',
            'priority': 'high',
            'status': 'todo',
            'due_date': timezone.now() + timedelta(days=30),
            'estimated_hours': 8,
            'compliance_context': 'UAE Labour Law: Workplace safety requirements',
            'action_required': 'Draft H&S policy, conduct risk assessment, provide employee training'
        },
        {
            'title': 'Employee Satisfaction Survey',
            'description': 'Conduct annual employee engagement and satisfaction assessment',
            'category': 'social',
            'priority': 'medium',
            'status': 'todo',
            'due_date': timezone.now() + timedelta(days=60),
            'estimated_hours': 6,
            'compliance_context': 'Social sustainability best practices',
            'action_required': 'Design survey, distribute to employees, analyze results'
        }
    ]
    
    # Add tasks for larger companies
    if employee_size not in ['1-10', '11-50']:
        tasks.append({
            'title': 'Diversity & Inclusion Program',
            'description': 'Establish D&I initiatives and track diversity metrics',
            'category': 'social',
            'priority': 'medium',
            'status': 'todo',
            'due_date': timezone.now() + timedelta(days=90),
            'estimated_hours': 12,
            'compliance_context': 'UAE Vision 2071: Inclusive society goals',
            'action_required': 'Develop D&I policy, set targets, implement programs'
        })
    
    return tasks


def _get_governance_tasks(company, sector):
    """Generate governance tasks for the company"""
    return [
        {
            'title': 'ESG Committee Formation',
            'description': 'Establish internal ESG oversight committee with defined roles',
            'category': 'governance',
            'priority': 'high',
            'status': 'todo',
            'due_date': timezone.now() + timedelta(days=45),
            'estimated_hours': 6,
            'compliance_context': 'Corporate governance best practices',
            'action_required': 'Identify committee members, define terms of reference, schedule regular meetings'
        },
        {
            'title': 'Code of Conduct Review',
            'description': 'Update or create comprehensive business ethics and conduct policy',
            'category': 'governance',
            'priority': 'medium',
            'status': 'todo',
            'due_date': timezone.now() + timedelta(days=60),
            'estimated_hours': 8,
            'compliance_context': 'UAE Commercial Companies Law: Good governance requirements',
            'action_required': 'Review existing policies, update with ESG considerations, communicate to all staff'
        },
        {
            'title': 'ESG Risk Assessment',
            'description': 'Identify and assess material ESG risks affecting the business',
            'category': 'governance',
            'priority': 'high',
            'status': 'todo',
            'due_date': timezone.now() + timedelta(days=75),
            'estimated_hours': 16,
            'compliance_context': 'Risk management framework requirements',
            'action_required': 'Conduct ESG risk workshop, prioritize risks, develop mitigation strategies'
        }
    ]


def _update_company_completion_stats(company):
    """Update company completion statistics based on current tasks"""
    total_tasks = Task.objects.filter(company=company).count()
    completed_tasks = Task.objects.filter(company=company, status='completed').count()
    
    if total_tasks > 0:
        completion_percentage = (completed_tasks / total_tasks) * 100
        company.data_completion_percentage = completion_percentage
        
        # Calculate category-specific scores
        for category in ['environmental', 'social', 'governance']:
            category_tasks = Task.objects.filter(company=company, category=category).count()
            completed_category = Task.objects.filter(
                company=company, 
                category=category, 
                status='completed'
            ).count()
            
            if category_tasks > 0:
                category_score = (completed_category / category_tasks) * 100
                setattr(company, f'{category}_score', category_score)
        
        # Calculate overall ESG score
        env_score = company.environmental_score or 0
        social_score = company.social_score or 0  
        gov_score = company.governance_score or 0
        company.overall_esg_score = (env_score + social_score + gov_score) / 3
        
        company.save()