'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

console.log('===============================================================');
console.log('  CAPRI DESKTOP — INTERACTION & DESIGN OVERHAUL TEST SUITE      ');
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

// 1. Check Item 1: Quick-Input Redesign
test('1. Quick-Input Markup & CSS & Logic (Collapsed 2-button | Expanded 250px)', () => {
  const indexHtml = fs.readFileSync(path.join(ROOT, 'src/renderer/index.html'), 'utf8');
  assert(indexHtml.includes('id="biochip-quick-type-btn"'), 'index.html must have biochip-quick-type-btn');
  assert(indexHtml.includes('class="quick-bar-divider"'), 'index.html must have quick-bar-divider');
  assert(indexHtml.includes('id="biochip-quick-mic-btn"'), 'index.html must have biochip-quick-mic-btn');
  assert(indexHtml.includes('id="biochip-quick-input-field"'), 'index.html must have biochip-quick-input-field');

  const capriCss = fs.readFileSync(path.join(ROOT, 'src/renderer/styles/capri.css'), 'utf8');
  assert(capriCss.includes('.biochip-quick-input {') && capriCss.includes('width: 72px;'), 'capri.css must style collapsed quick-input width ~72px');
  assert(capriCss.includes('.biochip-quick-input.is-expanded {') && capriCss.includes('width: 250px;'), 'capri.css must style expanded quick-input width 250px');
  assert(capriCss.includes('border: none !important;') && capriCss.includes('.biochip-quick-input__btn'), 'Quick bar buttons must have border none');
  assert(capriCss.includes('.quick-bar-divider'), 'capri.css must style .quick-bar-divider');

  const chipJs = fs.readFileSync(path.join(ROOT, 'src/renderer/js/chip.js'), 'utf8');
  assert(chipJs.includes('expandQuickInput()'), 'chip.js must have expandQuickInput method');
  assert(chipJs.includes('collapseQuickInput()'), 'chip.js must have collapseQuickInput method');
  assert(chipJs.includes('isQuickExpanded'), 'chip.js must track isQuickExpanded state');
});

// 2. Check Item 2: Pixel-Accurate Alpha Hit-Testing
test('2. Biochip Alpha Hit-Testing & Tight Hitbox', () => {
  const chipJs = fs.readFileSync(path.join(ROOT, 'src/renderer/js/chip.js'), 'utf8');
  assert(chipJs.includes('willReadFrequently: true'), 'Small must request willReadFrequently');
  assert(chipJs.includes('isAlphaSolid(clientX, clientY'), 'chip.js must have isAlphaSolid method');
  assert(chipJs.includes('getImageData'), 'isAlphaSolid must read pixel via getImageData');
  assert(chipJs.includes('pixel[3] > threshold') || chipJs.includes('data[3] > threshold'), 'isAlphaSolid must check alpha channel');
  assert(chipJs.includes('isAlphaSolid(e.clientX, e.clientY, 25)'), 'chip.js mousedown must check alpha threshold');

  const appJs = fs.readFileSync(path.join(ROOT, 'src/renderer/js/app.js'), 'utf8');
  assert(appJs.includes('chip.contains(clientX, clientY)'), 'app.js updateMouseHitTest must call chip.contains');
});

