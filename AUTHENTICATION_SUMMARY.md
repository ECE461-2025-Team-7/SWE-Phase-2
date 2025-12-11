# Authentication Implementation Summary

## Changes Made

### 1. Updated `http-helpers.js` to Use Proper JWT Validation

**File**: `app/src/utils/http-helpers.js`

**Changes**:
- Imported `authenticateToken` and `requireAdmin` from `authMiddleware.js`
- Changed `requireAuth` from a placeholder function to use `authenticateToken` middleware
- Changed `validateResetToken` to use `requireAdmin` middleware

**Before**:
```javascript
export function requireAuth(req, res, next) {
  const token = req.header("X-Authorization");
  if (!token) return res.status(403).json({ error: "Missing X-Authorization header." });
  // Can add proper validation logic here later
  return next();
}
```

**After**:
```javascript
import { authenticateToken, requireAdmin } from "../middleware/authMiddleware.js";

// Now uses proper JWT validation from authMiddleware
export const requireAuth = authenticateToken;

// Requires admin privileges for reset operations
export const validateResetToken = requireAdmin;
```

## Authentication Flow

### How It Works

1. **User Authentication** (`PUT /authenticate`):
   - User sends credentials (username, password, is_admin)
   - Server validates credentials against default admin account
   - Server generates JWT token signed with secret key
   - Returns token in format: `bearer <jwt_token>`

2. **Protected Endpoint Access**:
   - Client includes token in `X-Authorization` header
   - `authenticateToken` middleware:
     - Extracts token from header
     - Validates format (`bearer <token>`)
     - Verifies JWT signature
     - Checks expiration
     - Attaches user info to `req.user`
   - If invalid/missing: Returns **403** error
   - If valid: Proceeds to route handler

3. **Admin-Only Endpoints** (`DELETE /reset`):
   - First validates token (403 if invalid)
   - Then checks `req.user.is_admin` (401 if not admin)

## Protected Endpoints

According to the OpenAPI spec, these endpoints require authentication:

| Endpoint | Method | Auth Required | Admin Required |
|----------|--------|---------------|----------------|
| `/artifacts` | POST | ✓ | ✗ |
| `/artifact/{type}` | POST | ✓ | ✗ |
| `/artifacts/{type}/{id}` | GET | ✓ | ✗ |
| `/artifacts/{type}/{id}` | PUT | ✓ | ✗ |
| `/artifacts/{type}/{id}` | DELETE | ✓ | ✗ |
| `/artifact/model/{id}/rate` | GET | ✓ | ✗ |
| `/artifact/{type}/{id}/cost` | GET | ✓ | ✗ |
| `/artifact/byName/{name}` | GET | ✓ | ✗ |
| `/artifact/byRegEx` | POST | ✓ | ✗ |
| `/artifact/{type}/{id}/audit` | GET | ✓ | ✗ |
| `/artifact/model/{id}/lineage` | GET | ✓ | ✗ |
| `/artifact/model/{id}/license-check` | POST | ✓ | ✗ |
| `/reset` | DELETE | ✓ | **✓** |

**Not protected**: `/health`, `/health/components`, `/tracks`, `/authenticate`

## Error Responses

Per OpenAPI specification:

- **400**: Bad Request - Missing/malformed fields
- **401**: Unauthorized - User doesn't have permission (admin check failed)
- **403**: Forbidden - Invalid or missing authentication token (JWT validation failed)
- **404**: Not Found - Artifact doesn't exist

## Testing

### Run Authentication Tests

1. **Basic Authentication Tests**:
   ```powershell
   .\test-authenticate.ps1
   ```

2. **All Protected Endpoints Tests**:
   ```powershell
   .\test-auth-all-endpoints.ps1
   ```

### Example Usage

#### Get Token
```powershell
$password = "correcthorsebatterystaple123(!__+@**(A'" + '"`' + "`;DROP TABLE artifacts;"
$body = @{
  user = @{
    name = "ece30861defaultadminuser"
    is_admin = $true
  }
  secret = @{
    password = $password
  }
} | ConvertTo-Json -Depth 10

$token = Invoke-RestMethod -Uri "http://localhost:3100/authenticate" -Method PUT -Body $body -ContentType "application/json"
```

#### Use Token
```powershell
# Any protected endpoint
Invoke-RestMethod -Uri "http://localhost:3100/artifacts/model/123" -Method GET -Headers @{"X-Authorization" = $token}
```

## Security Notes

1. **JWT Secret**: Currently using default secret. In production, set `JWT_SECRET` environment variable
2. **Token Expiry**: Default 24 hours. Configure with `JWT_EXPIRY` environment variable
3. **Password Storage**: Default admin password is hardcoded (for development only)
4. **HTTPS**: Use HTTPS in production to protect tokens in transit

## Default Admin Credentials

- **Username**: `ece30861defaultadminuser`
- **Password**: `correcthorsebatterystaple123(!__+@**(A'"\``;DROP TABLE artifacts;`
- **is_admin**: `true`

**Note**: The password contains special characters that require careful escaping in PowerShell. Use the string concatenation method shown above.
