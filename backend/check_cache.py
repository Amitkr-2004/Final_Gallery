"""Check Redis cache state."""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.core.cache import cache

print("=== REDIS CACHE STATE ===\n")

# Try to get common cache keys
keys_to_check = [
    'persons_list_page_1',
    'persons_list',
    'views.decorators.cache.cache_page',
]

for key in keys_to_check:
    val = cache.get(key)
    status = "EXISTS" if val is not None else "NOT FOUND"
    print(f"{key}: {status}")
    if val is not None:
        print(f"  Type: {type(val)}")
        if isinstance(val, (list, dict)):
            import json
            print(f"  Sample: {json.dumps(val, default=str)[:200]}...")

print("\n=== CACHE BACKEND INFO ===")
print(f"Backend: {cache.__class__.__name__}")
print(f"Backend module: {cache.__class__.__module__}")
