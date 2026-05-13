import { readFileSync, mkdirSync, existsSync, statSync, readdirSync, cpSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

function getPackageVersion() {
  const packageJsonPath = join(rootDir, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const chromiumMinVersion = packageJson.dependencies['@sparticuz/chromium-min'];
  const versionMatch = chromiumMinVersion.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!versionMatch) {
    throw new Error(`Cannot parse version from ${chromiumMinVersion}`);
  }
  return `${versionMatch[1]}.${versionMatch[2]}.${versionMatch[3]}`;
}

function extractTar(tarPath, destDir) {
  execSync(`tar -xf "${tarPath}" -C "${destDir}"`, { stdio: 'inherit' });
}

async function downloadAndExtract(version) {
  const tarUrl = `https://github.com/Sparticuz/chromium/releases/download/v${version}/chromium-v${version}-pack.arm64.tar`;
  const chromiumDir = join(rootDir, 'chromium');
  const tempDir = join(rootDir, '.chromium-temp');

  if (existsSync(chromiumDir)) {
    execSync(`rm -rf "${chromiumDir}"`);
  }
  mkdirSync(chromiumDir, { recursive: true });

  if (existsSync(tempDir)) {
    execSync(`rm -rf "${tempDir}"`);
  }
  mkdirSync(tempDir, { recursive: true });

  console.log(`Downloading arm64 Chromium v${version}...`);
  console.log(`URL: ${tarUrl}`);

  const tempTarPath = join(tempDir, 'chromium-pack.arm64.tar');

  execSync(`curl -L -o "${tempTarPath}" "${tarUrl}"`, { stdio: 'inherit' });

  const stats = statSync(tempTarPath);
  console.log(`Downloaded ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  console.log('Extracting tar archive...');
  extractTar(tempTarPath, tempDir);

  const extractedFiles = readdirSync(tempDir).filter((f) => !f.endsWith('.tar'));
  console.log(`Extracted files: ${extractedFiles.join(', ')}`);

  for (const file of extractedFiles) {
    const src = join(tempDir, file);
    const dest = join(chromiumDir, file);
    cpSync(src, dest);
    rmSync(src);
    const fileStats = statSync(dest);
    console.log(`  ${file}: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);
  }

  execSync(`rm -rf "${tempDir}"`);

  console.log(`Arm64 Chromium v${version} packed files saved to ${chromiumDir}/`);
}

const version = getPackageVersion();
await downloadAndExtract(version);