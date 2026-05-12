import { readFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createBrotliDecompress } from 'node:zlib';
import { createReadStream, createWriteStream } from 'node:fs';

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

function decompressFile(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const input = createReadStream(inputPath);
    const output = createWriteStream(outputPath);
    const decompressor = createBrotliDecompress();

    input.pipe(decompressor).pipe(output);

    output.on('finish', resolve);
    output.on('error', reject);
    decompressor.on('error', reject);
  });
}

async function downloadAndExtract(version) {
  const tarUrl = `https://github.com/Sparticuz/chromium/releases/download/v${version}/chromium-v${version}-pack.arm64.tar`;
  const binDir = join(rootDir, 'node_modules/@sparticuz/chromium-min/bin');
  const tempDir = join(rootDir, '.chromium-temp');

  if (!existsSync(binDir)) {
    mkdirSync(binDir, { recursive: true });
  }

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

  console.log('Decompressing chromium.br...');
  const compressedChromium = join(tempDir, 'chromium.br');
  const extractedChromium = join(binDir, 'chromium');

  await decompressFile(compressedChromium, extractedChromium);

  execSync(`chmod +x "${extractedChromium}"`);

  if (!existsSync(extractedChromium)) {
    throw new Error('Chromium binary not found after decompression');
  }

  const binaryStats = statSync(extractedChromium);
  console.log(`Chromium binary size: ${(binaryStats.size / 1024 / 1024).toFixed(2)} MB`);

  execSync(`rm -rf "${tempDir}"`);

  console.log(`Arm64 Chromium v${version} successfully extracted to ${binDir}/chromium`);
}

const version = getPackageVersion();
await downloadAndExtract(version);