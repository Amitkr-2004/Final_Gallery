import sqlite3

db_path = 'electron-app/app-data/database/app.db'
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Count total collections in local DB
total = cur.execute('SELECT COUNT(*) FROM face_collections').fetchone()[0]

print(f'Local database has {total} collections')
print(f'\nTo check GCS, run this in Electron app console:')
print(f'  window.electronAPI.gcs.listCollections().then(r => console.log("GCS:", r.collections.length))')
print(f'\nIf GCS has less than {total} collections, you need to sync.')

conn.close()
