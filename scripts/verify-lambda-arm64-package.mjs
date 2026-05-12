import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const PACKAGE_DIR = '.serverless';
const CHROMIUM_ENTRY_SUFFIX = 'node_modules/@sparticuz/chromium/bin/chromium.br';
const ELF_MAGIC = [0x7f, 0x45, 0x4c, 0x46];
const EM_AARCH64 = 183;
const EM_X86_64 = 62;

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

function readArchiveEntry(zipPath, entryPath) {
  return execFileSync('unzip', ['-p', zipPath, entryPath], {
    encoding: 'buffer',
    maxBuffer: 256 * 1024 * 1024,
  });
}

function getElfMachine(binaryBuffer) {
  if (binaryBuffer.length < 20) {
    throw new Error('Chromium binary is too small to be a valid ELF executable.');
  }

  for (let index = 0; index < ELF_MAGIC.length; index += 1) {
    if (binaryBuffer[index] !== ELF_MAGIC[index]) {
      throw new Error('Chromium binary is not an ELF executable.');
    }
  }

  return binaryBuffer.readUInt16LE(18);
}

function describeMachine(machine) {
  switch (machine) {
    case EM_AARCH64:
      return 'arm64';
    case EM_X86_64:
      return 'x86_64';
    default:
      return `unknown(${machine})`;
  }
}

const zipFiles = listZipFiles(PACKAGE_DIR);

if (zipFiles.length === 0) {
  throw new Error(`No zip artifacts found in ${PACKAGE_DIR}. Run serverless package first.`);
}

let verifiedArtifacts = 0;

for (const zipPath of zipFiles) {
  const chromiumEntry = listArchiveEntries(zipPath).find((entry) => entry.endsWith(CHROMIUM_ENTRY_SUFFIX));
  if (!chromiumEntry) {
    continue;
  }

  const compressedChromium = readArchiveEntry(zipPath, chromiumEntry);
  const chromiumBinary = brotliDecompressSync(compressedChromium);
  const machine = getElfMachine(chromiumBinary);
  const architecture = describeMachine(machine);

  if (machine !== EM_AARCH64) {
    throw new Error(`Expected Arm64 Chromium in ${zipPath}, found ${architecture}.`);
  }

  verifiedArtifacts += 1;
  console.log(`Verified Arm64 Chromium in ${zipPath}.`);
}

if (verifiedArtifacts === 0) {
  throw new Error(`No packaged Chromium binary found in ${PACKAGE_DIR}.`);
}
