import sqlite3

db = sqlite3.connect('electron-app/app-data/database/app.db')
cursor = db.cursor()

# Get collections
cursor.execute('''
    SELECT fc.collection_id, fc.name,
           COUNT(DISTINCT f.image_id) as images,
           COUNT(f.face_id) as faces
    FROM face_collections fc
    LEFT JOIN face_collection_members fcm ON fc.collection_id = fcm.collection_id
    LEFT JOIN faces f ON fcm.face_id = f.face_id
    GROUP BY fc.collection_id
    ORDER BY faces DESC
''')

collections = cursor.fetchall()

print(f'=== TOTAL COLLECTIONS: {len(collections)} ===\n')

for i, c in enumerate(collections):
    print(f'{i+1}. {c[1]} ({c[0][:8]}...)')
    print(f'   - {c[2]} images with this person')
    print(f'   - {c[3]} faces total\n')

# Get processing status
cursor.execute('SELECT COUNT(*) FROM images WHERE processing_status = "completed"')
completed = cursor.fetchone()[0]
print(f'Processed: {completed}/7 images')

db.close()
