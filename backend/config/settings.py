"""
Django settings for config project.
"""

from pathlib import Path
import os
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env file
# Ensure .env file is loaded from the same directory as settings.py
env_path = BASE_DIR / '.env'
load_dotenv(dotenv_path=env_path)


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/4.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-change-this-in-production')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv('DEBUG', 'True') == 'True'

ALLOWED_HOSTS = ['localhost', '127.0.0.1']


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party apps
    'rest_framework',
    'corsheaders',
    # Local apps
    'api',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# Database
# https://docs.djangoproject.com/en/4.2/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME', 'photogallery'),
        'USER': os.getenv('DB_USER', 'postgres'),
        'PASSWORD': os.getenv('DB_PASSWORD', ''),
        'HOST': os.getenv('DB_HOST', 'localhost'),
        'PORT': os.getenv('DB_PORT', '5432'),
    }
}


# Password validation
# https://docs.djangoproject.com/en/4.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/4.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/4.2/howto/static-files/

STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Media files configuration
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# Default primary key field type
# https://docs.djangoproject.com/en/4.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Django Rest Framework settings
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.MultiPartParser',
        'rest_framework.parsers.FormParser',
    ],
}

# CORS settings
# Allow all origins for development (camera-scanner.html opened from file://)
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

# FAISS Configuration
FAISS_SIMILARITY_THRESHOLD = float(os.getenv('FAISS_SIMILARITY_THRESHOLD', '0.7'))

# Face Detection Quality Configuration
# Minimum detection confidence score to create a collection (0.0 to 1.0)
# Higher values = only clear, well-detected faces create collections
# Recommended: 0.5-0.7 (lower = more lenient, higher = stricter)
FACE_DETECTION_CONFIDENCE_THRESHOLD = float(os.getenv('FACE_DETECTION_CONFIDENCE_THRESHOLD', '0.5'))

# Thumbnail Configuration
THUMBNAIL_SIZES = {
    'small': (200, 200),   # For collections page
    'medium': (800, 800),  # For detail page
}
THUMBNAIL_QUALITY = 85
THUMBNAIL_FORMAT = 'JPEG'

# Time Scheduler Configuration
# Maximum file size for images in MB
MAX_IMAGE_SIZE_MB = int(os.getenv('MAX_IMAGE_SIZE_MB', '50'))

# Whether to scan subdirectories recursively
RECURSIVE_FOLDER_SCAN = os.getenv('RECURSIVE_FOLDER_SCAN', 'True') == 'True'

# Allowed image file extensions
ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']

# ============================================================================
# GOOGLE CLOUD STORAGE CONFIGURATION
# ============================================================================

# GCS bucket name for image storage
# GCS_BUCKET_NAME = os.getenv('GCS_BUCKET_NAME', 'your-image-bucket')

# GCS project ID
# GCS_PROJECT_ID = os.getenv('GCS_PROJECT_ID', 'your-gcp-project-id')

# Path to service account JSON credentials file
# Set GOOGLE_APPLICATION_CREDENTIALS environment variable to the path
# Example: /path/to/service-account-key.json

# Maximum number of files in a batch upload request
MAX_UPLOAD_BATCH_SIZE = int(os.getenv('MAX_UPLOAD_BATCH_SIZE', '100'))

# ============================================================================
# CELERY CONFIGURATION
# ============================================================================

# Celery broker configuration
# Using filesystem broker for Windows development (no RabbitMQ/Redis required)
CELERY_BROKER_URL = 'filesystem://'
CELERY_BROKER_TRANSPORT_OPTIONS = {
    'data_folder_in': os.path.join(BASE_DIR, 'celery_broker', 'out'),
    'data_folder_out': os.path.join(BASE_DIR, 'celery_broker', 'out'),
    'data_folder_processed': os.path.join(BASE_DIR, 'celery_broker', 'processed'),
}

# Result backend (optional - stores task results)
# CELERY_RESULT_BACKEND = 'db+sqlite:///celery_results.sqlite'

CELERY_BROKER_URL = "redis://127.0.0.1:6380/0"
CELERY_RESULT_BACKEND = "redis://127.0.0.1:6380/0"

CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"


# Celery task settings
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE

# Task execution settings
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes max per task