// 3. Check Item 3: Capri Voice Pack from Open-Source Assets
test('3. Capri Voice Pack & 4 Voice Output Modes', () => {
  const voiceJs = fs.readFileSync(path.join(ROOT, 'src/renderer/js/voice.js'), 'utf8');
  assert(voiceJs.includes("this.voiceMode = 'pack'"), 'voice.js must default voiceMode to pack');
  assert(voiceJs.includes('playCapriVoicePack'), 'voice.js must implement playCapriVoicePack');
  assert(voiceJs.includes('hello-morning.wav') && voiceJs.includes('hello-miss.wav') && voiceJs.includes('hello-late.wav'), 'voice.js must reference all 3 original voice clips');
  assert(voiceJs.includes("if (this.voiceMode === 'pack')"), 'speakCyberpunk must support pack mode');
  assert(voiceJs.includes("if (this.voiceMode === 'synth'") || voiceJs.includes("this.voiceMode === 'synth' || !this.ttsEnabled"), 'speakCyberpunk must support synth mode');

  const settingsUiJs = fs.readFileSync(path.join(ROOT, 'src/renderer/js/settings-ui.js'), 'utf8');
  assert(settingsUiJs.includes('id="cfg-voice-mode"'), 'settings-ui.js must have cfg-voice-mode select');
  assert(settingsUiJs.includes('Capri Voice Pack (Original Voice Assets)'), 'settings-ui.js must include Capri Voice Pack option');
  assert(settingsUiJs.includes('Cyber Glitch Synth (Classic Beeps)'), 'settings-ui.js must include Cyber Glitch Synth option');
  assert(settingsUiJs.includes('Neural / System TTS'), 'settings-ui.js must include Neural TTS option');
  assert(settingsUiJs.includes('playCapriVoicePack'), 'settings-ui.js test button must handle playCapriVoicePack');
  assert(!settingsUiJs.includes('Hệ thống giọng nói Capri Hologram'), 'settings-ui.js test message must not have old Vietnamese text');

  const configStoreJs = fs.readFileSync(path.join(ROOT, 'src/main/config-store.js'), 'utf8');
  assert(configStoreJs.includes("voiceMode: 'pack'"), 'config-store.js DEFAULTS must include voiceMode: pack');
});

// 4. Check Item 4: Intro Animation Lifecycle
test('4. Intro Animation: Biochip Hidden During Intro & Materializes at End', () => {
  const appJs = fs.readFileSync(path.join(ROOT, 'src/renderer/js/app.js'), 'utf8');
  assert(appJs.includes('const willPlayIntro = Boolean(intro && config.visible !== false)'), 'app.js must check willPlayIntro at boot');
  assert(appJs.includes("chip.canvas.style.opacity = '0'") && appJs.includes("chip.canvas.style.visibility = 'hidden'"), 'app.js must hide chip during intro');
  assert(appJs.includes('fx.burst') && appJs.includes("voice.play('teleport-in')"), 'app.js must trigger burst & sound on intro complete');
  assert(appJs.includes("chip.canvas.style.opacity = '1'") && appJs.includes("chip.canvas.style.visibility = 'visible'"), 'app.js must reveal chip after intro');
});

// 5. Check Item 5: Dynamic Scaling of Capri Model with Chat Size Presets
test('5. Dynamic Scaling of Capri Model & Stage Presets', () => {
  const panelJs = fs.readFileSync(path.join(ROOT, 'src/renderer/js/panel.js'), 'utf8');
  assert(panelJs.includes('--capri-model-scale'), 'panel.js setSize must set --capri-model-scale');
  assert(panelJs.includes('--holo-stage-width'), 'panel.js setSize must set --holo-stage-width');
  assert(panelJs.includes('0.78') && panelJs.includes('1.0') && panelJs.includes('1.15') && panelJs.includes('1.30'), 'panel.js must define all 4 scale factors');
  assert(panelJs.includes('170') && panelJs.includes('210') && panelJs.includes('250') && panelJs.includes('290'), 'panel.js must define all 4 stage widths');

  const capriCss = fs.readFileSync(path.join(ROOT, 'src/renderer/styles/capri.css'), 'utf8');
  assert(capriCss.includes('var(--holo-stage-width, 210px) !important;'), 'capri.css must apply var(--holo-stage-width)');
  assert(capriCss.includes('scale(var(--capri-model-scale, 1)) !important;'), 'capri.css must apply scale(var(--capri-model-scale))');
  assert(capriCss.includes('transform-origin: bottom center !important;'), 'capri.css must apply transform-origin: bottom center');
  assert(capriCss.includes('bottom: 0px !important;'), 'capri.css must anchor feet at bottom: 0px');

  const settingsUiJs = fs.readFileSync(path.join(ROOT, 'src/renderer/js/settings-ui.js'), 'utf8');
  assert(settingsUiJs.includes('Compact') && settingsUiJs.includes('Standard') && settingsUiJs.includes('Wide') && settingsUiJs.includes('Large'), 'settings-ui.js presets must be Compact, Standard, Wide, Large');
});

console.log('===============================================================');
console.log('ALL INTERACTION & DESIGN OVERHAUL CHECKS PASSED WITH 100%! ✓   ');
console.log('===============================================================');
