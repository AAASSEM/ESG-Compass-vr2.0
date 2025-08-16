# esg_platform/urls.py
"""
URL configuration for esg_platform project.
"""
import os
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from apps.dashboard.views import test_social_dashboard
from .views import FrontendAppView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Test dashboard (no auth required)
    path('test/social/', test_social_dashboard, name='test_social_dashboard'),
    
    # API endpoints
    path('api/auth/', include('apps.authentication.urls')),
    path('api/companies/', include('apps.companies.urls')),
    path('api/esg/', include('apps.esg_assessment.urls')),
    path('api/tasks/', include('apps.tasks.urls')),
    path('api/reports/', include('apps.reports.urls')),
    path('api/dashboard/', include('apps.dashboard.urls')),
    path('api/users/', include('apps.user_management.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    # Static files will be served by WhiteNoise or Django's static file handler

# Add catch-all pattern for frontend routes LAST
urlpatterns += [
    re_path(r'^.*$', FrontendAppView.as_view(), name='frontend'),
]


# esg_platform/views.py
import os
from django.http import HttpResponse, Http404
from django.views import View
from django.conf import settings

class FrontendAppView(View):
    def get(self, request, *args, **kwargs):
        # Serve the built index.html file
        index_path = os.path.join(settings.BASE_DIR, '..', 'frontend-react', 'dist', 'index.html')
        
        if os.path.exists(index_path):
            with open(index_path, 'r') as file:
                return HttpResponse(file.read(), content_type='text/html')
        else:
            raise Http404("Frontend build not found. Please run 'npm run build' in the frontend-react directory.")