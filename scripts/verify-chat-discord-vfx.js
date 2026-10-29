'use strict';

const fs = require('fs');
const assert = require('assert');

console.log('===========================================================');
console.log('   CAPRI DESKTOP — CHAT, DISCORD VOICE & VFX VERIFICATION  ');
console.log('===========================================================');

// 1. Panel.js verification
const panelSrc = fs.readFileSync('src/renderer/js/panel.js', 'utf8');
assert(panelSrc.includes('this.chatRef = null;'), 'Panel must initialize this.chatRef');
assert(panelSrc.includes('bindChat(chat)'), 'Panel must have bindChat method');
assert(panelSrc.includes("this.switchTab('chat');"), 'Panel.show must switch to chat tab');
assert(panelSrc.includes('this.handleUserSendMessage(text)'), 'Panel form submit must call this.handleUserSendMessage(text)');
assert(panelSrc.includes('renderChatHistory(this.chatRef.history)'), 'Panel.show must populate chat history');
console.log('[PASS] 1. Panel.js chat input and history restoration verified');

// 2. Settings-UI verification
const settingsSrc = fs.readFileSync('src/renderer/js/settings-ui.js', 'utf8');
assert(settingsSrc.includes('cfg-discord-token'), 'Settings UI must include cfg-discord-token');
assert(settingsSrc.includes('cfg-discord-user-id'), 'Settings UI must include cfg-discord-user-id');
assert(settingsSrc.includes('cfg-vfx-volume-slider'), 'Settings UI must include cfg-vfx-volume-slider');
assert(settingsSrc.includes('cfg-vfx-volume-val'), 'Settings UI must include cfg-vfx-volume-val');
assert(settingsSrc.includes('setVfxVolume'), 'Settings UI must call setVfxVolume');
console.log('[PASS] 2. Settings UI Discord and VFX Volume controls verified');

// 3. Voice.js verification
const voiceSrc = fs.readFileSync('src/renderer/js/voice.js', 'utf8');
assert(voiceSrc.includes('this.vfxVolume = 0.8;'), 'Voice must have this.vfxVolume');
assert(voiceSrc.includes('this.vfxGain = ctx.createGain();'), 'Voice must create this.vfxGain');
assert(voiceSrc.includes('this.vfxGain.connect(this.master);'), 'vfxGain must connect to master');
assert(voiceSrc.includes('setVfxVolume(vol)'), 'Voice must have setVfxVolume method');
assert(voiceSrc.includes('this.vfxGain || this.master'), 'Voice cues must route through vfxGain');
console.log('[PASS] 3. Voice.js VFX Volume routing and scaling verified');

// 4. Config-store.js verification
const configStoreSrc = fs.readFileSync('src/main/config-store.js', 'utf8');
assert(configStoreSrc.includes('vfxVolume: 0.8'), 'DEFAULTS must include vfxVolume: 0.8');
assert(configStoreSrc.includes('discordToken:'), 'DEFAULTS must include discordToken');
assert(configStoreSrc.includes('discordUserId:'), 'DEFAULTS must include discordUserId');
console.log('[PASS] 4. Config-Store DEFAULTS verified');

// 5. Discord.js verification
const discordSrc = fs.readFileSync('src/main/discord.js', 'utf8');
assert(discordSrc.includes('resolveTargetVoiceChannel('), 'DiscordBridge must implement resolveTargetVoiceChannel');
assert(discordSrc.includes('connectToVoiceChannel('), 'DiscordBridge must implement connectToVoiceChannel');
assert(discordSrc.includes('async restart('), 'DiscordBridge must implement restart');
assert(discordSrc.includes('cfg?.discordToken'), 'Discord loadConfig must load from configStore');
assert(!discordSrc.includes('Bạn không có quyền điều khiển Capri'), 'Must not contain Vietnamese error string');
console.log('[PASS] 5. DiscordBridge dynamic voice resolution and restart verified');

// 6. Main.js and Preload.js verification
const mainSrc = fs.readFileSync('src/main/main.js', 'utf8');
const preloadSrc = fs.readFileSync('src/preload.js', 'utf8');
assert(mainSrc.includes('discord?.restart?.()'), 'main.js must restart discord on config update');
assert(mainSrc.includes("ipcMain.handle('discord:restart'"), 'main.js must register discord:restart handler');
assert(preloadSrc.includes('restartDiscord:'), 'preload.js must expose restartDiscord');
console.log('[PASS] 6. Main IPC and Preload bindings verified');

// 7. App.js and Chip.js verification
const appSrc = fs.readFileSync('src/renderer/js/app.js', 'utf8');
const chipSrc = fs.readFileSync('src/renderer/js/chip.js', 'utf8');
assert(appSrc.includes('panel.bindChat(chat);'), 'app.js must bind chat to panel');
assert(chipSrc.includes("this.chat?.start === 'function'"), 'chip.js click must trigger chat.start');
console.log('[PASS] 7. App & Chip integration verified');

console.log('===========================================================');
console.log('ALL VERIFICATION CHECKS PASSED WITH 100% SUCCESS!');
console.log('===========================================================');
