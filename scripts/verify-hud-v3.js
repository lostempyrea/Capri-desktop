/**
 * Verification Script for Capri Desktop UI/UX Overhaul v3
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('===============================================================');
console.log('   CAPRI DESKTOP — UI/UX OVERHAUL V3 VERIFICATION SUITE       ');
console.log('===============================================================');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[TEST] ${name} ... PASSED ✓`);
    passed++;
  } catch (err) {
    console.error(`[TEST] ${name} ... FAILED ✗:`, err.message);
    failed++;
  }
}

const root = path.resolve(__dirname, '..');

// 1. Index.html structure check
test('index.html: Quick-input, decoupled voice pill, removed model tag & resize handle', () => {
  const html = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');
  assert(html.includes('id="biochip-quick-input"'), 'Missing #biochip-quick-input');
  assert(html.includes('id="biochip-quick-input-field"'), 'Missing #biochip-quick-input-field');
  assert(html.includes('id="biochip-quick-mic-btn"') || html.includes('id="biochip-quick-send-btn"'), 'Missing quick mic/send button');
  assert(html.includes('id="biochip-voice-pill"'), 'Missing #biochip-voice-pill for decoupled voice status');
  assert(!html.includes('panel__tag holo-tag'), 'Raw model tag should be removed from header');
  assert(!html.includes('id="holo-resize-handle"'), 'Resize handle grip should be removed');
  assert(html.includes('id="holo-chat-log"'), 'Missing #holo-chat-log for persistent history');
});

// 2. Chip.js: Hover quick input, right-click, speech stack
test('chip.js: Quick-input methods, unified overhead speech stack, contains check', () => {
  const chipJs = fs.readFileSync(path.join(root, 'src/renderer/js/chip.js'), 'utf8');
  assert(chipJs.includes('showQuickInput'), 'Missing showQuickInput');
  assert(chipJs.includes('hideQuickInput'), 'Missing hideQuickInput');
  assert(chipJs.includes('containsQuickInput'), 'Missing containsQuickInput');
  assert(chipJs.includes('updateQuickInputPosition'), 'Missing updateQuickInputPosition');
  assert(chipJs.includes('containsQuickInput(x, y)'), 'contains() must check containsQuickInput');
  assert(chipJs.includes('isStatusActive'), 'Missing isStatusActive in chip.js');
});

// 3. App.js: Right click disabled on chip, quick-input binding
test('app.js: Right click contextmenu suppressed, chip binds chat and quick-input', () => {
  const appJs = fs.readFileSync(path.join(root, 'src/renderer/js/app.js'), 'utf8');
  assert(appJs.includes('e.stopPropagation()'), 'Context menu must call stopPropagation');
  const ctxBlock = appJs.slice(appJs.indexOf("addEventListener('contextmenu'"), appJs.indexOf("addEventListener('click'"));
  assert(!ctxBlock.includes('host.openMenu()'), 'Context menu on chip must not open legacy menu');
  assert(appJs.includes('chip.bindChat(chat)'), 'Missing chip.bindChat(chat)');
  assert(appJs.includes('chip.initQuickInput()'), 'Missing chip.initQuickInput()');
  assert(appJs.includes('SettingsUI({ host, panel, voice, voiceInput, chat })'), 'SettingsUI must receive chat');
});

// 4. Chat.js: Persistent chat history
test('chat.js: Persistent chat history via localStorage and addMessage', () => {
  const chatJs = fs.readFileSync(path.join(root, 'src/renderer/js/chat.js'), 'utf8');
  assert(chatJs.includes('capri.chatHistoryPersistent'), 'Missing chatHistoryPersistent in chat.js');
  assert(chatJs.includes('loadHistory()'), 'Missing loadHistory');
  assert(chatJs.includes('saveHistory()'), 'Missing saveHistory');
  assert(chatJs.includes('clearHistory()'), 'Missing clearHistory');
  assert(chatJs.includes('addMessage(role, content)'), 'Missing addMessage');
});

// 5. Panel.js: Persistent history DOM rendering and size methods
test('panel.js: renderChatHistory, appendChatMessage, clearHistoryDom', () => {
  const panelJs = fs.readFileSync(path.join(root, 'src/renderer/js/panel.js'), 'utf8');
  assert(panelJs.includes('renderChatHistory'), 'Missing renderChatHistory in panel.js');
  assert(panelJs.includes('appendChatMessage'), 'Missing appendChatMessage in panel.js');
  assert(panelJs.includes('clearHistoryDom'), 'Missing clearHistoryDom in panel.js');
  assert(panelJs.includes('setSize(w, h)'), 'Missing setSize in panel.js');
});

// 6. SettingsUI: 4 tabs, size presets, clear glass, theme cards, clear history button
test('settings-ui.js: 4 tabs, presets, clear glass, theme cards, clear history', () => {
  const settingsJs = fs.readFileSync(path.join(root, 'src/renderer/js/settings-ui.js'), 'utf8');
  assert(settingsJs.includes('data-tab="tab-appearance"'), 'Missing tab-appearance');
  assert(settingsJs.includes('data-tab="tab-ai"'), 'Missing tab-ai');
  assert(settingsJs.includes('data-tab="tab-voice"'), 'Missing tab-voice');
  assert(settingsJs.includes('data-tab="tab-system"'), 'Missing tab-system');
  assert(settingsJs.includes('settings-preset-grid'), 'Missing preset grid');
  assert(settingsJs.includes('data-w="580"'), 'Missing 580x380 preset');
  assert(settingsJs.includes('data-w="700"'), 'Missing 700x450 preset');
  assert(settingsJs.includes('data-w="840"'), 'Missing 840x520 preset');
  assert(settingsJs.includes('data-w="960"'), 'Missing 960x600 preset');
  assert(settingsJs.includes('cfg-clear-glass-toggle'), 'Missing clear glass toggle');
  assert(settingsJs.includes('settings-theme-cards'), 'Missing theme cards');
  assert(settingsJs.includes('cfg-active-model-display'), 'Missing active model display');
  assert(settingsJs.includes('cfg-clear-history-btn'), 'Missing clear history button');
  assert(settingsJs.includes('https://github.com/mochiiwuff/capri-desktop/tree/main'), 'Missing GitHub repo link');
});

// 7. Styles: Universal theme tokens, clear glass, quick-input, user bubble
test('capri.css: Universal theme variables, quick-input, anchored sprite, clear glass', () => {
  const css = fs.readFileSync(path.join(root, 'src/renderer/styles/capri.css'), 'utf8');
  assert(css.includes('--theme-primary:'), 'Missing --theme-primary in :root');
  assert(css.includes('--theme-secondary:'), 'Missing --theme-secondary in :root');
  assert(css.includes('--theme-bg:'), 'Missing --theme-bg in :root');
  assert(css.includes('--theme-surface:'), 'Missing --theme-surface in :root');
  assert(css.includes('--theme-border:'), 'Missing --theme-border in :root');
  assert(css.includes('--theme-text:'), 'Missing --theme-text in :root');
  assert(css.includes('.biochip-quick-input'), 'Missing .biochip-quick-input styles');
  assert(css.includes('.holo-stage-ai-badge'), 'Missing .holo-stage-ai-badge styles');
  assert(css.includes('html.clear-glass'), 'Missing html.clear-glass styles');
  assert(css.includes('[data-theme="tokyo-night"]'), 'Missing tokyo-night theme');
  assert(css.includes('[data-theme="obsidian"]'), 'Missing obsidian theme');
});

// 8. Language pruning: only vi and en
test('labels & lines: Pruned to vi and en only', () => {
  const labels = require(path.join(root, 'src/main/labels.js'));
  assert.deepStrictEqual(labels.LANGS, ['vi', 'en'], 'Main labels must contain only vi and en');

  const linesContent = fs.readFileSync(path.join(root, 'src/renderer/js/lines.js'), 'utf8');
  assert(/"vi":\s*\{/.test(linesContent) || /vi:\s*\{/.test(linesContent), 'lines.js must include vi');
  assert(/"en":\s*\{/.test(linesContent) || /en:\s*\{/.test(linesContent), 'lines.js must include en');
  assert(!/^\s*["']?(fr|es|pt|ru)["']?\s*:\s*\{/m.test(linesContent), 'lines.js must NOT include fr, es, pt, or ru');
});

console.log('===============================================================');
console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('===============================================================');

if (failed > 0) process.exit(1);
