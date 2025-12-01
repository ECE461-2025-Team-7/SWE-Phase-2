# Authentication Quick Reference

## 🚀 Quick Start

### 1. Install & Run
```bash
cd app
npm install
npm start
```

### 2. Get Token (PowerShell)
```powershell
$body = @{
  user = @{
    name = "ece30861defaultadminuser"
    is_admin = $true
  }
  secret = @{
    password = "correcthorsebatterystaple123(!__+@**(A'`"`;DROP TABLE artifacts;"
  }
} | ConvertTo-Json

$token = Invoke-RestMethod -Uri "http://localhost:3100/authenticate" -Method PUT -Body $body -ContentType "application/json"
```

### 3. Use Token
```powershell
Invoke-RestMethod -Uri "http://localhost:3100/artifacts" `
  -Method POST `
  -Headers @{"X-Authorization" = $token} `
  -Body '...' `
  -ContentType "application/json"
```

## 🔐 Default Admin Credentials
- **Username**: `ece30861defaultadminuser`
- **Password**: `correcthorsebatterystaple123(!__+@**(A'"`;DROP TABLE artifacts;`
- **is_admin**: `true`

## 📝 Protecting Routes

### Option 1: Protect all routes in a router
```javascript
import { authenticateToken } from "../middleware/authMiddleware.js";

router.use(authenticateToken);
// All routes below are protected
```

### Option 2: Protect specific routes
```javascript
import { authenticateToken, requireAdmin } from "../middleware/authMiddleware.js";

// Regular protected route
router.get("/data", authenticateToken, handler);

// Admin-only route
router.delete("/reset", authenticateToken, requireAdmin, handler);
```

### Option 3: Protect at server level
```javascript
// In server.js
import { authenticateToken } from "./middleware/authMiddleware.js";

// Public routes first
app.use("/authenticate", authenticateRouter);

// Then apply auth middleware
app.use(authenticateToken);

// All routes below are protected
app.use("/artifact", artifactRouter);
```

## 🎯 HTTP Status Codes
- **200**: Success - token returned
- **400**: Bad request - malformed body
- **401**: Unauthorized - invalid credentials OR insufficient permissions
- **403**: Forbidden - missing/invalid token

## 📁 Key Files
- `src/routes/authenticate.js` - Auth endpoint
- `src/middleware/authMiddleware.js` - Token validation
- `src/server.js` - Route registration

## 🔧 Environment Variables
```env
JWT_SECRET=your-secret-key-here
JWT_EXPIRY=24h
PORT=3100
```

## 📚 Full Documentation
- `test-authenticate.md` - Detailed testing examples
- `AUTHENTICATION_SETUP.md` - Complete setup guide
- `../AUTHENTICATION_SUMMARY.md` - Implementation overview
