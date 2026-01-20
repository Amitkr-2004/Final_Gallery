# Gallery - Full Stack Application

A full stack application with Django REST Framework backend and React frontend.

## Project Structure

```
Gallery/
├── backend/          # Django + Django REST Framework
└── frontend/         # React application
```

## Prerequisites

- Python 3.8+
- Node.js 14+
- PostgreSQL 12+

## Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:
   - Windows:
     ```bash
     venv\Scripts\activate
     ```
   - Linux/Mac:
     ```bash
     source venv/bin/activate
     ```

4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Create a `.env` file in the backend directory (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your database credentials.

6. Create PostgreSQL database:
   ```sql
   CREATE DATABASE gallery_db;
   ```

7. Run migrations:
   ```bash
   python manage.py migrate
   ```

8. Create a superuser (optional):
   ```bash
   python manage.py createsuperuser
   ```

9. Run the development server:
   ```bash
   python manage.py runserver
   ```

The backend will be available at `http://localhost:8000`

## Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

The frontend will be available at `http://localhost:3000`

## API Endpoints

- Health Check: `GET /api/health/`

## Technologies Used

### Backend
- Django 4.2.7
- Django REST Framework 3.14.0
- PostgreSQL (via psycopg2-binary)
- django-cors-headers

### Frontend
- React 19.2.3
- React Scripts 5.0.1

## Development Notes

- The backend API is configured to accept requests from `http://localhost:3000`
- CORS is enabled for development
- The frontend proxy is configured to forward API requests to `http://localhost:8000`
