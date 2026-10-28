<p align="center">
  <a href="README.md">English</a> · <strong>Tiếng Việt</strong>
</p>

# ⚡ Capri Desktop — Phiên Bản Cyberpunk

<p align="center">
  <strong>Trợ Lý Desktop Pet Thông Minh & Giao Diện Cyberpunk HUD Đỉnh Cao</strong><br>
  <em>Sống động ngay trên màn hình, tương tác thời gian thực với AI Coding Agents, phản hồi giọng nói và lưu lại highlight gaming.</em>
</p>

<p align="center">
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-%3E%3D20.0.0-339933?logo=node.js&logoColor=white" alt="Node.js" /></a>
  <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/Electron-44.x-47848F?logo=electron&logoColor=white" alt="Electron" /></a>
  <a href="package.json"><img src="https://img.shields.io/badge/Phi%C3%AAn_b%E1%BA%A3n-1.3.3--cyberpunk--edition-00f0ff?style=flat-square" alt="Version" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/Gi%E1%BA%A5y_ph%C3%A9p-MIT-blue.svg?style=flat-square" alt="License" /></a>
  <a href="README.md"><img src="https://img.shields.io/badge/Language-English-00f0ff?style=flat-square" alt="English" /></a>
</p>

---

## 🌟 Tổng Quan

**Capri Desktop** là người bạn đồng hành ảo thông minh trên desktop được xây dựng bằng Electron và các công nghệ web hiện đại, lấy cảm hứng từ nhân vật Capri trong thế giới *Cyberpunk: Edgerunners*.

Khác với các ứng dụng chiếm dụng màn hình cồng kềnh, Capri hoạt động chủ đạo dưới dạng **Mini Biochip HUD** nhỏ gọn, neo tĩnh lặng ở góc màn hình. Khi bạn lập trình cùng các AI Coding Assistant (**Google Antigravity, Claude Code, Gemini CLI, Cursor**) hoặc ra lệnh bằng giọng nói, Capri sẽ bừng sáng: bình luận mã nguồn, phóng điện sét đỏ khi chạy lệnh terminal, ăn mừng khi bài test vượt qua, và tự động cắt các pha xử lý game đỉnh cao của bạn.

---

## ⚡ Điểm Nhấn Kiến Trúc & Tính Năng Nổi Bật

### 1. Giao Diện Chính: Mini Biochip HUD
* **Gọn Gàng & Tối Giản**: Đặt sát góc dưới màn hình, tuyệt đối không che khuất không gian làm việc.
* **Vòng Sáng Neon Audio-Reactive**: Vòng neon bên ngoài phản hồi động theo cường độ âm thanh micro (RMS) trong thời gian thực.
* **Hover Hiện Ô Nhập Nhanh (Quick-Input)**: Di chuột vào Biochip để mở ô chat nhanh. Gõ câu hỏi hoặc lệnh rồi nhấn `Enter` để gửi ngay mà không cần mở toàn bộ cửa sổ chat.
* **Popup Thoại Trên Đầu (Overhead Speech Stack)**: Câu thoại của Capri hiển thị dạng bong bóng nổi phía trên Biochip, tự động kẹp tọa độ vào khung nhìn để không bao giờ bị tràn khỏi màn hình.
* **Kéo Thả Linh Hoạt (Drag-and-Clamp)**: Dễ dàng kéo thả Biochip tới bất kỳ vị trí nào trên các màn hình với cơ chế tự động giữ trong khung nhìn.

### 2. Khung Chat & Bảng Điều Khiển Hologram On-Demand
* **Chỉ Hiện Khi Cần (On-Demand)**: Toàn bộ khung chat Hologram chỉ mở khi bạn click vào Biochip hoặc nhấn phím tắt.
* **Avatar Sprite Động Bằng Canvas**: Avatar của Capri vẽ trực tiếp trên HTML5 Canvas cắt từ file sprite, biến đổi biểu cảm liên tục (bình thường, suy nghĩ, đang nói, cười đắc thắng, hoảng hốt).
* **Bố Cục Avatar Đối Xứng 40px**: Avatar Capri bên trái và Avatar User bên phải được căn chỉnh đối xứng hoàn hảo.
* **Bộ Tải Ảnh Đại Diện Canvas 128×128**: Tự động căn giữa (`object-fit: cover`), nén ảnh thành Base64 PNG dung lượng siêu nhẹ (~15KB) lưu an toàn trong máy.
* **Lưu Lịch Sử Trò Chuyện**: Toàn bộ nội dung trao đổi được lưu trữ cục bộ, hỗ trợ xóa lịch sử chỉ bằng một click.

