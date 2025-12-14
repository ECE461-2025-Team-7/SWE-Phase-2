# Logging Implementation Summary

This document summarizes the comprehensive logging that has been added to the project.

## Files Modified

### New Files Created
1. **`app/backend/src/utils/logger.js`** - Centralized logging utility with structured JSON logging
2. **`LOGGING.md`** - Complete documentation on how to use the logging system

### Files Enhanced with Logging

#### Core Infrastructure
1. **`app/backend/src/server.js`**
   - Server startup logging with configuration details
   - Request/response logging with timing information
   - All HTTP requests tracked with method, path, status code, and duration

#### Authentication System
2. **`app/backend/src/middleware/authMiddleware.js`**
   - Authentication attempt tracking
   - JWT verification logging
   - Token validation status
   - Admin access control logging

3. **`app/backend/src/routes/authenticate.js`**
   - Login attempt tracking
   - User lookup logging
   - Password validation status
   - Successful/failed authentication logging

4. **`app/backend/src/adapters/S3AuthAdapter.js`**
   - User creation/retrieval operations
   - Token storage and validation
   - Token usage tracking and limits
   - Token expiration handling

#### Artifact Management
5. **`app/backend/src/adapters/S3Adapter.js`**
   - All CRUD operations on artifacts (create, read, update, delete)
   - S3 operations with bucket and key information
   - Duplicate URL checking
   - Registry reset operations with counts
   - Debloat program management
   - History tracking operations

6. **`app/backend/src/routes/artifacts.js`**
   - Artifact retrieval requests
   - Artifact update operations
   - Artifact deletion operations
   - Search operations with result counts
   - Debloat program execution and validation

7. **`app/backend/src/routes/artifact.js`**
   - Already had some DEBUG logging for score validation

## Log Contexts

Each component logs with a specific context identifier for easy filtering:

| Context | Component | Purpose |
|---------|-----------|---------|
| `Server` | server.js | HTTP server and request handling |
| `AuthMiddleware` | authMiddleware.js | Authentication middleware |
| `AuthenticateRoute` | authenticate.js | Login endpoint |
| `S3AuthAdapter` | S3AuthAdapter.js | Authentication storage |
| `S3Adapter` | S3Adapter.js | Artifact storage |
| `ArtifactsRoute` | artifacts.js | Artifact CRUD operations |

## Key Logging Points

### Every Request Path
1. Server receives request → logs method, path, query params
2. Authentication middleware validates token → logs validation status
3. Route handler processes request → logs operation details
4. Adapter performs S3 operations → logs bucket/key operations
5. Response sent → logs status code and duration

### Critical Operations Logged

#### Artifact Operations
- ✅ Artifact creation with type and name
- ✅ Artifact retrieval with type and ID
- ✅ Artifact updates with old/new URLs
- ✅ Artifact deletion with type and ID
- ✅ Artifact search with query count and results
- ✅ Duplicate URL detection

#### Authentication Operations
- ✅ User login attempts (success/failure)
- ✅ Token generation and storage
- ✅ Token validation and usage tracking
- ✅ Token expiration and limit enforcement
- ✅ Admin access checks

#### S3 Operations
- ✅ All S3 reads (GetObject)
- ✅ All S3 writes (PutObject)
- ✅ All S3 deletes (DeleteObject)
- ✅ S3 list operations
- ✅ S3 errors and failures

## Log Levels Used

- **ERROR**: S3 failures, authentication errors, system errors
- **WARN**: Not found scenarios, validation failures, expired tokens
- **INFO**: Successful operations, state changes, key events
- **DEBUG**: Detailed operation steps, intermediate states

## Environment Configuration

Added to `.env`:
```env
LOG_LEVEL=INFO  # Options: ERROR, WARN, INFO, DEBUG
```

## Usage for Autograder Debugging

To debug autograder issues, set:
```env
LOG_LEVEL=DEBUG
```

Then check logs for:
1. **Authentication failures**: Look for `AuthMiddleware` or `AuthenticateRoute` context
2. **Missing artifacts**: Look for `S3Adapter` "not found" warnings
3. **S3 access issues**: Look for S3 error messages with bucket/key details
4. **Request failures**: Look at request completion logs with status codes
5. **Timing issues**: Check request duration in completion logs

## Example Debug Workflow

1. Set `LOG_LEVEL=DEBUG` in `.env`
2. Restart server
3. Run failing autograder test
4. Collect logs: `docker logs <container> > debug.log 2>&1`
5. Filter relevant logs:
   ```bash
   # Find authentication issues
   cat debug.log | jq 'select(.context | contains("Auth"))'
   
   # Find S3 errors
   cat debug.log | jq 'select(.level == "ERROR" and .context == "S3Adapter")'
   
   # Find specific artifact operations
   cat debug.log | jq 'select(.data.id == "failing-artifact-id")'
   
   # Find slow operations
   cat debug.log | jq 'select(.data.duration and (.data.duration | gsub("ms";"") | tonumber > 5000))'
   ```

## Benefits

1. **Structured JSON format** - Easy to parse and filter programmatically
2. **Consistent format** - All logs have timestamp, level, context, message, data
3. **Contextual information** - Each log includes relevant IDs, usernames, operation details
4. **Configurable verbosity** - Adjust LOG_LEVEL without code changes
5. **Performance tracking** - Request duration logged for all endpoints
6. **Complete audit trail** - Every authentication and artifact operation logged
7. **Error context** - Errors include operation context and parameters
8. **Easy filtering** - Use jq or other tools to find specific issues quickly
