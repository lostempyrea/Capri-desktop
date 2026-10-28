'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

function getDesktopPath() {
  try {
    // 1. Try PowerShell to get exact Windows desktop folder (handles OneDrive)
    const out = execSync('powershell.exe -NoProfile -Command "[Environment]::GetFolderPath(\'Desktop\')"', {
      encoding: 'utf8'
    }).trim();
    if (out && fs.existsSync(out)) {
      return out;
    }
  } catch (e) {
    console.warn('PowerShell desktop query error:', e.message);
  }

  // 2. Common fallbacks
  const userProfile = process.env.USERPROFILE || 'C:\\Users\\' + (process.env.USERNAME || 'nguye');
  const onedriveDesktop = path.join(userProfile, 'OneDrive', 'Desktop');
  if (fs.existsSync(onedriveDesktop)) return onedriveDesktop;

  const normalDesktop = path.join(userProfile, 'Desktop');
  if (fs.existsSync(normalDesktop)) return normalDesktop;

  return userProfile;
}

function createShortcut() {
  const desktop = getDesktopPath();
  const projectRoot = path.resolve(__dirname, '..');
  const electronExe = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
  const iconFile = path.join(projectRoot, 'assets', 'icons', 'capri.ico');
  const shortcutPath = path.join(desktop, 'Capri.lnk');

  console.log('Project Root   :', projectRoot);
  console.log('Desktop Path   :', desktop);
  console.log('Shortcut Path  :', shortcutPath);
  console.log('Target Exe     :', electronExe);
  console.log('Icon File      :', iconFile);

  if (!fs.existsSync(electronExe)) {
    throw new Error('electron.exe not found at ' + electronExe);
  }

  if (!fs.existsSync(iconFile)) {
    throw new Error('capri.ico not found at ' + iconFile);
  }

  // Create temporary VBScript to generate the .lnk file cleanly
  const vbsScript = [
    'Set oWS = WScript.CreateObject("WScript.Shell")',
    `sLinkFile = "${shortcutPath.replace(/\\/g, '\\\\')}"`,
    'Set oLink = oWS.CreateShortcut(sLinkFile)',
    `oLink.TargetPath = "${electronExe.replace(/\\/g, '\\\\')}"`,
    'oLink.Arguments = "."',
    `oLink.WorkingDirectory = "${projectRoot.replace(/\\/g, '\\\\')}"`,
    `oLink.IconLocation = "${iconFile.replace(/\\/g, '\\\\')},0"`,
    'oLink.Description = "Capri - Cyberpunk Hologram Construct Assistant"',
    'oLink.Save',
    'WScript.Echo "SUCCESS"'
  ].join('\r\n');

  const tempVbs = path.join(projectRoot, '_temp_shortcut.vbs');
  fs.writeFileSync(tempVbs, vbsScript, 'utf8');

  try {
    const result = execSync(`cscript.exe //nologo "${tempVbs}"`, { encoding: 'utf8' }).trim();
    console.log('Result         :', result);
  } finally {
    try { fs.unlinkSync(tempVbs); } catch {}
  }

  // Verify creation
  if (fs.existsSync(shortcutPath)) {
    console.log('\n✓ Shortcut created successfully on Desktop: ' + shortcutPath);
  } else {
    throw new Error('Shortcut creation failed, file not found on desktop');
  }

  // Also create/update Capri.lnk inside project folder for convenience
  const rootShortcut = path.join(projectRoot, 'Capri.lnk');
  try {
    fs.copyFileSync(shortcutPath, rootShortcut);
    console.log('✓ Project root shortcut updated: ' + rootShortcut);
  } catch {}
}

try {
  createShortcut();
} catch (err) {
  console.error('Error creating shortcut:', err.message);
  process.exit(1);
}