### 3. Thanh Trạng Thái Góc Trái (Status Ticker Bar)
* **Khít Góc Màn Hình (0px, 0px)**: Neo sát cạnh trên bên trái màn hình, không có khoảng cách thừa.
* **Hiển Thị Telemetry Thời Gian Thực**: Cập nhật hành động của AI Agent (`[ AGENT // EDITING: <file> ]`, `[ AGENT // BASH: "npm test" ]`, `VOICE: LISTENING...`, `REPLAY: BUFFERING...`).
* **Kéo Thả Tùy Ý**: Bạn có thể dùng chuột kéo hoặc nhấn `Alt + Kéo chuột` để đặt thanh trạng thái ở bất kỳ vị trí nào.
* **Presets Định Vị Sẵn**: Chọn nhanh các vị trí *Góc Trái Trên*, *Giữa Trên*, *Góc Phải Trên*, *Góc Trái Dưới* hoặc nhập tọa độ tùy chỉnh `Offset X/Y` (-10px đến 500px).

### 4. Kết Nối Agent Hook 2 Tầng (Antigravity & Claude Code)
* **Bộ Giám Sát In-Process (Zero Zombie)**: Theo dõi trực tiếp file mã nguồn và runtime log của Agent trong tiến trình Electron, chống tự kích hoạt vòng lặp với debounce 400ms.
* **Cầu Nối HTTP Non-Blocking**: Mở cổng `43225` (`/hook`) bắt các lệnh công cụ (`Edit`, `Bash`, `Read`, `Grep`).
* **Hoạt Ảnh Độc Đáo**: Capri phóng tia sét đỏ, nhảy lên chiếm quyền cửa sổ terminal giả lập, chỉ tay vào tác vụ và ăn mừng khi xong việc.
* **Nút Test Nhanh**: Tích hợp nút `[ TEST AGENT HOOK ]` trong Cài đặt -> Hệ thống để thử nghiệm ngay lập tức.

### 5. Whisper STT & Lọc Tiếng Ồn Thụ Động
* **Nhận Diện Giọng Nói Thụ Động (VAD)**: Ở trạng thái chờ, mic tắt hoàn toàn hoạt ảnh sóng âm khi có tiếng nói chuyện bình thường hoặc tiếng ồn xung quanh.
* **Từ Khóa Đánh Thức (Wake Words)**: Lắng nghe chính xác các câu: `"Hey Capri"`, `"Hi Capri"`, `"Capri ơi"`.
* **Giải Mã Siêu Tốc**: Hỗ trợ Groq Cloud Whisper (`whisper-large-v3-turbo`) và Whisper offline cục bộ với độ trễ dưới 1 giây.

### 6. Quay Ngược Khoảnh Khắc (Instant Replay Ring-Buffer)
* **Vòng Lặp Ghi Ngầm 30s–60s**: Tự động lưu 30–60 giây hình ảnh và âm thanh gần nhất vào bộ đệm vòng tròn thông qua FFmpeg.
* **Loại Bỏ Nút Bấm Thừa**: Không cần nút bấm quay thủ công, chỉ cần ra lệnh bằng giọng nói:
  * *"record that"*
  * *"clip that"*
* Video được xuất tự động dạng MP4 vào thư mục `Videos/Capri_Clips/` kèm mốc thời gian rõ ràng.

### 7. Đa Nền Tảng Mô Hình AI LLM
* **Groq Cloud (Khuyên dùng)**: Tốc độ phản hồi cực nhanh với Llama 3.3 70B & DeepSeek.
* **Google Gemini Studio**: Tích hợp Gemini 2.0 Flash / Pro.
* **OpenAI / OpenRouter**: GPT-4o, Claude 3.5 Sonnet, v.v.
* **Ollama (100% Offline)**: Chạy hoàn toàn cục bộ không cần internet (`llama3`, `mistral`, `qwen`).

