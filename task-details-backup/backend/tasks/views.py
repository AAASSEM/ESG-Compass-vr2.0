from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q, Count, Avg
from datetime import timedelta
import logging

from .models import Task, TaskTemplate, TaskComment, TaskAttachment, TaskReminder
from .serializers import (
    TaskSerializer, TaskCreateSerializer, TaskUpdateSerializer,
    TaskTemplateSerializer, TaskCommentSerializer, TaskAttachmentSerializer,
    TaskStatsSerializer, NextStepsSerializer, TaskBulkActionSerializer,
    TaskReminderSerializer
)
from apps.authentication.models import User

logger = logging.getLogger(__name__)


class TaskViewSet(viewsets.ModelViewSet):
    """
    ViewSet for task management
    Handles all task CRUD operations and related actions
    """
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == 'create':
            return TaskCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return TaskUpdateSerializer
        return TaskSerializer
    
    def get_queryset(self):
        """Return tasks for user's company with filtering"""
        try:
            # Check if user is authenticated
            if not self.request.user or not self.request.user.is_authenticated:
                logger.warning("Unauthenticated user trying to access tasks")
                return Task.objects.none()
            
            # Check if user has a company
            if not hasattr(self.request.user, 'company') or not self.request.user.company:
                logger.warning(f"User {self.request.user.email} has no associated company")
                return Task.objects.none()
            
            queryset = Task.objects.filter(
                company=self.request.user.company
            ).select_related(
                'assigned_to', 'created_by', 'related_question', 'related_assessment'
            ).prefetch_related(
                'attachments', 'comments', 'progress_logs'
            ).order_by('-priority', '-created_at')
            
        except Exception as e:
            logger.error(f"Error in get_queryset: {e}")
            return Task.objects.none()
        
        # Apply filters
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        category_filter = self.request.query_params.get('category')
        if category_filter:
            queryset = queryset.filter(category=category_filter)
        
        assigned_to_filter = self.request.query_params.get('assigned_to')
        if assigned_to_filter:
            if assigned_to_filter == 'me':
                queryset = queryset.filter(assigned_to=self.request.user)
            else:
                queryset = queryset.filter(assigned_to_id=assigned_to_filter)
        
        priority_filter = self.request.query_params.get('priority')
        if priority_filter:
            queryset = queryset.filter(priority=priority_filter)
        
        overdue_filter = self.request.query_params.get('overdue')
        if overdue_filter == 'true':
            queryset = queryset.filter(
                due_date__lt=timezone.now(),
                status__in=['todo', 'in_progress']
            )
        
        return queryset
    
    def perform_create(self, serializer):
        """Set company and creator when creating task"""
        # Handle assigned_to_id
        assigned_to_id = serializer.validated_data.pop('assigned_to_id', None)
        assigned_to = None
        
        if assigned_to_id:
            try:
                assigned_to = User.objects.get(
                    id=assigned_to_id,
                    company=self.request.user.company
                )
            except User.DoesNotExist:
                pass
        
        serializer.save(
            company=self.request.user.company,
            created_by=self.request.user,
            assigned_to=assigned_to
        )
    
    @action(detail=True, methods=['post'])
    def mark_completed(self, request, pk=None):
        """Mark task as completed"""
        task = self.get_object()
        notes = request.data.get('notes', '')
        
        task.mark_completed(request.user, notes)
        
        # Add comment about completion
        TaskComment.objects.create(
            task=task,
            author=request.user,
            content=f"Task marked as completed. {notes}".strip(),
            is_status_update=True,
            old_status='in_progress',
            new_status='completed'
        )
        
        logger.info(f"Task {task.title} completed by {request.user.email}")
        
        return Response({
            'message': 'Task marked as completed',
            'task': TaskSerializer(task).data
        })
    
    @action(detail=True, methods=['post'])
    def mark_in_progress(self, request, pk=None):
        """Mark task as in progress"""
        task = self.get_object()
        
        task.mark_in_progress(request.user)
        
        # Add comment about status change
        TaskComment.objects.create(
            task=task,
            author=request.user,
            content="Task started",
            is_status_update=True,
            old_status='todo',
            new_status='in_progress'
        )
        
        return Response({
            'message': 'Task marked as in progress',
            'task': TaskSerializer(task).data
        })
    
    @action(detail=True, methods=['post'])
    def add_comment(self, request, pk=None):
        """Add comment to task"""
        task = self.get_object()
        content = request.data.get('content', '').strip()
        
        if not content:
            return Response({
                'error': 'Comment content is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        comment = TaskComment.objects.create(
            task=task,
            author=request.user,
            content=content
        )
        
        return Response({
            'message': 'Comment added successfully',
            'comment': TaskCommentSerializer(comment).data
        })
    
    @action(detail=True, methods=['get'])
    def attachments(self, request, pk=None):
        """Get all attachments for a task"""
        task = self.get_object()
        attachments = task.attachments.all()
        return Response({
            'attachments': TaskAttachmentSerializer(attachments, many=True).data
        })
    
    @action(detail=True, methods=['post'])
    def upload_attachment(self, request, pk=None):
        """Upload attachment to task"""
        task = self.get_object()
        
        if 'file' not in request.FILES:
            return Response({
                'error': 'No file provided'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        file = request.FILES['file']
        
        attachment = TaskAttachment.objects.create(
            task=task,
            file=file,
            original_filename=file.name,
            file_size=file.size,
            mime_type=file.content_type,
            title=request.data.get('title', ''),
            description=request.data.get('description', ''),
            attachment_type=request.data.get('attachment_type', 'evidence'),
            uploaded_by=request.user
        )
        
        # Update task to show it has evidence
        if attachment.attachment_type == 'evidence':
            task.progress_percentage = min(task.progress_percentage + 10, 100)
            task.save()
        
        return Response({
            'message': 'Attachment uploaded successfully',
            'attachment': TaskAttachmentSerializer(attachment).data
        })
    
    @action(detail=True, methods=['get', 'delete'], url_path='attachments/(?P<attachment_id>[^/.]+)')
    def attachment_detail(self, request, pk=None, attachment_id=None):
        """Get or delete individual attachment"""
        task = self.get_object()
        
        try:
            attachment = TaskAttachment.objects.get(
                id=attachment_id,
                task=task
            )
        except TaskAttachment.DoesNotExist:
            return Response({
                'error': 'Attachment not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        if request.method == 'GET':
            # Return attachment details
            return Response({
                'attachment': TaskAttachmentSerializer(attachment).data
            })
        
        elif request.method == 'DELETE':
            # Delete the file from storage
            if attachment.file:
                attachment.file.delete(save=False)
            
            # Delete the attachment record
            attachment.delete()
            
            return Response({
                'message': 'Attachment deleted successfully'
            })
    
    @action(detail=False, methods=['get'])
    def my_tasks(self, request):
        """Get tasks assigned to current user"""
        tasks = self.get_queryset().filter(assigned_to=request.user)
        
        # Group by status
        grouped_tasks = {
            'todo': [],
            'in_progress': [],
            'completed': [],
            'blocked': []
        }
        
        for task in tasks:
            task_data = TaskSerializer(task).data
            grouped_tasks[task.status].append(task_data)
        
        return Response({
            'tasks_by_status': grouped_tasks,
            'total_tasks': tasks.count(),
            'overdue_count': tasks.filter(
                due_date__lt=timezone.now(),
                status__in=['todo', 'in_progress']
            ).count()
        })
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Get task statistics for tracker.html
        """
        if not request.user.company:
            return Response({
                'error': 'User is not associated with any company'
            }, status=status.HTTP_404_NOT_FOUND)
        
        company = request.user.company
        tasks = Task.objects.filter(company=company)
        
        # Overall statistics
        total_tasks = tasks.count()
        completed_tasks = tasks.filter(status='completed').count()
        in_progress_tasks = tasks.filter(status='in_progress').count()
        todo_tasks = tasks.filter(status='todo').count()
        overdue_tasks = tasks.filter(
            due_date__lt=timezone.now(),
            status__in=['todo', 'in_progress']
        ).count()
        
        # Category breakdown
        categories = ['environmental', 'social', 'governance']
        category_stats = {}
        
        for category in categories:
            category_tasks = tasks.filter(category=category)
            category_completed = category_tasks.filter(status='completed').count()
            category_total = category_tasks.count()
            
            category_stats[f"{category}_tasks"] = {
                'total': category_total,
                'completed': category_completed,
                'in_progress': category_tasks.filter(status='in_progress').count(),
                'todo': category_tasks.filter(status='todo').count(),
                'completion_percentage': (
                    (category_completed / category_total * 100) 
                    if category_total > 0 else 0
                )
            }
        
        # Recent activity
        recent_completed = tasks.filter(
            status='completed',
            completed_at__gte=timezone.now() - timedelta(days=7)
        ).order_by('-completed_at')[:5]
        
        upcoming_due = tasks.filter(
            due_date__gte=timezone.now(),
            due_date__lte=timezone.now() + timedelta(days=7),
            status__in=['todo', 'in_progress']
        ).order_by('due_date')[:5]
        
        stats_data = {
            'total_tasks': total_tasks,
            'completed_tasks': completed_tasks,
            'in_progress_tasks': in_progress_tasks,
            'todo_tasks': todo_tasks,
            'overdue_tasks': overdue_tasks,
            'overall_completion': (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0,
            'environmental_completion': category_stats['environmental_tasks']['completion_percentage'],
            'social_completion': category_stats['social_tasks']['completion_percentage'],
            'governance_completion': category_stats['governance_tasks']['completion_percentage'],
            'recent_completed': [
                {
                    'id': str(task.id),
                    'title': task.title,
                    'completed_at': task.completed_at,
                    'category': task.category
                } for task in recent_completed
            ],
            'upcoming_due': [
                {
                    'id': str(task.id),
                    'title': task.title,
                    'due_date': task.due_date,
                    'category': task.category,
                    'priority': task.priority
                } for task in upcoming_due
            ],
            **category_stats
        }
        
        serializer = TaskStatsSerializer(stats_data)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def next_steps(self, request):
        """
        Get next steps/action items for tracker.html
        """
        if not request.user.company:
            return Response({
                'error': 'User is not associated with any company'
            }, status=status.HTTP_404_NOT_FOUND)
        
        company = request.user.company
        next_steps = []
        
        # High priority overdue tasks
        overdue_tasks = Task.objects.filter(
            company=company,
            priority='high',
            due_date__lt=timezone.now(),
            status__in=['todo', 'in_progress']
        ).order_by('due_date')[:3]
        
        for task in overdue_tasks:
            next_steps.append({
                'type': 'urgent',
                'title': f"Complete: {task.title}",
                'description': task.action_required or task.description,
                'action': 'Continue',
                'priority': 'high',
                'due_date': task.due_date,
                'task_id': str(task.id),
                'category': task.category
            })
        
        # Evidence upload tasks
        evidence_tasks = Task.objects.filter(
            company=company,
            task_type='evidence_upload',
            status__in=['todo', 'in_progress']
        ).order_by('priority', 'created_at')[:2]
        
        for task in evidence_tasks:
            next_steps.append({
                'type': 'upload',
                'title': f"Upload: {task.title}",
                'description': 'Upload supporting documents',
                'action': 'Upload',
                'priority': task.priority,
                'due_date': task.due_date,
                'task_id': str(task.id),
                'category': task.category
            })
        
        # Review tasks
        review_tasks = Task.objects.filter(
            company=company,
            task_type='document_review',
            status__in=['todo', 'in_progress']
        ).order_by('priority', 'created_at')[:2]
        
        for task in review_tasks:
            next_steps.append({
                'type': 'review',
                'title': f"Review: {task.title}",
                'description': task.action_required or 'Review and update documentation',
                'action': 'Review',
                'priority': task.priority,
                'due_date': task.due_date,
                'task_id': str(task.id),
                'category': task.category
            })
        
        # Limit to top 5 items
        next_steps = next_steps[:5]
        
        serializer = NextStepsSerializer(next_steps, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def bulk_action(self, request):
        """Perform bulk actions on multiple tasks"""
        serializer = TaskBulkActionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        action = data['action']
        task_ids = data['task_ids']
        
        # Get tasks for user's company only
        tasks = Task.objects.filter(
            id__in=task_ids,
            company=self.request.user.company
        )
        
        if not tasks.exists():
            return Response({
                'error': 'No valid tasks found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        affected_count = 0
        
        try:
            if action == 'mark_completed':
                notes = data.get('notes', 'Bulk completion')
                for task in tasks:
                    if task.status != 'completed':
                        task.mark_completed(request.user, notes)
                        affected_count += 1
            
            elif action == 'mark_in_progress':
                for task in tasks:
                    if task.status == 'todo':
                        task.mark_in_progress(request.user)
                        affected_count += 1
            
            elif action == 'assign_to':
                assignee = User.objects.get(
                    id=data['assigned_to_id'],
                    company=request.user.company
                )
                tasks.update(assigned_to=assignee)
                affected_count = tasks.count()
            
            elif action == 'set_priority':
                tasks.update(priority=data['priority'])
                affected_count = tasks.count()
            
            elif action == 'set_due_date':
                tasks.update(due_date=data['due_date'])
                affected_count = tasks.count()
            
            elif action == 'delete':
                affected_count = tasks.count()
                tasks.delete()
            
            return Response({
                'message': f'Bulk action completed successfully',
                'action': action,
                'affected_tasks': affected_count
            })
            
        except Exception as e:
            logger.error(f"Bulk action error: {e}")
            return Response({
                'error': 'Failed to perform bulk action'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def task_templates(request):
    """Get task templates for company's sector"""
    if not request.user.company:
        return Response({
            'error': 'User is not associated with any company'
        }, status=status.HTTP_404_NOT_FOUND)
    
    sector = request.user.company.business_sector
    
    templates = TaskTemplate.objects.filter(
        is_active=True
    ).filter(
        Q(applicable_sectors__contains=[sector]) |
        Q(applicable_sectors=[])  # Templates applicable to all sectors
    )
    
    serializer = TaskTemplateSerializer(templates, many=True)
    
    return Response({
        'templates': serializer.data,
        'sector': sector,
        'total_templates': len(serializer.data)
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_from_template(request, template_id):
    """Create task from template"""
    if not request.user.company:
        return Response({
            'error': 'User is not associated with any company'
        }, status=status.HTTP_404_NOT_FOUND)
    
    try:
        template = TaskTemplate.objects.get(id=template_id, is_active=True)
    except TaskTemplate.DoesNotExist:
        return Response({
            'error': 'Template not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Create task from template
    overrides = request.data  # Allow customization
    task = template.create_task_for_company(
        company=request.user.company,
        created_by=request.user,
        **overrides
    )
    
    return Response({
        'message': 'Task created from template',
        'task': TaskSerializer(task).data
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def regenerate_tasks_with_meters(request):
    """
    Regenerate existing tasks with enhanced meter information
    This demonstrates the v1-style meter enhancement feature
    """
    if not request.user.company:
        return Response({
            'error': 'User is not associated with any company'
        }, status=status.HTTP_404_NOT_FOUND)

    try:
        from .utils import generate_initial_tasks_for_company
        
        # Clear existing tasks (optional - user can choose)
        clear_existing = request.data.get('clear_existing', False)
        deleted_count = 0
        if clear_existing:
            deleted_count = Task.objects.filter(company=request.user.company).count()
            Task.objects.filter(company=request.user.company).delete()
            logger.info(f"Cleared {deleted_count} existing tasks for company {request.user.company.name}")
        
        # Regenerate tasks with meter enhancement
        new_tasks = generate_initial_tasks_for_company(
            company=request.user.company,
            created_by=request.user
        )
        
        return Response({
            'message': f'Successfully regenerated {len(new_tasks)} tasks with meter information',
            'tasks_created': len(new_tasks),
            'tasks_cleared': deleted_count if clear_existing else 0,
            'company': request.user.company.name,
            'business_sector': request.user.company.business_sector,
            'tasks': [TaskSerializer(task).data for task in new_tasks[:5]]  # Return first 5 as sample
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Error regenerating tasks with meters for company {request.user.company.name}: {e}")
        return Response({
            'error': f'Failed to regenerate tasks: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sync_frontend_tasks(request):
    """
    Sync tasks from frontend localStorage to backend database
    Accepts array of tasks generated by frontend ESG assessment system
    """
    if not request.user.company:
        return Response({
            'error': 'User is not associated with any company'
        }, status=status.HTTP_404_NOT_FOUND)
    
    tasks_data = request.data.get('tasks', [])
    
    if not tasks_data or not isinstance(tasks_data, list):
        return Response({
            'error': 'Tasks data is required and must be an array'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    created_tasks = []
    updated_tasks = []
    errors = []
    
    for task_data in tasks_data:
        try:
            # Check if task already exists by frontend task ID or title
            frontend_task_id = task_data.get('id')
            existing_task = None
            
            if frontend_task_id:
                existing_task = Task.objects.filter(
                    company=request.user.company,
                    external_id=frontend_task_id
                ).first()
            
            if not existing_task:
                # Check by title to avoid duplicates
                existing_task = Task.objects.filter(
                    company=request.user.company,
                    title=task_data.get('title', '')
                ).first()
            
            # Parse due date
            due_date = None
            if task_data.get('due_date'):
                try:
                    from dateutil.parser import parse
                    due_date = parse(task_data['due_date'])
                except:
                    # Fallback to current date + 30 days
                    from datetime import datetime, timedelta
                    due_date = timezone.now() + timedelta(days=30)
            
            # Prepare task data
            task_values = {
                'title': task_data.get('title', 'Untitled Task')[:200],  # Limit title length
                'description': task_data.get('description', '')[:500],  # Limit description length
                'category': task_data.get('category', 'environmental'),
                'priority': task_data.get('priority', 'medium'),
                'status': task_data.get('status', 'todo'),
                'due_date': due_date,
                'compliance_context': task_data.get('compliance_context', '')[:300],
                'action_required': task_data.get('action_required', '')[:300],
                'framework_tags': task_data.get('framework_tags', []),
                'sector': task_data.get('sector', ''),
                'external_id': frontend_task_id,  # Store frontend task ID
                'task_type': 'esg_assessment',  # Mark as generated from ESG assessment
                'estimated_hours': task_data.get('estimated_hours', 4)
            }
            
            if existing_task:
                # Update existing task
                for key, value in task_values.items():
                    if value is not None:  # Only update non-null values
                        setattr(existing_task, key, value)
                existing_task.save()
                updated_tasks.append(existing_task)
            else:
                # Create new task
                new_task = Task.objects.create(
                    company=request.user.company,
                    created_by=request.user,
                    assigned_to=request.user,  # Default assign to creator
                    **task_values
                )
                created_tasks.append(new_task)
                
        except Exception as e:
            logger.error(f"Error syncing task {task_data.get('title', 'Unknown')}: {e}")
            errors.append({
                'task_title': task_data.get('title', 'Unknown'),
                'error': str(e)
            })
    
    # Prepare response
    response_data = {
        'message': f'Task sync completed: {len(created_tasks)} created, {len(updated_tasks)} updated',
        'created_count': len(created_tasks),
        'updated_count': len(updated_tasks),
        'error_count': len(errors),
        'created_tasks': [TaskSerializer(task).data for task in created_tasks],
        'updated_tasks': [TaskSerializer(task).data for task in updated_tasks],
        'errors': errors
    }
    
    if errors:
        logger.warning(f"Task sync completed with {len(errors)} errors for company {request.user.company.name}")
        return Response(response_data, status=status.HTTP_207_MULTI_STATUS)  # Partial success
    else:
        logger.info(f"Task sync successful: {len(created_tasks) + len(updated_tasks)} tasks synced for company {request.user.company.name}")
        return Response(response_data, status=status.HTTP_200_OK)