import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const PACKAGE_DIR = '.serverless';
const EXPECTED_CHROMIUM_FILES = ['al2023.tar.br', 'chromium.br', 'fonts.tar.br', 'swiftshader.tar.br'];

function listZipFiles(packageDir) {
  return readdirSync(packageDir)
    .filter((fileName) => fileName.endsWith('.zip'))
    .map((fileName) => join(packageDir, fileName));
}

function listArchiveEntries(zipPath) {
  return execFileSync('unzip', ['-Z1', zipPath], {
    encoding: 'utf8',
  })
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const zipFiles = listZipFiles(PACKAGE_DIR);

if (zipFiles.length === 0) {
  throw new Error(`No zip artifacts found in ${PACKAGE_DIR}. Run serverless package first.`);
}

let verifiedArtifacts = 0;

for (const zipPath of zipFiles) {
  const entries = listArchiveEntries(zipPath);

  const chromiumFolderEntry = entries.find((entry) => entry.startsWith('chromium/') && !entry.endsWith('/'));
  if (!chromiumFolderEntry) {
    console.log(`No chromium/ folder found in ${zipPath}.`);
    continue;
  }

  const chromiumFiles = entries.filter((entry) => entry.startsWith('chromium/') && EXPECTED_CHROMIUM_FILES.some((f) => entry.endsWith(f)));

  const missingFiles = EXPECTED_CHROMIUM_FILES.filter(
    (expected) => !chromiumFiles.some((f) => f.endsWith(expected))
  );

  if (missingFiles.length > 0) {
    throw new Error(`Missing expected chromium files in ${zipPath}: ${missingFiles.join(', ')}`);
  }

  let totalSize = 0;
  for (const file of chromiumFiles) {
    const content = execFileSync('unzip', ['-p', zipPath, file], {
      encoding: 'buffer',
      maxBuffer: 256 * 1024 * 1024,
    });
    totalSize += content.length;
  }

  verifiedArtifacts += 1;
  console.log(`Verified arm64 Chromium pack (${(totalSize / 1024 / 1024).toFixed(2)} MB) in ${zipPath}.`);
  console.log(`  Files: ${chromiumFiles.map((f) => f.split('/').pop()).join(', ')}`);
}

if (verifiedArtifacts === 0) {
  throw new Error(`No packaged Chromium files found in ${PACKAGE_DIR}.`);
}