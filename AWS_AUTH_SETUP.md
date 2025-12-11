# AWS S3 Authentication Storage Setup

This guide explains how to set up a dedicated S3 bucket for authentication data storage.

## Why a Separate Bucket?

Storing authentication data (user credentials, tokens, audit logs) in a separate S3 bucket provides:
- **Security isolation** - Authentication data is separated from artifact storage
- **Access control** - Different IAM policies can be applied
- **Cost tracking** - Easier to monitor auth-related storage costs
- **Compliance** - Better alignment with security best practices

## AWS Setup Steps

### Option 1: Create a New Dedicated Bucket (Recommended)

1. **Create the S3 Bucket**
   ```bash
   aws s3api create-bucket \
     --bucket your-project-auth-bucket \
     --region us-east-1
   ```

2. **Enable Encryption**
   ```bash
   aws s3api put-bucket-encryption \
     --bucket your-project-auth-bucket \
     --server-side-encryption-configuration '{
       "Rules": [{
         "ApplyServerSideEncryptionByDefault": {
           "SSEAlgorithm": "AES256"
         }
       }]
     }'
   ```

3. **Enable Versioning (Optional but Recommended)**
   ```bash
   aws s3api put-bucket-versioning \
     --bucket your-project-auth-bucket \
     --versioning-configuration Status=Enabled
   ```

4. **Configure Lifecycle Policy for Expired Tokens**
   Create a file `auth-lifecycle.json`:
   ```json
   {
     "Rules": [
       {
         "Id": "DeleteExpiredTokens",
         "Status": "Enabled",
         "Filter": {
           "Prefix": "auth/tokens/"
         },
         "Expiration": {
           "Days": 7
         }
       },
       {
         "Id": "ArchiveAuditLogs",
         "Status": "Enabled",
         "Filter": {
           "Prefix": "auth/audit/"
         },
         "Transitions": [
           {
             "Days": 90,
             "StorageClass": "GLACIER"
           }
         ]
       }
     ]
   }
   ```

   Apply the lifecycle policy:
   ```bash
   aws s3api put-bucket-lifecycle-configuration \
     --bucket your-project-auth-bucket \
     --lifecycle-configuration file://auth-lifecycle.json
   ```

5. **Set Bucket Policy for Access Control**
   Create a file `auth-bucket-policy.json`:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "DenyInsecureTransport",
         "Effect": "Deny",
         "Principal": "*",
         "Action": "s3:*",
         "Resource": [
           "arn:aws:s3:::your-project-auth-bucket/*",
           "arn:aws:s3:::your-project-auth-bucket"
         ],
         "Condition": {
           "Bool": {
             "aws:SecureTransport": "false"
           }
         }
       }
     ]
   }
   ```

   Apply the bucket policy:
   ```bash
   aws s3api put-bucket-policy \
     --bucket your-project-auth-bucket \
     --policy file://auth-bucket-policy.json
   ```

### Option 2: Use Existing Bucket with Prefix

If you prefer to use your existing artifact bucket with a dedicated prefix:

1. No additional bucket creation needed
2. Set the `S3_AUTH_PREFIX` environment variable to `auth/`
3. The auth data will be stored under the same bucket but with proper isolation

## IAM Permissions

Your application's IAM role/user needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-project-auth-bucket/*",
        "arn:aws:s3:::your-project-auth-bucket"
      ]
    }
  ]
}
```

## Environment Variables

Add these to your `.env` file:

### For Dedicated Auth Bucket (Option 1):
```bash
# Dedicated authentication bucket
S3_AUTH_BUCKET=your-project-auth-bucket
S3_AUTH_REGION=us-east-1
S3_AUTH_PREFIX=auth/

# Main artifact bucket (keep existing)
S3_BUCKET=your-project-artifact-bucket
AWS_REGION=us-east-1
S3_PREFIX=artifacts/
```

### For Same Bucket with Prefix (Option 2):
```bash
# Use same bucket for both
S3_BUCKET=your-project-bucket
AWS_REGION=us-east-1

# Artifact prefix
S3_PREFIX=artifacts/

# Auth prefix (will use S3_BUCKET)
S3_AUTH_PREFIX=auth/
```

