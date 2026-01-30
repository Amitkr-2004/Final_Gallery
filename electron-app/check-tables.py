import sqlite3

conn = sqlite3.connect('app-data/database/app.db')
cursor = conn.cursor()

print('\n=== UPLOADED FILES ===')
count = cursor.execute('SELECT COUNT(*) FROM uploaded_files').fetchone()[0]
print(f'Total: {count} rows')

if count > 0:
    sample = cursor.execute('SELECT id, filename, file_hash FROM uploaded_files LIMIT 3').fetchall()
    print('\nSample:')
    for r in sample:
        print(f'  ID: {r[0]}, File: {r[1]}, Hash: {r[2][:16]}...')

print('\n=== FACE DETECTION TABLES ===')
tables = ['images', 'faces', 'face_collections', 'face_collection_members']
for t in tables:
    count = cursor.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0]
    print(f'{t}: {count} rows')

conn.close()
