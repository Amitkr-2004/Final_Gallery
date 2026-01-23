"""
Simple test script to upload images to the Gallery API.

This script will:
1. Find image files in a specified directory
2. Upload them to the API
3. Show the async processing in action
"""

import os
import sys
import time
import requests
from pathlib import Path

# Configuration
API_URL = "http://localhost:8000/api/upload/"
API_PERSONS_URL = "http://localhost:8000/api/persons/"
API_PHOTOS_URL = "http://localhost:8000/api/photos/"

def find_test_images():
    """Find test images in common locations."""
    possible_paths = [
        r"C:\Users\AMIT\Pictures",
        r"C:\Users\AMIT\Downloads",
        r"D:\Gallery_VSCode\test_images",
        Path.home() / "Pictures",
        Path.home() / "Downloads",
    ]

    image_extensions = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'}
    found_images = []

    for path in possible_paths:
        if not os.path.exists(path):
            continue

        for file in os.listdir(path):
            if Path(file).suffix.lower() in image_extensions:
                found_images.append(os.path.join(path, file))
                if len(found_images) >= 5:  # Limit to 5 images
                    return found_images

    return found_images

def upload_image(image_path):
    """Upload a single image to the API."""
    print(f"\n{'='*60}")
    print(f"Uploading: {os.path.basename(image_path)}")
    print(f"{'='*60}")

    try:
        start_time = time.time()

        with open(image_path, 'rb') as img_file:
            files = {'image': img_file}
            data = {'event_id': 'test_event_123'}
            response = requests.post(API_URL, files=files, data=data, timeout=10)

        elapsed = (time.time() - start_time) * 1000  # Convert to milliseconds

        if response.status_code in [200, 201]:
            result = response.json()
            print(f"✅ Upload successful in {elapsed:.0f}ms")
            print(f"   Photo ID: {result.get('photo_id')}")
            print(f"   Status: {result.get('status')}")
            print(f"   Task ID: {result.get('task_id', 'N/A')[:16]}...")
            print(f"   Message: {result.get('message')}")
            return result.get('photo_id')
        else:
            print(f"❌ Upload failed: {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return None

    except requests.exceptions.ConnectionError:
        print("❌ Error: Could not connect to API")
        print("   Make sure Django server is running: python manage.py runserver")
        return None
    except FileNotFoundError:
        print(f"❌ Error: Image file not found: {image_path}")
        return None
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return None

def check_photo_status(photo_id):
    """Check the processing status of a photo."""
    try:
        response = requests.get(API_PHOTOS_URL, timeout=5)
        if response.status_code == 200:
            photos = response.json()
            for photo in photos:
                if photo['id'] == photo_id:
                    return photo.get('status'), photo
        return None, None
    except Exception as e:
        print(f"⚠️  Could not check status: {str(e)}")
        return None, None

def get_persons_count():
    """Get the current number of persons (collections)."""
    try:
        response = requests.get(f"{API_PERSONS_URL}?page=1", timeout=5)
        if response.status_code == 200:
            data = response.json()
            return data.get('pagination', {}).get('total_count', 0)
        return 0
    except:
        return 0

def main():
    """Main test function."""
    print("\n" + "="*60)
    print(" Gallery API Upload Test")
    print("="*60)

    # Check if API is running
    print("\n1. Checking if API is running...")
    try:
        response = requests.get("http://localhost:8000/api/health/", timeout=3)
        if response.status_code == 200:
            print("   ✅ API is running")
        else:
            print("   ❌ API returned unexpected status")
            sys.exit(1)
    except requests.exceptions.ConnectionError:
        print("   ❌ Cannot connect to API at http://localhost:8000")
        print("   Please start Django server: python manage.py runserver")
        sys.exit(1)

    # Get initial persons count
    print("\n2. Checking initial state...")
    initial_count = get_persons_count()
    print(f"   Current persons (collections): {initial_count}")

    # Find test images
    print("\n3. Looking for test images...")

    # Check if user provided image path as argument
    if len(sys.argv) > 1:
        test_images = [sys.argv[1]]
        print(f"   Using provided image: {test_images[0]}")
    else:
        test_images = find_test_images()
        if not test_images:
            print("   ❌ No test images found")
            print("\n   Please provide an image path:")
            print("   python test_upload.py C:\\path\\to\\image.jpg")
            sys.exit(1)
        print(f"   Found {len(test_images)} test images")

    # Upload images
    print("\n4. Uploading images...")
    print("   (Watch the Celery worker terminal for processing logs)")

    uploaded_ids = []
    for img_path in test_images[:3]:  # Upload max 3 images
        photo_id = upload_image(img_path)
        if photo_id:
            uploaded_ids.append(photo_id)
        time.sleep(1)  # Small delay between uploads

    if not uploaded_ids:
        print("\n❌ No images were uploaded successfully")
        sys.exit(1)

    # Wait for processing
    print(f"\n5. Waiting for async processing to complete...")
    print("   (This may take 2-10 seconds per image)")

    max_wait = 30  # seconds
    for i in range(max_wait):
        time.sleep(1)

        # Check status of first uploaded photo
        status, photo_data = check_photo_status(uploaded_ids[0])

        if status == 'completed':
            print(f"\n   ✅ Processing complete!")
            if photo_data:
                print(f"   Thumbnail (small): {photo_data.get('thumbnail_small_url', 'N/A')}")
                print(f"   Thumbnail (medium): {photo_data.get('thumbnail_medium_url', 'N/A')}")
            break
        elif status == 'failed':
            print(f"\n   ❌ Processing failed")
            break
        elif i % 5 == 0:
            print(f"   Status: {status or 'pending'}... ({i}s)")

    # Check final state
    print("\n6. Checking final state...")
    final_count = get_persons_count()
    new_persons = final_count - initial_count
    print(f"   Persons before: {initial_count}")
    print(f"   Persons after: {final_count}")
    if new_persons > 0:
        print(f"   ✅ Created {new_persons} new person(s)/collection(s)")
    else:
        print(f"   ℹ️  No new persons created (faces matched existing collections)")

    # Check thumbnails directory
    thumbnails_dir = Path("backend/media/thumbnails")
    if thumbnails_dir.exists():
        thumbnails = list(thumbnails_dir.glob("*.webp"))
        print(f"\n7. Generated thumbnails:")
        print(f"   Location: {thumbnails_dir}")
        print(f"   Count: {len(thumbnails)} files")
        if thumbnails:
            total_size = sum(f.stat().st_size for f in thumbnails[:5])
            avg_size = total_size / min(len(thumbnails), 5) / 1024
            print(f"   Average size: {avg_size:.1f} KB (should be 10-20KB)")

    print("\n" + "="*60)
    print(" Test Complete! 🎉")
    print("="*60)
    print("\nNext steps:")
    print("1. Visit http://localhost:8000/api/persons/?page=1 to see collections")
    print("2. Visit http://localhost:8000/api/statistics/ to see daily stats")
    print("3. Check Celery worker logs for detailed processing info")
    print("4. Try uploading more images with different faces!")
    print()

if __name__ == "__main__":
    main()
