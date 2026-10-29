'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

function getMemoryPath() {
  // Prefer project root me.md if accessible, or userData
  try {
    const rootPath = path.resolve(__dirname, '..', '..', 'me.md');
    return rootPath;
  } catch {
    return path.join(app.getPath('userData'), 'me.md');
  }
}

const DEFAULT_MEMORY = `# CAPRI USER MEMORY & PREFERENCES (me.md)
*Tài liệu ký ức lâu dài của Capri về Operator*

## 1. Thông tin người dùng
- Callsign / Tên gọi: Operator
- Vai trò: Nhà phát triển phần mềm / Kiến trúc sư hệ thống
- Ngôn ngữ ưa chuộng: Tiếng Việt, Tiếng Anh

## 2. Thói quen & Môi trường làm việc
- IDE / Công cụ chính: Visual Studio Code, Antigravity, PowerShell, Terminal
- Phong cách giao tiếp: Ngắn gọn, chuẩn xác, sắc sảo
- Nhạc ưa thích: Synthwave, Cyberpunk 2077 OST, Lofi Hip Hop

## 3. Ghi nhớ quan trọng (Facts & Notes)
- Dự án cốt lõi: Capri Desktop Cyberpunk Edition
`;

function getMemory() {
  const file = getMemoryPath();
  try {
    if (fs.existsSync(file)) {
      return fs.readFileSync(file, 'utf8');
    }
    fs.writeFileSync(file, DEFAULT_MEMORY, 'utf8');
    return DEFAULT_MEMORY;
  } catch (err) {
    console.warn('[memory] Failed to read me.md:', err.message);
    return DEFAULT_MEMORY;
  }
}

function saveMemory(content) {
  const file = getMemoryPath();
  try {
    fs.writeFileSync(file, String(content || ''), 'utf8');
    return { ok: true };
  } catch (err) {
    console.error('[memory] Failed to write me.md:', err.message);
    return { ok: false, error: err.message };
  }
}

function appendMemory(note) {
  const current = getMemory();
  const dateStr = new Date().toISOString().slice(0, 10);
  const entry = `\n- [${dateStr}] ${note.trim()}`;
  const updated = current + entry;
  return saveMemory(updated);
}

module.exports = {
  getMemory,
  saveMemory,
  appendMemory,
  getMemoryPath,
};
