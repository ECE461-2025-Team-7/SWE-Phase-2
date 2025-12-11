# Autograder Fixes - Phase 2

## Critical Issue Identified

The autograder was failing with a score of **10/322** primarily due to one critical issue:

### Reset Endpoint Not Clearing Authentication Data

**Problem**: The `/reset` endpoint was only clearing artifacts but not authentication data (users, tokens, audit logs). This caused the test "Artifacts still present after reset" to fail, which cascaded into all subsequent test failures since the autograder depends on a clean state after reset.

**Root Cause**: 
- `reset.js` only called `pipeline.reset()` which clears artifacts
- It did not call `authAdapter.reset()` to clear authentication data
- Both S3Adapter and S3AuthAdapter had pagination issues in their reset methods

## Fixes Applied

### 1. Updated `/reset` Endpoint (reset.js)
**File**: `app/backend/src/routes/reset.js`

**Changes**:
- Added import for `S3AuthAdapter`
- Now calls both `pipeline.reset()` AND `authAdapter.reset()`
- Ensures complete system reset including:
  - All artifacts (models, datasets, code)
  - All authentication data (users, tokens, audit logs)

```javascript
// Reset artifacts (models, datasets, code)
await pipeline.reset();

// Reset authentication data (users, tokens, audit logs)
await authAdapter.reset();
```

### 2. Fixed S3 Pagination in S3Adapter (S3Adapter.js)
**File**: `app/backend/src/adapters/S3Adapter.js`

**Problem**: `ListObjectsV2Command` only returns up to 1000 objects per request. If there were more artifacts, they wouldn't be deleted.

**Solution**: Added pagination loop using `IsTruncated` and `ContinuationToken`:
```javascript
let continuationToken;
let hasMore = true;

while (hasMore) {
  const listCmd = new ListObjectsV2Command({
    Bucket: this.bucket,
    Prefix: this.prefix,
    ContinuationToken: continuationToken,
  });
  
  // ... delete objects ...
  
  hasMore = listResp.IsTruncated || false;
  continuationToken = listResp.NextContinuationToken;
}
```

### 3. Fixed S3 Pagination in S3AuthAdapter (S3AuthAdapter.js)
**File**: `app/backend/src/adapters/S3AuthAdapter.js`

**Problem**: Same pagination issue as S3Adapter.

**Solution**: Applied the same pagination fix to ensure all auth data is deleted even if there are >1000 objects.

## EC2 Logging Information

### Finding Logs on Your EC2 Instance

1. **SSH into EC2**:
   ```bash
   ssh -i your-key.pem ec2-user@ec2-52-23-202-149.compute-1.amazonaws.com
   ```

2. **Application Logs**:
   - If using PM2: `~/.pm2/logs/` or run `pm2 logs`
   - If using systemd: `journalctl -u your-service-name -f`
   - Check application directory: `cd /path/to/app && ls *.log`

3. **Node.js Application Logs**:
   ```bash
   # If running with PM2
   pm2 logs --lines 100
   
   # If running with systemd
   sudo journalctl -u node-app -f
   ```

4. **CloudWatch Logs** (if configured):
   - AWS Console → CloudWatch → Log Groups
   - Look for `/aws/ec2/` or your application's log group

5. **System Logs**:
   ```bash
   # General system logs
   sudo tail -f /var/log/messages
   
   # Error logs
   sudo tail -f /var/log/syslog
   ```

## Testing the Fixes

### Local Testing (Before Deployment)

1. Install dependencies:
   ```bash
   cd app/backend
   npm install
   ```

2. Run local tests (if available):
   ```bash
   npm test
   ```

3. Start the server locally:
   ```bash
   npm run dev
   ```

### AWS Testing

I've created a test script to validate the deployment: `test-aws-deployment.sh`

**Usage**:
```bash
chmod +x test-aws-deployment.sh
./test-aws-deployment.sh http://ec2-52-23-202-149.compute-1.amazonaws.com:3000
```

