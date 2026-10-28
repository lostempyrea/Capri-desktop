'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BACKUPS_DIR = path.join(ROOT, '_backups');

if (!fs.existsSync(BACKUPS_DIR)) {
  console.error('[rollback] No _backups directory found!');
  process.exit(1);
}

const backups = fs.readdirSync(BACKUPS_DIR)
  .filter((f) => {
    const full = path.join(BACKUPS_DIR, f);
    return fs.statSync(full).isDirectory() && (f.startsWith('backup_') || f.startsWith('core_backup_'));
  })
  .map((f) => ({ name: f, mtime: fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime)
  .map((x) => x.name);

if (backups.length === 0) {
  console.error('[rollback] No backup directories found in _backups!');
  process.exit(1);
}

const latestBackup = path.join(BACKUPS_DIR, backups[0]);
console.log(`[rollback] Rolling back to latest backup: ${backups[0]}`);

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src)) {
      copyRecursive(path.join(src, item), path.join(dest, item));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

for (const target of ['src', 'hooks', 'scripts', 'package.json']) {
  const src = path.join(latestBackup, target);
  const dest = path.join(ROOT, target);
  if (fs.existsSync(src)) {
    console.log(`[rollback] Restoring ${target}...`);
    copyRecursive(src, dest);
  }
}

console.log('[rollback] Complete! Application restored successfully.');
