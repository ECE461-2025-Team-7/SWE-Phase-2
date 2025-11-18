# URL Ingest Debug Improvements & Token Usage Tracking

## Overview
This document summarizes the improvements made to:
1. Add comprehensive debug logging to the URL scoring/rating system
2. Implement token expiration (10h) and usage limits (1000 uses) per project spec

## Changes Made

### 1. Debug Logging for URL Scoring (`app/src/routes/artifact.js`)

**Problem**: URLs were being rejected with "doesn't score high enough" error, but there was no visibility into what scores were being calculated.

**Solution**: Added comprehensive debug logging throughout the `score_validate` function:

```javascript
[DEBUG] score_validate called for URL: <url>
[DEBUG] Python stderr: <any stderr output>
[DEBUG] Python stdout (raw): <first 500 chars>
[DEBUG] Parsed JSON successfully. Keys: <object keys>
[DEBUG] Scoring details:
  - Threshold: <threshold value>
  - Raw net_score from Python: <raw score>
  - Parsed score: <parsed score>
  - Score >= Threshold: <boolean>
  - Pass validation: <boolean>
```

**What to look for**:
- Check if Python is executing successfully (no spawn errors)
- Verify the `net_score` value being returned
- Compare the score to the threshold (default 0.5, configurable via `MIN_NET_SCORE` or `RATING_THRESHOLD` env vars)
- Check stderr for Python-side debug messages

### 2. Debug Logging for Python Rating (`src/web_utils.py`)

**Problem**: No visibility into what happens during the Python scoring process.

**Solution**: Added debug logging at key points in the rating pipeline:

```python
[DEBUG] _rate_one_entry called with URL: <url>
[DEBUG] Creating model context for URL: <url>
[DEBUG] Context created successfully
[DEBUG] Calculating metrics for context
[DEBUG] Metrics calculated. Count: <number>
[DEBUG] Net score calculated: <score>
[DEBUG] Model result finalized. net_score in result: <score>
[DEBUG] Returning result with net_score: <score>
```

**Error scenarios also logged**:
```python
[DEBUG] Context creation failed: <error>
[DEBUG] Exception during metric calculation: <error>
[DEBUG] Attempting to create default result
[DEBUG] Default result creation also failed: <error>
```

**What to look for**:
- Check if context creation succeeds for the URL
- Verify metrics are being calculated (count should be > 0)
- See the actual net_score value computed
- Identify any exceptions in the calculation pipeline

### 3. Token Expiration - 10 Hour Limit

**Problem**: Tokens were set to expire in 24 hours, but project spec requires 10 hours.

**Changes**:
- `app/src/routes/authenticate.js` line 12: Changed `JWT_EXPIRY` default from `"24h"` to `"10h"`
- `app/src/routes/authenticate.js` line 88: Updated token storage expiry calculation from `24 * 60 * 60 * 1000` to `10 * 60 * 60 * 1000`

**Result**: Tokens now expire after 10 hours unless overridden by `JWT_EXPIRY` environment variable.

### 4. Token Usage Limit - 1000 Uses

**Problem**: Tokens had expiration but no usage limit tracking. Project spec requires 1000 use limit.

**Changes**:

#### A. S3AuthAdapter - Token Storage (`app/src/adapters/S3AuthAdapter.js`)

Added fields to token metadata:
```javascript
{
  username: "...",
  expires_at: "...",
  stored_at: "...",
  usage_count: 0,        // NEW: Initialize to 0
  usage_limit: 1000      // NEW: 1000 use limit
}
```

#### B. S3AuthAdapter - Usage Tracking Method

Added new `incrementTokenUsage(tokenHash)` method that:
1. Retrieves current token data
2. Checks if token is expired (returns null if expired)
3. Increments `usage_count`
4. Checks if count exceeds `usage_limit` (returns null if exceeded)
5. Updates token in S3 with new usage count and `last_used_at` timestamp
6. Returns updated token data or null

