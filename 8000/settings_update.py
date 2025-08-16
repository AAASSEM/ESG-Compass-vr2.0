# Add/Update these settings in your settings.py

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Important: Update STATICFILES_DIRS to include the dist/assets directory
STATICFILES_DIRS = [
    os.path.join(BASE_DIR, '..', 'frontend-react', 'dist', 'assets'),  # Vite built assets
    os.path.join(BASE_DIR, '..', 'frontend-react', 'dist'),  # Root dist for other files
]

# Ensure WhiteNoise is in MIDDLEWARE (for production-like serving)
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # This should be second
    'corsheaders.middleware.CorsMiddleware',
    # ... rest of your middleware
]

# Optional: Configure WhiteNoise for better performance
WHITENOISE_AUTOREFRESH = True  # Only for development
WHITENOISE_USE_FINDERS = True  # Use Django's staticfiles finders