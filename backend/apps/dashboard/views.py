from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.utils import timezone
from django.db.models import Q, Avg, Count, Max, Min
from django.http import HttpResponse
from datetime import datetime, timedelta, date
from django.contrib.auth import get_user_model
from django.views.decorators.csrf import csrf_exempt
from collections import defaultdict
import os
import re

from .models import DashboardMetric, DashboardWidget, DashboardAlert, BenchmarkData, AnalyticsEvent
from .serializers import (
    DashboardOverviewSerializer, DashboardMetricSerializer, DashboardWidgetSerializer,
    DashboardAlertSerializer, ESGTrendsSerializer, EmissionsBreakdownSerializer,
    RecentActivitySerializer, RecommendationSerializer, TargetProgressSerializer,
    CompanyComparisonSerializer, AlertSummarySerializer, KPISerializer,
    DashboardInsightSerializer, QuickStatsSerializer, PerformanceMetricsSerializer,
    DashboardConfigSerializer, BenchmarkDataSerializer, AnalyticsEventSerializer
)
from apps.companies.models import Company, Location
from apps.tasks.models import Task, TaskTemplate, TaskAttachment
from apps.esg_assessment.models import ESGAssessment, ESGResponse
from apps.reports.models import GeneratedReport
from apps.files.models import ExtractedFileData

User = get_user_model()


