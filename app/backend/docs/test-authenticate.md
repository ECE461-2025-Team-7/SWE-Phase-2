# Testing the /authenticate Endpoint

## Installation
First, install the dependencies (including jsonwebtoken):
```bash
cd app
npm install
```

## Starting the Server
```bash
npm start
# or for development with auto-reload:
npm run dev
```

## Testing with curl (PowerShell)

### Successful Authentication
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

Invoke-RestMethod -Uri "http://localhost:3100/authenticate" -Method PUT -Body $body -ContentType "application/json"
```

### Invalid Credentials (401)
```powershell
$body = @{
  user = @{
    name = "wronguser"
    is_admin = $true
  }
  secret = @{
    password = "wrongpassword"
  }
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3100/authenticate" -Method PUT -Body $body -ContentType "application/json"
```

### Missing Fields (400)
```powershell
$body = @{
  user = @{
    name = "ece30861defaultadminuser"
  }
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3100/authenticate" -Method PUT -Body $body -ContentType "application/json"
```

## Testing with curl (Linux/Mac)
```bash
# Successful authentication
curl -X PUT http://localhost:3100/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "user": {
      "name": "ece30861defaultadminuser",
      "is_admin": true
    },
    "secret": {
      "password": "correcthorsebatterystaple123(!__+@**(A'\''\"`;DROP TABLE artifacts;"
    }
  }'
```

## Using the Token on Protected Endpoints

Once you receive a token like `"bearer eyJhbGciOiJIUzI1..."`, use it in the `X-Authorization` header:

### PowerShell
```powershell
$token = "bearer eyJhbGciOiJIUzI1..."
Invoke-RestMethod -Uri "http://localhost:3100/artifacts" -Method POST -Headers @{"X-Authorization" = $token} -Body $body -ContentType "application/json"
```

### Bash
```bash
TOKEN="bearer eyJhbGciOiJIUzI1..."
curl -X POST http://localhost:3100/artifacts \
  -H "X-Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

## Expected Response Format

### Success (200)
```json
"bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiZWNlMzA4NjFkZWZhdWx0YWRtaW51c2VyIiwiaXNfYWRtaW4iOnRydWUsImlhdCI6MTczMDk1NTE2OSwiZXhwIjoxNzMxMDQxNTY5fQ.signature"
```

### Error (400)
```json
{
  "error": "Missing field(s) in the AuthenticationRequest or it is formed improperly."
}
```

### Error (401)
```json
{
  "error": "The user or password is invalid."
}
```

## Default Admin Credentials

From the OpenAPI spec:
- **Username**: `ece30861defaultadminuser`
- **is_admin**: `true`
- **Password**: `correcthorsebatterystaple123(!__+@**(A'"`;DROP TABLE artifacts;`

## Environment Variables

You can customize the JWT configuration by setting these environment variables:

```bash
JWT_SECRET=your-secure-secret-key
JWT_EXPIRY=24h  # Token expiration time (e.g., "1h", "7d", "30d")
```

Create a `.env` file in the `app` directory:
```
PORT=3100
JWT_SECRET=your-secure-secret-key-change-in-production
JWT_EXPIRY=24h
```
