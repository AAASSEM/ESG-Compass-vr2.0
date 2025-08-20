from django.urls import path
from . import views
from . import enhanced_views

app_name = 'dashboard'

urlpatterns = [
    # Test endpoints
    path('test/social/', views.test_social_dashboard, name='test_social_dashboard'),
    path('social/file-data/', views.social_file_data, name='social_file_data'),
    path('environmental/file-data/', views.environmental_file_data, name='environmental_file_data'),
    path('environmental/combined-data/', views.combined_environmental_data, name='combined_environmental_data'),
    path('governance/file-data/', views.governance_file_data, name='governance_file_data'),
    
    # Main dashboard endpoints
    path('overview/', enhanced_views.enhanced_dashboard_overview, name='dashboard_overview'),
    path('metrics/', views.dashboard_metrics, name='dashboard_metrics'),
    path('trends/', views.esg_trends, name='esg_trends'),
    path('comparison/', views.company_comparison, name='company_comparison'),
    path('insights/', views.dashboard_insights, name='dashboard_insights'),
    path('quick-stats/', views.quick_stats, name='quick_stats'),
    path('kpis/', views.kpi_metrics, name='kpi_metrics'),
    
    # Alert management
    path('alerts/', views.dashboard_alerts, name='dashboard_alerts'),
    path('alerts/summary/', views.alert_summary, name='alert_summary'),
    path('alerts/<uuid:alert_id>/read/', views.mark_alert_read, name='mark_alert_read'),
    
    # Widget management
    path('widgets/', views.DashboardWidgetListView.as_view(), name='widget_list'),
    path('widgets/<uuid:pk>/', views.DashboardWidgetDetailView.as_view(), name='widget_detail'),
    
    # Analytics tracking
    path('analytics/track/', views.track_analytics_event, name='track_analytics_event'),
]