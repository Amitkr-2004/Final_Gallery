# Create PostgreSQL Database

The database `photogallery` needs to be created. Choose one method:

## Method 1: Using psql Command Line

1. Open PowerShell or Command Prompt
2. Connect to PostgreSQL:
   ```bash
   psql -U postgres -h localhost
   ```
   (Enter your password when prompted: 8617525631@Amit)

3. Create the database:
   ```sql
   CREATE DATABASE photogallery;
   ```

4. Exit psql:
   ```sql
   \q
   ```

## Method 2: Using pgAdmin

1. Open pgAdmin
2. Connect to your PostgreSQL server
3. Right-click on "Databases" → "Create" → "Database"
4. Name: `photogallery`
5. Click "Save"

## Method 3: One-line Command (if psql is in PATH)

```bash
psql -U postgres -h localhost -c "CREATE DATABASE photogallery;"
```

After creating the database, restart Django server:
```bash
python manage.py runserver
```
