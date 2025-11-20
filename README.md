# Deployment Guide

## Migration Complete! 

The M365-Renew application has been successfully migrated from Cloudflare Workers to AWS Lambda.

## What's Been Migrated

✅ **API Routes**: All existing endpoints maintained
- `POST /api/admin/generate-key`
- `POST /api/credentials/store` 
- `GET /api/internal/credentials/{user_id}`
- `POST /api/auth/login`

✅ **OpenAPI Backend**: Documentation available at `/docs`

✅ **Puppeteer Browser**: Now using chrome-aws-lambda for Lambda compatibility

✅ **Database**: SQLite → DynamoDB with same data structure

✅ **Scheduling**: Cloudflare Cron → EventBridge Scheduler

✅ **Email Notifications**: Custom service → AWS SES

## Pre-Deployment Setup

1. **Configure AWS CLI** (if not already done):
   ```bash
   aws configure
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Configure SES** (for email notifications):
   - Verify your notification email address in AWS SES
   - If in sandbox mode, verify both sender and recipient

## Deploy

```bash
# Install dependencies (already done)
npm install --legacy-peer-deps

# Deploy to AWS
npm run deploy
```

## Post-Deployment Steps

1. **Generate encryption key**:
   ```bash
   curl -X POST https://YOUR_API_URL/api/admin/generate-key \
     -H "Content-Type: application/json" \
     -d '{"admin_key": "your_admin_key_from_env"}'
   ```

2. **Update environment with the generated key**:
   - Copy the returned key
   - Set it as `AES_ENCRYPTION_KEY` in your environment
   - Redeploy: `npm run deploy`

3. **Test the API**:
   ```bash
   # Test storing credentials
   curl -X POST https://YOUR_API_URL/api/credentials/store \
     -H "Content-Type: application/json" \
     -d '{
       "email_address": "test@example.com",
       "password": "password123",
       "totp_key": "JBSWY3DPEHPK3PXP"
     }'
   ```

## Monitoring

- **CloudWatch Logs**: Check function logs for processing status
- **DynamoDB**: Monitor table metrics and items
- **SES**: Check email sending metrics
- **Lambda**: Monitor function duration and errors

## Differences from Cloudflare Version

| Feature | Cloudflare | AWS Lambda |
|---------|------------|------------|
| Database | SQLite (D1) | DynamoDB |
| Scheduling | Cron Triggers | EventBridge |
| Browser | @cloudflare/puppeteer | chrome-aws-lambda |
| Email | Custom service | AWS SES |
| Framework | Hono + chanfana | Native Lambda |

## Troubleshooting

### Common Issues:

1. **Puppeteer timeout**: Increase Lambda timeout in serverless.yml
2. **SES permissions**: Ensure IAM role has SES send permissions
3. **DynamoDB access**: Check IAM permissions for DynamoDB operations
4. **Environment variables**: Verify all required env vars are set

### Logs:
```bash
# View API logs
serverless logs -f api

# View scheduler logs  
serverless logs -f scheduler
```

The migration maintains full API compatibility while leveraging AWS services for better scalability and integration.
