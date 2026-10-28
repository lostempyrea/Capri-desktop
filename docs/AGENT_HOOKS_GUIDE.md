# Hướng Dẫn Kiến Trúc & Vận Hành Agent Hooks (`capri-desktop`)
*Tuân thủ tiêu chuẩn Antigravity Customizations (`agy-customizations`)*

Tài liệu này cung cấp hướng dẫn kỹ thuật chi tiết về hệ thống Lifecycle Hooks, quản lý tiến trình nền (Process Guardians), bảo đảm toàn vẹn xuyên chuột (Hit-test Integrity) và dọn dẹp tài nguyên 100% trong dự án `capri-desktop`.

---

## 1. Tổng Quan Kiến Trúc Hooks

Hệ thống Hooks trong `capri-desktop` được thiết kế theo 3 tầng bảo vệ để ngăn chặn rò rỉ tiến trình và lỗi trải nghiệm người dùng:

```
+-------------------------------------------------------------+
|                      AGENT HOOKS PIPELINE                   |
+-------------------------------------------------------------+
   |
   |-- 1. Pre-Start Check [hooks/pre-start-check.js]
   |      +-- Quét cổng :43224 (TCP Lock của agent-bridge)
   |      +-- Quét cổng :47823 (Capri internal server)
   |      +-- Tự động tiêu diệt tiến trình Zombie/Orphan
   |
   |-- 2. Runtime Cleanup Hook [src/main/cleanup-hook.js]
   |      +-- Lắng nghe Electron 'before-quit' & 'will-quit'
   |      +-- SIGINT / SIGTERM handler
   |      +-- Tự động dọn dẹp childProcess (bridge, ffmpeg), sockets & watchers
   |
   +-- 3. Post-Audit Integrity Hook [hooks/post-audit.js]
          +-- Kiểm tra cờ { forward: true } trong setIgnoreMouseEvents
          +-- Kiểm tra tính dynamic của setFocusable
          +-- Kiểm tra API exposure trong src/preload.js
```

---

## 2. Chi Tiết Các Hook

### A. Pre-Start Check (`hooks/pre-start-check.js`)
- **Mục đích**: Chạy trước khi khởi động ứng dụng (`npm start`, `npm run dev`) hoặc trước khi chạy bài test độ bền.
- **Cơ chế hoạt động**:
  1. Sử dụng thư viện `net` để kiểm tra trạng thái của các cổng mạng trọng yếu (`43224`, `47823`).
  2. Nếu phát hiện cổng bị chiếm dụng bởi tiến trình treo (Zombie Node/Electron/Bridge), script truy xuất PID qua lệnh `netstat` và thực thi dọn dẹp cưỡng bức qua `taskkill /F /PID`.
  3. Đảm bảo môi trường hoàn toàn sạch sẽ trước khi tiến trình chính khởi chạy.
- **Cách chạy thủ công**:
  ```bash
  node hooks/pre-start-check.js
  ```

### B. Post-Audit Hook (`hooks/post-audit.js`)
- **Mục đích**: Tự động rà soát mã nguồn sau khi lập trình viên hoặc AI Agent chỉnh sửa code.
- **Quy tắc kiểm thử**:
  1. **Hit-test Transparency**: Mọi lời gọi `overlay.setIgnoreMouseEvents(ignore, { forward: true })` phải luôn có tùy chọn `{ forward: true }`. Nếu thiếu flag này, Windows sẽ chặn mọi cú click chuột xuyên qua màn hình desktop.
  2. **Focus Safety**: Đảm bảo `setFocusable` được gán động qua cờ boolean chứ không bị hardcode `true`, tránh cướp focus bàn phím của người dùng khi đang làm việc khác.
  3. **IPC Bridge Contracts**: Đảm bảo `src/preload.js` cung cấp đầy đủ các hàm giao tiếp `setInteractive` và `setFocusable`.
- **Cách chạy thủ công**:
  ```bash
  node hooks/post-audit.js
  ```

### C. Runtime Cleanup Hook (`src/main/cleanup-hook.js`)
- **Mục đích**: Quản lý vòng đời tiến trình con và tài nguyên I/O trong Electron Main Process.
- **Tính năng chính**:
  - `cleanupGuardian.registerChildProcess(proc)`: Đăng ký tiến trình con (`agent-bridge.js`, `ffmpeg`, ...).
  - `cleanupGuardian.registerWatcher(watcher)`: Đăng ký các file watchers (chokidar, fs.watch).
  - `cleanupGuardian.registerServer(server)`: Đăng ký các TCP/HTTP servers.
  - Tự động kích hoạt khi Electron nhận sự kiện `before-quit`, `will-quit` hoặc khi tiến trình nhận tín hiệu `SIGINT`/`SIGTERM`, bảo đảm không để lại tiến trình mồ côi ngốn CPU/RAM trong Windows Task Manager.

---

## 3. Tích Hợp Vào `package.json`

Các lệnh hooks đã được tích hợp trực tiếp vào workflow của dự án:

```json
{
  "scripts": {
    "prestart": "node hooks/pre-start-check.js",
    "predev": "node hooks/pre-start-check.js",
    "postbuild": "node hooks/post-audit.js",
    "audit": "node hooks/post-audit.js",
    "test:redteam": "node hooks/pre-start-check.js && node scripts/redteam-stress-test.js"
  }
}
```

---

## 4. Kiểm Thử & Nghiệm Thu

Sau khi tích hợp, chạy lệnh kiểm toán:
```bash
node hooks/pre-start-check.js
node hooks/post-audit.js
```
Kết quả mong đợi: Cả hai lệnh đều trả về exit code `0` với thông báo `PASS` trên toàn bộ các tiêu chí.
