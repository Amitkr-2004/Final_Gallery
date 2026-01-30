import sqlite3

conn = sqlite3.connect('app-data/database/app.db')
cursor = conn.cursor()

print('\n=== IMAGES TABLE SCHEMA ===')
schema = cursor.execute("PRAGMA table_info(images)").fetchall()
for col in schema:
    print(f'{col[1]:30} {col[2]:15} {"PRIMARY KEY" if col[5] else ""} {"NOT NULL" if col[3] else ""}')

print('\n=== CHECKING FOR image_id COLUMN ===')
has_image_id = any(col[1] == 'image_id' for col in schema)
print(f'image_id column exists: {has_image_id}')

conn.close()
