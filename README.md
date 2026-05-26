# M365 Renew

Automated Microsoft 365 credential renewal using headless browser automation.

## What It Does

M365 Renew keeps your Microsoft 365 accounts active by automatically logging in on a schedule. It encrypts credentials at rest, handles two-factor authentication, and notifies you of each execution via email.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────┐     ┌────────────────────┐
│   EventBridge   │────▶│  Lambda      │────▶│  Puppeteer +       │
│  (every 280m)  │     │  (Scheduler) │     │  Chromium           │
└─────────────────┘     └──────────────┘     └────────────────────┘
                               │
                               ▼
                       ┌──────────────┐
                       │   DynamoDB   │
                       │  (Users &    │
                       │   Audit Log) │
                       └──────────────┘
                               │
                               ▼
                       ┌──────────────┐
                       │     SNS      │
                       │ (Email Notify)│
                       └──────────────┘
```

- **Scheduler Lambda**: Triggered by EventBridge, processes one user per run
- **API Lambda**: HTTP endpoints for credential management (disabled by default)
- **DynamoDB**: Stores encrypted credentials and processing logs
- **Notifications**: Sends execution summaries via the configured provider (`sns`, `mailmeow`, or `console`)

## Setup

### Prerequisites

- Node.js 24
- AWS Account with CLI configured
- Serverless Framework v4

### Environment Variables

Create a `.env` file from the example:

```bash
cp .env.example .env
```

```
AES_ENCRYPTION_KEY=      # Base64-encoded 256-bit key (generate via /api/admin/generate-key)
NOTIFICATION_PROVIDER=   # console, sns, or mailmeow. Defaults to sns.
NOTIFICATION_EMAIL=      # Email for SNS or MailMeow notifications
TOTP_SERVER_BASE_URL=    # TOTP code generation service URL
```

### Install Dependencies

```bash
npm install --legacy-peer-deps
```

## Deployment

### Local Development

```bash
npm run tsc      # Type-check only
npm run test     # Run unit tests
npm run build    # Compile + test
```

### Deploy to AWS

```bash
npm run deploy
```

This will:

1. Clean previous builds
2. Format code with Prettier
3. Lint with auto-fix
4. Type-check and test
5. Deploy the Serverless stack to `us-east-2`

SNS topic, subscription, and publish permissions are deployed only when `NOTIFICATION_PROVIDER=sns`.

### CI/CD

Pushes to `main` automatically deploy via GitHub Actions (`.github/workflows/deploy-serverless-stack.yml`).

**Required GitHub Secrets:**

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `SERVERLESS_LICENSE_KEY`

**Required GitHub Variables:**

- `DOT_ENV` (Base64-encoded `.env` content)

## API Endpoints

Once deployed, the API Lambda exposes:

| Method | Path                                 | Description                           |
| ------ | ------------------------------------ | ------------------------------------- |
| POST   | `/api/admin/generate-key`            | Generate a new AES-256 encryption key |
| POST   | `/api/credentials/store`             | Store encrypted user credentials      |
| GET    | `/api/internal/credentials/{userId}` | Retrieve decrypted credentials        |
| POST   | `/api/auth/login`                    | Test M365 login manually              |
| GET    | `/docs`                              | Swagger UI documentation              |

## How It Works

1. **Credential Storage**: Encrypt email, password, and TOTP key with AES-256-GCM. Each user gets a unique IV stored as `salt`.
2. **User ID Generation**: Deterministic SHA-256 hash of normalized email (lowered, trimmed), formatted as UUID-style hex.
3. **Scheduled Processing**: EventBridge triggers the scheduler every 280 minutes. It queries for the next due user, decrypts credentials, and performs headless login.
4. **Retry Logic**: Success schedules the next run in 25 hours. Failure applies exponential backoff (1hr, 2hr, 4hr...) up to 25 hours.
5. **Notifications**: The configured notification provider sends or logs a summary of each execution.

## Troubleshooting

- **Deploy fails at test stage**: Ensure `AES_ENCRYPTION_KEY` is valid Base64
- **Login failures**: Check TOTP server connectivity and credentials in DynamoDB
- **No users processed**: Verify at least one user has `status: active` and `nextProcessingAfter <= now`

## License

MIT