### 8. Bộ Giao Diện Cyberpunk HUD Đa Dạng
* **4 Theme Sẵn Có**:
  * `Dark Matter` (Không gian đen huyền bí viền tím Cyberpunk)
  * `Neon Horizon` (Xanh Cyan và hồng Neon rực rỡ)
  * `Crimson Protocol` (Sắc đỏ cảnh báo Netrunner)
  * `Matrix Console` (Màn hình điện toán xanh lá cổ điển)
* **Kính Mờ Trong Suốt (Clear Glass)**: Tùy chỉnh thanh trượt độ trong suốt (opacity) và độ mờ nền (blur từ 8px–32px).

---

## 🛠️ Cài Đặt & Khởi Chạy

### Yêu cầu hệ thống
* [Node.js](https://nodejs.org/) **>= 20.0.0**
* `npm` hoặc `bun`
* Windows 10/11 (hỗ trợ cả macOS và Linux)

### Các bước cài đặt nhanh

1. **Clone mã nguồn từ GitHub**:
   ```bash
   git clone https://github.com/lostempyrea/Capri-desktop.git
   cd Capri-desktop
   ```

2. **Cài đặt các gói phụ thuộc**:
   ```bash
   npm install
   ```

3. **Cấu hình API Keys** (Tùy chọn, để trò chuyện AI & Nhận diện giọng nói):
   Sao chép file `.env.example` thành `.env`:
   ```bash
   cp .env.example .env
   ```
   Điền API Key miễn phí của bạn:
   * **Groq API Key** (Chat siêu nhanh & Whisper STT): [console.groq.com](https://console.groq.com)
   * **Gemini API Key**: [aistudio.google.com](https://aistudio.google.com/apikey)

4. **Khởi động ứng dụng**:
   ```bash
   npm start
   ```

5. **Tạo Shortcut ngoài màn hình chính**:
   ```bash
   npm run shortcut
   ```

---

## 🎯 Phím Tắt & Khẩu Lệnh Giọng Nói

| Thao Tác | Khẩu Lệnh (EN / VI) | Phím Tắt |
| :--- | :--- | :--- |
| **Đánh thức / Lắng nghe** | `"Hey Capri"`, `"Hi Capri"`, `"Capri ơi"` | Bấm nút Mic `🎙️` |
| **Lưu highlight game (Instant Replay)** | `"record that"`, `"clip that"` | — |
| **Mở khung Chat & Cài đặt** | Bấm vào lõi Biochip | `Ctrl + Shift + C` |
| **Nhập prompt nhanh** | Di chuột vào Biochip -> Gõ ô Quick-Input | Nhấn `Enter` |
| **Di chuyển Thanh Trạng Thái** | Kéo chuột trực tiếp hoặc `Alt + Kéo chuột` | — |
| **Bật/Tắt âm thanh** | `"mute"`, `"im lặng đi"` | Menu khay hệ thống (Tray) |

---

## 🤖 Kết Nối Với Google Antigravity & Claude Code

Để Capri tương tác với quá trình viết mã của bạn trong **Antigravity** hoặc **Claude Code**:

1. Mở Cài đặt của Capri -> chuyển sang tab **Hệ thống**.
2. Bật công tắc **Antigravity Agent Hook** sang `ON`.
3. Nhấn **[ TEST AGENT HOOK ]** để chiêm ngưỡng Capri phản hồi tức thì.
4. Khi Agent chạy lệnh, sửa file hay test code trong IDE, Capri sẽ theo dõi và hiển thị hoạt ảnh trực tiếp.

---

## 🔒 Bảo Mật & Quyền Riêng Tư

* **Xử lý Cục Bộ (Local-First)**: Capri chạy 100% trên máy tính cá nhân của bạn.
* **Bộ Đệm Quay Màn Hình Ngoại Tuyến**: Bộ đệm Instant Replay lưu trữ tạm thời trong RAM/ổ cứng máy bạn, tuyệt đối không gửi video lên Internet.
* **Bảo Vệ API Keys**: Toàn bộ khóa bảo mật trong `.env` và `config.json` đều được loại trừ khỏi Git qua `.gitignore`.

---

## 📜 Giấy Phép & Ghi Nhận

* **Giấy phép**: [MIT License](LICENSE)
* **Cảm hứng**: Dự án Capricorn trong phim hoạt hình *Cyberpunk: Edgerunners* của Studio Trigger và CD PROJEKT RED.
* **Đóng góp**: Được phát triển với đam mê từ cộng đồng Capri Desktop.