#### C. Authentication Middleware (`app/src/middleware/authMiddleware.js`)

**Changed**: `authenticateToken` from synchronous to **async** function

**Added**: Token usage tracking and enforcement:
```javascript
// Track token usage in S3 and enforce limits
const tokenHash = token.substring(0, 64);
const updatedTokenData = await authAdapter.incrementTokenUsage(tokenHash);

if (!updatedTokenData) {
  // Token not found, expired, or usage limit exceeded
  return res.status(403).json({ 
    error: "Authentication failed due to invalid or missing AuthenticationToken." 
  });
}
```

**Result**: Every authenticated request now:
1. Increments the token's usage counter
2. Checks expiration
3. Enforces 1000 use limit
4. Returns 403 if token is expired or limit exceeded

## Testing the Changes

### Test URL Scoring Debug Output

1. Start the server: `npm start` (in `app/` directory)
2. Attempt to upload a URL:
   ```powershell
   $token = "bearer <your-token>"
   $body = @{ url = "https://github.com/someuser/somerepo" } | ConvertTo-Json
   Invoke-RestMethod -Uri "http://localhost:3100/artifact/model" -Method POST `
     -Headers @{"X-Authorization" = $token} `
     -Body $body -ContentType "application/json"
   ```
3. Check server console output for `[DEBUG]` messages
4. Look for:
   - The threshold being used
   - The actual net_score calculated
   - Whether the comparison passes

### Test Token Expiration

1. Create a token with short expiry:
   ```bash
   JWT_EXPIRY=1m npm start  # 1 minute expiry
   ```
2. Get a token
3. Wait 1 minute
4. Try to use the token - should get 403 error

### Test Token Usage Limit

1. Get a new token
2. Make authenticated requests
3. Check token usage in S3 at `auth/tokens/<tokenHash>.json` - should see:
   ```json
   {
     "username": "ece30861defaultadminuser",
     "expires_at": "...",
     "stored_at": "...",
     "usage_count": 5,
     "usage_limit": 1000,
     "last_used_at": "2025-11-17T..."
   }
   ```
4. To test limit, temporarily modify line 177 in `S3AuthAdapter.js` to use a lower limit (e.g., `const usageLimit = 3;`)

## Environment Variables

### Rating Threshold
```bash
MIN_NET_SCORE=0.5          # Preferred variable name
RATING_THRESHOLD=0.5       # Fallback
```

### Token Configuration
```bash
JWT_SECRET=your-secret-key  # JWT signing secret
JWT_EXPIRY=10h             # Token expiration time (default: 10h)
```

## Troubleshooting

### URLs Still Being Rejected

1. Check debug output for the actual `net_score` value
2. Check the threshold value being used
3. Verify Python is executing without errors
4. Check Python stderr for exceptions
5. Try lowering the threshold: `MIN_NET_SCORE=0.1`

### Token Usage Not Being Tracked

1. Verify S3 bucket is configured correctly
2. Check S3 permissions for read/write on token objects
3. Look for errors in server logs when incrementing usage
4. Verify token is being stored with `usage_count` field initially

### Token Expires Too Quickly

1. Check `JWT_EXPIRY` environment variable
2. Verify line 88 in `authenticate.js` matches JWT_EXPIRY setting
3. Check token's `expires_at` field in S3

## Notes

- All debug logging uses `[DEBUG]` prefix for easy filtering
- Token usage tracking is atomic (read-modify-write per request)
- Usage limit enforcement is automatic - tokens are revoked when limit is exceeded
- Both expiration and usage limits can be customized per token if needed
- Express automatically handles async middleware functions, so the change to `authenticateToken` is backward compatible

## Future Improvements

1. Add token usage monitoring endpoint for admins
2. Add rate limiting per user/token
3. Add token refresh mechanism before expiry
4. Add usage statistics/analytics
5. Consider using atomic operations for usage counting (to prevent race conditions under high load)
