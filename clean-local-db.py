import sqlite3
import os
import shutil

db_path = 'electron-app/app-data/database/app.db'
uploads_path = 'electron-app/app-data/uploads'

print('Cleaning local database...\n')

conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Get counts before deletion
images_count = cur.execute('SELECT COUNT(*) FROM images').fetchone()[0]
faces_count = cur.execute('SELECT COUNT(*) FROM faces').fetchone()[0]
collections_count = cur.execute('SELECT COUNT(*) FROM face_collections').fetchone()[0]
files_count = cur.execute('SELECT COUNT(*) FROM uploaded_files').fetchone()[0]

print(f'Current counts:')
print(f'  - Images: {images_count}')
print(f'  - Faces: {faces_count}')
print(f'  - Collections: {collections_count}')
print(f'  - Uploaded files: {files_count}')
print()

# Delete all data
print('Deleting all data from database...')
cur.execute('DELETE FROM face_collection_members')
cur.execute('DELETE FROM face_collections')
cur.execute('DELETE FROM faces')
cur.execute('DELETE FROM images')
cur.execute('DELETE FROM uploaded_files')
conn.commit()

print('OK Database tables cleared')

# Delete all uploaded files
print('\nDeleting uploaded files from filesystem...')
if os.path.exists(uploads_path):
    file_count = len([f for f in os.listdir(uploads_path) if os.path.isfile(os.path.join(uploads_path, f))])
    for filename in os.listdir(uploads_path):
        file_path = os.path.join(uploads_path, filename)
        if os.path.isfile(file_path):
            os.remove(file_path)
    print(f'OK Deleted {file_count} files from uploads folder')
else:
    print('OK Uploads folder already empty')

conn.close()

print('\n═══════════════════════════════════════')
print('OK LOCAL DATABASE COMPLETELY CLEANED!')
print('═══════════════════════════════════════')
print('\nYou can now upload new images through the app')
print('All changes will auto-sync to GCS!')
