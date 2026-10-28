'use strict';

// Automated Version Bump Engine for Capri Desktop
// Supports:
//   npm run bump:small -> increments patch (+0.0.1)
//   npm run bump:major -> increments minor (+0.1.0) and resets patch to 0

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const mode = (process.argv[2] || 'small').toLowerCase();

const pkgPath = path.join(ROOT, 'package.json');
if (!fs.existsSync(pkgPath)) {
  console.error('[version-bump] package.json not found at:', pkgPath);
  process.exit(1);
}

const pkgContent = fs.readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(pkgContent);
const oldVersion = pkg.version;

const match = oldVersion.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
if (!match) {
  console.error('[version-bump] Could not parse semver from:', oldVersion);
  process.exit(1);
}

let major = parseInt(match[1], 10);
let minor = parseInt(match[2], 10);
let patch = parseInt(match[3], 10);
const suffix = match[4] || '-cyberpunk-edition';

if (mode === 'major' || mode === 'minor') {
  minor += 1;
  patch = 0;
} else {
  // small / patch
  patch += 1;
}

const newVersion = `${major}.${minor}.${patch}${suffix}`;
console.log(`[version-bump] Bumping version: ${oldVersion} -> ${newVersion} (mode: ${mode})`);

// 1. Update package.json
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

// 2. Update package-lock.json if exists
const lockPath = path.join(ROOT, 'package-lock.json');
if (fs.existsSync(lockPath)) {
  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    lock.version = newVersion;
    if (lock.packages && lock.packages['']) {
      lock.packages[''].version = newVersion;
    }
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf8');
    console.log('[version-bump] Updated package-lock.json');
  } catch (e) {
    console.warn('[version-bump] Could not update package-lock.json:', e.message);
  }
}

// 3. Update settings-ui.js
const settingsUiPath = path.join(ROOT, 'src', 'renderer', 'js', 'settings-ui.js');
if (fs.existsSync(settingsUiPath)) {
  let sContent = fs.readFileSync(settingsUiPath, 'utf8');
  if (sContent.includes(oldVersion)) {
    sContent = sContent.replaceAll(oldVersion, newVersion);
    fs.writeFileSync(settingsUiPath, sContent, 'utf8');
    console.log('[version-bump] Updated src/renderer/js/settings-ui.js');
  }
}

// 4. Update index.html if present
const indexPath = path.join(ROOT, 'src', 'renderer', 'index.html');
if (fs.existsSync(indexPath)) {
  let hContent = fs.readFileSync(indexPath, 'utf8');
  if (hContent.includes(oldVersion)) {
    hContent = hContent.replaceAll(oldVersion, newVersion);
    fs.writeFileSync(indexPath, hContent, 'utf8');
    console.log('[version-bump] Updated src/renderer/index.html');
  }
}

console.log(`[version-bump] SUCCESS: Upgrade to ${newVersion} completed.`);
