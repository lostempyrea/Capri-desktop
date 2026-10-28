'use strict';

// Media player controls for Windows (Spotify, YouTube Music, Apple Music, Browser players, etc.)
// Simulates standard Windows virtual media keys via WScript.Shell.

const { execFile } = require('node:child_process');

const KEYS = {
  playpause: 179, // VK_MEDIA_PLAY_PAUSE (0xB3)
  next: 176,      // VK_MEDIA_NEXT_TRACK (0xB0)
  prev: 177,      // VK_MEDIA_PREV_TRACK (0xB1)
  volup: 175,     // VK_VOLUME_UP (0xAF)
  voldown: 174,   // VK_VOLUME_DOWN (0xAE)
  mute: 173,      // VK_VOLUME_MUTE (0xAD)
};

const ALIASES = {
  play: 'playpause',
  pause: 'playpause',
  play_pause: 'playpause',
  next: 'next',
  prev: 'prev',
  previous: 'prev',
  volup: 'volup',
  vol_up: 'volup',
  voldown: 'voldown',
  vol_down: 'voldown',
  volume_up: 'volup',
  volume_down: 'voldown',
  mute: 'mute',
};

function sendKey(code) {
  if (process.platform !== 'win32') return Promise.resolve(false);
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `& { $ws = New-Object -ComObject WScript.Shell; $ws.SendKeys([char]${code}) }`,
      ],
      { windowsHide: true, timeout: 5000 },
      (err) => resolve(!err)
    );
  });
}

function playPause() {
  return sendKey(KEYS.playpause);
}

function next() {
  return sendKey(KEYS.next);
}

function prev() {
  return sendKey(KEYS.prev);
}

function volumeUp() {
  return sendKey(KEYS.volup);
}

function volumeDown() {
  return sendKey(KEYS.voldown);
}

function mute() {
  return sendKey(KEYS.mute);
}

function action(name) {
  const norm = String(name || '').toLowerCase().replace(/[- ]/g, '_');
  const keyName = ALIASES[norm] || norm;
  const code = KEYS[keyName];
  if (code) return sendKey(code);
  return Promise.resolve(false);
}

module.exports = {
  playPause,
  next,
  prev,
  volumeUp,
  volumeDown,
  mute,
  action,
};
