'use strict';

// Capri Safe Hands: Desktop interaction tools ported from Hands.cs & Computer.cs
// Provides safe desktop manipulation: open, switch, minimize, shortcut, power.
// Does NOT auto-click or take over the mouse blindly.

const { execFile } = require('node:child_process');
const { launchApp, find, list } = require('./apps');

function powershell(script) {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      `[Console]::OutputEncoding = [Text.Encoding]::UTF8; ${script}`,
    ], { windowsHide: true, timeout: 15000 }, (err, out) => (err ? reject(err) : resolve(out ? out.trim() : '')));
  });
}

/**
 * Switch focus to an active window by process name or window title
 */
async function switchApp(target) {
  if (process.platform !== 'win32') return { ok: false, error: 'Chỉ hỗ trợ trên Windows' };
  const clean = String(target || '').trim();
  if (!clean) return { ok: false, error: 'Thiếu tên ứng dụng cần chuyển' };

  try {
    const ps = `
$target = "${clean.replace(/"/g, '`"')}"
$p = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and ($_.ProcessName -like "*$target*" -or $_.MainWindowTitle -like "*$target*") } | Select-Object -First 1
if ($p) {
  $wsh = New-Object -ComObject WScript.Shell
  $wsh.AppActivate($p.Id)
  Write-Output "OK"
} else {
  Write-Output "NOT_FOUND"
}
`;
    const res = await powershell(ps);
    if (res.includes('OK')) {
      return { ok: true, message: `Đã chuyển sang ${clean}` };
    }
    return { ok: false, error: `Không tìm thấy cửa sổ đang mở của "${clean}"` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Minimize an active application window safely
 */
async function minimizeApp(target) {
  if (process.platform !== 'win32') return { ok: false, error: 'Chỉ hỗ trợ trên Windows' };
  const clean = String(target || '').trim();
  if (!clean) return { ok: false, error: 'Thiếu tên ứng dụng' };

  try {
    const ps = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinApi {
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
}
"@
$target = "${clean.replace(/"/g, '`"')}"
$p = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and ($_.ProcessName -like "*$target*" -or $_.MainWindowTitle -like "*$target*") } | Select-Object -First 1
if ($p) {
  [WinApi]::ShowWindowAsync($p.MainWindowHandle, 2) # SW_SHOWMINIMIZED
  Write-Output "OK"
} else {
  Write-Output "NOT_FOUND"
}
`;
    const res = await powershell(ps);
    if (res.includes('OK')) {
      return { ok: true, message: `Đã thu nhỏ ${clean}` };
    }
    return { ok: false, error: `Không tìm thấy cửa sổ "${clean}"` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Send keyboard shortcut safely (e.g. "ctrl+c", "ctrl+v", "alt+tab", "win+d")
 */
async function sendShortcut(combo) {
  if (process.platform !== 'win32') return { ok: false, error: 'Chỉ hỗ trợ trên Windows' };
  const clean = String(combo || '').toLowerCase().trim();

  // Mapping common shortcut names to SendKeys syntax
  const mapping = {
    'ctrl+c': '^c',
    'ctrl+v': '^v',
    'ctrl+z': '^z',
    'ctrl+y': '^y',
    'ctrl+s': '^s',
    'ctrl+a': '^a',
    'ctrl+f': '^f',
    'ctrl+w': '^w',
    'ctrl+t': '^t',
    'alt+f4': '%{F4}',
    'alt+tab': '%{TAB}',
    'win+d': '^{ESC}', // fallback
    'f11': '{F11}',
    'esc': '{ESC}',
    'escape': '{ESC}',
    'enter': '{ENTER}',
  };

  const sendKey = mapping[clean];
  if (!sendKey) {
    return { ok: false, error: `Phím tắt "${combo}" không nằm trong danh sách an toàn.` };
  }

  try {
    const ps = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("${sendKey}")
Write-Output "OK"
`;
    await powershell(ps);
    return { ok: true, combo };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Safe power management: lock or sleep (never raw immediate shutdown)
 */
async function systemPower(action) {
  if (process.platform !== 'win32') return { ok: false, error: 'Chỉ hỗ trợ trên Windows' };
  const act = String(action || '').toLowerCase().trim();

  if (act === 'lock' || act === 'khóa') {
    try {
      await powershell('rundll32.exe user32.dll,LockWorkStation');
      return { ok: true, message: 'Đã khóa màn hình máy tính.' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  if (act === 'sleep' || act === 'ngủ') {
    try {
      await powershell('rundll32.exe powrprof.dll,SetSuspendState 0,1,0');
      return { ok: true, message: 'Máy tính đang chuyển sang chế độ Sleep.' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  return { ok: false, error: `Hành động power "${action}" không được hỗ trợ hoặc tiềm ẩn nguy cơ.` };
}

module.exports = {
  openApp: launchApp,
  switchApp,
  minimizeApp,
  sendShortcut,
  systemPower,
};
