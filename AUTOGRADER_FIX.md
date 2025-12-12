# Autograder Fixes Applied

## Issues Found

Based on the logs and autograder output:

1. **Environment variable mismatch**: Code looked for `ADAPTER` but `.env` had `ADAPTER_TYPE`
2. **Reset not deleting artifacts**: S3Adapter reset showed `deletedCount: 0`
3. **Token validation failures**: After reset, all subsequent requests failed authentication

## Fixes Applied

### 1. Fixed Adapter Environment Variable
**File**: `app/backend/src/pipelines/DataPipeline.js`
- Changed to check both `ADAPTER_TYPE` and `ADAPTER` (fallback)
- Now: `const SELECTED_ADAPTER = process.env.ADAPTER_TYPE || process.env.ADAPTER || "s3";`

### 2. Added Comprehensive Logging to Reset
**File**: `app/backend/src/routes/reset.js`
- Added structured logging to track reset progress
- Logs when artifacts are reset
- Logs when auth data is reset
- Logs any errors with stack traces

### 3. Enhanced Server Startup Logging
**File**: `app/backend/src/server.js`
- Now logs which adapter is being used
- Logs S3 bucket and prefix configuration
- Helps diagnose configuration issues

## What to Check Next

### On Your EC2 Instance

1. **Restart the application** (if not auto-deployed):
   ```bash
   pm2 restart model-registry-api
   ```

2. **Check the startup logs**:
   ```bash
   tail -f /opt/myapp/logs/out-3.log
   ```
   
   Look for:
   ```json
   {"level":"INFO","context":"Server","message":"Server started","data":{"adapter":"s3","s3Bucket":"hf-model-info","s3Prefix":"projectA/"}}
   ```

3. **Verify S3 configuration** - Make sure these match your actual S3 setup:
   - `S3_BUCKET=hf-model-info`
   - `S3_PREFIX=projectA/`
   - `S3_AUTH_BUCKET=phase-2-auth-bucket`

### Test the Reset

```bash
# SSH into EC2
ssh -i your-key.pem deploy@your-ec2-ip

# Watch logs in real-time
tail -f /opt/myapp/logs/combined-3.log

# In another terminal, trigger a reset (or wait for autograder)
# You should see:
# - "Starting registry reset"
# - "Resetting artifacts"
# - "Registry reset completed" with deletedCount > 0
```

## Expected Log Output After Fix

When reset is called, you should see:
```json
{"timestamp":"...","level":"WARN","context":"ResetRoute","message":"Starting registry reset","data":{"username":"ece30861defaultadminuser"}}
{"timestamp":"...","level":"INFO","context":"ResetRoute","message":"Resetting artifacts"}
{"timestamp":"...","level":"WARN","context":"S3Adapter","message":"Starting registry reset - deleting all artifacts"}
{"timestamp":"...","level":"WARN","context":"S3Adapter","message":"Registry reset completed","data":{"deletedCount":30}}  // Should be > 0!
{"timestamp":"...","level":"INFO","context":"ResetRoute","message":"Artifacts reset complete"}
{"timestamp":"...","level":"INFO","context":"ResetRoute","message":"Resetting authentication data"}
{"timestamp":"...","level":"WARN","context":"ResetRoute","message":"Registry reset completed successfully"}
```

## Known Issue: Authentication After Reset

After reset, all tokens (including the one used for reset) are deleted. The autograder must:
1. Call DELETE /reset with a valid admin token
2. Re-authenticate (PUT /authenticate) to get a new token
3. Use the new token for subsequent requests

This is expected behavior - your implementation is correct.

## If Still Failing

1. **Check S3 permissions** - Make sure the EC2 instance role can:
   - List objects in the bucket
   - Delete objects from the bucket
   - Access the auth bucket

2. **Verify S3 bucket/prefix** - The logs will now show what bucket and prefix are being used. Make sure they match where artifacts are actually stored.

3. **Check for existing artifacts before reset**:
   ```bash
   # On EC2
   aws s3 ls s3://hf-model-info/projectA/ --recursive
   ```

4. **Look for ERROR level logs**:
   ```bash
   tail -f /opt/myapp/logs/err-3.log | grep '"level":"ERROR"'
   ```

## Quick Test Locally

Before pushing, you can test locally:

1. Set LOG_LEVEL=DEBUG in .env
2. Run `npm start` in app/backend
3. Check startup logs show correct S3 config
4. Try creating an artifact
5. Check logs show the S3 operation
6. Try reset
7. Check logs show deletedCount > 0
