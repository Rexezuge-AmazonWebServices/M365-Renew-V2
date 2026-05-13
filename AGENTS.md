# AGENTS.md

This file provides guidance to OpenCode and Claude Code when working with code in this repository.

## Project

M365-Renew-V2 is an AWS Lambda application that automates Microsoft 365 credential renewal using headless Puppeteer browser automation. It uses Serverless Framework for deployment, DynamoDB for persistence, SNS for email notifications, and EventBridge for scheduling.

## Commands

```bash
npm run build          # tsc compile + vitest run (tests must pass to build)
npm run tsc            # Type-check only, no emit
npm run lint           # ESLint with auto-fix
npm run prettier       # Format all files with Prettier
npm run test           # vitest run (src/**/*.test.ts)
npm run clean          # Remove .build/, .serverless/, dist/
npm run deploy         # clean → prettier → lint → build → serverless deploy
npm install --legacy-peer-deps  # Required — installs fail without this flag
```

## Architecture

**Two Lambda functions** in `serverless.yml`, both dispatched from `src/handler.ts`:

- **api** (`src/handler.api`) — HTTP handler via Lambda Function URL (not API Gateway). Routes dispatched manually in `src/api/router.ts` by matching HTTP method + path. Timeout: 60s, 512MB. Reserved concurrency 0 (disabled by default — enable to activate).
- **scheduler** (`src/handler.scheduler`) — EventBridge trigger every 280 minutes. Queries for one active user whose `nextProcessingAfter <= now`, performs M365 login, logs result, schedules next run with exponential backoff on failure. Timeout: 300s, 1536MB.

**Two DynamoDB tables** (DAO pattern):

- `src/dao/UserDAO.ts` — User CRUD and processing scheduling. `userId` is a deterministic SHA-256 hash of normalized email (lowercased, trimmed), formatted as UUID-style hex. Queries the `StatusNextProcessingIndex` GSI to find the next user due for processing.
- `src/dao/ProcessingLogDAO.ts` — Audit trail of processing attempts. TTL: 5 years via `dynamoTTL` attribute.

**Encryption** (`src/crypto/aes-gcm.ts`): AES-256-GCM via Web Crypto API. Per-user IV (stored as `salt`) generated on credential storage.

**Browser** (`src/utils/M365LoginUtil.ts`): Puppeteer-core + `@sparticuz/chromium` (Lambda-compatible Chrome, excluded from esbuild bundle). Handles M365 login flow: email → password → TOTP 2FA (fetched from `TOTP_SERVER_BASE_URL`) → post-auth prompts (Terms of Use, "Stay signed in?").

**Notifications**: SNS topic publishes email per processing attempt.

## API Routes

Defined in `src/api/router.ts`, documented via OpenAPI at `/docs`:

- `POST /api/admin/generate-key` — Generate AES-256 encryption key
- `POST /api/credentials/store` — Store encrypted credentials (409 if email exists)
- `GET /api/internal/credentials/{userId}` — Retrieve decrypted credentials
- `POST /api/auth/login` — Test M365 login with Puppeteer

## Code Style

- **Prettier**: 140 char width, single quotes, semicolons, spaces (no tabs)
- **ESLint**: Flat config (`eslint.config.mjs`), TypeScript-ESLint recommended. Unused vars are errors (prefix with `_` to ignore).
- **TypeScript**: strict mode, ES2020 target, nodenext module resolution
- **Imports**: Use `.js` extensions in relative imports (required by nodenext resolution)

## Environment Variables

Required in `.env` (see `.env.example`):

- `AES_ENCRYPTION_KEY` — Base64-encoded 256-bit key
- `NOTIFICATION_EMAIL` — Email for SNS subscription
- `TOTP_SERVER_BASE_URL` — Base URL for TOTP code generation service

Auto-populated by Serverless: `USERS_TABLE`, `PROCESSING_LOG_TABLE`, `SNS_TOPIC_ARN`.

## Deployment

Serverless Framework v4 → AWS `us-east-2`. CI/CD: push to main via `.github/workflows/deploy-serverless-stack.yml` (Node.js 24). Requires `DOT_ENV` GitHub variable and `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SERVERLESS_LICENSE_KEY` secrets. esbuild bundles with minification; `@sparticuz/chromium` is external.
