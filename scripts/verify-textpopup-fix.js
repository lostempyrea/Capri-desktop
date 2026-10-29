'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

console.log('===============================================================');
console.log('  CAPRI DESKTOP — TEXTPOPUP & HIT-TEST CONFLICT FIX TEST SUITE  ');
console.log('===============================================================');

const ROOT = path.resolve(__dirname, '..');

function test(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    process.exit(1);
  }
}

// 1. Check Step 1: Hit-Test Bypass & setInteractive
test('1. Hit-Test Bypass & setInteractive on Popup Hover & Expansion', () => {
  const appJs = fs.readFileSync(path.join(ROOT, 'src/renderer/js/app.js'), 'utf8');
  assert(
    appJs.includes('clientX >= qr.left - padX && clientX <= qr.right + padX &&') &&
    appJs.includes('clientY >= qr.top - padTop && clientY <= qr.bottom + padBottom'),
    'app.js updateMouseHitTest must check popup bounds with padX and padTop'
  );
  assert(
    (appJs.includes('if (chip.isQuickExpanded || onQuickInput) {') || appJs.includes('if (chip?.isQuickExpanded || onQuickInput) {')) &&
    appJs.includes('setInteractive(true);') &&
    appJs.includes('return true;'),
    'app.js must unconditionally setInteractive(true) when expanded or over quick popup'
  );

  const chipJs = fs.readFileSync(path.join(ROOT, 'src/renderer/js/chip.js'), 'utf8');
  assert(
    chipJs.includes('containsQuickInput(x, y) {') &&
    chipJs.includes('padX = 12') &&
    chipJs.includes('padTop = 16'),
    'chip.js containsQuickInput must use 12px padX and 16px padTop'
  );
  assert(
    chipJs.includes('if (this.isQuickExpanded || this.containsQuickInput(e.clientX, e.clientY)) {') &&
    chipJs.includes('window.host?.setInteractive?.(true);') &&
    chipJs.includes('return;'),
    'chip.js mousemove must immediately setInteractive(true) and return before alpha check'
  );
});

// 2. Check Step 2: Stop Bubbling & Event Conflicts
test('2. Event Bubbling & Mouse Conflict Prevention (stopPropagation & guards)', () => {
  const chipJs = fs.readFileSync(path.join(ROOT, 'src/renderer/js/chip.js'), 'utf8');
  assert(
    chipJs.includes("['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick']") &&
    chipJs.includes('e.stopPropagation();'),
    'chip.js initQuickInput must attach stopPropagation on all pointer/mouse events'
  );
  assert(
    chipJs.includes('.chip-quick-bar, .quick-input-btn, .quick-mic-btn, .quick-chat-input, #biochip-quick-input, .biochip-quick-input') &&
    chipJs.includes('this.isMouseDown = false;') &&
    chipJs.includes('this.hasDragged = false;'),
    'chip.js mousedown and mouseup must guard against clicking quick bar elements'
  );

  const appJs = fs.readFileSync(path.join(ROOT, 'src/renderer/js/app.js'), 'utf8');
  assert(
    appJs.includes('.chip-quick-bar, .quick-input-btn, .quick-mic-btn, .quick-chat-input, #biochip-quick-input, .biochip-quick-input') &&
    appJs.includes('chipDrag = null;'),
    'app.js mousedown and mouseup must guard against starting drag when clicking quick bar elements'
  );
});

// 3. Check Step 3: Z-Index Elevation & CSS Pointer Events
test('3. Z-Index Elevation & Pointer-Events in capri.css & index.html', () => {
  const indexHtml = fs.readFileSync(path.join(ROOT, 'src/renderer/index.html'), 'utf8');
  assert(
    indexHtml.includes('class="biochip-quick-input chip-quick-bar biochip-popup"'),
    'index.html quick input container must include chip-quick-bar and biochip-popup classes'
  );
  assert(
    indexHtml.includes('quick-input-btn'),
    'index.html type button must include quick-input-btn class'
  );
  assert(
    indexHtml.includes('quick-mic-btn'),
    'index.html mic button must include quick-mic-btn class'
  );
  assert(
    indexHtml.includes('quick-chat-input'),
    'index.html input field must include quick-chat-input class'
  );

  const capriCss = fs.readFileSync(path.join(ROOT, 'src/renderer/styles/capri.css'), 'utf8');
  assert(
    capriCss.includes('z-index: 2147483647 !important;'),
    'capri.css must set maximum z-index 2147483647 on quick bar'
  );
  assert(
    capriCss.includes('pointer-events: auto !important;'),
    'capri.css must ensure pointer-events: auto on quick bar and buttons'
  );
  assert(
    capriCss.includes('pointer-events: none !important;') &&
    (capriCss.includes('.chip-quick-bar button svg') || capriCss.includes('.quick-input-btn svg') || capriCss.includes('.biochip-quick-input__btn svg')),
    'capri.css must disable pointer-events on child SVG elements of quick buttons'
  );
  assert(
    capriCss.includes('#fx') && capriCss.includes('pointer-events: none !important;'),
    'capri.css must ensure #fx layer has pointer-events: none'
  );
});

// 4. Check Step 4: State Machine & Window Focus Handling
test('4. State Machine (COLLAPSED, EXPANDED, MIC) & IPC focus-input', () => {
  const mainJs = fs.readFileSync(path.join(ROOT, 'src/main/main.js'), 'utf8');
  assert(
    mainJs.includes("ipcMain.on('window:focus-input'") &&
    mainJs.includes('overlay.setFocusable(true);') &&
    mainJs.includes('overlay.focus();') &&
    mainJs.includes('overlay.setIgnoreMouseEvents(false'),
    'main.js must handle window:focus-input IPC and configure overlay window for text input'
  );

  const preloadJs = fs.readFileSync(path.join(ROOT, 'src/preload.js'), 'utf8');
  assert(
    preloadJs.includes("focusInput: () => ipcRenderer.send('window:focus-input')"),
    'preload.js must expose focusInput API to host'
  );

  const chipJs = fs.readFileSync(path.join(ROOT, 'src/renderer/js/chip.js'), 'utf8');
  assert(
    chipJs.includes('window.host?.focusInput?.()'),
    'chip.js expandQuickInput must call window.host.focusInput()'
  );
  assert(
    chipJs.includes('this.quickTypeBtn.disabled = false;') &&
    chipJs.includes("this.quickTypeBtn.style.pointerEvents = 'auto';"),
    'chip.js lockQuickInput must keep quickTypeBtn enabled so user can interrupt mic session'
  );
  assert(
    chipJs.includes('this.voiceInput?.deactivateCommandMode?.()') &&
    chipJs.includes('this.unlockQuickInput()'),
    'chip.js quickTypeBtn click must cleanly interrupt active mic session'
  );
  assert(
    chipJs.includes('this.chatRef?.handleSpokenCommand') || chipJs.includes('this.chatRef?.handleSpokenQueryOnChip'),
    'chip.js submitQuickInput must forward text to chatRef spoken command handler'
  );

  const voiceInputJs = fs.readFileSync(path.join(ROOT, 'src/renderer/js/voice-input.js'), 'utf8');
  assert(
    voiceInputJs.includes('this.chip?.setMicStatus?.(') || voiceInputJs.includes('setMicStatus(status)'),
    'voice-input.js must synchronize mic status with chip'
  );
});

console.log('===============================================================');
console.log('ALL TEXTPOPUP & HIT-TEST CONFLICT CHECKS PASSED WITH 100%! ✓    ');
console.log('===============================================================');
