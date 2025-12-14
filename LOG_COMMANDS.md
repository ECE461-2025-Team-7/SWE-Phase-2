# Quick Log Command Reference

Quick reference for filtering and analyzing logs when debugging autograder issues.

## Setup

### On EC2 Instance
```bash
# SSH into your EC2 instance
ssh -i your-key.pem ec2-user@your-ec2-ip

# Find where logs are being written
# Option 1: PM2 (if using PM2)
pm2 logs
pm2 logs --json > logs.jsonl

# Option 2: systemd service
sudo journalctl -u your-service-name -n 1000 > logs.jsonl

# Option 3: Direct file
tail -n 10000 /path/to/app.log > logs.jsonl

# Option 4: Current running process stdout
# (Find your node process and check where stdout goes)
ps aux | grep node
```

### From Autograder Output
```bash
# Copy autograder output to a file
# Then filter the JSON log lines
grep '^{"timestamp"' autograder-output.txt > logs.jsonl
```

### Using CloudWatch (if configured)
```bash
# Use AWS CLI to fetch logs
aws logs tail /aws/ec2/your-app --follow

# Or download recent logs
aws logs get-log-events --log-group-name /aws/ec2/your-app --log-stream-name your-stream > logs.json
```

## Common Filters

### By Log Level
```bash
# Show only errors
cat logs.jsonl | jq -c 'select(.level == "ERROR")'

# Show errors and warnings
cat logs.jsonl | jq -c 'select(.level == "ERROR" or .level == "WARN")'

# Show everything except debug
cat logs.jsonl | jq -c 'select(.level != "DEBUG")'
```

### By Component
```bash
# Show all authentication logs
cat logs.jsonl | jq -c 'select(.context | contains("Auth"))'

# Show S3 adapter logs
cat logs.jsonl | jq -c 'select(.context == "S3Adapter")'

# Show server/request logs
cat logs.jsonl | jq -c 'select(.context == "Server")'

# Show artifact route logs
cat logs.jsonl | jq -c 'select(.context == "ArtifactsRoute")'
```

### By Operation
```bash
# Show authentication attempts
cat logs.jsonl | jq -c 'select(.message | contains("Authentication"))'

# Show artifact creation
cat logs.jsonl | jq -c 'select(.message | contains("Creating artifact"))'

# Show not found errors
cat logs.jsonl | jq -c 'select(.message | contains("not found"))'

# Show failed operations
cat logs.jsonl | jq -c 'select(.message | contains("failed"))'
```

### By User/Artifact
```bash
# Show logs for specific user
cat logs.jsonl | jq -c 'select(.data.username == "testuser")'

# Show logs for specific artifact ID
cat logs.jsonl | jq -c 'select(.data.id == "your-artifact-id")'

# Show logs for specific artifact type
cat logs.jsonl | jq -c 'select(.data.type == "model")'
```

### By Request
```bash
# Show all POST requests
cat logs.jsonl | jq -c 'select(.data.method == "POST")'

# Show specific endpoint
cat logs.jsonl | jq -c 'select(.data.path == "/authenticate")'

# Show failed requests (4xx, 5xx)
cat logs.jsonl | jq -c 'select(.data.statusCode >= 400)'

# Show slow requests (>2 seconds)
cat logs.jsonl | jq -c 'select(.data.duration and (.data.duration | sub("ms";"") | tonumber > 2000))'
```

## Advanced Queries

### Request Timeline
```bash
# Show complete flow for a specific request
# (Filter by timestamp range)
cat logs.jsonl | jq -c 'select(.timestamp >= "2025-12-12T02:30:00" and .timestamp <= "2025-12-12T02:30:10")'
```

### Error Analysis
```bash
# Show errors with full context (pretty printed)
cat logs.jsonl | jq 'select(.level == "ERROR")'

# Count errors by context
cat logs.jsonl | jq -r 'select(.level == "ERROR") | .context' | sort | uniq -c

# Show unique error messages
cat logs.jsonl | jq -r 'select(.level == "ERROR") | .message' | sort | uniq
```

### Performance Analysis
```bash
# Show slowest requests
cat logs.jsonl | jq -c 'select(.message == "Request completed") | {path: .data.path, duration: .data.duration, status: .data.statusCode}' | jq -s 'sort_by(.duration | sub("ms";"") | tonumber) | reverse | .[0:10]'

# Average request duration by endpoint
cat logs.jsonl | jq -r 'select(.message == "Request completed") | "\(.data.path),\(.data.duration | sub("ms";""))"'
```

### Token Tracking
```bash
# Show token lifecycle
cat logs.jsonl | jq -c 'select(.message | contains("token") or contains("Token"))'

# Show token expiration/limit issues
cat logs.jsonl | jq -c 'select(.message | contains("expired") or .message | contains("limit exceeded"))'
```

## Debugging Specific Issues

### Authentication Not Working
```bash
# 1. Check if request reaches server
cat logs.jsonl | jq -c 'select(.data.path == "/authenticate")'

# 2. Check user lookup
cat logs.jsonl | jq -c 'select(.message | contains("Looking up user"))'

# 3. Check password validation
cat logs.jsonl | jq -c 'select(.message | contains("password"))'

# 4. Check final auth result
cat logs.jsonl | jq -c 'select(.message | contains("Authentication") and .level != "DEBUG")'
```

### Artifact Not Found
```bash
# 1. Check if retrieval was attempted
cat logs.jsonl | jq -c 'select(.message | contains("Retrieving artifact"))'

# 2. Check S3 lookup
cat logs.jsonl | jq -c 'select(.context == "S3Adapter" and .message | contains("Getting artifact"))'

# 3. Check for not found warning
cat logs.jsonl | jq -c 'select(.message | contains("not found"))'
```

### S3 Permission Issues
```bash
# Show all S3 errors
cat logs.jsonl | jq -c 'select(.context == "S3Adapter" and .level == "ERROR")'

# Show S3 operations with bucket/key details
cat logs.jsonl | jq -c 'select(.context == "S3Adapter" and .data.bucket)'
```

## Tips

1. **Use `-c` flag** with jq for compact JSON (one line per log entry)
2. **Remove `-c` flag** to pretty-print when you need to read details
3. **Combine filters** with `and` and `or` operators
4. **Save filtered results** to separate files for analysis
5. **Use `grep` first** for quick text searches before parsing JSON

## Examples

```bash
# Find why artifact creation failed
cat logs.jsonl | jq 'select(.message | contains("Creating artifact") or .message | contains("created") or (.message | contains("Artifact") and .level == "ERROR"))'

# Trace a single artifact through its lifecycle
cat logs.jsonl | jq -c 'select(.data.id == "abc-123-xyz")'

# Find all 401/403 authentication failures
cat logs.jsonl | jq -c 'select(.data.statusCode == 401 or .data.statusCode == 403)'

# See what happened in last 5 minutes (adjust timestamp)
cat logs.jsonl | jq -c 'select(.timestamp >= "2025-12-12T02:25:00")'
```

## Setup LOG_LEVEL for Debugging

Edit `.env`:
```env
# For maximum detail
LOG_LEVEL=DEBUG

# For normal operation
LOG_LEVEL=INFO

# For errors only
LOG_LEVEL=ERROR
```

Restart container after changing LOG_LEVEL:
```bash
docker restart <container-id>
```
