# Docker Setup Guide

This guide will help you run the Photo Gallery application using Docker.

## Prerequisites

- Docker Desktop installed on your system
- Docker Compose (included with Docker Desktop)

## Quick Start

### 1. Environment Setup

Copy the example environment file:

```bash
cp backend/.env.example backend/.env
```

The default values in `.env.example` are already configured for Docker.

### 2. Build and Start Services

Build and start all services:

```bash
docker-compose up --build
```

Or run in detached mode (background):

```bash
docker-compose up -d --build
```

### 3. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Django Admin**: http://localhost:8000/admin

### 4. Create Django Superuser (Optional)

```bash
docker-compose exec backend python manage.py createsuperuser
```

## Services

The Docker Compose setup includes:

- **db**: PostgreSQL 15 database
- **redis**: Redis for caching and Celery message broker
- **backend**: Django REST API server
- **celery**: Celery worker for async tasks (face detection, image processing)
- **frontend**: React development server

## Common Commands

### View Logs

All services:
```bash
docker-compose logs -f
```

Specific service:
```bash
docker-compose logs -f backend
docker-compose logs -f celery
docker-compose logs -f frontend
```

### Stop Services

```bash
docker-compose down
```

### Stop and Remove Volumes (Caution: Deletes data)

```bash
docker-compose down -v
```

### Restart a Specific Service

```bash
docker-compose restart backend
docker-compose restart celery
```

### Execute Commands in Containers

Django shell:
```bash
docker-compose exec backend python manage.py shell
```

Database migrations:
```bash
docker-compose exec backend python manage.py makemigrations
docker-compose exec backend python manage.py migrate
```

Access PostgreSQL:
```bash
docker-compose exec db psql -U postgres -d photogallery
```

Access Redis CLI:
```bash
docker-compose exec redis redis-cli
```

### Rebuild Specific Service

```bash
docker-compose up -d --build backend
```

## Development Workflow

The Docker setup is configured for development:

- **Hot Reload**: Both frontend and backend support hot reloading
- **Volume Mounts**: Code changes are reflected immediately
- **Persistent Data**: Database and media files are preserved in Docker volumes

## Troubleshooting

### Port Already in Use

If you get a port conflict error, either:
1. Stop the service using that port on your host
2. Change the port mapping in `docker-compose.yml` (e.g., `"3001:3000"` instead of `"3000:3000"`)

### Database Connection Issues

Ensure the database service is healthy:
```bash
docker-compose ps
```

Check database logs:
```bash
docker-compose logs db
```

### Celery Not Processing Tasks

Check Celery worker logs:
```bash
docker-compose logs celery
```

Restart Celery:
```bash
docker-compose restart celery
```

### Reset Everything

To start fresh (WARNING: Deletes all data):
```bash
docker-compose down -v
docker-compose up --build
```

## Production Deployment

For production, you should:

1. Update `docker-compose.yml`:
   - Use production-ready web server (Gunicorn/uWSGI)
   - Add Nginx for static files and reverse proxy
   - Set `DEBUG=False`
   - Use strong `SECRET_KEY` and `DB_PASSWORD`

2. Update environment variables in `backend/.env`

3. Configure proper volume backups

4. Set up SSL/TLS certificates

## Data Persistence

Data is stored in Docker volumes:
- `postgres_data`: Database data
- `redis_data`: Redis data
- `media_files`: Uploaded images and processed files
- `static_files`: Django static files

To backup volumes:
```bash
docker run --rm -v gallery_vscode_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz -C /data .
```
