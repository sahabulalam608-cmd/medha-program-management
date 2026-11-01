import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('--- Starting Medha Portal Build ---');

// 1. Run Vite build
execSync('npx vite build', { stdio: 'inherit' });

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const assetsDir = path.join(rootDir, 'assets');
const distAssetsDir = path.join(distDir, 'assets');

// 2. Ensure dist/assets exists
if (!fs.existsSync(distAssetsDir)) {
  fs.mkdirSync(distAssetsDir, { recursive: true });
}

// 3. Copy all files and folders from assets/ into dist/assets/
if (fs.existsSync(assetsDir)) {
  fs.cpSync(assetsDir, distAssetsDir, { recursive: true, force: true });
  console.log('✓ Copied assets/ into dist/assets/');
}

// 4. Copy backend/ into dist/backend/
const backendDir = path.join(rootDir, 'backend');
const distBackendDir = path.join(distDir, 'backend');
if (fs.existsSync(backendDir)) {
  fs.cpSync(backendDir, distBackendDir, { recursive: true, force: true });
  console.log('✓ Copied backend/ into dist/backend/');
}

// 5. Copy standalone root files: _headers, _redirects, guide.html, sw.js
const standaloneFiles = ['_headers', '_redirects', 'guide.html', 'sw.js'];
for (const f of standaloneFiles) {
  const src = path.join(rootDir, f);
  const dest = path.join(distDir, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`✓ Copied ${f} to dist/`);
  }
}

// 6. Ensure bkash-logo.jpg is in all expected image locations
const bkashSrc = path.join(assetsDir, 'img', 'bkash-logo.jpg');
if (fs.existsSync(bkashSrc)) {
  const targets = [
    path.join(distAssetsDir, 'img', 'bkash-logo.jpg'),
    path.join(distAssetsDir, 'assets', 'img', 'bkash-logo.jpg'),
    path.join(rootDir, 'public', 'assets', 'img', 'bkash-logo.jpg')
  ];
  for (const t of targets) {
    fs.mkdirSync(path.dirname(t), { recursive: true });
    fs.copyFileSync(bkashSrc, t);
  }
}

console.log('--- Medha Portal Build Finished Successfully ---');
