#!/usr/bin/env node
'use strict';

// Test Antigravity & IDE events against a running Capri instance.
// Sends simulated Antigravity actions (sitting on window, editing, bash sparks, alert pointing, victory celebration).

const http = require('node:http');

const PORT = Number(process.env.CAPRI_PORT) || 47823;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SESSION = 'antigravity-test-session';
const CWD = process.cwd();

function post(evt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(evt);
    const req = http.request(
      {
        host: '127.0.0.1',
        port: PORT,
        path: '/event',
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
      },
      (res) => {
        res.resume();
        res.on('end', resolve);
      }
    );
    req.on('error', reject);
    req.end(body);
  });
}

const steps = [
  {
    desc: '1. Khởi tạo phiên làm việc với Antigravity',
    evt: {
      hook_event_name: 'SessionStart',
      session_id: SESSION,
      cwd: CWD,
      agent_source: 'Antigravity',
      source: 'startup',
    },
    wait: 2000,
  },
  {
    desc: '2. Antigravity nhận prompt: "Tối ưu hiệu năng và sửa lỗi logic"',
    evt: {
      hook_event_name: 'UserPromptSubmit',
      session_id: SESSION,
      cwd: CWD,
      agent_source: 'Antigravity',
      prompt: 'Tối ưu hiệu năng và sửa lỗi logic',
    },
    wait: 3000,
  },
  {
    desc: '3. Antigravity đọc file: Read src/index.ts',
    evt: {
      hook_event_name: 'PreToolUse',
      session_id: SESSION,
      cwd: CWD,
      tool_name: 'Read',
      tool_input: { file_path: `${CWD}/src/index.ts` },
    },
    wait: 1800,
  },
  {
    desc: '4. Antigravity sửa code: Edit src/renderer/js/brain.js',
    evt: {
      hook_event_name: 'PreToolUse',
      session_id: SESSION,
      cwd: CWD,
      tool_name: 'Edit',
      tool_input: { file_path: `${CWD}/src/renderer/js/brain.js` },
    },
    wait: 1800,
  },
  {
    desc: '5. Antigravity chạy test: Bash "npm test" (Capri phóng tia sét đỏ & chiếm giữ cửa sổ)',
    evt: {
      hook_event_name: 'PreToolUse',
      session_id: SESSION,
      cwd: CWD,
      tool_name: 'Bash',
      tool_input: { command: 'npm test', description: 'Chạy kiểm thử hệ thống' },
    },
    wait: 2500,
  },
  {
    desc: '6. Cần quyền truy cập terminal: Capri chuyển sang Alert và chỉ tay vào cửa sổ IDE',
    evt: {
      hook_event_name: 'Notification',
      session_id: SESSION,
      cwd: CWD,
      notification_type: 'permission_prompt',
      title: 'Yêu cầu cấp quyền',
      message: 'Antigravity cần sự đồng ý của bạn để chạy lệnh: git push origin main',
    },
    wait: 4000,
  },
  {
    desc: '7. Hoàn thành nhiệm vụ: Capri teleport ra sân khấu và ăn mừng chiến thắng!',
    evt: {
      hook_event_name: 'Stop',
      session_id: SESSION,
      cwd: CWD,
      agent_source: 'Antigravity',
      last_assistant_message: 'Đã tối ưu xong toàn bộ mã nguồn! 12 tests đã pass thành công.',
    },
    wait: 1000,
  },
];

(async () => {
  console.log(`\n======================================================`);
  console.log(`  Bắt đầu chạy thử nghiệm chuỗi sự kiện Antigravity -> Capri`);
  console.log(`  Cổng: 127.0.0.1:${PORT}`);
  console.log(`======================================================\n`);

  for (const step of steps) {
    console.log(`[TEST] ${step.desc}`);
    try {
      await post(step.evt);
    } catch {
      console.error(`\n[LỖI] Không thể kết nối tới Capri tại 127.0.0.1:${PORT}.`);
      console.error(`Hãy đảm bảo bạn đã chạy 'npm start' ở một terminal khác trước khi chạy script này!\n`);
      process.exit(1);
    }
    await sleep(step.wait);
  }

  console.log(`\n✓ Hoàn tất chuỗi thử nghiệm thành công!`);
})();
