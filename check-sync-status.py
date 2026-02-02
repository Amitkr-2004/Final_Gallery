import sqlite3
import sys

db_path = 'electron-app/app-data/database/app.db'
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Count total and unsynced
total = cur.execute('SELECT COUNT(*) FROM face_collections').fetchone()[0]
unsynced = cur.execute('SELECT COUNT(*) FROM face_collections WHERE gcs_synced_at IS NULL').fetchone()[0]

print(f'Total collections in local DB: {total}')
print(f'Collections not synced to GCS: {unsynced}')
print(f'Collections synced to GCS: {total - unsynced}')
print()

# Show most recent collections
print('Most recent 10 collections:')
print('-' * 90)
rows = cur.execute('''
    SELECT collection_id, name, created_at, gcs_synced_at
    FROM face_collections
    ORDER BY created_at DESC
    LIMIT 10
''').fetchall()

for idx, row in enumerate(rows, 1):
    coll_id = row[0][:12] + '...'
    name = row[1][:25].ljust(25)
    created = row[2][:19] if row[2] else 'N/A'
    synced = 'SYNCED' if row[3] else 'NOT SYNCED'
    print(f'{idx:2}. {name} | {created} | {synced}')

conn.close()
