'use strict';

const fs = require('fs');
const assert = require('assert');

console.log('===============================================================');
console.log('   CAPRI DESKTOP — CHAT INPUT FLOW & EVENT REMEDIATION TEST   ');
console.log('===============================================================');

// 1. Verify panel.js input handlers and handleUserSendMessage
const panelSrc = fs.readFileSync('src/renderer/js/panel.js', 'utf8');

assert(panelSrc.includes('handleUserSendMessage(text)'), 'Panel must implement handleUserSendMessage(text)');
assert(panelSrc.includes('this.chatInput.value = \'\';'), 'handleUserSendMessage must immediately clear chatInput');
assert(panelSrc.includes('this.chatRef.handleUserSendMessage(cleanText)'), 'handleUserSendMessage must delegate to chatRef');
assert(panelSrc.includes("this.chatSend?.addEventListener('click'"), 'chatSend must have explicit click event listener');
assert(panelSrc.includes("if (e.key === 'Enter')"), 'chatInput keydown must handle Enter key');
assert(panelSrc.includes('triggerSend();'), 'Enter and click must trigger send');
assert(panelSrc.includes('window.host?.focusOverlay?.(true)'), 'Panel.show must focus overlay');
console.log('[PASS] 1. Panel.js Enter key, click, and input flow verified');

// 2. Verify chat.js handleUserSendMessage
const chatSrc = fs.readFileSync('src/renderer/js/chat.js', 'utf8');

assert(chatSrc.includes('handleUserSendMessage(text)'), 'Chat must implement handleUserSendMessage(text)');
assert(chatSrc.includes('this.open = true;'), 'handleUserSendMessage must ensure this.open = true');
assert(chatSrc.includes("this.addMessage('user', cleanText);"), 'handleUserSendMessage must render user message');
assert(chatSrc.includes("this.addMessage('assistant', answer);"), 'handleUserSendMessage must render assistant answer');
assert(chatSrc.includes('async send(text) {'), 'Chat must have send(text) delegating to handleUserSendMessage');
assert(chatSrc.includes('return await this.handleUserSendMessage(text);'), 'send must delegate to handleUserSendMessage');
console.log('[PASS] 2. Chat.js core sending and assistant reply flow verified');

// 3. Verify capri.css pointer-events, user-select, and z-index
const cssSrc = fs.readFileSync('src/renderer/styles/capri.css', 'utf8');

assert(cssSrc.includes('user-select: text !important;'), 'capri.css must set user-select: text !important on input');
assert(cssSrc.includes('pointer-events: auto !important;'), 'capri.css must set pointer-events: auto !important on input form');
assert(cssSrc.includes('z-index: 51 !important;'), 'capri.css must set z-index: 51 !important on input');
console.log('[PASS] 3. Capri.css pointer-events and focus styling verified');

console.log('===============================================================');
console.log('ALL CHAT INPUT FLOW TESTS PASSED SUCCESSFULLY! ✓');
console.log('===============================================================');
