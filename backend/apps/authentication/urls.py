from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

app_name = 'authentication'

urlpatterns = [
    # Authentication endpoints matching frontend expectations
    path('register/', views.register, name='register'),
    path('login/', views.CustomTokenObtainPairView.as_view(), name='login'),
    path('token/', views.CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),  # Alternative endpoint
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', views.logout, name='logout'),
    
    # User management
    path('me/', views.get_current_user, name='current_user'),
    path('profile/', views.update_profile, name='update_profile'),
    path('sessions/', views.user_sessions, name='user_sessions'),
    
    # Demo request (from login.html)
    path('demo-request/', views.demo_request, name='demo_request'),
    path('demo-login/', views.demo_login, name='demo_login'),
    
    # Password reset
    path('password-reset/', views.password_reset_request, name='password_reset_request'),
    path('password-reset-confirm/', views.password_reset_confirm, name='password_reset_confirm'),
    
    # CSRF token
    path('csrf/', views.get_csrf_token, name='get_csrf_token'),
]