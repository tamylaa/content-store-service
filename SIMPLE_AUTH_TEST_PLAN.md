# Simple Test Plan for Content Store Authentication

## Test 1: Health Check (No Auth Required)
```bash
curl -X GET "https://content.tamyla.com/health"
```
**Expected**: 200 OK with health status

## Test 2: Upload Without Token (Should Fail)
```bash
curl -X POST "https://content.tamyla.com/api/v1/content/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test.jpg"
```
**Expected**: 401 Unauthorized with auth error

## Test 3: Upload With Invalid Token (Should Fail)
```bash
curl -X POST "https://content.tamyla.com/api/v1/content/upload" \
  -H "Authorization: Bearer invalid-token" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test.jpg"
```
**Expected**: 401 Unauthorized with token validation error

## Test 4: Get Valid Token via Magic Link
1. Request magic link:
```bash
curl -X POST "https://auth.tamyla.com/auth/magic-link" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@tamyla.com","name":"Test User"}'
```

2. Check email for magic link
3. Verify magic link to get JWT token
4. Use JWT token for upload

## Test 5: Upload With Valid Token (Should Work)
```bash
curl -X POST "https://content.tamyla.com/api/v1/content/upload" \
  -H "Authorization: Bearer YOUR_VALID_JWT_TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test.jpg"
```
**Expected**: 200 OK with upload success

## Current Status:
✅ Health endpoint working
✅ Auth service introspect endpoint working  
✅ Content store deployed with simplified auth
⏳ Need to test actual file upload authentication

## Key Changes Made:
1. **Removed complex JWT middleware** - no more local JWT validation
2. **Uses existing auth service** - calls `/auth/introspect` endpoint
3. **Simplified authentication** - one path, aligned with production
4. **No breaking changes** - uses existing auth service endpoints
5. **No complex migration** - just works with what's already there

This approach is much simpler and aligns perfectly with the existing auth service without any complex migration plans.
