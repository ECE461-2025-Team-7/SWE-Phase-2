# Authentication Implementation Guide

## Overview

This implementation provides a minimal JWT-based authentication system for the ECE 461 Trustworthy Model Registry API. It includes:

1. **Authentication Endpoint** (`PUT /authenticate`) - Issues JWT tokens
2. **Authentication Middleware** - Validates tokens on protected routes
3. **Default Admin Credentials** - As specified in the OpenAPI spec

## Files Created

```
app/
├── src/
│   ├── routes/
│   │   └── authenticate.js          # Authentication endpoint handler
│   ├── middleware/
│   │   └── authMiddleware.js        # JWT verification middleware
│   └── server.js                    # Updated to register /authenticate route
├── package.json                      # Updated with jsonwebtoken dependency
├── test-authenticate.md              # Testing guide
└── AUTHENTICATION_SETUP.md           # This file
```

## How It Works

### 1. Authentication Flow
```
Client → PUT /authenticate with credentials → Server validates → Returns JWT token
Client → Uses token in X-Authorization header → Server validates token → Grants access
```

### 2. Token Format
- **Request**: Admin credentials (username + password)
- **Response**: `"bearer <JWT_TOKEN>"`
- **Header Usage**: `X-Authorization: bearer <JWT_TOKEN>`

### 3. Default Admin Credentials
From OpenAPI spec (lines 419-423):
```javascript
{
  user: {
    name: "ece30861defaultadminuser",
    is_admin: true
  },
  secret: {
    password: "correcthorsebatterystaple123(!__+@**(A'\"`;DROP TABLE artifacts;"
  }
}
```

## Applying Authentication to Existing Routes

To protect your existing routes, import and apply the middleware:

### Example: Protecting All Routes in a Router

```javascript
// In your route file (e.g., artifacts.js)
import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Apply authentication to all routes in this router
router.use(authenticateToken);

// Now all routes below are protected
router.get("/:artifact_type/:id", async (req, res) => {
  // req.user will be available here with {name, is_admin}
  console.log("Authenticated user:", req.user);
  // ... your logic
});

router.post("/", async (req, res) => {
  // ... your logic
});

export default router;
```

### Example: Protecting Specific Routes

```javascript
// In your route file
import express from "express";
import { authenticateToken, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public route (no auth required)
router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Protected route (auth required)
router.get("/artifacts", authenticateToken, (req, res) => {
  // req.user is available
  res.json({ user: req.user });
});

// Admin-only route (auth + admin required)
router.delete("/reset", authenticateToken, requireAdmin, (req, res) => {
  // Only admin users can access this
  res.json({ message: "Registry reset" });
});

export default router;
```

### Example: Applying to Server Level

```javascript
// In server.js - apply to all routes at once
import { authenticateToken } from "./middleware/authMiddleware.js";

const app = express();
app.use(express.json());

// Public routes (before middleware)
app.get("/health", (req, res) => res.json({ ok: true }));
app.use("/authenticate", authenticateRouter);

// Apply authentication to all routes below
app.use(authenticateToken);

// All these routes are now protected
app.use("/artifact", artifactRouter);
app.use("/artifacts", artifactsRouter);
app.use("/artifact/model", rateRouter);
```

## According to OpenAPI Spec

The OpenAPI spec indicates these endpoints require `X-Authorization` header:

### BASELINE Endpoints (Require Auth)
- `POST /artifacts` - List artifacts
- `DELETE /reset` - Reset registry (also requires admin)
- `GET /artifacts/{artifact_type}/{id}` - Get artifact
- `PUT /artifacts/{artifact_type}/{id}` - Update artifact
- `POST /artifact/{artifact_type}` - Create artifact
- `GET /artifact/model/{id}/rate` - Get model rating
- `GET /artifact/{artifact_type}/{id}/cost` - Get artifact cost
- `GET /artifact/model/{id}/lineage` - Get lineage graph
- `POST /artifact/model/{id}/license-check` - License check
- `POST /artifact/byRegEx` - Search by regex

### NON-BASELINE Endpoints (Require Auth)
- `DELETE /artifacts/{artifact_type}/{id}` - Delete artifact
- `GET /artifact/byName/{name}` - Get by name
- `GET /artifact/{artifact_type}/{id}/audit` - Get audit trail

### Public Endpoints (No Auth)
- `PUT /authenticate` - Get token
- `GET /tracks` - Get planned tracks (no auth mentioned)

## Recommended Implementation Steps

1. **Install dependencies**:
   ```bash
   cd app
   npm install
   ```

2. **Test authentication endpoint**:
   - Start server: `npm start`
   - Test with PowerShell or curl (see test-authenticate.md)
   - Verify token is returned

3. **Apply middleware to protected routes**:
   - Start with one route file (e.g., `artifacts.js`)
   - Add `authenticateToken` middleware
   - Test with valid and invalid tokens

4. **Apply to all routes**:
   - Once verified, apply to all route files
   - Or apply at server level in `server.js`

5. **Handle admin-only routes**:
   - For `/reset`, add both `authenticateToken` and `requireAdmin`
   - Example: `router.delete("/reset", authenticateToken, requireAdmin, handler)`

## Environment Configuration

Create/update `.env` file in the `app` directory:

```env
# Server configuration
PORT=3100

# JWT configuration
JWT_SECRET=your-secure-secret-key-change-in-production
JWT_EXPIRY=24h
```

**Important**: In production, use a strong, randomly generated JWT_SECRET!

## Error Responses

The middleware returns these errors:

### 403 - Invalid/Missing Token
```json
{
  "error": "Authentication failed due to invalid or missing AuthenticationToken."
}
```

### 401 - Insufficient Permissions
```json
{
  "error": "You do not have permission to perform this action."
}
```

## Testing Protected Endpoints

Once you have a token:

```powershell
# Get token first
$authResponse = Invoke-RestMethod -Uri "http://localhost:3100/authenticate" -Method PUT -Body $body -ContentType "application/json"
$token = $authResponse

# Use token on protected endpoint
Invoke-RestMethod -Uri "http://localhost:3100/artifacts/model/123" -Method GET -Headers @{"X-Authorization" = $token}
```

## Next Steps

1. ✅ Authentication endpoint implemented
2. ✅ JWT middleware created
3. ⏳ Apply middleware to existing routes
4. ⏳ Test all protected endpoints
5. ⏳ Add proper error handling
6. ⏳ Consider adding user management (beyond default admin)

## Security Notes

This is a **minimal implementation** for development/testing:

- ✅ Uses JWT for stateless authentication
- ✅ Validates credentials against spec defaults
- ✅ Token expiration supported
- ⚠️ Hardcoded admin credentials (as per spec)
- ⚠️ Simple secret management (use env vars in production)
- ⚠️ No password hashing (spec provides plaintext password)
- ⚠️ No user database (only default admin)
- ⚠️ No refresh tokens

For production, consider:
- Proper user management system
- Password hashing (bcrypt)
- Refresh token mechanism
- Rate limiting on /authenticate
- Audit logging
- Token revocation list