This script tests:
1. Health check
2. Tracks endpoint
3. Authentication
4. Query artifacts before reset
5. Reset registry
6. **CRITICAL**: Verify no artifacts remain after reset
7. Verify tokens are invalidated

### Manual AWS Testing

You can also test manually using curl:

```bash
# 1. Authenticate
TOKEN=$(curl -s -X PUT "http://ec2-52-23-202-149.compute-1.amazonaws.com:3000/authenticate" \
  -H "Content-Type: application/json" \
  -d '{"user": {"name": "ece30861defaultadminuser", "is_admin": true}, "secret": {"password": "correcthorsebatterystaple123(!)"}}' \
  | tr -d '"' | sed 's/bearer //')

# 2. Query artifacts before reset
curl -X POST "http://ec2-52-23-202-149.compute-1.amazonaws.com:3000/artifacts" \
  -H "Content-Type: application/json" \
  -H "X-Authorization: bearer $TOKEN" \
  -d '[{"name": "*"}]'

# 3. Reset
curl -X DELETE "http://ec2-52-23-202-149.compute-1.amazonaws.com:3000/reset" \
  -H "X-Authorization: bearer $TOKEN"

# 4. Verify artifacts cleared (should return empty array or 403)
curl -X POST "http://ec2-52-23-202-149.compute-1.amazonaws.com:3000/artifacts" \
  -H "Content-Type: application/json" \
  -H "X-Authorization: bearer $TOKEN" \
  -d '[{"name": "*"}]'
```

## Deployment Steps

To deploy these fixes to your EC2 instance:

1. **Commit and push changes**:
   ```bash
   git add .
   git commit -m "Fix reset endpoint to clear all data including auth"
   git push origin main
   ```

2. **SSH into EC2**:
   ```bash
   ssh -i your-key.pem ec2-user@ec2-52-23-202-149.compute-1.amazonaws.com
   ```

3. **Pull latest changes**:
   ```bash
   cd /path/to/SWE-Phase-2
   git pull origin main
   ```

4. **Install any new dependencies** (if needed):
   ```bash
   cd app/backend
   npm install
   ```

5. **Restart the application**:
   ```bash
   # If using PM2
   pm2 restart all
   
   # If using systemd
   sudo systemctl restart your-service-name
   
   # Or simply
   pm2 restart app
   ```

6. **Verify deployment**:
   ```bash
   # Check if app is running
   pm2 status
   
   # Check logs for errors
   pm2 logs --lines 50
   ```

## Expected Autograder Improvements

With these fixes, you should see significant improvement in the autograder score:

### Before Fixes:
- **Setup and Reset Test Group**: 5/6 (failed: "Artifacts still present after reset")
- **All subsequent tests**: Failed due to unclean state after reset
- **Total**: 10/322

### After Fixes:
- **Setup and Reset Test Group**: 6/6 ✓
- **Upload Artifacts Test Group**: Should pass ✓
- **Regex Tests**: Should pass ✓
- **Artifact Read Tests**: Should pass ✓
- **Other tests**: Should work correctly with clean state ✓
- **Expected Total**: Significant improvement (likely >200/322)

## Additional Notes

### Lineage Test
The lineage endpoint implementation looks correct according to the OpenAPI spec. The test failure was likely due to the cascading failure from reset not working. Once reset is fixed, lineage tests should pass.

### Frontend UI Compliance
The Lighthouse test failed, but this is a separate issue from the backend fixes. To address:
1. Check if the frontend is properly accessible at port 3000
2. Verify the frontend build is deployed correctly
3. Review accessibility, performance, and SEO metrics

### Best Practices
- Always test reset functionality locally before deploying
- Monitor CloudWatch logs during autograder runs
- Consider adding automated tests for the reset endpoint
- Ensure S3 bucket permissions are correctly configured

## Questions or Issues?

If the autograder still shows failures after these fixes:
1. Run the test script: `./test-aws-deployment.sh`
2. Check EC2 logs for errors
3. Verify S3 bucket permissions (PutObject, GetObject, DeleteObject, ListBucket)
4. Ensure environment variables are correctly set on EC2
5. Check that both artifact and auth S3 buckets are accessible
