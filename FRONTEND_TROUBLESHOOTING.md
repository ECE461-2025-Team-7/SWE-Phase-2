# Frontend Login & Environment Troubleshooting Guide

## Current Frontend Configuration

The frontend uses `VITE_API_URL` environment variable to determine the backend API URL.

**File**: `app/frontend/src/apiClient.js` (Line 4)
```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || '';
```

## Environment Setup

### Option 1: Using Vite Proxy (Development - Recommended)

**When to use**: Local development or when frontend and backend are on same server

**No `.env` file needed!** The Vite proxy is already configured in `vite.config.js`:
```javascript
proxy: {
  '/authenticate': 'http://localhost:3100',
  '/health': 'http://localhost:3100',
  '/artifact': 'http://localhost:3100',
  '/artifacts': 'http://localhost:3100',
  '/tracks': 'http://localhost:3100',
  '/reset': 'http://localhost:3100',
}
```

This works because:
- Frontend runs on `http://localhost:3000` (or EC2 public IP:3000)
- Requests to `/authenticate`, `/artifact`, etc. are proxied to `http://localhost:3100`
- No CORS issues since proxy handles it

### Option 2: Direct API URL (Production/EC2)

**When to use**: When you need to access backend from a different machine

Create `app/frontend/.env`:
```bash
# For local development accessing EC2 backend
VITE_API_URL=http://ec2-52-23-202-149.compute-1.amazonaws.com:3100

# OR for production on EC2 (accessing itself)
VITE_API_URL=http://localhost:3100
```

**IMPORTANT**: 
- Environment variables in Vite MUST start with `VITE_`
- You must restart the dev server after changing `.env`
- `.env` is read at build time, not runtime

## EC2 Production Setup

### Backend .env (`/opt/myapp/.env`)
```bash
# AWS Configuration
AWS_REGION=us-east-1

# S3 Storage
S3_BUCKET=hf-model-info
S3_PREFIX=projectA/
S3_AUTH_BUCKET=hf-model-info
S3_AUTH_PREFIX=projectA/auth/

# Server
PORT=3100
ADAPTER_TYPE=s3

# Auth
JWT_EXPIRY=24h

# Rating
MIN_NET_SCORE=0.3

# Logging
LOG_LEVEL=INFO
```

### Frontend .env (`/opt/myapp/app/frontend/.env`)

**Option A: Using localhost (backend on same machine)**
```bash
# Frontend proxies to backend on same EC2 instance
# Leave empty to use Vite proxy configuration
# VITE_API_URL=
```

**Option B: Direct URL**
```bash
VITE_API_URL=http://localhost:3100
```

## Troubleshooting Steps

### 1. Check Browser Console
Open Chrome DevTools (F12) → Console tab when trying to log in.

**What to look for:**
```
API Request: PUT /authenticate
Request body: {"user":{"name":"..."},"secret":{"password":"..."}}
API Response: 200 OK
```

**Common errors:**
- `Failed to fetch` → Backend not running or CORS issue
- `404 Not Found` → Wrong URL or proxy not working
- `401 Unauthorized` → Wrong credentials
- `CORS error` → Backend not allowing frontend origin

### 2. Check Network Tab
Chrome DevTools → Network tab → Try to log in

**Check the request:**
- URL: Should be `/authenticate` (if using proxy) or `http://...:3100/authenticate` (if using direct URL)
- Method: PUT
- Status: Should be 200
- Response: Should contain token

**If URL is wrong:**
- Using proxy: URL should be `/authenticate` (relative)
- Using direct: URL should include full backend URL

### 3. Test Backend Directly

From your local machine's PowerShell:
```powershell
# Test backend health
curl http://ec2-52-23-202-149.compute-1.amazonaws.com:3100/health

# Test authentication
curl -X PUT http://ec2-52-23-202-149.compute-1.amazonaws.com:3100/authenticate `
  -H "Content-Type: application/json" `
  -d '{\"user\":{\"name\":\"ece30861defaultadminuser\",\"is_admin\":true},\"secret\":{\"password\":\"correcthorsebatterystaple123(!__+@**(A'\''\\\"`;DROP TABLE packages;\"}}'
```

**Expected response:**
```json
"bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 4. Check Frontend is Running

On EC2:
```bash
pm2 logs frontend-dev
```

Should see:
```
VITE v5.4.21  ready in 654 ms
➜  Local:   http://localhost:3000/
➜  Network: http://172.31.30.212:3000/
```

### 5. Access Frontend

**From browser on your local machine:**
```
http://ec2-52-23-202-149.compute-1.amazonaws.com:3000
```

**The login form should show with default credentials pre-filled.**

## Common Issues & Solutions

### Issue 1: "Failed to fetch" or Network Error

**Cause**: Frontend can't reach backend

**Solutions:**
1. Check backend is running: `pm2 status model-registry-api`
2. Check backend port: `netstat -tlnp | grep 3100`
3. Check EC2 security group allows port 3100 (should allow TCP 3100 from 0.0.0.0/0)
4. Try direct backend URL: `curl http://localhost:3100/health` on EC2

