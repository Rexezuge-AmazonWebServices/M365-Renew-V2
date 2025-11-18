# M365 Renew - AWS Lambda Version

This is the AWS Lambda migration of the M365 Renew application, previously running on Cloudflare Workers.

## Architecture

- **AWS Lambda**: Serverless functions for API and scheduled processing
- **API Gateway**: HTTP endpoints for the REST API
- **DynamoDB**: NoSQL database for storing encrypted user credentials
- **EventBridge Scheduler**: Cron-like scheduling for user processing
- **SES**: Email notifications
- **Puppeteer + Chrome**: Browser automation for M365 login

## API Endpoints

All endpoints maintain compatibility with the original Cloudflare version:

- `POST /api/admin/generate-key` - Generate AES encryption key
- `POST /api/credentials/store` - Store encrypted user credentials
- `GET /api/internal/credentials/{user_id}` - Retrieve decrypted credentials
- `POST /api/auth/login` - Perform M365 login with Puppeteer
- `GET /docs` - OpenAPI documentation

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Deploy to AWS:**
   ```bash
   npm run deploy
   ```

4. **Generate encryption key:**
   ```bash
   curl -X POST https://your-api-url/api/admin/generate-key \
     -H "Content-Type: application/json" \
     -d '{"admin_key": "your_admin_key"}'
   ```

## Environment Variables

- `AES_ENCRYPTION_KEY`: Base64 encoded AES key for credential encryption
- `ADMIN_KEY`: Key for accessing admin endpoints
- `NOTIFICATION_EMAIL`: Email address for processing notifications
- `AWS_REGION`: AWS region (defaults to us-east-1)

## Migration Notes

### Changes from Cloudflare Version:

1. **Database**: SQLite → DynamoDB
2. **Scheduling**: Cloudflare Cron → EventBridge Scheduler
3. **Browser**: @cloudflare/puppeteer → chrome-aws-lambda + puppeteer-core
4. **Email**: Custom service → AWS SES
5. **Framework**: Hono + chanfana → Native Lambda + API Gateway

### Maintained Compatibility:

- All API endpoints and request/response formats
- Encryption/decryption logic
- M365 login flow with Puppeteer
- OpenAPI documentation structure
- User processing workflow

## Development

```bash
# Local development
npm run dev

# Deploy
npm run deploy

# Run tests
npm test
```

## Database Schema

### Users Table
- `userId` (String, Primary Key)
- `encryptedEmailAddress` (String)
- `encryptedPassword` (String)
- `encryptedTotpKey` (String)
- `salt` (String)
- `status` (String: active/disabled/locked)
- `createdAt` (String, ISO date)
- `updatedAt` (String, ISO date)

### Processing State Table
- `userId` (String, Primary Key)
- `lastProcessedAt` (String, ISO date)
- `lastProcessStatus` (String: success/failure/skipped)
- `lastMessage` (String)
- `updatedAt` (String, ISO date)

### Processing Log Table
- `logId` (String, Primary Key)
- `userId` (String)
- `processedAt` (String, ISO date)
- `processStatus` (String: success/failure/skipped)
- `message` (String)
- `updatedAt` (String, ISO date)
