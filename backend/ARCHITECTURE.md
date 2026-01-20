# Gallery Application Architecture

This document describes the architecture rules that must be strictly followed, matching Google Photos / FotoOwl design patterns.

## Core Architecture Rules

### 1. Store Image Only Once Using image_hash
- **Rule**: Each unique image is stored exactly ONCE in the database
- **Implementation**: 
  - `Photo` model has `image_hash` field with `unique=True` constraint
  - Upload endpoint checks for existing photo by hash before saving
  - If hash exists, reuses existing photo record
- **Database Constraint**: `unique_image_hash` constraint on `image_hash` field
- **Result**: No duplicate photos, efficient storage

### 2. One Person = One Collection
- **Rule**: Each Person represents exactly one collection
- **Implementation**: 
  - `Person` model represents a single collection
  - One-to-one relationship: 1 Person = 1 Collection
- **Result**: Clear collection organization

### 3. One Photo Can Belong to Many Persons
- **Rule**: A single photo can be associated with multiple persons (collections)
- **Implementation**: 
  - Many-to-many relationship via `PersonPhoto` mapping table
  - One photo can have multiple `PersonPhoto` records
- **Result**: Photos with multiple faces are correctly categorized

### 4. Use PersonPhoto Mapping Table
- **Rule**: The ONLY way to associate photos with persons is through `PersonPhoto` table
- **Implementation**: 
  - `PersonPhoto` model with ForeignKeys to both `Person` and `Photo`
  - All photo-person associations go through this table
- **Result**: Normalized data structure, easy queries

### 5. No Duplicate Photos
- **Rule**: No two Photo records can have the same `image_hash`
- **Implementation**: 
  - Database-level unique constraint on `image_hash`
  - Application-level check before creating new Photo
- **Database Constraint**: `unique_image_hash` on `Photo.image_hash`
- **Result**: Data integrity guaranteed

### 6. No Duplicate Persons
- **Rule**: No two Person records can have the same `person_number`
- **Implementation**: 
  - Database-level unique constraint on `person_number`
  - FAISS similarity matching prevents duplicate person creation
- **Database Constraint**: `unique_person_number` on `Person.person_number`
- **Result**: Each collection is unique

### 7. No Duplicate Mappings
- **Rule**: No duplicate `(person, photo)` pairs in `PersonPhoto` table
- **Implementation**: 
  - Database-level unique constraint on `(person, photo)` combination
  - `get_or_create()` used to prevent duplicates
- **Database Constraint**: `unique_person_photo` on `PersonPhoto(person, photo)`
- **Result**: Clean many-to-many relationships

### 8. Collections Numbering Must Start from 1 and Be Ascending
- **Rule**: Person numbers must start at 1 and increment sequentially (1, 2, 3, ...)
- **Implementation**: 
  - `Person.save()` auto-increments `person_number` starting from 1
  - Uses `select_for_update()` for thread-safe sequential numbering
  - Validation ensures `person_number >= 1`
- **Result**: Predictable, sequential collection numbering

## Data Model Relationships

```
Photo (1) ──< PersonPhoto >── (N) Person
```

- **Photo**: Stores unique images (by hash)
- **Person**: Represents collections (numbered 1, 2, 3, ...)
- **PersonPhoto**: Maps photos to persons (many-to-many)

## Verification

Run the architecture verification command:
```bash
python manage.py verify_architecture
```

This command checks all 8 rules and reports any violations.

## Design Pattern

This architecture follows the **Google Photos / FotoOwl** pattern:
- Deduplication at storage level (image_hash)
- Collections as first-class entities (Person)
- Many-to-many relationships for flexible categorization
- Sequential numbering for user-friendly collections
- Normalized database structure
