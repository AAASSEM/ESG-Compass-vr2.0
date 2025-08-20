from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import authenticate, login
from django.utils import timezone
from django.conf import settings
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from django.http import JsonResponse
import logging

from .models import User, PasswordResetToken
from .serializers import (
    UserSerializer, RegisterSerializer, LoginSerializer,
    DemoRequestSerializer, PasswordResetSerializer,
    PasswordResetConfirmSerializer, UserProfileUpdateSerializer
)
from .demo_service import DemoUserService

logger = logging.getLogger(__name__)


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Custom token view that matches frontend login expectations
    Frontend sends: { username: email, password: password }
    """
    def post(self, request, *args, **kwargs):
        # Handle both email and username fields
        if 'username' in request.data and 'email' not in request.data:
            request.data['email'] = request.data['username']
        
        response = super().post(request, *args, **kwargs)
        
        if response.status_code == 200:
            # Get user for additional data
            email = request.data.get('username') or request.data.get('email')
            try:
                user = User.objects.get(email=email)
                
                # Handle demo user data population
                if DemoUserService.is_demo_user(user):
                    DemoUserService.populate_demo_data(user)
                    logger.info(f"Demo user data populated for: {user.email}")
                
                # Track user session
                self._track_user_session(request, user)
                
                # Add user data to response
                response.data['user'] = UserSerializer(user).data
                response.data['token_type'] = 'bearer'
                
                logger.info(f"User {user.email} logged in successfully")
                
            except User.DoesNotExist:
                pass
        
        return response
    
    def _track_user_session(self, request, user):
        """Track user session for security and analytics"""
        try:
            # Get client info
            ip_address = self._get_client_ip(request)
            user_agent = request.META.get('HTTP_USER_AGENT', '')
            
            # Create or update session
            # UserSession.objects.update_or_create(
            #     user=user,
            #     ip_address=ip_address,
            #     defaults={
            #         'user_agent': user_agent,
            #         'is_active': True,
            #         'last_activity': timezone.now()
            #     }
            # )
        except Exception as e:
            logger.error(f"Error tracking user session: {e}")
    
    def _get_client_ip(self, request):
        """Get client IP address"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


@api_view(['POST'])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def register(request):
    """
    User registration endpoint
    Matches signup.html form structure
    """
    serializer = RegisterSerializer(data=request.data)
    
    if serializer.is_valid():
        try:
            # Create user and company
            user = serializer.save()
            
            # Generate tokens
            refresh = RefreshToken.for_user(user)
            
            # Track registration
            logger.info(f"New user registered: {user.email}, Company: {user.company.name}")
            
            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'token_type': 'bearer',
                'user': UserSerializer(user).data,
                'message': 'Registration successful'
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Registration error: {e}")
            return Response({
                'error': 'Registration failed. Please try again.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def demo_request(request):
    """
    Demo request endpoint
    Matches login.html demo form structure
    """
    serializer = DemoRequestSerializer(data=request.data)
    
    if serializer.is_valid():
        # In a real application, you would:
        # 1. Save demo request to database
        # 2. Send email to sales team
        # 3. Schedule demo call
        # 4. Send confirmation email to user
        
        demo_data = serializer.validated_data
        
        # Log demo request
        logger.info(f"Demo request from: {demo_data['business_email']}, Company: {demo_data['company_name']}")
        
        # For now, just return success
        # In production, integrate with CRM/email system
        return Response({
            'message': 'Demo request submitted successfully',
            'demo_scheduled': True,
            'contact_within': '24 hours'
        }, status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def demo_login(request):
    """
    Demo login endpoint - creates and logs in demo user
    """
    try:
        # Get or create demo user
        demo_user = DemoUserService.get_or_create_demo_user()
        
        # Generate tokens for demo user
        refresh = RefreshToken.for_user(demo_user)
        
        # Populate demo data
        DemoUserService.populate_demo_data(demo_user)
        
        logger.info(f"Demo login successful for: {demo_user.email}")
        
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'token_type': 'bearer',
            'user': UserSerializer(demo_user).data,
            'message': 'Demo login successful',
            'demo_mode': True
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Demo login error: {e}")
        return Response({
            'error': 'Demo login failed. Please try again.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_current_user(request):
    """
    Get current user information
    Used by frontend to check authentication status
    """
    return Response(UserSerializer(request.user).data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_profile(request):
    """Update user profile information"""
    serializer = UserProfileUpdateSerializer(
        request.user, 
        data=request.data, 
        partial=True
    )
    
    if serializer.is_valid():
        serializer.save()
        return Response({
            'user': UserSerializer(request.user).data,
            'message': 'Profile updated successfully'
        })
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_request(request):
    """Request password reset"""
    serializer = PasswordResetSerializer(data=request.data)
    
    if serializer.is_valid():
        email = serializer.validated_data['email']
        
        try:
            user = User.objects.get(email=email)
            
            # In production, send email with reset link
            # For now, just return success
            logger.info(f"Password reset requested for: {email}")
            
            return Response({
                'message': 'Password reset email sent if account exists'
            })
            
        except User.DoesNotExist:
            # Don't reveal if user exists or not
            return Response({
                'message': 'Password reset email sent if account exists'
            })
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_confirm(request):
    """Confirm password reset with token"""
    serializer = PasswordResetConfirmSerializer(data=request.data)
    
    if serializer.is_valid():
        # In production, validate token and reset password
        # For now, just return success
        return Response({
            'message': 'Password reset successful'
        })
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    """
    Logout user and invalidate session
    """
    try:
        # Check if user exists (for demo mode compatibility)
        if hasattr(request, 'user') and request.user:
            # Handle demo user data cleanup
            if DemoUserService.is_demo_user(request.user):
                DemoUserService.clear_demo_data(request.user)
                logger.info(f"Demo user data cleared for: {request.user.email}")
            
            logger.info(f"User {getattr(request.user, 'email', 'demo-user')} logged out")
        
        return Response({
            'message': 'Logged out successfully'
        })
        
    except Exception as e:
        logger.error(f"Logout error: {e}")
        return Response({
            'message': 'Logged out successfully'  # Always return success for logout
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_sessions(request):
    """Get user's active sessions"""
    # sessions = UserSession.objects.filter(
    #     user=request.user,
    #     is_active=True
    # ).order_by('-last_activity')
    
    session_data = []
    # for session in sessions:
    #     session_data.append({
    #         'id': str(session.id),
    #         'ip_address': session.ip_address,
    #         'location': session.location or 'Unknown',
    #         'user_agent': session.user_agent,
    #         'created_at': session.created_at,
    #         'last_activity': session.last_activity
    #     })
    
    return Response({
        'sessions': session_data,
        'total_sessions': len(session_data)
    })


@api_view(['GET'])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def get_csrf_token(request):
    """
    Provide CSRF token for frontend applications
    """
    token = get_token(request)
    return Response({
        'csrfToken': token,
        'headerName': 'X-CSRFToken',
        'cookieName': 'csrftoken'
    })