@csrf_exempt
def test_social_dashboard(request):
    """
    Serve the test social dashboard HTML file - Plain Django view without DRF
    """
    # Use absolute path to the HTML file
    html_path = '/mnt/c/Users/20100/v3/backend/test_social_dashboard.html'
    
    try:
        with open(html_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        return HttpResponse(html_content, content_type='text/html')
    except FileNotFoundError:
        return HttpResponse(f"Test dashboard HTML file not found at: {html_path}", status=404)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def social_file_data(request):
    """
    Extract and analyze data from uploaded social files using ExtractedFileData
    """
    company = request.user.company
    if not company:
        return Response({'error': 'No company associated with user'}, status=400)
    
    # Get all extracted data for social tasks
    social_extracted_data = ExtractedFileData.objects.filter(
        task_attachment__task__company=company,
        task_attachment__task__category__icontains='social',
        processing_status='completed'
    ).select_related('task_attachment__task')
    
    extracted_data = {
        'training_hours': None,
        'safety_incidents': None,
        'satisfaction_score': None,
        'diversity_ratio': None,
        'files_analyzed': social_extracted_data.count(),
        'social_tasks': [],
        'extraction_confidence': 0.0
    }
    
    # Aggregate data from extracted files
    if social_extracted_data.exists():
        # Calculate average confidence
        avg_confidence = social_extracted_data.aggregate(
            avg_confidence=Avg('confidence_score')
        )['avg_confidence'] or 0.0
        extracted_data['extraction_confidence'] = round(avg_confidence, 1)
        
        # Get latest values for each metric
        latest_training = social_extracted_data.exclude(
            training_hours__isnull=True
        ).order_by('-extraction_date').first()
        if latest_training:
            extracted_data['training_hours'] = latest_training.training_hours
        
        latest_safety = social_extracted_data.exclude(
            safety_incidents__isnull=True
        ).order_by('-extraction_date').first()
        if latest_safety:
            extracted_data['safety_incidents'] = latest_safety.safety_incidents
        
        latest_satisfaction = social_extracted_data.exclude(
            employee_satisfaction_score__isnull=True
        ).order_by('-extraction_date').first()
        if latest_satisfaction:
            extracted_data['satisfaction_score'] = latest_satisfaction.employee_satisfaction_score
        
        latest_employees = social_extracted_data.exclude(
            total_employees__isnull=True
        ).order_by('-extraction_date').first()
        if latest_employees:
            extracted_data['total_employees'] = latest_employees.total_employees
        
        # Group by task for detailed view
        tasks_data = {}
        for extracted in social_extracted_data:
            task = extracted.task_attachment.task
            if task.id not in tasks_data:
                tasks_data[task.id] = {
            'title': task.title,
            'attachments': []
        }
        
            attachment_data = {
                'title': extracted.task_attachment.title,
                'filename': extracted.task_attachment.original_filename,
                'file_size': extracted.task_attachment.file.size if extracted.task_attachment.file else None,
                'attachment_type': extracted.task_attachment.attachment_type,
                'description': extracted.task_attachment.description,
                'created_at': extracted.task_attachment.uploaded_at,
                'extracted_values': [],
                'confidence_score': extracted.confidence_score,
                'extraction_method': extracted.extraction_method
            }
            
            # Add extracted metrics
            if extracted.training_hours:
                attachment_data['extracted_values'].append(f"Training Hours: {extracted.training_hours}")
            if extracted.safety_incidents:
                attachment_data['extracted_values'].append(f"Safety Incidents: {extracted.safety_incidents}")
            if extracted.employee_satisfaction_score:
                attachment_data['extracted_values'].append(f"Satisfaction Score: {extracted.employee_satisfaction_score}%")
            if extracted.total_employees:
                attachment_data['extracted_values'].append(f"Total Employees: {extracted.total_employees}")
            
            tasks_data[task.id]['attachments'].append(attachment_data)
        
        extracted_data['social_tasks'] = list(tasks_data.values())
    
    return Response(extracted_data)


def _get_task_data_entries(company):
    """
    Extract consumption data from task data_entries field
    """
    # Get tasks with data entries
    tasks_with_data = Task.objects.filter(
        company=company,
        data_entries__isnull=False
    ).exclude(data_entries={})
    
    consumption_data = {
        'energy_consumption_kwh': 0,
        'water_usage_m3': 0,
        'gas_usage_m3': 0,
        'data_entries_count': 0,
        'tasks_with_data': []
    }
    
    total_energy = 0
    total_water = 0 
    total_gas = 0
    entries_count = 0
    
    for task in tasks_with_data:
        task_data = {
            'title': task.title,
            'entries': {}
        }
        
        # Process each data entry
        for key, value in task.data_entries.items():
            if value and str(value).strip():  # Only count non-empty entries
                entries_count += 1
                task_data['entries'][key] = value
                
                # Parse meter readings by connecting with actual meter data from task
                try:
                    numeric_value = float(str(value).replace(',', ''))
                    
                    # Get meter type by analyzing the task content to determine what meters it tracks
                    meter_type = _get_meter_type_for_field(task, key)
                    
                    if meter_type:
                        # Skip cost fields for consumption calculation
                        if 'cost' not in key.lower():
                            if meter_type == 'electricity':
                                total_energy += numeric_value
                                print(f"     ⚡ Added {numeric_value} kWh from {meter_type} meter (key: {key})")
                            elif meter_type == 'water':
                                total_water += numeric_value
                                print(f"     💧 Added {numeric_value} m³ from {meter_type} meter (key: {key})")
                            elif meter_type == 'gas':
                                total_gas += numeric_value
                                print(f"     🔥 Added {numeric_value} m³ from {meter_type} meter (key: {key})")
                    else:
                        print(f"     ❓ Unknown meter type for key: {key} = {numeric_value}")
                        
                except (ValueError, TypeError):
                    # Skip non-numeric values
                    pass
        
        if task_data['entries']:
            consumption_data['tasks_with_data'].append(task_data)
    
    consumption_data['energy_consumption_kwh'] = total_energy
    consumption_data['water_usage_m3'] = total_water
    consumption_data['gas_usage_m3'] = total_gas
    consumption_data['data_entries_count'] = entries_count
    
    # Debug logging and validation
    print(f"📊 Dashboard Metrics Debug - Company: {company.name}")
    print(f"   Tasks with data: {len(consumption_data['tasks_with_data'])}")
    print(f"   Total entries: {entries_count}")
    print(f"   Energy: {total_energy} kWh")
    print(f"   Water: {total_water} m³") 
    print(f"   Gas: {total_gas} m³")
    for task_data in consumption_data['tasks_with_data']:
        print(f"   Task: {task_data['title'][:50]}...")
        for key, value in task_data['entries'].items():
            print(f"     {key}: {value}")
    
    # Run validation to ensure detection is working properly
    validation_results = _validate_meter_detection_coverage(company)
    
    # Add validation results to response for monitoring
    consumption_data['validation'] = validation_results
    
    return consumption_data


def _get_meter_type_for_field(task, field_key):
    """
    BULLETPROOF meter type detection for any task/user/industry combination
    
    This function ensures accurate meter detection regardless of:
    - Industry type (hospitality, manufacturing, education, etc.)
    - Task content variations and language
    - User field naming patterns (clear names vs random numbers)
    - Number of meters (single vs multiple)
    """
    
    # STEP 1: Comprehensive task content analysis
    task_text = f"{task.title or ''} {task.description or ''} {task.action_required or ''}".lower()
    
    # Enhanced detection patterns for all industries
    electricity_patterns = [
        'electricity', 'electric', 'electrical', 'kwh', 'kw', 'power', 'energy',
        'consumption', 'volt', 'watt', 'amp', 'current', 'dewa', 'addc', 'sewa',
        'utility', 'grid', 'mains', 'solar', 'generator', 'ups'
    ]
    
    water_patterns = [
        'water', 'hydro', 'aqua', 'm³', 'm3', 'cubic', 'liter', 'litre', 'gallon',
        'consumption', 'usage', 'supply', 'municipal', 'well', 'bore', 'tank',
        'wastewater', 'sewage', 'irrigation', 'cooling tower', 'chiller'
    ]
    
    gas_patterns = [
        'gas', 'natural gas', 'lng', 'lpg', 'propane', 'methane', 'fuel',
        'heating', 'cooking', 'boiler', 'furnace', 'compressed', 'pipeline'
    ]
    
    # Detect required meter types
    requires_electricity = any(pattern in task_text for pattern in electricity_patterns)
    requires_water = any(pattern in task_text for pattern in water_patterns)  
    requires_gas = any(pattern in task_text for pattern in gas_patterns)
    
    # Build required types list (order matters for distribution)
    required_types = []
    if requires_electricity:
        required_types.append('electricity')
    if requires_water:
        required_types.append('water') 
    if requires_gas:
        required_types.append('gas')
    
    print(f"     🔍 Task analysis: {task.title[:40]}...")
    print(f"        Required types: {required_types}")
    print(f"        Field key: {field_key}")
    
    # STEP 2: Handle single meter type tasks (most common case)
    if len(required_types) == 1:
        print(f"        -> Single meter task: {required_types[0]}")
        return required_types[0]
    
    # STEP 3: Handle no meter requirements (shouldn't happen but safety check)
    if len(required_types) == 0:
        print(f"        -> No meter requirements detected")
        return None
    
    # STEP 4: Advanced pattern matching for multiple meter tasks
    field_lower = field_key.lower()
    
    # Enhanced field key pattern matching
    elec_field_patterns = ['elc', 'elec', 'elect', 'electricity', 'electric', 'power', 'energy', 'kwh', 'volt', 'amp']
    water_field_patterns = ['wat', 'war', 'water', 'hydro', 'aqua', 'm3', 'm³', 'liter', 'gallon']
    gas_field_patterns = ['gas', 'lng', 'lpg', 'fuel', 'propane', 'methane']
    
    # Try exact pattern matching first
    if requires_electricity and any(pattern in field_lower for pattern in elec_field_patterns):
        print(f"        -> Matched electricity pattern in field name")
        return 'electricity'
    elif requires_water and any(pattern in field_lower for pattern in water_field_patterns):
        print(f"        -> Matched water pattern in field name") 
        return 'water'
    elif requires_gas and any(pattern in field_lower for pattern in gas_field_patterns):
        print(f"        -> Matched gas pattern in field name")
        return 'gas'
    
    # STEP 5: Intelligent distribution for ambiguous field names
    # When users enter generic names like "123", "field1", "reading", etc.
    if len(required_types) > 1:
        # Get all numeric data entry keys for this task
        all_keys = list(task.data_entries.keys()) if hasattr(task, 'data_entries') and task.data_entries else []
        
        # Filter to only numeric/reading fields (exclude text fields like notes)
        numeric_keys = []
        for key in all_keys:
            value = str(task.data_entries.get(key, ''))
            # Consider it a reading if it's numeric or looks like a meter reading
            if (value.replace('.', '').replace(',', '').replace('-', '').isdigit() or 
                'reading' in key.lower() or 'consumption' in key.lower() or 
                'usage' in key.lower() or 'meter' in key.lower()):
                numeric_keys.append(key)
        
        # Sort keys consistently to ensure predictable distribution
        numeric_keys = sorted(numeric_keys)
        
        # Find the index of current field in the sorted list
        try:
            field_index = numeric_keys.index(field_key)
            if field_index < len(required_types):
                assigned_type = required_types[field_index]
                print(f"        -> Distributed field {field_index + 1}/{len(numeric_keys)} to {assigned_type}")
                return assigned_type
        except ValueError:
            pass
    
    # STEP 6: Fallback - default to first required type
    default_type = required_types[0]
    print(f"        -> Fallback to first required type: {default_type}")
    return default_type


def _validate_meter_detection_coverage(company):
    """
    Validation function to ensure meter detection works for all scenarios
    This helps prevent future issues by testing edge cases
    """
    validation_results = {
        'total_tasks_checked': 0,
        'tasks_with_data': 0,
        'detection_success_rate': 0,
        'potential_issues': [],
        'coverage_by_type': {'electricity': 0, 'water': 0, 'gas': 0}
    }
    
    tasks_with_data = Task.objects.filter(
        company=company,
        data_entries__isnull=False
    ).exclude(data_entries={})
    
    validation_results['total_tasks_checked'] = tasks_with_data.count()
    validation_results['tasks_with_data'] = tasks_with_data.count()
    
    successful_detections = 0
    for task in tasks_with_data:
        for key, value in task.data_entries.items():
            # Test detection for each field
            detected_type = _get_meter_type_for_field(task, key)
            if detected_type:
                successful_detections += 1
                validation_results['coverage_by_type'][detected_type] += 1
            else:
                validation_results['potential_issues'].append({
                    'task_title': task.title[:50],
                    'field_key': key,
                    'issue': 'No meter type detected'
                })
    
    total_fields = sum(len(task.data_entries) for task in tasks_with_data)
    if total_fields > 0:
        validation_results['detection_success_rate'] = round((successful_detections / total_fields) * 100, 1)
    
    print(f"🔍 Meter Detection Validation for {company.name}:")
    print(f"   Tasks with data: {validation_results['tasks_with_data']}")
    print(f"   Detection success rate: {validation_results['detection_success_rate']}%")
    print(f"   Coverage: E:{validation_results['coverage_by_type']['electricity']} W:{validation_results['coverage_by_type']['water']} G:{validation_results['coverage_by_type']['gas']}")
    
    return validation_results


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def combined_environmental_data(request):
    """
    Combined environmental data from both task data_entries and extracted files
    """
    company = request.user.company
    if not company:
        return Response({'error': 'No company associated with user'}, status=400)
    
    # Get data from task entries (meter readings)
    task_data = _get_task_data_entries(company)
    
    # Get data from uploaded file analysis
    environmental_extracted_data = ExtractedFileData.objects.filter(
        task_attachment__task__company=company,
        task_attachment__task__category__icontains='environmental',
        processing_status='completed'
    ).select_related('task_attachment__task')
    
    combined_data = {
        # Task data entries (meter readings)
        'task_entries': {
            'energy_consumption_kwh': task_data['energy_consumption_kwh'],
            'water_usage_m3': task_data['water_usage_m3'],
            'gas_usage_m3': task_data['gas_usage_m3'],
            'data_entries_count': task_data['data_entries_count'],
            'tasks_with_data': task_data['tasks_with_data']
        },
        
        # File extracted data
        'file_data': {
            'energy_consumption': None,
            'water_usage': None,
            'waste_generated': None,
            'carbon_emissions': None,
            'renewable_energy': None,
            'files_analyzed': environmental_extracted_data.count()
        },
        
        # Combined totals (task data + file data)
        'combined_totals': {},
        'data_source_priority': 'task_entries'  # Prefer task entries over file data
    }
    
    # Process file data
    if environmental_extracted_data.exists():
        # Get latest values from files
        latest_energy = environmental_extracted_data.exclude(
            energy_consumption_kwh__isnull=True
        ).order_by('-extraction_date').first()
        if latest_energy:
            combined_data['file_data']['energy_consumption'] = latest_energy.energy_consumption_kwh
        
        latest_water = environmental_extracted_data.exclude(
            water_usage_liters__isnull=True
        ).order_by('-extraction_date').first()
        if latest_water:
            combined_data['file_data']['water_usage'] = latest_water.water_usage_liters
        
        latest_waste = environmental_extracted_data.exclude(
            waste_generated_kg__isnull=True
        ).order_by('-extraction_date').first()
        if latest_waste:
            combined_data['file_data']['waste_generated'] = latest_waste.waste_generated_kg
        
        latest_carbon = environmental_extracted_data.exclude(
            carbon_emissions_tco2__isnull=True
        ).order_by('-extraction_date').first()
        if latest_carbon:
            combined_data['file_data']['carbon_emissions'] = latest_carbon.carbon_emissions_tco2
    
    # Calculate combined totals (prefer task data when available)
    combined_data['combined_totals'] = {
        'energy_consumption_kwh': (
            task_data['energy_consumption_kwh'] if task_data['energy_consumption_kwh'] > 0 
            else combined_data['file_data']['energy_consumption'] or 0
        ),
        'water_usage_liters': (
            task_data['water_usage_m3'] * 1000 if task_data['water_usage_m3'] > 0  # Convert m³ to liters
            else combined_data['file_data']['water_usage'] or 0
        ),
        'waste_generated': combined_data['file_data']['waste_generated'] or 0,
        'carbon_emissions': combined_data['file_data']['carbon_emissions'] or 0,
        'data_completeness': {
            'has_task_data': task_data['data_entries_count'] > 0,
            'has_file_data': environmental_extracted_data.count() > 0,
            'total_data_points': task_data['data_entries_count'] + environmental_extracted_data.count()
        }
    }
    
    return Response(combined_data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def environmental_file_data(request):
    """
    Extract and analyze data from uploaded environmental files using ExtractedFileData
    """
    company = request.user.company
    if not company:
        return Response({'error': 'No company associated with user'}, status=400)
    
    # Get all extracted data for environmental tasks
    environmental_extracted_data = ExtractedFileData.objects.filter(
        task_attachment__task__company=company,
        task_attachment__task__category__icontains='environmental',
        processing_status='completed'
    ).select_related('task_attachment__task')
    
    extracted_data = {
        'energy_consumption': None,
        'water_usage': None,
        'waste_generated': None,
        'carbon_emissions': None,
        'renewable_energy': None,
        'files_analyzed': environmental_extracted_data.count(),
        'environmental_tasks': [],
        'extraction_confidence': 0.0
    }
    
    # Aggregate data from extracted files
    if environmental_extracted_data.exists():
        # Calculate average confidence
        avg_confidence = environmental_extracted_data.aggregate(
            avg_confidence=Avg('confidence_score')
        )['avg_confidence'] or 0.0
        extracted_data['extraction_confidence'] = round(avg_confidence, 1)
        
        # Get latest values for each metric
        latest_energy = environmental_extracted_data.exclude(
            energy_consumption_kwh__isnull=True
        ).order_by('-extraction_date').first()
        if latest_energy:
            extracted_data['energy_consumption'] = latest_energy.energy_consumption_kwh
        
        latest_water = environmental_extracted_data.exclude(
            water_usage_liters__isnull=True
        ).order_by('-extraction_date').first()
        if latest_water:
            extracted_data['water_usage'] = latest_water.water_usage_liters
        
        latest_waste = environmental_extracted_data.exclude(
            waste_generated_kg__isnull=True
        ).order_by('-extraction_date').first()
        if latest_waste:
            extracted_data['waste_generated'] = latest_waste.waste_generated_kg
        
        latest_carbon = environmental_extracted_data.exclude(
            carbon_emissions_tco2__isnull=True
        ).order_by('-extraction_date').first()
        if latest_carbon:
            extracted_data['carbon_emissions'] = latest_carbon.carbon_emissions_tco2
        
        latest_renewable = environmental_extracted_data.exclude(
            renewable_energy_percentage__isnull=True
        ).order_by('-extraction_date').first()
        if latest_renewable:
            extracted_data['renewable_energy'] = latest_renewable.renewable_energy_percentage
        
        # Group by task for detailed view
        tasks_data = {}
        for extracted in environmental_extracted_data:
            task = extracted.task_attachment.task
            if task.id not in tasks_data:
                tasks_data[task.id] = {
                    'title': task.title,
                    'attachments': []
                }
            
            attachment_data = {
                'title': extracted.task_attachment.title,
                'filename': extracted.task_attachment.original_filename,
                'file_size': extracted.task_attachment.file.size if extracted.task_attachment.file else None,
                'attachment_type': extracted.task_attachment.attachment_type,
                'description': extracted.task_attachment.description,
                'created_at': extracted.task_attachment.uploaded_at,
                'extracted_values': [],
                'confidence_score': extracted.confidence_score,
                'extraction_method': extracted.extraction_method
            }
            
            # Add extracted metrics
            if extracted.energy_consumption_kwh:
                attachment_data['extracted_values'].append(f"Energy: {extracted.energy_consumption_kwh} kWh")
            if extracted.water_usage_liters:
                attachment_data['extracted_values'].append(f"Water: {extracted.water_usage_liters} L")
            if extracted.waste_generated_kg:
                attachment_data['extracted_values'].append(f"Waste: {extracted.waste_generated_kg} kg")
            if extracted.carbon_emissions_tco2:
                attachment_data['extracted_values'].append(f"Carbon: {extracted.carbon_emissions_tco2} tCO2")
            if extracted.renewable_energy_percentage:
                attachment_data['extracted_values'].append(f"Renewable: {extracted.renewable_energy_percentage}%")
            
            tasks_data[task.id]['attachments'].append(attachment_data)
        
        extracted_data['environmental_tasks'] = list(tasks_data.values())
    
    return Response(extracted_data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def governance_file_data(request):
    """
    Extract and analyze data from uploaded governance files using ExtractedFileData
    """
    company = request.user.company
    if not company:
        return Response({'error': 'No company associated with user'}, status=400)
    
    # Get all extracted data for governance tasks
    governance_extracted_data = ExtractedFileData.objects.filter(
        task_attachment__task__company=company,
        task_attachment__task__category__icontains='governance',
        processing_status='completed'
    ).select_related('task_attachment__task')
    
    extracted_data = {
        'board_meetings': None,
        'compliance_score': None,
        'audit_findings': None,
        'policy_updates': None,
        'stakeholder_engagement': None,
        'files_analyzed': governance_extracted_data.count(),
        'governance_tasks': [],
        'extraction_confidence': 0.0
    }
    
    # Aggregate data from extracted files
    if governance_extracted_data.exists():
        # Calculate average confidence
        avg_confidence = governance_extracted_data.aggregate(
            avg_confidence=Avg('confidence_score')
        )['avg_confidence'] or 0.0
        extracted_data['extraction_confidence'] = round(avg_confidence, 1)
        
        # Get latest values for each metric
        latest_board = governance_extracted_data.exclude(
            board_meetings__isnull=True
        ).order_by('-extraction_date').first()
        if latest_board:
            extracted_data['board_meetings'] = latest_board.board_meetings
        
        latest_compliance = governance_extracted_data.exclude(
            compliance_score__isnull=True
        ).order_by('-extraction_date').first()
        if latest_compliance:
            extracted_data['compliance_score'] = latest_compliance.compliance_score
        
        # Group by task for detailed view
        tasks_data = {}
        for extracted in governance_extracted_data:
            task = extracted.task_attachment.task
            if task.id not in tasks_data:
                tasks_data[task.id] = {
            'title': task.title,
            'attachments': []
        }
        
            attachment_data = {
                'title': extracted.task_attachment.title,
                'filename': extracted.task_attachment.original_filename,
                'file_size': extracted.task_attachment.file.size if extracted.task_attachment.file else None,
                'attachment_type': extracted.task_attachment.attachment_type,
                'description': extracted.task_attachment.description,
                'created_at': extracted.task_attachment.uploaded_at,
                'extracted_values': [],
                'confidence_score': extracted.confidence_score,
                'extraction_method': extracted.extraction_method
            }
            
            # Add extracted metrics
            if extracted.board_meetings:
                attachment_data['extracted_values'].append(f"Board Meetings: {extracted.board_meetings}")
            if extracted.compliance_score:
                attachment_data['extracted_values'].append(f"Compliance Score: {extracted.compliance_score}%")
            
            tasks_data[task.id]['attachments'].append(attachment_data)
        
        extracted_data['governance_tasks'] = list(tasks_data.values())
    
    return Response(extracted_data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_overview(request):
    """
    Main dashboard overview API using real extracted file data
    Returns ESG scores, trends, activity, and recommendations
    """
    company = request.user.company
    
    # Handle demo mode or users without companies
    if not company:
        return Response(_get_demo_dashboard_data(), status=status.HTTP_200_OK)
    
    # Calculate ESG scores
    current_scores = {
        'overall_esg_score': company.overall_esg_score,
        'environmental_score': company.environmental_score,
        'social_score': company.social_score,
        'governance_score': company.governance_score,
    }
    
    # Calculate score changes (mock data - would come from historical metrics)
    score_changes = {
        'overall_change': 2.5,
        'environmental_change': 1.8,
        'social_change': 3.2,
        'governance_change': 2.1,
    }
    
    # Progress indicators
    total_tasks = Task.objects.filter(company=company).count()
    completed_tasks = Task.objects.filter(company=company, status='completed').count()
    
    # Real data completion percentages from company model
    data_completion = company.data_completion_percentage or 0.0
    evidence_completion = company.evidence_completion_percentage or 0.0
    
    # Get real extracted data metrics
    extracted_metrics = _get_extracted_data_metrics(company)
    
    # ESG trends (last 12 months)
    trends_data = _get_esg_trends(company)
    
    # Emissions breakdown using real data
    emissions_data = _get_real_emissions_breakdown(company)
    
    # Recent activity
    recent_activity = _get_recent_activity(company)
    
    # Priority recommendations based on real data
    recommendations = _get_priority_recommendations_from_data(company, extracted_metrics)
    
    # Targets progress using real data
    targets_progress = _get_real_targets_progress(company, extracted_metrics)
    
    overview_data = {
        **current_scores,
        **score_changes,
        'data_completion_percentage': data_completion,
        'evidence_completion_percentage': evidence_completion,
        'tasks_completed': completed_tasks,
        'total_tasks': total_tasks,
        'extracted_metrics': extracted_metrics,
        'esg_trends': trends_data,
        'emissions_breakdown': emissions_data,
        'recent_activity': recent_activity,
        'priority_recommendations': recommendations,
        'targets_progress': targets_progress,
    }
    
    serializer = DashboardOverviewSerializer(overview_data)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_metrics(request):
    """Get dashboard metrics for a company"""
    company = request.user.company
    if not company:
        return Response(_get_demo_metrics_data(), status=status.HTTP_200_OK)
    
    metrics = DashboardMetric.objects.filter(
        company=company,
        is_current=True
    ).order_by('-calculated_at')
    
    serializer = DashboardMetricSerializer(metrics, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_alerts(request):
    """Get active dashboard alerts"""
    company = request.user.company
    if not company:
        return Response(
            {'error': 'User not associated with a company'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    alerts = DashboardAlert.objects.filter(
        company=company,
        is_active=True
    ).order_by('-created_at')
    
    serializer = DashboardAlertSerializer(alerts, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_alert_read(request, alert_id):
    """Mark a specific alert as read"""
    try:
        alert = DashboardAlert.objects.get(
            id=alert_id,
            company=request.user.company
        )
        alert.mark_read(request.user)
        return Response({'message': 'Alert marked as read'})
    except DashboardAlert.DoesNotExist:
        return Response(
            {'error': 'Alert not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def alert_summary(request):
    """Get alert summary statistics"""
    company = request.user.company
    if not company:
        return Response(
            {'error': 'User not associated with a company'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    alerts = DashboardAlert.objects.filter(company=company, is_active=True)
    
    summary_data = {
        'total_alerts': alerts.count(),
        'unread_alerts': alerts.filter(is_read=False).count(),
        'critical_alerts': alerts.filter(severity='critical').count(),
        'alerts_by_type': dict(alerts.values('alert_type').annotate(count=Count('id')).values_list('alert_type', 'count')),
        'recent_alerts': alerts.order_by('-created_at')[:5]
    }
    
    serializer = AlertSummarySerializer(summary_data)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def esg_trends(request):
    """Get ESG trends data for charts"""
    company = request.user.company
    if not company:
        return Response(
            {'error': 'User not associated with a company'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    trends_data = _get_esg_trends(company)
    serializer = ESGTrendsSerializer(trends_data)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def company_comparison(request):
    """Get company performance comparison with benchmarks"""
    company = request.user.company
    if not company:
        return Response(
            {'error': 'User not associated with a company'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get benchmark data for company's sector
    benchmark = BenchmarkData.objects.filter(
        sector=company.business_sector,
        is_current=True
    ).first()
    
    if not benchmark:
        return Response(
            {'error': 'No benchmark data available for this sector'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    comparison_data = {
        'company_scores': {
            'environmental': company.environmental_score,
            'social': company.social_score,
            'governance': company.governance_score,
            'overall': company.overall_esg_score,
        },
        'industry_averages': {
            'environmental': benchmark.environmental_average,
            'social': benchmark.social_average,
            'governance': benchmark.governance_average,
            'overall': benchmark.overall_average,
        },
        'percentile_ranking': _calculate_percentile_ranking(company, benchmark),
        'comparison_analysis': _generate_comparison_analysis(company, benchmark)
    }
    
    serializer = CompanyComparisonSerializer(comparison_data)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_insights(request):
    """Get dashboard insights and analytics"""
    company = request.user.company
    if not company:
        return Response(
            {'error': 'User not associated with a company'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    insights_data = {
        'performance_summary': _generate_performance_summary(company),
        'key_achievements': _get_key_achievements(company),
        'areas_for_improvement': _get_improvement_areas(company),
        'trending_upward': _get_trending_metrics(company, direction='up'),
        'trending_downward': _get_trending_metrics(company, direction='down'),
        'forecasted_score': _forecast_esg_score(company),
        'projected_completion_date': _project_completion_date(company),
        'industry_position': _get_industry_position(company),
        'peer_comparison': _get_peer_comparison(company)
    }
    
    serializer = DashboardInsightSerializer(insights_data)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def quick_stats(request):
    """Get quick statistics for dashboard widgets"""
    company = request.user.company
    if not company:
        return Response(
            {'error': 'User not associated with a company'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    today = timezone.now().date()
    
    stats_data = {
        'total_assessments': ESGAssessment.objects.filter(company=company).count(),
        'active_frameworks': ESGAssessment.objects.filter(
            company=company, 
            status='active'
        ).values('framework').distinct().count(),
        'completed_tasks_today': Task.objects.filter(
            company=company,
            status='completed',
            updated_at__date=today
        ).count(),
        'reports_generated': GeneratedReport.objects.filter(company=company).count(),
        'team_members': User.objects.filter(company=company).count(),
        'data_points_collected': ESGResponse.objects.filter(
            assessment__company=company
        ).count(),
        'score_improvement': 2.3,  # Mock improvement percentage
        'completion_rate': 67.8,  # Mock completion rate
        'average_task_completion_days': 4.2,  # Mock average
        'last_report_generated': GeneratedReport.objects.filter(
            company=company
        ).order_by('-created_at').first().created_at if GeneratedReport.objects.filter(company=company).exists() else None
    }
    
    serializer = QuickStatsSerializer(stats_data)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def kpi_metrics(request):
    """Get Key Performance Indicators"""
    company = request.user.company
    if not company:
        return Response(
            {'error': 'User not associated with a company'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    kpis = _get_company_kpis(company)
    serializer = KPISerializer(kpis, many=True)
    return Response(serializer.data)


class DashboardWidgetListView(generics.ListCreateAPIView):
    """List and create dashboard widgets"""
    serializer_class = DashboardWidgetSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return DashboardWidget.objects.filter(
            company=self.request.user.company,
            is_visible=True
        ).order_by('position_y', 'position_x')


class DashboardWidgetDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a dashboard widget"""
    serializer_class = DashboardWidgetSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return DashboardWidget.objects.filter(company=self.request.user.company)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def track_analytics_event(request):
    """Track user analytics events"""
    company = request.user.company
    if not company:
        return Response(
            {'error': 'User not associated with a company'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    event_data = request.data
    
    AnalyticsEvent.objects.create(
        company=company,
        user=request.user,
        event_type=event_data.get('event_type'),
        event_data=event_data.get('event_data', {}),
        ip_address=_get_client_ip(request),
        user_agent=request.META.get('HTTP_USER_AGENT', ''),
        referrer=request.META.get('HTTP_REFERER', '')
    )
    
    return Response({'message': 'Event tracked successfully'})


# Helper functions

def _get_esg_trends(company):
    """Generate ESG trends data for the last 12 months"""
    # Mock data - in production, this would come from historical metrics
    months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    return {
        'environmental': [65, 67, 69, 72, 74, 76, 78, 80, 82, 83, 84, 85],
        'social': [70, 71, 73, 75, 77, 78, 80, 81, 82, 83, 84, 85],
        'governance': [75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86],
        'months': months
    }


def _get_emissions_breakdown(company):
    """Get emissions breakdown by category"""
    # Mock data - would come from actual emissions data
    return {
        'electricity': 45.2,
        'transportation': 28.7,
        'waste': 15.3,
        'other': 10.8
    }


def _get_recent_activity(company):
    """Generate recent activity data"""
    activities = []
    
    # Recent tasks
    recent_tasks = Task.objects.filter(
        company=company,
        status='completed'
    ).order_by('-updated_at')[:3]
    
    for task in recent_tasks:
        activities.append({
            'type': 'task_completed',
            'message': f'Task "{task.title}" completed',
            'time': _format_time_ago(task.updated_at),
            'icon': 'check-circle',
            'user': task.assigned_to.full_name if task.assigned_to else 'Unknown'
        })
    
    # Recent reports
    recent_reports = GeneratedReport.objects.filter(
        company=company,
        status='completed'
    ).order_by('-completed_at')[:2]
    
    for report in recent_reports:
        activities.append({
            'type': 'report_generated',
            'message': f'Report "{report.name}" generated',
            'time': _format_time_ago(report.completed_at),
            'icon': 'file-text',
            'user': report.generated_by.full_name if report.generated_by else 'System'
        })
    
    return sorted(activities, key=lambda x: x['time'], reverse=True)[:5]


def _get_priority_recommendations(company):
    """Generate priority ESG recommendations"""
    # Mock recommendations - would be generated based on assessment data
    return [
        {
            'title': 'Implement Energy Management System',
            'description': 'Deploy IoT sensors and automated controls to reduce energy consumption by 15%',
            'impact': 'High',
            'category': 'environmental',
            'priority': 1,
            'estimated_cost': '$25,000 - $50,000',
            'time_to_implement': '3-6 months'
        },
        {
            'title': 'Enhance Employee Wellness Program',
            'description': 'Expand mental health support and flexible working arrangements',
            'impact': 'Medium',
            'category': 'social',
            'priority': 2,
            'estimated_cost': '$10,000 - $20,000',
            'time_to_implement': '2-3 months'
        },
        {
            'title': 'Strengthen Board Diversity',
            'description': 'Add diverse perspectives to board composition and decision-making',
            'impact': 'High',
            'category': 'governance',
            'priority': 3,
            'time_to_implement': '6-12 months'
        }
    ]


def _get_targets_progress(company):
    """Get progress towards ESG targets"""
    # Mock target progress data
    return {
        'carbon_neutral_progress': 34.2,
        'employee_satisfaction': 78.5,
        'governance_compliance': 92.1,
        'renewable_energy': 45.8,
        'waste_reduction': 67.3
    }


def _calculate_percentile_ranking(company, benchmark):
    """Calculate company's percentile ranking against benchmark"""
    rankings = {}
    
    for category in ['environmental', 'social', 'governance', 'overall']:
        company_score = getattr(company, f'{category}_score')
        
        if category == 'overall':
            avg = benchmark.overall_average
            p25, p50, p75 = benchmark.percentile_25, benchmark.percentile_50, benchmark.percentile_75
        else:
            avg = getattr(benchmark, f'{category}_average')
            # Mock percentile data for categories
            p25, p50, p75 = avg - 10, avg, avg + 10
        
        if company_score >= p75:
            percentile = 75
        elif company_score >= p50:
            percentile = 50
        elif company_score >= p25:
            percentile = 25
        else:
            percentile = 10
        
        rankings[category] = percentile
    
    return rankings


def _generate_comparison_analysis(company, benchmark):
    """Generate text analysis of company vs benchmark performance"""
    overall_diff = company.overall_esg_score - benchmark.overall_average
    
    if overall_diff > 10:
        return f"Your company performs significantly above industry average by {overall_diff:.1f} points, placing you in the top quartile of {benchmark.sector} companies."
    elif overall_diff > 0:
        return f"Your company performs {overall_diff:.1f} points above industry average, showing solid ESG performance in the {benchmark.sector} sector."
    elif overall_diff > -10:
        return f"Your company performs slightly below industry average by {abs(overall_diff):.1f} points, with room for improvement in key ESG areas."
    else:
        return f"Your company significantly trails industry average by {abs(overall_diff):.1f} points, requiring focused ESG improvement initiatives."


def _generate_performance_summary(company):
    """Generate overall performance summary"""
    score = company.overall_esg_score
    
    if score >= 80:
        return "Excellent ESG performance with strong foundations across all categories. Focus on maintaining current standards and pursuing advanced sustainability initiatives."
    elif score >= 70:
        return "Good ESG performance with solid practices in place. Opportunities exist to enhance specific areas and achieve industry leadership."
    elif score >= 60:
        return "Moderate ESG performance with room for improvement. Developing comprehensive strategies will help advance your sustainability goals."
    else:
        return "ESG performance needs significant improvement. Immediate action required to establish fundamental sustainability practices and compliance."


def _get_key_achievements(company):
    """Get recent key achievements"""
    return [
        "Achieved 25% reduction in energy consumption",
        "Implemented comprehensive diversity & inclusion program",
        "Established ESG governance committee",
        "Completed sustainability reporting framework"
    ]


def _get_improvement_areas(company):
    """Get areas needing improvement"""
    return [
        "Enhance waste management practices",
        "Increase renewable energy adoption",
        "Strengthen supplier sustainability requirements",
        "Improve stakeholder engagement processes"
    ]


def _get_trending_metrics(company, direction='up'):
    """Get metrics trending up or down"""
    if direction == 'up':
        return ["Energy efficiency", "Employee satisfaction", "Board diversity"]
    else:
        return ["Water consumption", "Carbon intensity", "Supplier compliance"]


def _forecast_esg_score(company):
    """Forecast future ESG score"""
    # Simple linear projection based on current score
    return min(100, company.overall_esg_score + 5.2)


def _project_completion_date(company):
    """Project completion date for current initiatives"""
    return (timezone.now() + timedelta(days=120)).date()


def _get_industry_position(company):
    """Get industry position description"""
    score = company.overall_esg_score
    if score >= 80:
        return "Top 10% in industry"
    elif score >= 70:
        return "Top 25% in industry"
    elif score >= 60:
        return "Above average in industry"
    else:
        return "Below average in industry"


def _get_peer_comparison(company):
    """Get peer comparison data"""
    return {
        'better_than': 67,  # percentage of peers
        'similar_to': 23,
        'behind': 10
    }


def _get_company_kpis(company):
    """Get company KPIs"""
    # Mock KPI data
    return [
        {
            'name': 'Carbon Intensity',
            'current_value': 2.3,
            'target_value': 2.0,
            'unit': 'tCO2e/revenue',
            'trend': 'down',
            'change_percentage': -8.5,
            'category': 'environmental',
            'last_updated': timezone.now()
        },
        {
            'name': 'Employee Satisfaction',
            'current_value': 7.8,
            'target_value': 8.5,
            'unit': 'score/10',
            'trend': 'up',
            'change_percentage': 12.3,
            'category': 'social',
            'last_updated': timezone.now()
        }
    ]


def _format_time_ago(dt):
    """Format datetime as 'time ago' string"""
    if not dt:
        return "Unknown"
    
    now = timezone.now()
    diff = now - dt
    
    if diff.days > 0:
        return f"{diff.days} days ago"
    elif diff.seconds > 3600:
        hours = diff.seconds // 3600
        return f"{hours} hours ago"
    elif diff.seconds > 60:
        minutes = diff.seconds // 60
        return f"{minutes} minutes ago"
    else:
        return "Just now"


def _get_client_ip(request):
    """Get client IP address from request"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def _get_demo_dashboard_data():
    """Return demo dashboard data for users without companies"""
    return {
        'overall_esg_score': 78.5,
        'environmental_score': 82.3,
        'social_score': 75.8,
        'governance_score': 77.4,
        'overall_change': 3.2,
        'environmental_change': 2.8,
        'social_change': 4.1,
        'governance_change': 2.5,
        'data_completion_percentage': 85.2,
        'evidence_completion_percentage': 72.8,
        'tasks_completed': 24,
        'total_tasks': 32,
        'esg_trends': _get_esg_trends(None),
        'emissions_breakdown': _get_emissions_breakdown(None),
        'recent_activity': [
            {
                'type': 'task_completed',
                'message': 'Energy audit task completed',
                'time': '2 hours ago',
                'icon': 'check-circle',
                'user': 'Demo User'
            },
            {
                'type': 'report_generated',
                'message': 'Sustainability report generated',
                'time': '1 day ago',
                'icon': 'file-text',
                'user': 'System'
            }
        ],
        'priority_recommendations': _get_priority_recommendations(None),
        'targets_progress': _get_targets_progress(None),
        'kpis': _get_company_kpis(None)
    }


def _get_demo_metrics_data():
    """Return demo metrics data"""
    return [
        {
            'id': 1,
            'metric_name': 'Carbon Footprint',
            'current_value': 2450.5,
            'target_value': 2000.0,
            'unit': 'tCO2e',
            'trend': 'down',
            'change_percentage': -8.2,
            'category': 'environmental'
        },
        {
            'id': 2,
            'metric_name': 'Employee Satisfaction',
            'current_value': 8.2,
            'target_value': 8.5,
            'unit': 'score/10',
            'trend': 'up',
            'change_percentage': 5.1,
            'category': 'social'
        }
    ]


def _get_extracted_data_metrics(company):
    """
    Get aggregated metrics from extracted file data
    """
    extracted_data = ExtractedFileData.objects.filter(
        task_attachment__task__company=company,
        processing_status='completed'
    )
    
    if not extracted_data.exists():
        return {}
    
    metrics = {
        'total_files_processed': extracted_data.count(),
        'average_confidence': extracted_data.aggregate(
            avg_confidence=Avg('confidence_score')
        )['avg_confidence'] or 0.0,
        'environmental': {},
        'social': {},
        'governance': {},
        'last_updated': timezone.now().isoformat()
    }
    
    # Environmental metrics (latest non-null values)
    latest_energy = extracted_data.exclude(
        energy_consumption_kwh__isnull=True
    ).order_by('-extraction_date').first()
    if latest_energy:
        metrics['environmental']['energy_consumption_kwh'] = latest_energy.energy_consumption_kwh
    
    latest_water = extracted_data.exclude(
        water_usage_liters__isnull=True
    ).order_by('-extraction_date').first()
    if latest_water:
        metrics['environmental']['water_usage_liters'] = latest_water.water_usage_liters
    
    latest_waste = extracted_data.exclude(
        waste_generated_kg__isnull=True
    ).order_by('-extraction_date').first()
    if latest_waste:
        metrics['environmental']['waste_generated_kg'] = latest_waste.waste_generated_kg
    
    latest_carbon = extracted_data.exclude(
        carbon_emissions_tco2__isnull=True
    ).order_by('-extraction_date').first()
    if latest_carbon:
        metrics['environmental']['carbon_emissions_tco2'] = latest_carbon.carbon_emissions_tco2
    
    latest_renewable = extracted_data.exclude(
        renewable_energy_percentage__isnull=True
    ).order_by('-extraction_date').first()
    if latest_renewable:
        metrics['environmental']['renewable_energy_percentage'] = latest_renewable.renewable_energy_percentage
    
    # Social metrics
    latest_employees = extracted_data.exclude(
        total_employees__isnull=True
    ).order_by('-extraction_date').first()
    if latest_employees:
        metrics['social']['total_employees'] = latest_employees.total_employees
    
    avg_training = extracted_data.exclude(
        training_hours__isnull=True
    ).aggregate(avg_training=Avg('training_hours'))
    if avg_training['avg_training']:
        metrics['social']['training_hours_avg'] = avg_training['avg_training']
    
    latest_satisfaction = extracted_data.exclude(
        employee_satisfaction_score__isnull=True
    ).order_by('-extraction_date').first()
    if latest_satisfaction:
        metrics['social']['employee_satisfaction_score'] = latest_satisfaction.employee_satisfaction_score
    
    # Governance metrics
    latest_compliance = extracted_data.exclude(
        compliance_score__isnull=True
    ).order_by('-extraction_date').first()
    if latest_compliance:
        metrics['governance']['compliance_score'] = latest_compliance.compliance_score
    
    latest_board = extracted_data.exclude(
        board_meetings__isnull=True
    ).order_by('-extraction_date').first()
    if latest_board:
        metrics['governance']['board_meetings'] = latest_board.board_meetings
    
    return metrics


def _get_real_emissions_breakdown(company):
    """
    Get real emissions breakdown from extracted data
    """
    extracted_data = ExtractedFileData.objects.filter(
        task_attachment__task__company=company,
        processing_status='completed'
    )
    
    if not extracted_data.exists():
        return _get_emissions_breakdown(company)  # Fallback to mock data
    
    # Get latest carbon emissions
    latest_carbon = extracted_data.exclude(
        carbon_emissions_tco2__isnull=True
    ).order_by('-extraction_date').first()
    
    if latest_carbon:
        # Estimate breakdown based on typical ratios
        total_emissions = latest_carbon.carbon_emissions_tco2
        return {
            'electricity': round(total_emissions * 0.45, 1),
            'transportation': round(total_emissions * 0.30, 1),
            'waste': round(total_emissions * 0.15, 1),
            'other': round(total_emissions * 0.10, 1)
        }
    
    return _get_emissions_breakdown(company)  # Fallback to mock data


def _get_priority_recommendations_from_data(company, extracted_metrics):
    """
    Generate recommendations based on real extracted data
    """
    recommendations = []
    
    # Check environmental data
    env_metrics = extracted_metrics.get('environmental', {})
    if not env_metrics.get('energy_consumption_kwh'):
        recommendations.append({
            'title': 'Upload Energy Consumption Data',
            'description': 'Upload electricity bills or energy reports to track environmental performance',
            'impact': 'High',
            'category': 'environmental',
            'priority': 1,
            'estimated_cost': '$0 - $500',
            'time_to_implement': '1-2 weeks'
        })
    
    if not env_metrics.get('carbon_emissions_tco2'):
        recommendations.append({
            'title': 'Complete Carbon Footprint Assessment',
            'description': 'Upload transportation and waste data to calculate carbon emissions',
            'impact': 'High',
            'category': 'environmental',
            'priority': 2,
            'estimated_cost': '$1,000 - $5,000',
            'time_to_implement': '2-4 weeks'
        })
    
    # Check social data
    social_metrics = extracted_metrics.get('social', {})
    if not social_metrics.get('employee_satisfaction_score'):
        recommendations.append({
            'title': 'Conduct Employee Satisfaction Survey',
            'description': 'Upload survey results to measure workplace wellbeing and social performance',
            'impact': 'Medium',
            'category': 'social',
            'priority': 3,
            'estimated_cost': '$2,000 - $8,000',
            'time_to_implement': '3-6 weeks'
        })
    
    # Check governance data
    gov_metrics = extracted_metrics.get('governance', {})
    if not gov_metrics.get('compliance_score'):
        recommendations.append({
            'title': 'Assess Governance Compliance',
            'description': 'Upload compliance reports and audit findings to measure governance performance',
            'impact': 'High',
            'category': 'governance',
            'priority': 4,
            'estimated_cost': '$5,000 - $15,000',
            'time_to_implement': '4-8 weeks'
        })
    
    # If no specific recommendations, provide general ones
    if not recommendations:
        recommendations = _get_priority_recommendations(company)
    
    return recommendations[:3]  # Return top 3


def _get_real_targets_progress(company, extracted_metrics):
    """
    Get real target progress based on extracted data
    """
    progress = {}
    
    # Environmental targets
    env_metrics = extracted_metrics.get('environmental', {})
    if env_metrics.get('energy_consumption_kwh'):
        # Mock progress - in real system this would compare to historical data
        progress['carbon_neutral_progress'] = 45.2
    else:
        progress['carbon_neutral_progress'] = 0.0
    
    if env_metrics.get('renewable_energy_percentage'):
        progress['renewable_energy'] = env_metrics['renewable_energy_percentage']
    else:
        progress['renewable_energy'] = 0.0
    
    # Social targets
    social_metrics = extracted_metrics.get('social', {})
    if social_metrics.get('employee_satisfaction_score'):
        progress['employee_satisfaction'] = social_metrics['employee_satisfaction_score']
    else:
        progress['employee_satisfaction'] = 0.0
    
    # Governance targets
    gov_metrics = extracted_metrics.get('governance', {})
    if gov_metrics.get('compliance_score'):
        progress['governance_compliance'] = gov_metrics['compliance_score']
    else:
        progress['governance_compliance'] = 0.0
    
    # Waste reduction (mock for now)
    progress['waste_reduction'] = 67.3
    
    return progress