### Issue 2: CORS Error in Browser Console

**Cause**: Backend not allowing frontend origin

**Solution**: Backend CORS is already configured to allow all origins (`*`). If still seeing CORS:
1. Check you're not mixing http/https
2. Try using the proxy method (leave `VITE_API_URL` empty)

### Issue 3: 401 Unauthorized

**Cause**: Wrong password or user doesn't exist

**Default password has special characters - copy carefully:**
```
correcthorsebatterystaple123(!__+@**(A'"`;DROP TABLE packages;
```

**To verify user exists on EC2:**
```bash
cd /opt/myapp/app/backend
node seed-admin.js
```

Should see:
```
✓ Default admin user already exists.
```

Or:
```
✅ Default admin user created successfully!
```

### Issue 4: Token Not Stored After Login

**Cause**: Frontend not setting token correctly

**Check**:
1. Open browser DevTools → Application tab → Local Storage
2. Should see `auth_token`, `auth_name`, `auth_isAdmin`

**If missing**: The authenticate response format might be wrong. Check Network tab response.

### Issue 5: Can't Upload After Login

**Cause**: Token not being sent or validation failing

**Check in Network tab** that subsequent requests include:
```
X-Authorization: bearer eyJhbGciOiJIUzI1...
```

## Testing Upload from Frontend

After successful login:

1. Go to "Upload Artifact" page
2. Enter a model URL: `https://huggingface.co/bert-base-uncased`
3. Click Upload
4. Check browser console for errors
5. Check PM2 logs on EC2:
   ```bash
   pm2 logs model-registry-api --lines 100
   ```

Look for:
```
[UPLOAD] Starting artifact upload
[UPLOAD] Validating artifact score for URL: ...
[DEBUG] Scoring details: { threshold: 0.3, score: ... }
```

## Quick Test Script

Save this as `test-frontend.ps1` on your local machine:

```powershell
# Test backend is accessible
Write-Host "Testing backend health..." -ForegroundColor Yellow
$health = Invoke-RestMethod -Uri "http://ec2-52-23-202-149.compute-1.amazonaws.com:3100/health"
Write-Host "Health check: $health" -ForegroundColor Green

# Test authentication
Write-Host "`nTesting authentication..." -ForegroundColor Yellow
$authBody = @{
    user = @{ name = "ece30861defaultadminuser"; is_admin = $true }
    secret = @{ password = "correcthorsebatterystaple123(!__+@**(A'`"`;DROP TABLE packages;" }
} | ConvertTo-Json

$authResponse = Invoke-RestMethod -Uri "http://ec2-52-23-202-149.compute-1.amazonaws.com:3100/authenticate" `
    -Method PUT `
    -ContentType "application/json" `
    -Body $authBody

Write-Host "Token received: $($authResponse.Substring(0, 50))..." -ForegroundColor Green

# Test upload
Write-Host "`nTesting artifact upload..." -ForegroundColor Yellow
$token = $authResponse.Replace("bearer ", "")
$uploadBody = @{ url = "https://huggingface.co/bert-base-uncased" } | ConvertTo-Json

try {
    $uploadResponse = Invoke-RestMethod `
        -Uri "http://ec2-52-23-202-149.compute-1.amazonaws.com:3100/artifact/model" `
        -Method POST `
        -ContentType "application/json" `
        -Headers @{ "X-Authorization" = "bearer $token" } `
        -Body $uploadBody
    
    Write-Host "Upload successful! Artifact ID: $($uploadResponse.metadata.id)" -ForegroundColor Green
} catch {
    Write-Host "Upload failed: $_" -ForegroundColor Red
}
```

Run with: `.\test-frontend.ps1`

## Environment Variables Summary

| Variable | Location | Value | Purpose |
|----------|----------|-------|---------|
| `PORT` | Backend `.env` | `3100` | Backend server port |
| `S3_BUCKET` | Backend `.env` | `hf-model-info` | S3 bucket for artifacts |
| `S3_PREFIX` | Backend `.env` | `projectA/` | S3 prefix for artifacts |
| `S3_AUTH_BUCKET` | Backend `.env` | `hf-model-info` | S3 bucket for auth |
| `S3_AUTH_PREFIX` | Backend `.env` | `projectA/auth/` | S3 prefix for auth |
| `MIN_NET_SCORE` | Backend `.env` | `0.3` | Minimum rating threshold |
| `VITE_API_URL` | Frontend `.env` | (empty) or `http://localhost:3100` | Backend API URL |

## Next Steps

1. ✅ Verify backend is running: `pm2 status`
2. ✅ Test backend directly: `curl http://localhost:3100/health`
3. ✅ Check `.env` files are correct
4. ✅ Restart services: `pm2 restart all`
5. ✅ Access frontend: `http://ec2-....:3000`
6. ✅ Open browser console (F12) and try to log in
7. ✅ Check Network tab for request/response details
8. ✅ Monitor PM2 logs: `pm2 logs model-registry-api`
