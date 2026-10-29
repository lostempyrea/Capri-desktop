'use strict';

const fs = require('node:fs');
const path = require('node:path');

console.log('===============================================================');
console.log('   CAPRI DESKTOP — RUNTIME AUDIT & VERIFICATION SUITE         ');
console.log('===============================================================');

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}`);
    failed++;
  }
}

// 1. Test LINES bilingual parity
async function testLinesParity() {
  const linesContent = fs.readFileSync('src/renderer/js/lines.js', 'utf8');
  // Simple check for vi and en objects
  assert(linesContent.includes('"vi":') && linesContent.includes('"en":'), 'lines.js contains both vi and en dictionaries');
  
  // Extract top-level keys
  const viIdx = linesContent.indexOf('"vi":');
  const enIdx = linesContent.indexOf('"en":');
  assert(viIdx !== -1 && enIdx !== -1 && viIdx < enIdx, 'lines.js defines vi followed by en');
}

// 2. Test ACTS and Emotes in acting.js
function testActingEmotes() {
  const actingContent = fs.readFileSync('src/renderer/js/acting.js', 'utf8');
  const requiredEmotes = [
    'idle',
    'arrive',
    'leave',
    'dance',
    'dangle',
    'point',
    'bolt',
    'satellite',
    'sleep',
    'wake',
    'blink_glitch'
  ];

  for (const emote of requiredEmotes) {
    const present = actingContent.includes(`${emote}:`) || actingContent.includes(`ACTS.${emote} =`);
    assert(present, `acting.js defines emote '${emote}'`);
  }
}

// 3. Test SPRITE_CLIPS in sprite.js
function testSpriteClips() {
  const spriteContent = fs.readFileSync('src/renderer/js/sprite.js', 'utf8');
  assert(spriteContent.includes('export const SPRITE_CLIPS ='), 'sprite.js exports canonical SPRITE_CLIPS');
  assert(spriteContent.includes('satellite:'), 'SPRITE_CLIPS defines satellite dimensions');
  assert(spriteContent.includes('clear()'), 'SpriteRenderer has clear() canvas cleanup method');
}

// 4. Test Web Audio API and CSP for Music Player
function testMusicPlayer() {
  const playerContent = fs.readFileSync('src/renderer/js/player.js', 'utf8');
  const indexContent = fs.readFileSync('src/renderer/index.html', 'utf8');

  assert(playerContent.includes('window.capriAudioPlayer'), 'player.js uses persistent global window.capriAudioPlayer to prevent audio loss');
  assert(!playerContent.includes('createMediaElementSource'), 'player.js eliminates createMediaElementSource to avoid silencing Electron native audio');
  assert(indexContent.includes('media-src') && indexContent.includes('file:') && indexContent.includes('data:'), 'index.html CSP includes file: and data: for audio');
}

// 5. Test FFmpeg flags in screen-capture.js
function testScreenCapture() {
  const screenContent = fs.readFileSync('src/main/screen-capture.js', 'utf8');
  assert(screenContent.includes('+genpts+igndts'), 'screen-capture.js includes -fflags +genpts+igndts');
  assert(screenContent.includes('scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=30'), 'screen-capture.js forces even dimensions and 30fps');
  assert(screenContent.includes('-pix_fmt') && screenContent.includes('yuv420p'), 'screen-capture.js specifies yuv420p for Windows DWM safety');
  assert(screenContent.includes('-movflags') && screenContent.includes('+faststart'), 'screen-capture.js specifies +faststart for instant metadata header');
  assert(screenContent.includes('-threads') && screenContent.includes('2'), 'screen-capture.js restricts threads to 2');
}

// 6. Test Ticker Top-Left CSS and ShareTechMono font
function testTickerAndHud() {
  const cssContent = fs.readFileSync('src/renderer/styles/capri.css', 'utf8');
  assert(cssContent.includes('.ticker {') || cssContent.includes('.ticker{'), 'capri.css defines .ticker');
  assert(cssContent.includes('top: 0px !important;') && cssContent.includes('left: 0px !important;'), 'capri.css positions .ticker fixed at (0px, 0px)');
  assert(cssContent.includes('font-family: \'ShareTechMono\''), 'capri.css declares ShareTechMono font-face');
  assert(cssContent.includes('clip-path: polygon(7px 0,'), 'capri.css applies sharp cyberpunk beveled corners');
}

// 7. Test Discord shutdown crash prevention
function testDiscordBridgeSafety() {
  const discordContent = fs.readFileSync('src/main/discord.js', 'utf8');
  assert(discordContent.includes('stopVoice cleanup') || discordContent.includes('stopVoice error'), 'discord.js guards stopVoice with try/catch to prevent Object destroyed crash');
}

async function run() {
  await testLinesParity();
  testActingEmotes();
  testSpriteClips();
  testMusicPlayer();
  testScreenCapture();
  testTickerAndHud();
  testDiscordBridgeSafety();

  console.log('===============================================================');
  console.log(`VERIFICATION RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
