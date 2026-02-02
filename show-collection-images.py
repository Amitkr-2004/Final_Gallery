import sqlite3

db = sqlite3.connect('electron-app/app-data/database/app.db')
cursor = db.cursor()

# Get collections with their images
cursor.execute('''
    SELECT fc.collection_id, fc.name
    FROM face_collections fc
    ORDER BY fc.name
''')

collections = cursor.fetchall()

for coll in collections:
    coll_id, coll_name = coll
    print(f'\n=== {coll_name} ({coll_id[:8]}...) ===')

    # Get images for this collection
    cursor.execute('''
        SELECT DISTINCT i.original_filename, COUNT(f.face_id) as face_count
        FROM images i
        JOIN faces f ON i.image_id = f.image_id
        JOIN face_collection_members fcm ON f.face_id = fcm.face_id
        WHERE fcm.collection_id = ?
        GROUP BY i.image_id
        ORDER BY i.original_filename
    ''', (coll_id,))

    images = cursor.fetchall()
    print(f'Found in {len(images)} images:')
    for img in images:
        print(f'  - {img[0]} ({img[1]} faces)')

db.close()
