# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

M365-Renew-V2 is an AWS Lambda application that automates Microsoft 365 credential renewal using headless browser automation (Puppeteer). Migrated from Cloudflare Workers, it uses Serverless Framework for deployment with DynamoDB for persistence, SNS for email notifications, and EventBridge for scheduling.

## Build & Development Commands

```bash
npm run build          # Compile TypeScript (tsc → dist/)
npm run tsc            # Type-check only, no emit
npm run lint           # ESLint with auto-fix (TypeScript)
npm run prettier       # Format all files with Prettier
npm run clean          # Remove .build/, .serverless/, dist/
npm run deploy         # Full deploy: clean → prettier → lint → build → serverless deploy
npm install --legacy-peer-deps  # Install dependencies (legacy-peer-deps required)
```

There is no test suite configured in this project.

## Architecture

**Two Lambda functions** defined in `serverless.yml`, both entry-pointed from `src/handler.ts`:

- **api** (`src/handler.api`) — HTTP handler via Lambda Function URL (not API Gateway). Routes are dispatched manually in `src/api/router.ts` by matching HTTP method + path. Timeout: 60s. Reserved concurrency is 0 (disabled by default).
- **scheduler** (`src/handler.scheduler`) — EventBridge-triggered every 355 minutes. Processes one user per invocation via `src/scheduler/processUsers.ts`. On each run, it first auto-migrates any legacy users (random UUID v4 → deterministic SHA-256 hash key), then proceeds with normal processing. Timeout: 300s.

**Data layer** uses the DAO pattern with three DynamoDB tables:

- `src/dao/UserDAO.ts` — User CRUD, processing queue selection, and schema migration. The `userId` primary key is a deterministic SHA-256 hash of the normalized email (lowercased, trimmed), formatted as a UUID-style hex string. This ensures the same email always maps to the same key for deduplication. Legacy users created with random UUID v4 keys are auto-migrated by the scheduler (see below).
- `src/dao/ProcessingStateDAO.ts` — Tracks last processing time/status per user (TTL: 1 year)
- `src/dao/ProcessingLogDAO.ts` — Audit trail of processing attempts (TTL: 5 years)

**Encryption** (`src/crypto/aes-gcm.ts`): AES-256-GCM via Web Crypto API. Per-user IV generated on credential storage. Credentials are encrypted at rest in DynamoDB.

**Browser automation** (`src/utils/M365LoginUtil.ts`): Puppeteer-core with `@sparticuz/chromium` (Lambda-compatible Chrome binary, excluded from esbuild bundle via `external`). Handles the full M365 login flow including TOTP 2FA and Terms of Use prompts.

**Notifications**: SNS topic publishes email on processing completion/failure.

## API Routes

Defined in `src/api/router.ts`, documented via OpenAPI at `/docs`:

- `POST /api/admin/generate-key` — Generate AES encryption key
- `POST /api/credentials/store` — Store encrypted user credentials (returns 409 if email already exists)
- `GET /api/internal/credentials/{userId}` — Retrieve decrypted credentials
- `POST /api/auth/login` — Test M365 login with Puppeteer

## Code Style

- **Prettier**: 140 char width, single quotes, semicolons, spaces (no tabs)
- **ESLint**: TypeScript-ESLint recommended rules; unused vars are errors (prefix with `_` to ignore)
- **TypeScript**: strict mode, ES2020 target, nodenext module resolution
- **Imports**: Use `.js` extensions in relative imports (required by nodenext resolution)

## Environment Variables

Required in `.env` (see `.env.example`):

- `AES_ENCRYPTION_KEY` — Base64-encoded 256-bit key (generate via the admin endpoint)
- `NOTIFICATION_EMAIL` — Email address for SNS notifications

Auto-populated by Serverless Framework: `USERS_TABLE`, `PROCESSING_STATE_TABLE`, `PROCESSING_LOG_TABLE`, `SNS_TOPIC_ARN`.

## Deployment

Serverless Framework v4 deploys to AWS `us-east-2`. CI/CD runs on push to main via `.github/workflows/deploy-serverless-stack.yml` (Node.js 24). The esbuild config bundles and minifies, with `@sparticuz/chromium` as an external dependency.
