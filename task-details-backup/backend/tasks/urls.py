from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'tasks'

router = DefaultRouter()
router.register('', views.TaskViewSet, basename='task')

urlpatterns = [
    # Task viewset routes (includes CRUD, my_tasks, stats, etc.)
    path('', include(router.urls)),
    
    # Task templates
    path('templates/', views.task_templates, name='task_templates'),
    path('templates/<uuid:template_id>/create/', views.create_from_template, name='create_from_template'),
    
    # Task sync from frontend
    path('sync-frontend/', views.sync_frontend_tasks, name='sync_frontend_tasks'),
    
    # Regenerate tasks with meter information
    path('regenerate-with-meters/', views.regenerate_tasks_with_meters, name='regenerate_tasks_with_meters'),
]