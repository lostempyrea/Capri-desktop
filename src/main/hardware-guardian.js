'use strict';

const os = require('node:os');
const configStore = require('./config-store');

let guardianInterval = null;
let lastAlertTime = 0;
const ALERT_COOLDOWN = 5 * 60 * 1000; // Alert at most once every 5 minutes

// Game / Fullscreen keywords
const GAME_KEYWORDS = [
  'game', 'steam', 'epicgames', 'riot', 'valorant', 'league of legends',
  'genshin', 'starrail', 'honkai', 'overwatch', 'cyberpunk', 'cs2',
  'counter-strike', 'dota', 'minecraft', 'apex', 'pubg', 'elden ring',
  'unity', 'unreal', 'gta', 'fortnite', 'roblox'
];

function isGameWindow(title) {
  if (!title) return false;
  const lower = title.toLowerCase();
  return GAME_KEYWORDS.some((kw) => lower.includes(kw));
}

function checkMemory(webContents) {
  try {
    const total = os.totalmem();
    const free = os.freemem();
    const usedPercent = Math.round(((total - free) / total) * 100);

    if (usedPercent >= 90) {
      const now = Date.now();
      if (now - lastAlertTime > ALERT_COOLDOWN) {
        lastAlertTime = now;
        console.warn(`[hardware-guardian] High RAM usage: ${usedPercent}%`);
        if (webContents && !webContents.isDestroyed()) {
          webContents.send('hardware:alert', {
            type: 'ram',
            percent: usedPercent,
            message: `⚠️ Cảnh báo: RAM hệ thống đã đạt ${usedPercent}%! Hãy tắt bớt ứng dụng nặng.`
          });
        }
      }
    }
  } catch (err) {
    console.error('[hardware-guardian] Error checking memory:', err.message);
  }
}

function startHardwareGuardian(mainWindow) {
  if (guardianInterval) clearInterval(guardianInterval);

  guardianInterval = setInterval(() => {
    const config = configStore.load();
    if (!config.system.gamerAutoPilot) return;

    if (mainWindow && !mainWindow.isDestroyed()) {
      checkMemory(mainWindow.webContents);
    }
  }, 10000); // Check every 10 seconds

  return {
    stop() {
      if (guardianInterval) {
        clearInterval(guardianInterval);
        guardianInterval = null;
      }
    }
  };
}

module.exports = {
  startHardwareGuardian,
  isGameWindow
};