## Storage Structure

The S3AuthAdapter will create this structure:

```
your-project-auth-bucket/
└── auth/
    ├── users/
    │   └── ece30861defaultadminuser.json
    ├── tokens/
    │   ├── abc123hash.json
    │   └── def456hash.json
    └── audit/
        └── ece30861defaultadminuser/
            ├── 2025-01-10T00:00:00.000Z-login.json
            └── 2025-01-10T01:00:00.000Z-logout.json
```

## Security Best Practices

1. **Enable MFA Delete** (for production):
   ```bash
   aws s3api put-bucket-versioning \
     --bucket your-project-auth-bucket \
     --versioning-configuration Status=Enabled,MFADelete=Enabled \
     --mfa "arn:aws:iam::ACCOUNT-ID:mfa/DEVICE-NAME MFA-CODE"
   ```

2. **Enable CloudTrail Logging**:
   - Log all S3 API calls for audit compliance
   - Monitor for unusual access patterns

3. **Block Public Access**:
   ```bash
   aws s3api put-public-access-block \
     --bucket your-project-auth-bucket \
     --public-access-block-configuration \
       BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
   ```

4. **Use AWS KMS Encryption** (instead of AES256) for enhanced security:
   ```bash
   aws s3api put-bucket-encryption \
     --bucket your-project-auth-bucket \
     --server-side-encryption-configuration '{
       "Rules": [{
         "ApplyServerSideEncryptionByDefault": {
           "SSEAlgorithm": "aws:kms",
           "KMSMasterKeyID": "your-kms-key-id"
         }
       }]
     }'
   ```

## Testing the Setup

1. **Test Bucket Access**:
   ```bash
   aws s3 ls s3://your-project-auth-bucket/
   ```

2. **Test Write Permissions**:
   ```bash
   echo "test" | aws s3 cp - s3://your-project-auth-bucket/auth/test.txt
   ```

3. **Test Read Permissions**:
   ```bash
   aws s3 cp s3://your-project-auth-bucket/auth/test.txt -
   ```

4. **Clean up test file**:
   ```bash
   aws s3 rm s3://your-project-auth-bucket/auth/test.txt
   ```

## Using the S3AuthAdapter

The adapter is now ready to use in your application. Example usage:

```javascript
import S3AuthAdapter from './src/adapters/S3AuthAdapter.js';

const authAdapter = new S3AuthAdapter();

// Create a user
await authAdapter.createUser({
  name: 'username',
  is_admin: false,
  password_hash: 'hashed_password'
});

// Get a user
const user = await authAdapter.getUser('username');

// Store a token
await authAdapter.storeToken('token_hash', {
  username: 'username',
  expires_at: new Date(Date.now() + 24*60*60*1000).toISOString()
});

// Log authentication event
await authAdapter.logAuthEvent('username', 'login', {
  ip: '192.168.1.1',
  user_agent: 'Mozilla/5.0...'
});
```

## Cost Considerations

- **Storage**: Auth data is typically small (< 1GB for most applications)
- **Requests**: GET/PUT operations per authentication event
- **Data Transfer**: Minimal for auth operations
- **Lifecycle**: Archive audit logs to Glacier after 90 days to reduce costs

## Troubleshooting

### Permission Denied
- Check IAM role/user has correct permissions
- Verify bucket policy allows your IAM principal
- Ensure AWS credentials are properly configured

### Bucket Not Found
- Verify bucket name in environment variables
- Check if bucket exists: `aws s3 ls s3://your-project-auth-bucket/`
- Verify region configuration

### Encryption Errors
- Ensure KMS key permissions if using KMS encryption
- Verify the encryption configuration is applied

## Monitoring

Set up CloudWatch metrics for:
- Number of authentication requests
- Failed login attempts
- Token creation/validation rates
- S3 API errors

Example CloudWatch alarm for failed authentications:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name high-failed-auth-rate \
  --alarm-description "Alert on high failed authentication rate" \
  --metric-name FailedAuthAttempts \
  --namespace YourApp/Auth \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold
```
