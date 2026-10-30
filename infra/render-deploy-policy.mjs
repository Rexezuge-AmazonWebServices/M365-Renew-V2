#!/usr/bin/env node
// Generates infra/deploy-policy.json from the DeployPolicy resource in infra/deploy-prereqs.json.
// The template is the single source of truth; this keeps the standalone policy document in sync.
//
// Usage:
//   node infra/render-deploy-policy.mjs           # write infra/deploy-policy.json
//   node infra/render-deploy-policy.mjs --check   # fail when the checked-in file is stale
import { readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const templatePath = join(here, 'deploy-prereqs.json');
const policyPath = join(here, 'deploy-policy.json');

const template = JSON.parse(readFileSync(templatePath, 'utf8'));
const policyDocument = template?.Resources?.DeployPolicy?.Properties?.PolicyDocument;

if (!policyDocument) {
  console.error(`Could not find Resources.DeployPolicy.Properties.PolicyDocument in ${templatePath}`);
  process.exit(1);
}

const checkOnly = process.argv.includes('--check');

if (checkOnly) {
  const current = JSON.parse(readFileSync(policyPath, 'utf8'));
  if (!isDeepStrictEqual(current, policyDocument)) {
    console.error('infra/deploy-policy.json is out of sync with infra/deploy-prereqs.json. Run: npm run infra:policy');
    process.exit(1);
  }
  console.log('infra/deploy-policy.json is in sync.');
} else {
  writeFileSync(policyPath, `${JSON.stringify(policyDocument, null, 2)}\n`);
  console.log('Wrote infra/deploy-policy.json');
}
