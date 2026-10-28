'use strict';

// Verification suite for Capri Desktop v1.3.0-cyberpunk-edition
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

console.log('===============================================================');
console.log('      CAPRI DESKTOP — v1.3.0 UPGRADE VERIFICATION SUITE       ');
console.log('===============================================================');

// 1. Version Bump & Package Config
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
assert(/^1\.3\.\d+-cyberpunk-edition$/.test(pkg.version), 'package.json version is >= 1.3.0-cyberpunk-edition');
assert(pkg.scripts['bump:small'] && pkg.scripts['bump:major'], 'package.json has bump:small and bump:major scripts');

// 2. Avatar Asset & Canvas Speaking Animation
const localFaces = path.join(ROOT, 'src', 'renderer', 'assets', 'faces.png');
assert(fs.existsSync(localFaces), 'src/renderer/assets/faces.png is present for reliable relative CSP loading');

const panelJs = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'js', 'panel.js'), 'utf8');
assert(panelJs.includes('drawCapriAvatarOnCanvas') && panelJs.includes('capri-avatar-canvas'), 'panel.js contains dynamic Capri avatar canvas drawing');
assert(panelJs.includes('createUserAvatar') && panelJs.includes('user-chat-avatar'), 'panel.js contains symmetrical User avatar generator');

// 3. Chat Layout Symmetry
const capriCss = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'styles', 'capri.css'), 'utf8');
assert(capriCss.includes('.capri-chat-avatar') && capriCss.includes('.user-chat-avatar'), 'capri.css defines symmetrical 40x40px avatar styling');
assert(capriCss.includes('.ticker') && capriCss.includes('position: fixed') && (capriCss.includes('left: 0px') || capriCss.includes('left: 8px') || capriCss.includes('left: 18px')), 'capri.css positions .ticker fixed at top-left');
assert(capriCss.includes('.voice-status-pill') && capriCss.includes('display: none !important'), 'capri.css suppresses legacy overhead voice pill');

// 4. Biochip Overhead Cleanup
const chipJs = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'js', 'chip.js'), 'utf8');
assert(!chipJs.includes('voicePillEl.classList.add(\'is-visible\')'), 'chip.js removed overhead voice pill visibility logic');

// 5. In-Process Hook & Main Process Integrity
const mainJs = fs.readFileSync(path.join(ROOT, 'src', 'main', 'main.js'), 'utf8');
assert(!mainJs.includes('bridgeProcess = fork('), 'main.js has eliminated external child_process.fork() leaks');
assert(mainJs.includes('antigravityHook'), 'main.js integrates in-process antigravityHook');

const hookJs = fs.readFileSync(path.join(ROOT, 'src', 'main', 'antigravity-hook.js'), 'utf8');
assert(hookJs.includes('43225') && hookJs.includes('BLACKLIST_PATTERNS') && hookJs.includes('DEBOUNCE_MS'), 'antigravity-hook.js has port 43225, blacklist filters and debounce');

// 6. Settings UI User Profile Tab
const settingsJs = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'js', 'settings-ui.js'), 'utf8');
assert(settingsJs.includes('tab-user') && settingsJs.includes('CYBERPUNK_AVATAR_PRESETS'), 'settings-ui.js includes Tab 0 (tab-user) and Cyberpunk Avatar presets');
assert(settingsJs.includes('cfg-agent-hook'), 'settings-ui.js includes Antigravity Agent Hook toggle');

console.log('===============================================================');
console.log(`VERIFICATION RESULT: ${passed} PASSED, ${failed} FAILED`);
console.log('===============================================================');

if (failed > 0) process.exit(1);
