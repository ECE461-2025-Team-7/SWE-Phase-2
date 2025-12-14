# Logging System

This project includes comprehensive structured logging to help diagnose issues and track system behavior.

## Quick Start

**For autograder debugging, see [`AUTOGRADER_DEBUG.md`](./AUTOGRADER_DEBUG.md)** - it has practical examples.

**For log filtering commands, see [`LOG_COMMANDS.md`](./LOG_COMMANDS.md)** - it has all the jq commands.

## Overview

All logs are output in JSON format with the following structure:
```json
{
  "timestamp": "2025-12-12T02:30:00.000Z",
  "level": "INFO",
  "context": "ComponentName",
  "message": "Description of what happened",
  "data": {
    "key": "value"
  }
}
```

## Log Levels

The system supports four log levels (in order of severity):

1. **ERROR** - Critical errors that need immediate attention
2. **WARN** - Warning conditions that should be reviewed
3. **INFO** - Informational messages about normal operations (default)
4. **DEBUG** - Detailed diagnostic information

## Configuration

Set the log level using the `LOG_LEVEL` environment variable in your `.env` file:

```env
# Log level: ERROR, WARN, INFO, or DEBUG
LOG_LEVEL=INFO
```

- `ERROR`: Only shows errors
- `WARN`: Shows errors and warnings
- `INFO`: Shows errors, warnings, and informational messages (recommended for production)
- `DEBUG`: Shows everything including detailed diagnostics (recommended for development/debugging)

## What's Logged

### Server (Server)
- Server startup with configuration
- All incoming HTTP requests
- Request completion with status code and duration

### Authentication (AuthMiddleware, AuthenticateRoute)
- Authentication attempts (success/failure)
- Token validation
- User login/logout events
- Admin access checks

### S3 Storage (S3Adapter, S3AuthAdapter)
- All S3 operations (create, read, update, delete)
- Artifact operations with IDs and types
- User and token management
- Registry reset operations

### Route Operations (ArtifactsRoute, ArtifactRoute)
- Artifact creation, retrieval, updates, and deletion
- Search operations
- Debloat program execution
- History recording

## Viewing Logs

### Development
When running locally, logs appear in your console/terminal in JSON format.

### Production/EC2
Logs are written to stdout/stderr and can be:
- Viewed with `docker logs <container-id>`
- Collected by AWS CloudWatch (if configured)
- Piped to log aggregation services

## Filtering Logs

Since logs are in JSON format, you can easily filter them using tools like `jq`:

```bash
# Show only ERROR logs
docker logs <container> 2>&1 | jq 'select(.level == "ERROR")'

# Show logs for a specific user
docker logs <container> 2>&1 | jq 'select(.data.username == "someuser")'

# Show logs for a specific artifact
docker logs <container> 2>&1 | jq 'select(.data.id == "some-uuid")'

# Show authentication-related logs
docker logs <container> 2>&1 | jq 'select(.context | contains("Auth"))'

# Show slow requests (> 1000ms)
docker logs <container> 2>&1 | jq 'select(.message == "Request completed" and (.data.duration | tonumber > 1000))'
```

## Common Debugging Scenarios

### Authentication Issues
Set `LOG_LEVEL=DEBUG` and look for:
- `AuthMiddleware` context logs showing token validation
- `AuthenticateRoute` context logs showing login attempts
- `S3AuthAdapter` context logs showing token/user lookups

### Artifact Not Found
Look for:
- `S3Adapter` logs with "not found" messages
- Request logs showing the artifact ID being accessed
- Authentication logs to verify user has access

### Performance Issues
Look for:
- `Request completed` logs with high duration values
- S3 operation logs to identify slow storage operations
- Multiple sequential S3 calls that could be optimized

### Autograder Issues
Run with `LOG_LEVEL=DEBUG` to see:
- Exact S3 operations being performed
- Authentication token validation details
- Request/response flow through the system
- Any errors or warnings that occur

## Example Log Output

```json
{"timestamp":"2025-12-12T02:30:00.000Z","level":"INFO","context":"Server","message":"Server started","data":{"port":3100,"env":"development","adapter":"s3","logLevel":"INFO"}}
{"timestamp":"2025-12-12T02:30:05.123Z","level":"INFO","context":"Server","message":"Incoming request","data":{"method":"POST","path":"/authenticate","ip":"127.0.0.1"}}
{"timestamp":"2025-12-12T02:30:05.150Z","level":"INFO","context":"AuthenticateRoute","message":"Authentication attempt","data":{"username":"testuser"}}
{"timestamp":"2025-12-12T02:30:05.200Z","level":"INFO","context":"S3AuthAdapter","message":"User retrieved successfully","data":{"username":"testuser"}}
{"timestamp":"2025-12-12T02:30:05.250Z","level":"INFO","context":"AuthenticateRoute","message":"Authentication successful","data":{"username":"testuser","is_admin":false}}
{"timestamp":"2025-12-12T02:30:05.251Z","level":"INFO","context":"Server","message":"Request completed","data":{"method":"POST","path":"/authenticate","statusCode":200,"duration":"128ms"}}
```

## Tips

1. **Start with INFO level** in production - it provides good visibility without overwhelming detail
2. **Use DEBUG level** when troubleshooting specific issues
3. **Pipe logs through jq** for easier reading and filtering
4. **Save logs to files** for later analysis: `docker logs <container> > logs.jsonl 2>&1`
5. **Search for specific error messages** to quickly identify issues
