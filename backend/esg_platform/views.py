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