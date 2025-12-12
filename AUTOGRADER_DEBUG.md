# Autograder Debugging Guide

Practical guide for using the logging system to debug autograder failures.

## How It Works

When your application runs on the autograder's EC2 instance, all logs are written to stdout (console). The autograder captures this output, so you'll see the JSON formatted logs in the autograder results.

## Step 1: Enable Debug Logging

In your `.env` file, set:
```env
LOG_LEVEL=DEBUG
```

Commit and push this change so the autograder uses it.

## Step 2: Run the Autograder

Submit your code to the autograder. It will run your application and capture all output.

## Step 3: Get the Logs

The autograder output will include your application logs mixed with test output. Look for lines that start with `{"timestamp"` - these are your structured logs.

Example autograder output:
```
Running test: POST /artifact/model
{"timestamp":"2025-12-12T02:30:05.123Z","level":"INFO","context":"Server","message":"Incoming request","data":{"method":"POST","path":"/artifact/model"}}
{"timestamp":"2025-12-12T02:30:05.150Z","level":"INFO","context":"AuthMiddleware","message":"Authenticating request","data":{"method":"POST","path":"/artifact/model"}}
{"timestamp":"2025-12-12T02:30:05.200Z","level":"ERROR","context":"S3Adapter","message":"Error creating artifact","data":{"error":"AccessDenied"}}
Test failed: Expected 201, got 500
```

## Step 4: Extract and Analyze Logs

### Option A: Manual Search (Quick)

Just read through the autograder output and look for:
- **Errors**: Lines with `"level":"ERROR"`
- **Warnings**: Lines with `"level":"WARN"`
- **Your failing operation**: Search for the artifact ID or endpoint that failed

### Option B: Save and Filter (Thorough)

1. Copy the autograder output to a file on your local machine (e.g., `autograder-output.txt`)

2. Extract just the JSON logs:
   ```bash
   # PowerShell (on your Windows machine)
   Get-Content autograder-output.txt | Select-String '^\{"timestamp"' > logs.jsonl
   ```

3. View specific logs (requires `jq` - install from https://jqlang.github.io/jq/):
   ```bash
   # Show only errors
   cat logs.jsonl | jq -c 'select(.level == "ERROR")'
   
   # Show specific operation
   cat logs.jsonl | jq -c 'select(.message | contains("Creating artifact"))'
   
   # Show all S3 operations
   cat logs.jsonl | jq -c 'select(.context == "S3Adapter")'
   ```

## Common Issues and What to Look For

### Issue: Authentication Failures (401/403)

**Look for:**
```bash
cat logs.jsonl | jq -c 'select(.context | contains("Auth"))'
```

**Check:**
- Does the user exist? Look for "User not found"
- Is the password correct? Look for "invalid password"
- Is the token valid? Look for "Token validation failed"
- Is the token expired? Look for "expired"

### Issue: Artifact Not Found (404)

**Look for:**
```bash
cat logs.jsonl | jq -c 'select(.message | contains("not found"))'
```

**Check:**
- Was the artifact created? Look for "Artifact created successfully"
- What S3 key was used? Look for S3Adapter logs with the ID
- Is the ID correct? Compare the ID in create vs retrieve logs

### Issue: S3 Access Denied

**Look for:**
```bash
cat logs.jsonl | jq -c 'select(.level == "ERROR" and .context == "S3Adapter")'
```

**Check:**
- Look for "AccessDenied" or similar AWS errors
- Check if the bucket name is correct in the logs
- Check if the S3 prefix is correct

### Issue: Tests Timing Out

**Look for:**
```bash
cat logs.jsonl | jq -c 'select(.message == "Request completed" and (.data.duration | sub("ms";"") | tonumber > 5000))'
```

**Check:**
- Are requests taking too long?
- Is S3 responding slowly?
- Are there multiple S3 operations happening?

## Real Example Workflow

Let's say the test "POST /artifact/model" is failing with a 500 error:

1. **Find the request logs:**
   ```bash
   cat logs.jsonl | jq -c 'select(.data.path == "/artifact/model" and .data.method == "POST")'
   ```

2. **Check if authentication succeeded:**
   ```bash
   cat logs.jsonl | jq -c 'select(.message | contains("authenticated"))'
   ```

3. **Check what happened in S3Adapter:**
   ```bash
   cat logs.jsonl | jq -c 'select(.context == "S3Adapter")'
   ```

4. **Find the error:**
   ```bash
   cat logs.jsonl | jq -c 'select(.level == "ERROR")'
   ```

5. **Trace the timeline:**
   Look at all logs for that request in order by timestamp to see the flow

## Without jq (Simple Text Search)

If you don't have `jq` installed, use simple text search:

```bash
# PowerShell
Get-Content logs.jsonl | Select-String "ERROR"
Get-Content logs.jsonl | Select-String "S3Adapter"
Get-Content logs.jsonl | Select-String "not found"

# Or just open in a text editor and search (Ctrl+F)
```

## SSH into EC2 (If You Have Access)

If you can SSH into the autograder EC2 instance (or your own test EC2):

```bash
# SSH in
ssh -i your-key.pem ec2-user@your-ec2-ip

# Check if app is running
ps aux | grep node

# View logs in real-time (if using PM2)
pm2 logs

# View logs (if running as service)
sudo journalctl -u your-service-name -f

# Or just run the app and watch console
cd /path/to/app
LOG_LEVEL=DEBUG node src/server.js
```

## Quick Tips

1. **Always look at the timestamp** - it tells you the order of events
2. **Focus on ERROR level first** - that's usually your smoking gun
3. **Check the context** - it tells you which component failed
4. **Look at the data field** - it has the specific IDs, usernames, etc.
5. **Trace backwards** - if something fails, look at what happened just before it

## Setting Up Locally for Testing

To test with the same logging before submitting:

1. Set `LOG_LEVEL=DEBUG` in your local `.env`
2. Run your server: `npm start`
3. Make requests to reproduce the issue
4. Read the console output (it's JSON formatted)
5. Copy interesting logs to a file and analyze them

## Example: Reading Console Output

When you run locally, you'll see output like:
```json
{"timestamp":"2025-12-12T02:30:00.000Z","level":"INFO","context":"Server","message":"Server started","data":{"port":3100,"env":"development","adapter":"s3","logLevel":"DEBUG"}}
{"timestamp":"2025-12-12T02:30:05.123Z","level":"INFO","context":"Server","message":"Incoming request","data":{"method":"POST","path":"/authenticate"}}
```

This is much easier to read than mixed debug statements, and you can copy-paste it into a file for filtering.
