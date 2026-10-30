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

### Deploy Identity (IAM)

Deploying this stack requires permissions beyond "CloudFormation admin". The deployer creates an IAM role and passes it to Lambda, so **`iam:PassRole` on `M365-Renew-V2-ExecutionRole` is mandatory** (AWS's `AWSCloudFormationFullAccess` policy does not include it).

Two files under `infra/` capture the exact, least-privilege permission set:

| File                        | Purpose                                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `infra/deploy-prereqs.json` | CloudFormation stack with the pinned deployment bucket, the `M365-Renew-V2-DeployPolicy` managed policy, and the deploy identities (IAM user and/or GitHub OIDC role). Single source of truth for the policy. |
| `infra/deploy-policy.json`  | Generated copy of the policy document for review or manual attachment (`aws iam create-policy --policy-document file://infra/deploy-policy.json`).                                                            |

Create the prerequisites once per account/region:

```bash
# IAM user with access keys (used by the current GitHub Actions workflow)
aws cloudformation deploy \
  --template-file infra/deploy-prereqs.json \
  --stack-name m365-renew-v2-deploy-prereqs \
  --region us-east-2 \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides IdentityMode=user

aws iam create-access-key --user-name M365-Renew-V2-Deployer

# Or, preferred: GitHub Actions OIDC role (no long-lived keys)
aws cloudformation deploy \
  --template-file infra/deploy-prereqs.json \
  --stack-name m365-renew-v2-deploy-prereqs \
  --region us-east-2 \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides IdentityMode=oidc GitHubOrg=<org> GitHubRepo=M365-Renew-V2 GitHubBranch=main
```

The stack pins the deployment bucket to `m365-renew-v2-deploy-<account-id>-<region>` (see `provider.deploymentBucket` in `serverless.yml`), which keeps every S3 permission scoped to a single bucket instead of the Serverless Framework's shared `serverless-framework-deployments-*` bucket.

The `local` stage (serverless-localstack / Floci) is the exception: it falls back to the framework-managed deployment bucket, because the pinned bucket only exists in the real account. This is driven by `custom.deploymentBucket` in `serverless.yml`; any other stage, including unlisted ones, uses the pinned name.

Permission highlights:

- CloudFormation stack operations scoped to the `M365-Renew-V2` stack only.
- IAM role lifecycle scoped to `M365-Renew-V2-ExecutionRole`, plus `iam:PassRole` with `iam:PassedToService = lambda.amazonaws.com`.
- Lambda, CloudWatch Logs, DynamoDB, SNS, and EventBridge actions scoped to the names defined in `serverless.yml`.
- S3 read/write on the deployment bucket only.

Keep `infra/deploy-policy.json` in sync after editing the template:

```bash
npm run infra:policy         # regenerate
npm run infra:policy:check   # verify (also runs as part of npm run build)
```

### CI/CD

Pushes to `main` automatically deploy via GitHub Actions (`.github/workflows/deploy-serverless-stack.yml`).

**Required GitHub Secrets:**

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `SERVERLESS_LICENSE_KEY`

**Required GitHub Variables:**

- `DOT_ENV` (Base64-encoded `.env` content)

The post-deploy cleanup job derives the deployment bucket name from the AWS account ID and region (`m365-renew-v2-deploy-<account-id>-<region>`), so no bucket variable is required.

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
