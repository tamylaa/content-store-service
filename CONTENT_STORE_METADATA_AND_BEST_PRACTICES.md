# Content Store Service: Metadata, Storage, and Best Practices

## 1. Required File Metadata
For every uploaded file, retain the following metadata:
- `id`: Unique file identifier (UUID or hash)
- `original_filename`: Name as uploaded by the user
- `file_size`: Size in bytes
- `mime_type`: Detected MIME type (e.g., `application/pdf`, `image/png`)
- `created_at`: ISO timestamp of upload
- `owner_id`: User ID of uploader
- `storage_path`: Path or key in R2/S3
- `is_public`: Boolean for sharing
- `category`: (optional) e.g., image, video, document, audio
- `checksum`: (optional, recommended) e.g., SHA256 hash for deduplication/integrity
- `last_accessed_at`: (optional) for analytics
- `download_count`: (optional) for analytics

## 2. Where to Store Metadata
- **File data**: Store in object storage (R2/S3).
- **Metadata**: Store in a database (SQL, NoSQL, or KV store) for fast queries, filtering, and consistency.

### Why Not Store Metadata in R2/S3?
- Object stores are not designed for metadata queries, filtering, or updates.
- Databases allow you to search, paginate, filter, and update metadata efficiently.

## 3. Upload Handler Best Practices
- After saving the file to R2, save all metadata fields to a database.
- When listing files (`/files`), query the database for metadata, not R2 directly.
- When accessing a file, use the metadata to get the storage path/key and serve the file from R2.

## 4. Handling Duplicates and Overwrites
- Use a checksum (e.g., SHA256) to detect duplicate files.
- If a file with the same checksum exists, you can:
  - Link the new upload to the existing file (deduplication), or
  - Allow duplicates but warn the user.
- Never overwrite files in R2 with the same name—always use unique IDs/paths.

## 5. Professional Product Practices
- Store file data in object storage (R2/S3).
- Store all metadata in a database.
- Use unique IDs for every file.
- Deduplicate using checksums if needed.
- Never trust client-supplied metadata—always detect and validate on the server.
- Return all metadata to the frontend for display.
- Paginate and filter file listings in the database.

## 6. Metadata Storage Table
| Data                | Store in R2/S3 | Store in DB (D1, Postgres, etc.) |
|---------------------|:-------------:|:--------------------------------:|
| File bytes          |      ✔️       |                ❌                |
| File path/key       |      ✔️       |                ✔️                |
| File size           |      ✔️       |                ✔️                |
| Original filename   |      ❌       |                ✔️                |
| MIME type           |      ❌       |                ✔️                |
| Upload date         |      ❌       |                ✔️                |
| Owner/user ID       |      ❌       |                ✔️                |
| Public/private flag |      ❌       |                ✔️                |
| Checksum/hash       |      ❌       |                ✔️                |


## 7. Implementation: Database, Endpoints, and Integration

### Database Schema
A new `files` table has been added to the data-service database, with the following columns:

- `id` (TEXT, PRIMARY KEY): Unique file identifier (UUID or hash)
- `original_filename` (TEXT, NOT NULL): Name as uploaded by the user
- `file_size` (INTEGER, NOT NULL): Size in bytes
- `mime_type` (TEXT, NOT NULL): Detected MIME type
- `created_at` (TEXT, NOT NULL): ISO timestamp of upload
- `owner_id` (TEXT, NOT NULL): User ID of uploader
- `storage_path` (TEXT, NOT NULL, UNIQUE): Path or key in R2/S3
- `is_public` (INTEGER, DEFAULT 0): Boolean for sharing
- `category` (TEXT, optional): e.g., image, video, document, audio
- `checksum` (TEXT, optional): SHA256 hash for deduplication/integrity
- `last_accessed_at` (TEXT, optional): For analytics
- `download_count` (INTEGER, DEFAULT 0, optional): For analytics

### Endpoints (data-service)
- `GET /files` — List all files (with metadata)
- `POST /files` — Create file metadata record (after upload to R2/S3)
- `GET /files/:id` — Get metadata for a specific file
- `PATCH /files/:id` — Update file metadata (partial update)
- `DELETE /files/:id` — Delete file metadata

All endpoints return complete metadata for every file. File listings are now paginated and filterable at the database layer (future work: add query params for pagination/filtering).

### Integration
- The upload handler in content-store-service should, after uploading to R2/S3, call `POST /files` on the data-service to persist metadata.
- File listings and lookups should use `GET /files` and `GET /files/:id` from the data-service, not R2/S3 directly.
- All metadata is validated and stored server-side; never trust client-supplied metadata.

---

**This document is now up-to-date with the production implementation of the content store metadata system.**

---

**This document summarizes best practices and requirements for a robust, scalable, and user-friendly content storage and retrieval service.**
