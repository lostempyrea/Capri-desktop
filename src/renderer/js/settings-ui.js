// Cyberpunk Settings Deck UI Controller
// Manages the 5-tab settings deck embedded in the Hologram Projection Screen.

const CYBERPUNK_AVATAR_PRESETS = {
  netrunner: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="%230b0e14"/><polygon points="20,4 34,14 34,28 20,36 6,28 6,14" fill="none" stroke="%2300f0ff" stroke-width="1.5"/><rect x="11" y="15" width="18" height="6" rx="2" fill="%2300f0ff" opacity="0.85"/><line x1="8" y1="20" x2="32" y2="20" stroke="%2300ffff" stroke-width="1"/><path d="M14 26 L20 30 L26 26" fill="none" stroke="%2300f0ff" stroke-width="1.5"/><circle cx="20" cy="18" r="1.5" fill="%23ffffff"/></svg>',
  cyborg: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="%23120f17"/><circle cx="20" cy="20" r="14" fill="%231a1528" stroke="%23fcee0a" stroke-width="1.5"/><circle cx="16" cy="17" r="3.5" fill="%23ff0055"/><circle cx="24" cy="17" r="4.5" fill="none" stroke="%23fcee0a" stroke-width="1.5"/><circle cx="24" cy="17" r="1.5" fill="%2300f0ff"/><line x1="24" y1="10" x2="24" y2="24" stroke="%23fcee0a" stroke-width="0.8"/><line x1="17" y1="17" x2="31" y2="17" stroke="%23fcee0a" stroke-width="0.8"/><path d="M14 26 H26 V29 H14 Z" fill="%232b2b3a" stroke="%23fcee0a" stroke-width="1"/><line x1="17" y1="26" x2="17" y2="29" stroke="%23fcee0a" stroke-width="1"/><line x1="23" y1="26" x2="23" y2="29" stroke="%23fcee0a" stroke-width="1"/></svg>',
  hacker: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="%23050d08"/><path d="M20 5 C12 5 8 13 8 24 C8 32 14 36 20 36 C26 36 32 32 32 24 C32 13 28 5 20 5 Z" fill="%230d1f14" stroke="%2300ff66" stroke-width="1.5"/><polyline points="13,17 17,21 13,25" fill="none" stroke="%2300ff66" stroke-width="2"/><line x1="19" y1="25" x2="26" y2="25" stroke="%2300ff66" stroke-width="2"/><line x1="10" y1="31" x2="30" y2="31" stroke="%2300ff66" stroke-dasharray="2,2" stroke-width="1"/></svg>',
  samurai: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="%23160a0d"/><polygon points="20,6 23,13 31,11 25,18 29,26 20,22 11,26 15,18 9,11 17,13" fill="%23ff0055" stroke="%23ff3366" stroke-width="1"/><polygon points="20,16 26,28 14,28" fill="%23260d15" stroke="%23ff0055" stroke-width="1.5"/><line x1="14" y1="21" x2="19" y2="21" stroke="%23ffffff" stroke-width="2"/><line x1="21" y1="21" x2="26" y2="21" stroke="%23ffffff" stroke-width="2"/><path d="M16 25 Q20 30 24 25" fill="none" stroke="%23ff0055" stroke-width="1.5"/></svg>'
};

const I18N_SETTINGS = {
  vi: {
    modalTitle: '[ CÀI ĐẶT HỆ THỐNG // SYSTEM CONTROL DECK ]',
    tabs: {
      user: 'HỒ SƠ',
      appearance: 'GIAO DIỆN',
      ai: 'AI & MODELS',
      voice: 'GIỌNG NÓI & ÂM THANH',
      system: 'HỆ THỐNG & GIỚI THIỆU'
    },
    user: {
      profileTitle: 'HỒ SƠ NGƯỜI DÙNG // OPERATOR PROFILE',
      profileDesc: 'Tùy chỉnh danh xưng, avatar đại diện đối thoại cùng Capri.',
      avatarLabel: 'Avatar đại diện của bạn (Kích thước chuẩn 40x40px):',
      uploadBtn: 'TẢI ẢNH LÊN (UPLOAD)',
      resetAvatarBtn: 'MẶC ĐỊNH',
      presetsLabel: 'Hoặc chọn nhanh Avatar Cyberpunk Preset:',
      presets: ['Netrunner', 'Cyborg', 'Neon Hacker', 'Samurai'],
      callsignLabel: 'Tên / Danh xưng gọi bạn (Callsign):',
      callsignPlaceholder: 'Ví dụ: Commander, Arch, Boss, Sensei...',
      randomNick: 'Tự động gọi ngẫu nhiên "tèo" / "blue" khi chưa cài danh xưng'
    },
    appearance: {
      frameTitle: 'KÍCH THƯỚC KHUNG HÌNH & CHẾ ĐỘ HIỂN THỊ',
      frameDesc: 'Tùy biến kích thước chuẩn, phong cách kính trong suốt và bảng màu neon Cyberpunk.',
      frameSizeLabel: 'Kích thước khung chiếu Hologram (Frame Size Presets):',
      presets: ['Nhỏ gọn', 'Tiêu chuẩn', 'Mở rộng', 'Lớn'],
      glassTitle: 'CHẾ ĐỘ KÍNH TRONG SUỐT (CLEAR GLASS MODE)',
      glassToggle: 'Bật chế độ Clear Glass (Tối giản viền, tối đa độ trong suốt)',
      opacityLabel: 'Độ mờ nền (Background Opacity: 0% - 95%):',
      blurLabel: 'Độ nhòe hậu cảnh (Backdrop Blur: 0px - 30px):',
      themeTitle: 'HỆ MÀU GIAO DIỆN (CYBERPUNK THEMES)',
      langLabel: 'Ngôn ngữ hiển thị (Language):'
    },
    ai: {
      activeBadge: '[ MÔ HÌNH HOẠT ĐỘNG // ACTIVE ]',
      pingFast: 'Độ trễ phản hồi: Cực nhanh',
      vaultTitle: 'MULTI-API VAULT (KHO KHÓA KẾT NỐI AI)',
      vaultDesc: 'Tự động chuyển đổi dự phòng (Auto-Failover) mượt mà khi gặp lỗi hạn ngạch hoặc mạng.',
      modelsTitle: 'LỰA CHỌN MÔ HÌNH (MODELS)',
      chatModelLabel: 'Chat Model:',
      visionModelLabel: 'Vision Model (Màn hình & Ảnh):',
      sttModelLabel: 'STT Model (Nhận diện giọng nói Whisper):',
      userNameLabel: 'Tên người dùng (Capri xưng hô thân mật):'
    },
    voice: {
      micTitle: 'THIẾT BỊ MICRO & GIỌNG NÓI NEURAL TTS',
      micDesc: 'Cấu hình thiết bị thu âm giọng nói và bộ phát âm thanh tổng hợp Capri.',
      micDeviceLabel: 'Microphone đầu vào (Microphone Device Selector):',
      micMeterLabel: 'Mức âm lượng Micro thực tế:',
      ttsEngineLabel: 'Neural TTS Engine:',
      ttsToggle: 'Bật giọng nói Neural TTS (Khi tắt, Capri chuyển sang âm thanh glitch/blip)',
      glitchLabel: 'Hiệu ứng Cyber Glitch & Reverb:',
      testTtsBtn: 'THỬ NGHIỆM GIỌNG NÓI CAPRI'
    },
    system: {
      replayTitle: 'INSTANT REPLAY BUFFER & THỜI GIAN NGỦ',
      replayDesc: 'Quản lý hiệu năng, bộ đệm ghi hình khoảnh khắc và tối ưu hóa tài nguyên phần cứng.',
      replayLabel: 'Bộ nhớ đệm Instant Replay (Độ dài clip khoảnh khắc):',
      replayOptions: ['15 giây gần nhất', '30 giây gần nhất (Khuyên dùng)', '60 giây gần nhất (1 phút)', '120 giây gần nhất (2 phút)'],
      sleepLabel: 'Thời gian tự ngủ của Biochip (Hibernation timer - 1 FPS tiết kiệm điện):',
      sleepOptions: ['15 giây', '30 giây', '1 phút', '3 phút', '5 phút', 'Không bao giờ ngủ'],
      holoSleepLabel: 'Thời gian tự thu nhỏ Màn hình chiếu Hologram:',
      holoSleepOptions: ['8 giây (Mặc định)', '10 giây', '20 giây', 'Không tự tắt'],
      gamerPilot: 'Bật Gamer Auto-Pilot (Tự thu nhỏ khi mở Game hoặc Fullscreen, cảnh báo RAM > 90%)',
      agentHookLabel: 'Antigravity Agent Hook (BẬT / TẮT)',
      agentHookHint: 'Cổng 127.0.0.1:43225 (In-Process Webhook - Không spawn tiến trình ngoài)',
      historyTitle: 'QUẢN LÝ DỮ LIỆU & LỊCH SỬ TRÒ CHUYỆN',
      historyDesc: 'Xóa vĩnh viễn toàn bộ lịch sử trò chuyện đã lưu trên máy tính.',
      clearHistoryBtn: 'XÓA LỊCH SỬ CHAT (CLEAR CHAT HISTORY)'
    },
    footer: {
      saveBtn: 'LƯU CẤU HÌNH'
    }
  },
  en: {
    modalTitle: '[ SYSTEM CONTROL DECK ]',
    tabs: {
      user: 'PROFILE',
      appearance: 'APPEARANCE',
      ai: 'AI & MODELS',
      voice: 'VOICE & AUDIO',
      system: 'SYSTEM & ABOUT'
    },
    user: {
      profileTitle: 'OPERATOR PROFILE // USER PROFILE',
      profileDesc: 'Customize your callsign and avatar for chat dialogue with Capri.',
      avatarLabel: 'Your Avatar (Standard 40x40px):',
      uploadBtn: 'UPLOAD IMAGE',
      resetAvatarBtn: 'DEFAULT',
      presetsLabel: 'Or select a Cyberpunk Preset avatar:',
      presets: ['Netrunner', 'Cyborg', 'Neon Hacker', 'Samurai'],
      callsignLabel: 'Callsign / Operator Name:',
      callsignPlaceholder: 'e.g. Commander, Arch, Boss, Sensei...',
      randomNick: 'Randomly call "tèo" / "blue" when callsign is empty'
    },
    appearance: {
      frameTitle: 'FRAME DIMENSIONS & DISPLAY MODES',
      frameDesc: 'Configure frame geometry, frosted glass aesthetics, and Cyberpunk neon palettes.',
      frameSizeLabel: 'Holographic Frame Dimensions (Presets):',
      presets: ['Compact', 'Standard', 'Expanded', 'Wide'],
      glassTitle: 'CLEAR GLASS TRANSLUCENCY MODE',
      glassToggle: 'Enable Clear Glass (Minimalist borders, maximum translucency)',
      opacityLabel: 'Background Opacity (0% - 95%):',
      blurLabel: 'Backdrop Blur (0px - 30px):',
      themeTitle: 'CYBERPUNK THEME PALETTES',
      langLabel: 'Display Language:'
    },
    ai: {
      activeBadge: '[ ACTIVE AI MODEL ]',
      pingFast: 'Response latency: Ultra fast',
      vaultTitle: 'MULTI-API KEY VAULT',
      vaultDesc: 'Seamless automated failover on rate limits or network issues.',
      modelsTitle: 'MODEL SELECTION',
      chatModelLabel: 'Chat Model:',
      visionModelLabel: 'Vision Model (Screen & Images):',
      sttModelLabel: 'STT Model (Whisper Speech Recognition):',
      userNameLabel: 'User Nickname (Capri greeting):'
    },
    voice: {
      micTitle: 'MICROPHONE & NEURAL TTS VOICE',
      micDesc: 'Configure audio input device and synthetic neural speech output.',
      micDeviceLabel: 'Microphone Device:',
      micMeterLabel: 'Live Input Meter:',
      ttsEngineLabel: 'Neural TTS Engine:',
      ttsToggle: 'Enable Neural TTS (When off, Capri falls back to cyberpunk blips)',
      glitchLabel: 'Cyber Glitch & Reverb FX:',
      testTtsBtn: 'TEST CAPRI VOICE'
    },
    system: {
      replayTitle: 'INSTANT REPLAY BUFFER & INACTIVITY SLEEP',
      replayDesc: 'Manage hardware performance, clip recorder buffer, and power efficiency.',
      replayLabel: 'Instant Replay Buffer (Clip duration):',
      replayOptions: ['Last 15 seconds', 'Last 30 seconds (Recommended)', 'Last 60 seconds (1 min)', 'Last 120 seconds (2 mins)'],
      sleepLabel: 'Biochip Hibernation Timer (1 FPS power saving):',
      sleepOptions: ['15 seconds', '30 seconds', '1 minute', '3 minutes', '5 minutes', 'Never hibernate'],
      holoSleepLabel: 'Holographic Frame Auto-Dismiss Timer:',
      holoSleepOptions: ['8 seconds (Default)', '10 seconds', '20 seconds', 'Never dismiss'],
      gamerPilot: 'Enable Gamer Auto-Pilot (Auto-stow during full-screen games, RAM > 90% alert)',
      agentHookLabel: 'Antigravity Agent Hook (ON / OFF)',
      agentHookHint: 'Port 127.0.0.1:43225 (In-Process Webhook - Zero external processes)',
      historyTitle: 'DATA & CONVERSATION HISTORY',
      historyDesc: 'Permanently wipe local chat history from disk.',
      clearHistoryBtn: 'CLEAR CHAT HISTORY'
    },
    footer: {
      saveBtn: 'SAVE SETTINGS'
    }
  }
};

export class SettingsUI {
  constructor({ host, panel, voice, voiceInput, chat }) {
    this.host = host;
    this.panel = panel;
    this.voice = voice;
    this.voiceInput = voiceInput;
    this.chat = chat;

    this.modalEl = null;
    this.isOpen = false;
    this.config = null;
    this.meterAnimId = null;

    this.createDom();
  }

  createDom() {
    const modal = document.createElement('div');
    modal.id = 'settings-modal';
    modal.className = 'settings-modal';
    modal.hidden = true;

    modal.innerHTML = `
      <div class="settings-modal__frame">
        <header class="settings-modal__header">
          <div class="settings-modal__title">[ SYSTEM CONTROL DECK ]</div>
          <button class="settings-modal__close-btn" type="button" title="Back to Chat (Esc)">✕</button>
        </header>

        <nav class="settings-modal__tabs">
          <button class="settings-modal__tab is-active" data-tab="tab-user" type="button">PROFILE</button>
          <button class="settings-modal__tab" data-tab="tab-appearance" type="button">APPEARANCE</button>
          <button class="settings-modal__tab" data-tab="tab-ai" type="button">AI & MODELS</button>
          <button class="settings-modal__tab" data-tab="tab-voice" type="button">VOICE & AUDIO</button>
          <button class="settings-modal__tab" data-tab="tab-system" type="button">SYSTEM & ABOUT</button>
        </nav>

        <div class="settings-modal__body">
          <!-- TAB 0: USER PROFILE -->
          <section id="tab-user" class="settings-modal__pane is-active">
            <h3 class="settings-pane__title">OPERATOR PROFILE // USER PROFILE</h3>
            <p class="settings-pane__desc">Customize your callsign and avatar for chat dialogue with Capri.</p>

            <div class="settings-form__group">
              <label>Operator Avatar (Standard 40x40px):</label>
              <div class="user-profile-layout">
                <div id="cfg-user-avatar-preview" class="user-avatar-preview-box"></div>
                <div class="user-avatar-controls">
                  <div style="display: flex; gap: 8px;">
                    <button id="cfg-user-avatar-upload-btn" class="settings-btn" type="button">UPLOAD IMAGE</button>
                    <button id="cfg-user-avatar-reset-btn" class="settings-btn" type="button">DEFAULT</button>
                  </div>
                  <input type="file" id="cfg-user-avatar-file" accept="image/*" style="display: none;">
                  <span style="font-size: 10px; color: var(--theme-text-dim);">Supported: PNG, JPG, WebP, SVG. Automatically optimized.</span>
                </div>
              </div>
            </div>

            <div class="settings-form__group">
              <label>Or select a Cyberpunk Preset avatar:</label>
              <div class="user-avatar-presets-grid">
                <button type="button" class="user-avatar-preset-btn" data-preset="netrunner">
                  <div class="preset-avatar-icon" style="background-image: url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect width=%2240%22 height=%2240%22 fill=%22%230b0e14%22/><polygon points=%2220,4 34,14 34,28 20,36 6,28 6,14%22 fill=%22none%22 stroke=%22%2300f0ff%22 stroke-width=%221.5%22/><rect x=%2211%22 y=%2215%22 width=%2218%22 height=%226%22 rx=%222%22 fill=%22%2300f0ff%22 opacity=%220.85%22/><line x1=%228%22 y1=%2220%22 x2=%2232%22 y2=%2220%22 stroke=%22%2300ffff%22 stroke-width=%221%22/><path d=%22M14 26 L20 30 L26 26%22 fill=%22none%22 stroke=%22%2300f0ff%22 stroke-width=%221.5%22/><circle cx=%2220%22 cy=%2218%22 r=%221.5%22 fill=%22%23ffffff%22/></svg>')"></div>
                  <span class="preset-avatar-name">Netrunner</span>
                </button>
                <button type="button" class="user-avatar-preset-btn" data-preset="cyborg">
                  <div class="preset-avatar-icon" style="background-image: url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect width=%2240%22 height=%2240%22 fill=%22%23120f17%22/><circle cx=%2220%22 cy=%2220%22 r=%2214%22 fill=%22%231a1528%22 stroke=%22%23fcee0a%22 stroke-width=%221.5%22/><circle cx=%2216%22 cy=%2217%22 r=%223.5%22 fill=%22%23ff0055%22/><circle cx=%2224%22 cy=%2217%22 r=%224.5%22 fill=%22none%22 stroke=%22%23fcee0a%22 stroke-width=%221.5%22/><circle cx=%2224%22 cy=%2217%22 r=%221.5%22 fill=%22%2300f0ff%22/><line x1=%2224%22 y1=%2210%22 x2=%2224%22 y2=%2224%22 stroke=%22%23fcee0a%22 stroke-width=%220.8%22/><line x1=%2217%22 y1=%2217%22 x2=%2231%22 y2=%2217%22 stroke=%22%23fcee0a%22 stroke-width=%220.8%22/><path d=%22M14 26 H26 V29 H14 Z%22 fill=%22%232b2b3a%22 stroke=%22%23fcee0a%22 stroke-width=%221%22/></svg>')"></div>
                  <span class="preset-avatar-name">Cyborg</span>
                </button>
                <button type="button" class="user-avatar-preset-btn" data-preset="hacker">
                  <div class="preset-avatar-icon" style="background-image: url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect width=%2240%22 height=%2240%22 fill=%22%23050d08%22/><path d=%22M20 5 C12 5 8 13 8 24 C8 32 14 36 20 36 C26 36 32 32 32 24 C32 13 28 5 20 5 Z%22 fill=%22%230d1f14%22 stroke=%22%2300ff66%22 stroke-width=%221.5%22/><polyline points=%2213,17 17,21 13,25%22 fill=%22none%22 stroke=%22%2300ff66%22 stroke-width=%222%22/><line x1=%2219%22 y1=%2225%22 x2=%2226%22 y2=%2225%22 stroke=%22%2300ff66%22 stroke-width=%222%22/><line x1=%2210%22 y1=%2231%22 x2=%2230%22 y2=%2231%22 stroke=%22%2300ff66%22 stroke-dasharray=%222,2%22 stroke-width=%221%22/></svg>')"></div>
                  <span class="preset-avatar-name">Neon Hacker</span>
                </button>
                <button type="button" class="user-avatar-preset-btn" data-preset="samurai">
                  <div class="preset-avatar-icon" style="background-image: url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect width=%2240%22 height=%2240%22 fill=%22%23160a0d%22/><polygon points=%2220,6 23,13 31,11 25,18 29,26 20,22 11,26 15,18 9,11 17,13%22 fill=%22%23ff0055%22 stroke=%22%23ff3366%22 stroke-width=%221%22/><polygon points=%2220,16 26,28 14,28%22 fill=%22%23260d15%22 stroke=%22%23ff0055%22 stroke-width=%221.5%22/><line x1=%2214%22 y1=%2221%22 x2=%2219%22 y2=%2221%22 stroke=%22%23ffffff%22 stroke-width=%222%22/><line x1=%2221%22 y1=%2221%22 x2=%2226%22 y2=%2221%22 stroke=%22%23ffffff%22 stroke-width=%222%22/><path d=%22M16 25 Q20 30 24 25%22 fill=%22none%22 stroke=%22%23ff0055%22 stroke-width=%221.5%22/></svg>')"></div>
                  <span class="preset-avatar-name">Samurai</span>
                </button>
              </div>
            </div>

            <div class="settings-form__group">
              <label>Callsign / Operator Name:</label>
              <input id="cfg-user-callsign" class="settings-input" placeholder="e.g. Commander, Arch, Boss, Sensei..." />
            </div>

            <div class="settings-form__checkbox-row" style="margin-top: 12px;">
              <input id="cfg-user-random-nick" type="checkbox" checked>
              <label for="cfg-user-random-nick">Randomly tease with "partner" / "blue" when callsign is unset</label>
            </div>

            <div class="settings-form__divider"></div>
            <div class="settings-form__group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label style="margin: 0;">Capri Long-Term Memory (me.md):</label>
                <button id="cfg-memory-save-btn" class="settings-btn" type="button" style="padding: 3px 12px; font-size: 11px;">SAVE MEMORY</button>
              </div>
              <textarea id="cfg-user-memory-text" class="settings-textarea" style="width: 100%; height: 110px; font-family: var(--font-mono); font-size: 11px; padding: 8px; box-sizing: border-box; resize: vertical;" placeholder="Enter habits, preferences or notes you want Capri to remember long-term..."></textarea>
              <span id="cfg-memory-status" style="font-size: 10px; color: var(--theme-text-dim);">Loaded automatically into Capri AI construct in every conversation.</span>
            </div>
          </section>

          <!-- TAB 1: APPEARANCE -->
          <section id="tab-appearance" class="settings-modal__pane">
            <h3 class="settings-pane__title">FRAME DIMENSIONS & DISPLAY MODES</h3>
            <p class="settings-pane__desc">Configure frame geometry, frosted glass aesthetics, and Cyberpunk neon palettes.</p>

            <div class="settings-form__group">
              <label>Holographic Frame Dimensions (Presets):</label>
              <div class="settings-preset-grid">
                <button class="settings-preset-btn" data-w="580" data-h="380" type="button">
                  <span class="preset-name">Compact</span>
                  <span class="preset-dim">580 × 380</span>
                </button>
                <button class="settings-preset-btn is-active" data-w="700" data-h="450" type="button">
                  <span class="preset-name">Standard</span>
                  <span class="preset-dim">700 × 450</span>
                </button>
                <button class="settings-preset-btn" data-w="840" data-h="520" type="button">
                  <span class="preset-name">Expanded</span>
                  <span class="preset-dim">840 × 520</span>
                </button>
                <button class="settings-preset-btn" data-w="960" data-h="600" type="button">
                  <span class="preset-name">Wide</span>
                  <span class="preset-dim">960 × 600</span>
                </button>
              </div>
            </div>

            <div class="settings-form__divider"></div>

            <h3 class="settings-pane__title">CLEAR GLASS TRANSLUCENCY MODE</h3>
            <div class="settings-form__checkbox-row" style="margin-bottom: 12px;">
              <input id="cfg-clear-glass-toggle" type="checkbox">
              <label for="cfg-clear-glass-toggle">Enable Clear Glass (Minimalist borders, maximum translucency)</label>
            </div>

            <div class="settings-grid-2">
              <div class="settings-form__group">
                <label>Background Opacity (0% - 95%):</label>
                <div class="settings-slider__row">
                  <input id="cfg-opacity-slider" class="settings-slider" type="range" min="0" max="95" value="95">
                  <span id="cfg-opacity-val" class="settings-slider__val">95%</span>
                </div>
              </div>
              <div class="settings-form__group">
                <label>Backdrop Blur (0px - 30px):</label>
                <div class="settings-slider__row">
                  <input id="cfg-blur-slider" class="settings-slider" type="range" min="0" max="30" value="16">
                  <span id="cfg-blur-val" class="settings-slider__val">16px</span>
                </div>
              </div>
            </div>

            <div class="settings-form__divider"></div>

            <h3 class="settings-pane__title">CYBERPUNK THEME PALETTES</h3>
            <div class="settings-theme-cards">
              <div class="settings-theme-card is-active" data-theme="system">
                <div class="theme-card__swatch">
                  <span class="swatch-col" style="background: #00f0ff;"></span>
                  <span class="swatch-col" style="background: #ff2a5f;"></span>
                </div>
                <div class="theme-card__meta">
                  <span class="theme-card__name">Cyberpunk Neon</span>
                  <span class="theme-card__desc">Cyan & Magenta</span>
                </div>
              </div>

              <div class="settings-theme-card" data-theme="matrix">
                <div class="theme-card__swatch">
                  <span class="swatch-col" style="background: #00ff66;"></span>
                  <span class="swatch-col" style="background: #051a0b;"></span>
                </div>
                <div class="theme-card__meta">
                  <span class="theme-card__name">Matrix Green</span>
                  <span class="theme-card__desc">Terminal Netrunner</span>
                </div>
              </div>

              <div class="settings-theme-card" data-theme="tokyo-night">
                <div class="theme-card__swatch">
                  <span class="swatch-col" style="background: #9d7cd8;"></span>
                  <span class="swatch-col" style="background: #7aa2f7;"></span>
                </div>
                <div class="theme-card__meta">
                  <span class="theme-card__name">Tokyo Night</span>
                  <span class="theme-card__desc">Deep Purple & Ice Blue</span>
                </div>
              </div>

              <div class="settings-theme-card" data-theme="obsidian">
                <div class="theme-card__swatch">
                  <span class="swatch-col" style="background: #ffffff;"></span>
                  <span class="swatch-col" style="background: #27272a;"></span>
                </div>
                <div class="theme-card__meta">
                  <span class="theme-card__name">Obsidian Stealth</span>
                  <span class="theme-card__desc">Monochrome Minimal</span>
                </div>
              </div>
            </div>
            <input id="cfg-theme-select" type="hidden" value="system">

            <div class="settings-form__group" style="margin-top: 14px; margin-bottom: 6px;">
              <label>HUD & Terminal Font Family:</label>
              <select id="cfg-font-family" class="settings-select">
                <option value="ShareTechMono">Share Tech Mono (Cyberpunk HUD Standard)</option>
                <option value="JetBrains Mono">JetBrains Mono (Developer Classic)</option>
                <option value="Chakra Petch">Chakra Petch (Futuristic Display)</option>
              </select>
            </div>

            <div class="settings-form__divider"></div>

            <h3 class="settings-pane__title">TOP-LEFT STATUS TICKER POSITION</h3>
            <p class="settings-pane__desc">Configure anchor preset or drag directly on screen (Alt + Left Click).</p>
            <div class="settings-grid-2">
              <div class="settings-form__group">
                <label>Anchor Preset:</label>
                <select id="cfg-ticker-preset" class="settings-select">
                  <option value="top-left">Top-Left</option>
                  <option value="top-center">Top-Center</option>
                  <option value="top-right">Top-Right</option>
                  <option value="bottom-left">Bottom-Left</option>
                  <option value="custom">Custom X/Y</option>
                </select>
              </div>
              <div class="settings-form__group" style="display: flex; gap: 8px;">
                <div style="flex: 1;">
                  <label>Offset X (px):</label>
                  <input id="cfg-ticker-offset-x" class="settings-input" type="number" min="-10" max="500" value="0">
                </div>
                <div style="flex: 1;">
                  <label>Offset Y (px):</label>
                  <input id="cfg-ticker-offset-y" class="settings-input" type="number" min="-10" max="500" value="0">
                </div>
              </div>
            </div>

            <div class="settings-form__divider"></div>

            <div class="settings-form__checkbox-row" style="margin-top: 12px; margin-bottom: 8px;">
              <input id="cfg-wander-idle" type="checkbox" checked>
              <label for="cfg-wander-idle">Wander When Idle (Capri explores desktop & perches on windows when idle)</label>
            </div>

            <div class="settings-form__group">
              <label>Display Language:</label>
              <select id="cfg-lang-select" class="settings-select">
                <option value="en" selected>English (Cyberpunk Assistant EN)</option>
              </select>
            </div>
          </section>

          <!-- TAB 2: AI & MODELS -->
          <section id="tab-ai" class="settings-modal__pane">
            <!-- Active Model Banner at top -->
            <div class="settings-active-model-card">
              <div class="settings-active-model__header">
                <span class="settings-active-model__badge">[ ACTIVE AI MODEL ]</span>
                <span class="settings-active-model__ping">Response latency: Ultra fast</span>
              </div>
              <div class="settings-active-model__name" id="cfg-active-model-display">openai/gpt-oss-120b</div>
            </div>

            <h3 class="settings-pane__title">MULTI-API KEY VAULT</h3>
            <p class="settings-pane__desc">Seamless automated failover on rate limits or network issues.</p>

            <div class="settings-form__group">
              <label>Groq API Key (Free & Ultra Fast):</label>
              <div class="settings-input__row">
                <input id="cfg-groq-key" class="settings-input" type="password" placeholder="gsk_...">
                <button class="settings-btn is-toggle-pass" type="button" title="Show / Hide">SHOW</button>
                <button class="settings-btn is-test" data-test="groq" type="button">Test</button>
              </div>
            </div>

            <div class="settings-form__group">
              <label>Google Gemini API Key:</label>
              <div class="settings-input__row">
                <input id="cfg-gemini-key" class="settings-input" type="password" placeholder="AIzaSy...">
                <button class="settings-btn is-toggle-pass" type="button" title="Show / Hide">SHOW</button>
                <button class="settings-btn is-test" data-test="gemini" type="button">Test</button>
              </div>
            </div>

            <div class="settings-form__group">
              <label>OpenRouter API Key:</label>
              <div class="settings-input__row">
                <input id="cfg-openrouter-key" class="settings-input" type="password" placeholder="sk-or-v1-...">
                <button class="settings-btn is-toggle-pass" type="button" title="Show / Hide">SHOW</button>
                <button class="settings-btn is-test" data-test="openrouter" type="button">Test</button>
              </div>
            </div>

            <div class="settings-form__group">
              <label>OpenAI API Key (Optional):</label>
              <div class="settings-input__row">
                <input id="cfg-openai-key" class="settings-input" type="password" placeholder="sk-proj-...">
                <button class="settings-btn is-toggle-pass" type="button" title="Show / Hide">SHOW</button>
                <button class="settings-btn is-test" data-test="openai" type="button">Test</button>
              </div>
            </div>

            <div id="cfg-api-status" class="settings-status-box" hidden></div>

            <div class="settings-form__divider"></div>

            <h3 class="settings-pane__title">MODEL SELECTION</h3>
            <div class="settings-grid-2">
              <div class="settings-form__group">
                <label>Chat Model:</label>
                <input id="cfg-model-chat" class="settings-input" type="text" placeholder="openai/gpt-oss-120b">
              </div>
              <div class="settings-form__group">
                <label>Vision Model (Screen & Images):</label>
                <input id="cfg-model-vision" class="settings-input" type="text" placeholder="gemini-1.5-flash">
              </div>
            </div>

            <div class="settings-form__group">
              <label>STT Model (Whisper Speech Recognition):</label>
              <input id="cfg-model-stt" class="settings-input" type="text" placeholder="whisper-large-v3" value="whisper-large-v3">
            </div>

            <div class="settings-form__group">
              <label>Operator Nickname (Capri greeting):</label>
              <input id="cfg-user-name" class="settings-input" type="text" placeholder="Partner" maxlength="32">
            </div>

            <div class="settings-form__divider"></div>

            <h3 class="settings-pane__title">DISCORD BOT INTEGRATION</h3>
            <p class="settings-pane__desc">Connect desktop Capri to Discord for voice streaming, two-way chat, and remote controls.</p>

            <div class="settings-form__group">
              <label>Discord Bot Token:</label>
              <div class="settings-input__row">
                <input id="cfg-discord-token" class="settings-input" type="password" placeholder="MTE...">
                <button class="settings-btn is-toggle-pass" type="button" title="Show / Hide">SHOW</button>
              </div>
            </div>

            <div class="settings-form__group">
              <label>Discord Default / Target User ID:</label>
              <div class="settings-input__row">
                <input id="cfg-discord-user-id" class="settings-input" type="text" placeholder="e.g. 123456789012345678">
              </div>
            </div>
          </section>

          <!-- TAB 3: VOICE & AUDIO -->
          <section id="tab-voice" class="settings-modal__pane">
            <h3 class="settings-pane__title">MICROPHONE DEVICE & NEURAL TTS VOICE</h3>
            <p class="settings-pane__desc">Configure audio input device and synthetic neural speech output.</p>

            <div class="settings-form__group">
              <label>Microphone Input Device:</label>
              <select id="cfg-mic-select" class="settings-select"></select>
            </div>

            <div class="settings-form__group">
              <label>Live Input Volume Meter:</label>
              <div class="settings-meter__wrap">
                <div id="cfg-mic-meter" class="settings-meter__fill"></div>
              </div>
            </div>

            <div class="settings-form__divider"></div>

            <div class="settings-form__group">
              <label>Neural TTS Engine:</label>
              <select id="cfg-tts-engine" class="settings-select">
                <option value="edge-tts">Edge TTS (Natural Neural Voice)</option>
                <option value="web-speech">Web Speech Synthesis (Local Browser)</option>
              </select>
            </div>

            <div class="settings-form__checkbox-row" style="margin-bottom: 12px;">
              <input id="cfg-tts-toggle" type="checkbox" checked>
              <label for="cfg-tts-toggle">Enable Neural TTS (When disabled, Capri falls back to cyberpunk blips)</label>
            </div>

            <div class="settings-form__group">
              <label>Cyber Glitch & Reverb FX:</label>
              <div class="settings-slider__row">
                <input id="cfg-glitch-slider" class="settings-slider" type="range" min="0" max="100" value="25">
                <span id="cfg-glitch-val" class="settings-slider__val">25%</span>
              </div>
            </div>

            <div class="settings-form__divider"></div>

            <div class="settings-form__group">
              <label>App VFX Volume (UI Sound Effects & Blips):</label>
              <div class="settings-slider__row">
                <input id="cfg-vfx-volume-slider" class="settings-slider" type="range" min="0" max="100" value="80">
                <span id="cfg-vfx-volume-val" class="settings-slider__val">80%</span>
              </div>
            </div>

            <button id="cfg-test-tts-btn" class="settings-btn" type="button">TEST CAPRI VOICE</button>
          </section>

          <!-- TAB 4: SYSTEM & ABOUT -->
          <section id="tab-system" class="settings-modal__pane">
            <h3 class="settings-pane__title">INSTANT REPLAY BUFFER & HIBERNATION</h3>
            <p class="settings-pane__desc">Manage hardware performance, clip recorder buffer, and power efficiency.</p>

            <div class="settings-form__group">
              <label>Instant Replay Buffer (Clip duration):</label>
              <select id="cfg-replay-sec" class="settings-select">
                <option value="15">Last 15 seconds</option>
                <option value="30">Last 30 seconds (Recommended)</option>
                <option value="60">Last 60 seconds (1 min)</option>
                <option value="120">Last 120 seconds (2 mins)</option>
              </select>
            </div>

            <div class="settings-form__group">
              <label>Biochip Hibernation Timer (1 FPS power saving):</label>
              <select id="cfg-sleep-sec" class="settings-select">
                <option value="15">15 seconds</option>
                <option value="30">30 seconds</option>
                <option value="60">1 minute</option>
                <option value="180">3 minutes</option>
                <option value="300">5 minutes</option>
                <option value="0">Never hibernate</option>
              </select>
            </div>

            <div class="settings-form__group">
              <label>Holographic Frame Auto-Dismiss Timer:</label>
              <select id="cfg-hologram-sec" class="settings-select">
                <option value="8">8 seconds (Default)</option>
                <option value="10">10 seconds</option>
                <option value="20">20 seconds</option>
                <option value="0">Never auto-dismiss</option>
              </select>
            </div>

            <div class="settings-form__checkbox-row" style="margin-bottom: 16px;">
              <input id="cfg-gamer-pilot" type="checkbox" checked>
              <label for="cfg-gamer-pilot">Enable Gamer Auto-Pilot (Auto-stow during full-screen games, RAM > 90% alert)</label>
            </div>

            <div class="settings-form__checkbox-row" style="margin-bottom: 16px;">
              <input id="cfg-discord-rpc" type="checkbox" checked>
              <label for="cfg-discord-rpc">Discord Local Rich Presence (Show Capri status via Named Pipe)</label>
            </div>

            <div class="settings-form__divider"></div>

            <h3 class="settings-pane__title">ANTIGRAVITY AGENT HOOK & INTERNAL INTEGRATION</h3>
            <div class="settings-form__checkbox-row" style="margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <input id="cfg-agent-hook" type="checkbox">
                <label for="cfg-agent-hook">Antigravity Agent Hook (ON / OFF)</label>
              </div>
              <button id="cfg-test-agent-hook" class="settings-btn settings-btn--ghost" type="button" style="padding: 4px 10px; font-size: 11px;">TEST AGENT HOOK</button>
            </div>
            <p class="settings-pane__desc" style="margin-bottom: 16px; font-size: 11px; color: var(--paper-2);">
              Port 127.0.0.1:43225 (In-Process Webhook - Automated file & Antigravity task tracking)
            </p>

            <div class="settings-form__divider"></div>

            <h3 class="settings-pane__title">DATA & CONVERSATION HISTORY</h3>
            <p class="settings-pane__desc">Permanently wipe local chat history from disk.</p>

            <div style="margin-bottom: 18px;">
              <button id="cfg-clear-history-btn" class="settings-btn is-danger" type="button">CLEAR CHAT HISTORY</button>
              <div id="cfg-clear-history-status" class="settings-status-box" hidden></div>
            </div>
          </section>
        </div>

        <footer class="settings-modal__footer">
          <div class="settings-modal__about">
            <span id="cfg-app-version" class="settings-about__version">v1.5.0-cyberpunk-edition</span>
            <span class="settings-about__sep">|</span>
            <a id="cfg-repo-link" class="settings-about__link" href="#" title="Open Capri repository on GitHub">GitHub: lostempyrea/Capri-desktop</a>
          </div>
          <button id="cfg-save-btn" class="settings-btn is-primary" type="button">SAVE SETTINGS</button>
        </footer>
      </div>
    `;

    const container = document.getElementById('tab-view-settings') || document.getElementById('holo-settings-view');
    if (container) {
      container.appendChild(modal);
    } else {
      document.body.appendChild(modal);
    }
    this.modalEl = modal;

    this.bindEvents();
  }

  bindEvents() {
    const modal = this.modalEl;

    // Prevent dragging character when interacting with settings
    modal.addEventListener('mousedown', (e) => e.stopPropagation());
    modal.addEventListener('click', (e) => e.stopPropagation());

    // Close button
    modal.querySelector('.settings-modal__close-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });

    // Input focus passthrough wiring
    modal.querySelectorAll('input, select, textarea').forEach((el) => {
      el.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this.host.setFocusable(true);
      });
      el.addEventListener('focus', () => {
        this.host.setFocusable(true);
      });
      el.addEventListener('blur', () => {
        this.host.setFocusable(false);
      });
      el.addEventListener('keydown', (e) => {
        e.stopPropagation();
      });
    });

    // 5-Tab switching
    const tabs = modal.querySelectorAll('.settings-modal__tab');
    const panes = modal.querySelectorAll('.settings-modal__pane');

    tabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        tabs.forEach((t) => t.classList.remove('is-active'));
        panes.forEach((p) => p.classList.remove('is-active'));

        tab.classList.add('is-active');
        const targetPane = modal.querySelector(`#${tab.dataset.tab}`);
        if (targetPane) targetPane.classList.add('is-active');
      });
    });

    // Avatar upload and presets wiring
    const avatarUploadBtn = modal.querySelector('#cfg-user-avatar-upload-btn');
    const avatarFileInput = modal.querySelector('#cfg-user-avatar-file');
    const avatarResetBtn = modal.querySelector('#cfg-user-avatar-reset-btn');
    const avatarPreview = modal.querySelector('#cfg-user-avatar-preview');
    const avatarPresetBtns = modal.querySelectorAll('.user-avatar-preset-btn');

    avatarUploadBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      avatarFileInput?.click();
    });

    avatarFileInput?.addEventListener('change', (e) => {
      e.stopPropagation();
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (re) => {
        const img = new Image();
        img.onload = () => {
          // Exact 128x128 canvas center-crop (object-fit: cover)
          const canvas = document.createElement('canvas');
          canvas.width = 128;
          canvas.height = 128;
          const ctx = canvas.getContext('2d');
          const scale = Math.max(128 / img.naturalWidth, 128 / img.naturalHeight);
          const w = img.naturalWidth * scale;
          const h = img.naturalHeight * scale;
          const x = (128 - w) / 2;
          const y = (128 - h) / 2;
          ctx.drawImage(img, x, y, w, h);
          const compressedDataUrl = canvas.toDataURL('image/png', 0.9);

          this.currentUserAvatar = compressedDataUrl;
          if (avatarPreview) {
            avatarPreview.style.backgroundImage = `url("${compressedDataUrl}")`;
          }
          avatarPresetBtns.forEach((b) => b.classList.remove('is-active'));
          this.panel?.setUserAvatar?.(compressedDataUrl);

          try {
            localStorage.setItem('capri_user_avatar', compressedDataUrl);
            localStorage.setItem('capri.userAvatar', compressedDataUrl);
          } catch {}

          this.host?.setConfig?.({
            user: { avatar: compressedDataUrl },
            userAvatar: compressedDataUrl,
          });
        };
        img.src = re.target.result;
      };
      reader.readAsDataURL(file);
    });

    avatarResetBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.currentUserAvatar = '';
      if (avatarPreview) {
        avatarPreview.style.backgroundImage = '';
      }
      avatarPresetBtns.forEach((b) => b.classList.remove('is-active'));
      this.panel?.setUserAvatar?.('');
      try {
        localStorage.removeItem('capri_user_avatar');
        localStorage.removeItem('capri.userAvatar');
      } catch {}
      this.host?.setConfig?.({
        user: { avatar: '' },
        userAvatar: '',
      });
    });

    avatarPresetBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        avatarPresetBtns.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const presetKey = btn.dataset.preset;
        const presetSvg = CYBERPUNK_AVATAR_PRESETS[presetKey];
        if (presetSvg) {
          this.currentUserAvatar = presetSvg;
          if (avatarPreview) {
            avatarPreview.style.backgroundImage = `url("${presetSvg}")`;
          }
          this.panel?.setUserAvatar?.(presetSvg);
          try {
            localStorage.setItem('capri_user_avatar', presetSvg);
            localStorage.setItem('capri.userAvatar', presetSvg);
          } catch {}
          this.host?.setConfig?.({
            user: { avatar: presetSvg },
            userAvatar: presetSvg,
          });
        }
      });
    });

    // Ticker Position controls
    const tickerPresetSelect = modal.querySelector('#cfg-ticker-preset');
    const tickerOffsetXInput = modal.querySelector('#cfg-ticker-offset-x');
    const tickerOffsetYInput = modal.querySelector('#cfg-ticker-offset-y');

    const updateTickerPosLive = () => {
      const preset = tickerPresetSelect?.value || 'top-left';
      const offsetX = Number(tickerOffsetXInput?.value || 0);
      const offsetY = Number(tickerOffsetYInput?.value || 0);
      const pos = { preset, offsetX, offsetY, statusBarOffsetX: offsetX, statusBarOffsetY: offsetY };
      this.panel?.setTickerPosition?.(pos);
      try {
        localStorage.setItem('capri.tickerPosition', JSON.stringify(pos));
      } catch {}
    };

    tickerPresetSelect?.addEventListener('change', (e) => {
      e.stopPropagation();
      updateTickerPosLive();
    });
    tickerOffsetXInput?.addEventListener('input', (e) => {
      e.stopPropagation();
      updateTickerPosLive();
    });
    tickerOffsetYInput?.addEventListener('input', (e) => {
      e.stopPropagation();
      updateTickerPosLive();
    });

    // Test Agent Hook button
    const testHookBtn = modal.querySelector('#cfg-test-agent-hook');
    testHookBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      testHookBtn.textContent = 'TESTING...';
      try {
        await this.host.testAgentHook?.();
        testHookBtn.textContent = '[ SENT ✓ ]';
      } catch {
        testHookBtn.textContent = '[ FAILED ]';
      }
      setTimeout(() => {
        testHookBtn.textContent = 'TEST AGENT HOOK';
      }, 1500);
    });

    // Size preset buttons
    const presetBtns = modal.querySelectorAll('.settings-preset-btn');
    presetBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        presetBtns.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');

        const w = Number(btn.dataset.w);
        const h = Number(btn.dataset.h);
        this.panel.setSize(w, h);
        try {
          localStorage.setItem('capri.hologramSize', JSON.stringify({ width: w, height: h }));
          this.host.setConfig({ hologramSize: { width: w, height: h } });
        } catch {}
      });
    });

    // Clear glass mode toggle
    const clearGlassToggle = modal.querySelector('#cfg-clear-glass-toggle');
    clearGlassToggle?.addEventListener('change', (e) => {
      e.stopPropagation();
      document.documentElement.classList.toggle('clear-glass', e.target.checked);
    });

    // Opacity slider live preview
    const opacitySlider = modal.querySelector('#cfg-opacity-slider');
    const opacityVal = modal.querySelector('#cfg-opacity-val');
    opacitySlider?.addEventListener('input', (e) => {
      e.stopPropagation();
      opacityVal.textContent = `${e.target.value}%`;
      const op = e.target.value / 100;
      document.documentElement.style.setProperty('--holo-opacity', op);
      document.documentElement.style.setProperty('--chat-bg-opacity', op);
    });

    // Backdrop blur slider live preview
    const blurSlider = modal.querySelector('#cfg-blur-slider');
    const blurVal = modal.querySelector('#cfg-blur-val');
    blurSlider?.addEventListener('input', (e) => {
      e.stopPropagation();
      blurVal.textContent = `${e.target.value}px`;
      document.documentElement.style.setProperty('--holo-blur', `${e.target.value}px`);
    });

    // Theme selector cards
    const themeCards = modal.querySelectorAll('.settings-theme-card');
    const themeInput = modal.querySelector('#cfg-theme-select');
    themeCards.forEach((card) => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        themeCards.forEach((c) => c.classList.remove('is-active'));
        card.classList.add('is-active');
        const theme = card.dataset.theme;
        themeInput.value = theme;
        document.documentElement.dataset.theme = theme;
      });
    });

    // Password show/hide eye toggles
    modal.querySelectorAll('.is-toggle-pass').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const input = btn.previousElementSibling;
        if (input && input.tagName === 'INPUT') {
          input.type = input.type === 'password' ? 'text' : 'password';
          btn.textContent = input.type === 'password' ? 'SHOW' : 'HIDE';
        }
      });
    });

    // Language dropdown live update
    modal.querySelector('#cfg-lang-select')?.addEventListener('change', (e) => {
      this.applyLanguage(e.target.value);
    });

    // Glitch slider
    const glitchSlider = modal.querySelector('#cfg-glitch-slider');
    const glitchVal = modal.querySelector('#cfg-glitch-val');
    glitchSlider?.addEventListener('input', (e) => {
      e.stopPropagation();
      glitchVal.textContent = `${e.target.value}%`;
    });

    // App VFX Volume Slider
    const vfxSlider = modal.querySelector('#cfg-vfx-volume-slider');
    const vfxVal = modal.querySelector('#cfg-vfx-volume-val');
    vfxSlider?.addEventListener('input', (e) => {
      e.stopPropagation();
      const val = Number(e.target.value);
      if (vfxVal) vfxVal.textContent = `${val}%`;
      this.voice?.setVfxVolume?.(val / 100);
    });

    // Long-Term Memory (me.md) Save Button
    const saveMemBtn = modal.querySelector('#cfg-memory-save-btn');
    const memArea = modal.querySelector('#cfg-user-memory-text');
    const memStatus = modal.querySelector('#cfg-memory-status');
    saveMemBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const text = memArea?.value || '';
      saveMemBtn.disabled = true;
      saveMemBtn.textContent = 'SAVING...';
      const res = await this.host.saveMemory(text);
      saveMemBtn.disabled = false;
      saveMemBtn.textContent = 'SAVE MEMORY';
      if (memStatus) {
        memStatus.textContent = res?.ok ? 'Saved me.md memory successfully!' : 'Error saving memory!';
        setTimeout(() => {
          memStatus.textContent = 'Automatically injected into Capri\'s AI mind during conversations.';
        }, 3000);
      }
    });

    // Font Family Select
    const fontSelect = modal.querySelector('#cfg-font-family');
    fontSelect?.addEventListener('change', (e) => {
      e.stopPropagation();
      const val = e.target.value;
      document.documentElement.style.setProperty('--font-mono', `'${val}', 'JetBrains Mono', monospace`);
      this.updateConfig({ system: { fontFamily: val } });
    });

    // Discord Local Named Pipe Rich Presence Toggle
    const discordRpcCheck = modal.querySelector('#cfg-discord-rpc');
    discordRpcCheck?.addEventListener('change', (e) => {
      e.stopPropagation();
      const enabled = e.target.checked;
      this.host.discordRpcToggle?.(enabled);
      this.updateConfig({ system: { discordRpc: enabled } });
    });

    // Original source link
    modal.querySelector('#cfg-repo-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const url = 'https://github.com/lostempyrea/Capri-desktop';
      if (this.host.openExternal) this.host.openExternal(url);
      else window.open(url, '_blank');
    });

    // Test API buttons
    modal.querySelectorAll('.is-test').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const providerId = btn.dataset.test;
        btn.textContent = '...';
        btn.disabled = true;

        const res = await this.host.aiTestProvider(providerId);
        const statusBox = modal.querySelector('#cfg-api-status');
        statusBox.hidden = false;
        if (res.ok) {
          statusBox.className = 'settings-status-box is-success';
          statusBox.textContent = `[ OK ] ${res.message || 'Kết nối thành công!'}`;
        } else {
          statusBox.className = 'settings-status-box is-error';
          statusBox.textContent = `[ ERROR ] ${res.error || 'Lỗi kết nối'}`;
        }

        btn.textContent = 'Test';
        btn.disabled = false;
      });
    });

    // Test TTS button
    modal.querySelector('#cfg-test-tts-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      this.voice.play('blip');
      const testMsg = 'Hệ thống giọng nói Capri Hologram Construct đang hoạt động tối ưu.';
      await this.voice.speakCyberpunk(testMsg);
    });

    // Clear Chat History button
    modal.querySelector('#cfg-clear-history-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isEn = document.documentElement.lang === 'en';
      const confirmed = window.confirm(isEn ? 'Permanently wipe local chat history?' : 'Bạn có chắc chắn muốn xóa toàn bộ lịch sử trò chuyện đã lưu trên máy tính không?');
      if (confirmed) {
        this.chat?.clearHistory?.();
        const statusBox = modal.querySelector('#cfg-clear-history-status');
        if (statusBox) {
          statusBox.hidden = false;
          statusBox.className = 'settings-status-box is-success';
          statusBox.textContent = isEn ? '[ OK ] Chat history wiped successfully!' : '[ OK ] Đã xóa sạch toàn bộ lịch sử trò chuyện!';
          setTimeout(() => {
            statusBox.hidden = true;
          }, 3500);
        }
      }
    });

    // Save button
    modal.querySelector('#cfg-save-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.save();
    });
  }

  async open() {
    this.isOpen = true;
    this.modalEl.hidden = false;
    this.host.setFocusable(true);

    // Load config
    this.config = await this.host.getConfig();
    this.populateForm();
    this.applyLanguage('en');
    await this.populateMics();
    this.startMicMeter();

    // Fetch version for footer
    try {
      if (this.host.getVersion) {
        const ver = await this.host.getVersion();
        const verEl = this.modalEl.querySelector('#cfg-app-version');
        if (verEl && ver) verEl.textContent = `v${ver}`;
      }
    } catch {}
  }

  close() {
    this.isOpen = false;
    this.modalEl.hidden = true;
    this.stopMicMeter();
    this.host.setFocusable(false);
    this.panel?.switchTab?.('chat');
  }

  rect() {
    if (!this.isOpen || this.modalEl.hidden) return null;
    return this.modalEl.getBoundingClientRect();
  }

  populateForm() {
    const c = this.config;
    if (!c) return;

    const modal = this.modalEl;

    // Active model display
    const activeModel = c.apiVault?.activeModels?.chat || 'openai/gpt-oss-120b';
    const activeModelDisplay = modal.querySelector('#cfg-active-model-display');
    if (activeModelDisplay) activeModelDisplay.textContent = activeModel;

    modal.querySelector('#cfg-groq-key').value = c.apiVault?.providers?.groq?.apiKey || '';
    modal.querySelector('#cfg-gemini-key').value = c.apiVault?.providers?.gemini?.apiKey || '';
    modal.querySelector('#cfg-openrouter-key').value = c.apiVault?.providers?.openrouter?.apiKey || '';
    modal.querySelector('#cfg-openai-key').value = c.apiVault?.providers?.openai?.apiKey || '';

    // Discord Integration fields
    const discordTokenInput = modal.querySelector('#cfg-discord-token');
    if (discordTokenInput) discordTokenInput.value = c.discordToken || '';
    const discordUserIdInput = modal.querySelector('#cfg-discord-user-id');
    if (discordUserIdInput) discordUserIdInput.value = c.discordUserId || '';

    modal.querySelector('#cfg-model-chat').value = activeModel;
    modal.querySelector('#cfg-model-vision').value = c.apiVault?.activeModels?.vision || 'gemini-1.5-flash';
    const sttModel = modal.querySelector('#cfg-model-stt');
    if (sttModel) sttModel.value = c.apiVault?.activeModels?.stt || 'whisper-large-v3';

    modal.querySelector('#cfg-tts-engine').value = c.voice?.engine || 'edge-tts';
    modal.querySelector('#cfg-tts-toggle').checked = c.voice?.ttsEnabled ?? true;

    const glitchPct = Math.round((c.voice?.glitchReverb ?? 0.25) * 100);
    modal.querySelector('#cfg-glitch-slider').value = glitchPct;
    modal.querySelector('#cfg-glitch-val').textContent = `${glitchPct}%`;

    // App VFX Volume Slider
    const vfxVol = (typeof c.vfxVolume === 'number') ? c.vfxVolume : ((typeof c.voice?.vfxVolume === 'number') ? c.voice.vfxVolume : 0.8);
    const vfxPct = Math.round(vfxVol * 100);
    const vfxSlider = modal.querySelector('#cfg-vfx-volume-slider');
    const vfxVal = modal.querySelector('#cfg-vfx-volume-val');
    if (vfxSlider) vfxSlider.value = vfxPct;
    if (vfxVal) vfxVal.textContent = `${vfxPct}%`;

    const op = (c.system?.opacity ?? 0.95);
    const opPct = Math.round(op * 100);
    modal.querySelector('#cfg-opacity-slider').value = opPct;
    modal.querySelector('#cfg-opacity-val').textContent = `${opPct}%`;
    document.documentElement.style.setProperty('--holo-opacity', op);
    document.documentElement.style.setProperty('--chat-bg-opacity', op);

    const blurPx = c.system?.blurPx ?? 16;
    const blurSlider = modal.querySelector('#cfg-blur-slider');
    const blurVal = modal.querySelector('#cfg-blur-val');
    if (blurSlider) blurSlider.value = blurPx;
    if (blurVal) blurVal.textContent = `${blurPx}px`;

    const clearGlass = c.system?.clearGlass ?? false;
    const clearGlassToggle = modal.querySelector('#cfg-clear-glass-toggle');
    if (clearGlassToggle) clearGlassToggle.checked = clearGlass;
    document.documentElement.classList.toggle('clear-glass', clearGlass);

    const theme = c.system?.theme || 'system';
    modal.querySelector('#cfg-theme-select').value = theme;
    modal.querySelectorAll('.settings-theme-card').forEach((card) => {
      card.classList.toggle('is-active', card.dataset.theme === theme);
    });

    const fontFamily = c.system?.fontFamily || 'ShareTechMono';
    const fontSelect = modal.querySelector('#cfg-font-family');
    if (fontSelect) fontSelect.value = fontFamily;
    document.documentElement.style.setProperty('--font-mono', `'${fontFamily}', 'JetBrains Mono', monospace`);

    const discordRpcCheck = modal.querySelector('#cfg-discord-rpc');
    if (discordRpcCheck) discordRpcCheck.checked = c.system?.discordRpc !== false;

    if (this.host?.getMemory) {
      this.host.getMemory().then((mem) => {
        const memArea = modal.querySelector('#cfg-user-memory-text');
        if (memArea) memArea.value = mem || '';
      }).catch(() => {});
    }

    const langSelect = modal.querySelector('#cfg-lang-select');
    if (langSelect) langSelect.value = c.lang === 'en' ? 'en' : 'vi';

    modal.querySelector('#cfg-user-name').value = c.system?.userName || 'Tèo';

    // User profile state
    this.currentUserAvatar = localStorage.getItem('capri_user_avatar') || localStorage.getItem('capri.userAvatar') || c.user?.avatar || c.userAvatar || '';
    const avatarPreview = modal.querySelector('#cfg-user-avatar-preview');
    if (avatarPreview) {
      avatarPreview.style.backgroundImage = this.currentUserAvatar ? `url("${this.currentUserAvatar}")` : '';
    }
    const avatarPresetBtns = modal.querySelectorAll('.user-avatar-preset-btn');
    avatarPresetBtns.forEach((b) => {
      const pSvg = CYBERPUNK_AVATAR_PRESETS[b.dataset.preset];
      b.classList.toggle('is-active', Boolean(this.currentUserAvatar && this.currentUserAvatar === pSvg));
    });

    // Ticker position state
    try {
      const savedTicker = JSON.parse(localStorage.getItem('capri.tickerPosition') || 'null') || c.system?.tickerPosition || { preset: 'top-left', offsetX: 0, offsetY: 0 };
      if (savedTicker.preset === 'top-left' && (savedTicker.offsetX === 8 || savedTicker.offsetX === undefined) && (savedTicker.offsetY === 8 || savedTicker.offsetY === undefined)) {
        savedTicker.offsetX = 0;
        savedTicker.offsetY = 0;
      }
      const tickerPresetSelect = modal.querySelector('#cfg-ticker-preset');
      const tickerOffsetXInput = modal.querySelector('#cfg-ticker-offset-x');
      const tickerOffsetYInput = modal.querySelector('#cfg-ticker-offset-y');
      if (tickerPresetSelect) tickerPresetSelect.value = savedTicker.preset || 'top-left';
      if (tickerOffsetXInput) tickerOffsetXInput.value = String(savedTicker.offsetX ?? 0);
      if (tickerOffsetYInput) tickerOffsetYInput.value = String(savedTicker.offsetY ?? 0);
    } catch {}

    const callsignInput = modal.querySelector('#cfg-user-callsign');
    if (callsignInput) callsignInput.value = c.user?.callsign || c.user?.name || '';
    const randomNickCheck = modal.querySelector('#cfg-user-random-nick');
    if (randomNickCheck) randomNickCheck.checked = c.user?.randomNick ?? true;
    const agentHookCheck = modal.querySelector('#cfg-agent-hook');
    if (agentHookCheck) agentHookCheck.checked = c.agentHookEnabled ?? false;

    const wanderCheck = modal.querySelector('#cfg-wander-idle');
    if (wanderCheck) wanderCheck.checked = c.system?.wanderWhenIdle ?? c.wanderWhenIdle ?? true;

    modal.querySelector('#cfg-replay-sec').value = String(c.system?.replaySeconds || 30);
    modal.querySelector('#cfg-sleep-sec').value = String(c.system?.inactivitySleepSec || 30);
    modal.querySelector('#cfg-hologram-sec').value = String(c.system?.hologramDismissSec || 8);
    modal.querySelector('#cfg-gamer-pilot').checked = c.system?.gamerAutoPilot ?? true;

    // Check size preset active state
    const currentW = this.panel?.width || 700;
    const currentH = this.panel?.height || 450;
    modal.querySelectorAll('.settings-preset-btn').forEach((btn) => {
      const match = Math.abs(Number(btn.dataset.w) - currentW) < 30 && Math.abs(Number(btn.dataset.h) - currentH) < 30;
      btn.classList.toggle('is-active', match);
    });
  }

  async populateMics() {
    const select = this.modalEl.querySelector('#cfg-mic-select');
    select.innerHTML = '<option value="">(Default Audio Input)</option>';
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === 'audioinput');
      audioInputs.forEach((d, idx) => {
        const opt = document.createElement('option');
        opt.value = d.deviceId;
        opt.textContent = d.label || `Microphone ${idx + 1}`;
        if (d.deviceId === this.config?.voice?.inputDeviceId) {
          opt.selected = true;
        }
        select.appendChild(opt);
      });
    } catch {}
  }

  startMicMeter() {
    const fill = this.modalEl.querySelector('#cfg-mic-meter');
    if (!fill) return;
    const update = () => {
      if (!this.isOpen) return;
      const level = this.voiceInput?.getCurrentVolume() || 0;
      fill.style.width = `${Math.min(100, Math.round(level * 100))}%`;
      this.meterAnimId = requestAnimationFrame(update);
    };
    update();
  }

  stopMicMeter() {
    if (this.meterAnimId) {
      cancelAnimationFrame(this.meterAnimId);
      this.meterAnimId = null;
    }
  }

  async save() {
    const modal = this.modalEl;
    const saveBtn = modal.querySelector('#cfg-save-btn');
    saveBtn.textContent = 'SAVING...';

    const vfxVol = Number(modal.querySelector('#cfg-vfx-volume-slider')?.value || 80) / 100;
    const discordToken = modal.querySelector('#cfg-discord-token')?.value.trim() || '';
    const discordUserId = modal.querySelector('#cfg-discord-user-id')?.value.trim() || '';

    const patch = {
      lang: 'en',
      vfxVolume: vfxVol,
      discordToken,
      discordUserId,
      agentHookEnabled: modal.querySelector('#cfg-agent-hook')?.checked ?? false,
      user: {
        name: modal.querySelector('#cfg-user-callsign')?.value.trim() || modal.querySelector('#cfg-user-name')?.value.trim() || 'Partner',
        callsign: modal.querySelector('#cfg-user-callsign')?.value.trim() || '',
        randomNick: modal.querySelector('#cfg-user-random-nick')?.checked ?? true,
        avatar: this.currentUserAvatar || ''
      },
      apiVault: {
        providers: {
          groq: { apiKey: modal.querySelector('#cfg-groq-key').value.trim() },
          gemini: { apiKey: modal.querySelector('#cfg-gemini-key').value.trim() },
          openrouter: { apiKey: modal.querySelector('#cfg-openrouter-key').value.trim() },
          openai: { apiKey: modal.querySelector('#cfg-openai-key').value.trim() }
        },
        activeModels: {
          chat: modal.querySelector('#cfg-model-chat').value.trim() || 'openai/gpt-oss-120b',
          vision: modal.querySelector('#cfg-model-vision').value.trim() || 'gemini-1.5-flash',
          stt: modal.querySelector('#cfg-model-stt')?.value.trim() || 'whisper-large-v3'
        }
      },
      voice: {
        engine: modal.querySelector('#cfg-tts-engine').value,
        glitchReverb: Number(modal.querySelector('#cfg-glitch-slider').value) / 100,
        inputDeviceId: modal.querySelector('#cfg-mic-select').value || null,
        ttsEnabled: modal.querySelector('#cfg-tts-toggle').checked,
        vfxVolume: vfxVol,
      },
      system: {
        wanderWhenIdle: modal.querySelector('#cfg-wander-idle')?.checked ?? true,
        replaySeconds: Number(modal.querySelector('#cfg-replay-sec').value),
        inactivitySleepSec: Number(modal.querySelector('#cfg-sleep-sec').value),
        hologramDismissSec: Number(modal.querySelector('#cfg-hologram-sec').value),
        gamerAutoPilot: modal.querySelector('#cfg-gamer-pilot').checked,
        clearGlass: modal.querySelector('#cfg-clear-glass-toggle')?.checked || false,
        opacity: Number(modal.querySelector('#cfg-opacity-slider').value) / 100,
        blurPx: Number(modal.querySelector('#cfg-blur-slider')?.value || 16),
        theme: modal.querySelector('#cfg-theme-select').value,
        userName: modal.querySelector('#cfg-user-callsign')?.value.trim() || modal.querySelector('#cfg-user-name')?.value.trim() || 'Partner',
        tickerPosition: {
          preset: modal.querySelector('#cfg-ticker-preset')?.value || 'top-left',
          offsetX: Number(modal.querySelector('#cfg-ticker-offset-x')?.value || 0),
          offsetY: Number(modal.querySelector('#cfg-ticker-offset-y')?.value || 0),
          statusBarOffsetX: Number(modal.querySelector('#cfg-ticker-offset-x')?.value || 0),
          statusBarOffsetY: Number(modal.querySelector('#cfg-ticker-offset-y')?.value || 0),
        },
      }
    };

    await this.host.setConfig(patch);
    this.panel?.setUserAvatar?.(patch.user.avatar);
    try {
      localStorage.setItem('capri_user_avatar', patch.user.avatar || '');
      localStorage.setItem('capri.userAvatar', patch.user.avatar || '');
      localStorage.setItem('capri.tickerPosition', JSON.stringify(patch.system.tickerPosition));
    } catch {}
    this.host.toggleAgentHook?.(patch.agentHookEnabled);
    this.voice.setVfxVolume?.(patch.vfxVolume);
    this.voice.configure({ ttsEnabled: patch.voice.ttsEnabled, vfxVolume: patch.vfxVolume });
    if (this.host?.restartDiscord) {
      try { this.host.restartDiscord(); } catch {}
    }
    document.documentElement.dataset.theme = patch.system.theme;
    document.documentElement.style.setProperty('--holo-opacity', patch.system.opacity);
    document.documentElement.style.setProperty('--holo-blur', `${patch.system.blurPx}px`);
    document.documentElement.classList.toggle('clear-glass', patch.system.clearGlass);
    this.onConfigSaved?.(patch);

    this.voice.play('done');

    saveBtn.textContent = '[ OK ] SAVED SUCCESSFULLY!';
    setTimeout(() => {
      saveBtn.textContent = 'SAVE SETTINGS';
      this.close();
    }, 800);
  }

  applyLanguage(lang = 'en') {
    document.documentElement.lang = 'en';
    if (this.brain) this.brain.lang = 'en';
    if (this.panel) this.panel.updateI18n?.('en');
    const t = I18N_SETTINGS.en || I18N_SETTINGS.vi;
    const modal = this.modalEl;
    if (!modal) return;

    // Header title
    const titleEl = modal.querySelector('.settings-modal__title');
    if (titleEl) titleEl.textContent = t.modalTitle;

    // Tabs
    const tabUser = modal.querySelector('.settings-modal__tab[data-tab="tab-user"]');
    if (tabUser) tabUser.textContent = t.tabs.user || 'PROFILE';
    const tabApp = modal.querySelector('.settings-modal__tab[data-tab="tab-appearance"]');
    if (tabApp) tabApp.textContent = t.tabs.appearance;
    const tabAi = modal.querySelector('.settings-modal__tab[data-tab="tab-ai"]');
    if (tabAi) tabAi.textContent = t.tabs.ai;
    const tabVoice = modal.querySelector('.settings-modal__tab[data-tab="tab-voice"]');
    if (tabVoice) tabVoice.textContent = t.tabs.voice;
    const tabSys = modal.querySelector('.settings-modal__tab[data-tab="tab-system"]');
    if (tabSys) tabSys.textContent = t.tabs.system;

    // Tab 0: User Profile
    const paneUser = modal.querySelector('#tab-user');
    if (paneUser && t.user) {
      const title = paneUser.querySelector('.settings-pane__title');
      if (title) title.textContent = t.user.profileTitle;
      const desc = paneUser.querySelector('.settings-pane__desc');
      if (desc) desc.textContent = t.user.profileDesc;

      const labels = paneUser.querySelectorAll('.settings-form__group > label');
      if (labels[0]) labels[0].textContent = t.user.avatarLabel;
      if (labels[1]) labels[1].textContent = t.user.presetsLabel;
      if (labels[2]) labels[2].textContent = t.user.callsignLabel;

      const uploadBtn = paneUser.querySelector('#cfg-user-avatar-upload-btn');
      if (uploadBtn) uploadBtn.textContent = t.user.uploadBtn;
      const resetBtn = paneUser.querySelector('#cfg-user-avatar-reset-btn');
      if (resetBtn) resetBtn.textContent = t.user.resetAvatarBtn;

      const callsignInput = paneUser.querySelector('#cfg-user-callsign');
      if (callsignInput) callsignInput.placeholder = t.user.callsignPlaceholder;

      const randomLabel = paneUser.querySelector('label[for="cfg-user-random-nick"]');
      if (randomLabel) randomLabel.textContent = t.user.randomNick;

      const presetNames = paneUser.querySelectorAll('.user-avatar-preset-btn .preset-avatar-name');
      presetNames.forEach((pn, i) => {
        if (t.user.presets && t.user.presets[i]) pn.textContent = t.user.presets[i];
      });
    }

    // Tab 1: Appearance
    const paneApp = modal.querySelector('#tab-appearance');
    if (paneApp) {
      const titles = paneApp.querySelectorAll('.settings-pane__title');
      if (titles[0]) titles[0].textContent = t.appearance.frameTitle;
      if (titles[1]) titles[1].textContent = t.appearance.glassTitle;
      if (titles[2]) titles[2].textContent = t.appearance.themeTitle;
      const descs = paneApp.querySelectorAll('.settings-pane__desc');
      if (descs[0]) descs[0].textContent = t.appearance.frameDesc;

      const labels = paneApp.querySelectorAll('.settings-form__group > label');
      if (labels[0]) labels[0].textContent = t.appearance.frameSizeLabel;
      if (labels[1]) labels[1].textContent = t.appearance.opacityLabel;
      if (labels[2]) labels[2].textContent = t.appearance.blurLabel;
      if (labels[3]) labels[3].textContent = t.appearance.langLabel;

      const glassLabel = paneApp.querySelector('label[for="cfg-clear-glass-toggle"]');
      if (glassLabel) glassLabel.textContent = t.appearance.glassToggle;

      const presets = paneApp.querySelectorAll('.settings-preset-btn .preset-name');
      presets.forEach((p, idx) => {
        if (t.appearance.presets[idx]) p.textContent = t.appearance.presets[idx];
      });
    }

    // Tab 2: AI
    const paneAi = modal.querySelector('#tab-ai');
    if (paneAi) {
      const badge = paneAi.querySelector('.settings-active-model__badge');
      if (badge) badge.textContent = t.ai.activeBadge;
      const ping = paneAi.querySelector('.settings-active-model__ping');
      if (ping) ping.textContent = t.ai.pingFast;

      const titles = paneAi.querySelectorAll('.settings-pane__title');
      if (titles[0]) titles[0].textContent = t.ai.vaultTitle;
      if (titles[1]) titles[1].textContent = t.ai.modelsTitle;
      const descs = paneAi.querySelectorAll('.settings-pane__desc');
      if (descs[0]) descs[0].textContent = t.ai.vaultDesc;

      const userLabel = paneAi.querySelector('label[for="cfg-user-name"]') || paneAi.querySelectorAll('.settings-form__group > label')[6];
      if (userLabel) userLabel.textContent = t.ai.userNameLabel;
    }

    // Tab 3: Voice
    const paneVoice = modal.querySelector('#tab-voice');
    if (paneVoice) {
      const title = paneVoice.querySelector('.settings-pane__title');
      if (title) title.textContent = t.voice.micTitle;
      const desc = paneVoice.querySelector('.settings-pane__desc');
      if (desc) desc.textContent = t.voice.micDesc;

      const labels = paneVoice.querySelectorAll('.settings-form__group > label');
      if (labels[0]) labels[0].textContent = t.voice.micDeviceLabel;
      if (labels[1]) labels[1].textContent = t.voice.micMeterLabel;
      if (labels[2]) labels[2].textContent = t.voice.ttsEngineLabel;
      if (labels[3]) labels[3].textContent = t.voice.glitchLabel;

      const ttsToggle = paneVoice.querySelector('label[for="cfg-tts-toggle"]');
      if (ttsToggle) ttsToggle.textContent = t.voice.ttsToggle;

      const testBtn = paneVoice.querySelector('#cfg-test-tts-btn');
      if (testBtn) testBtn.textContent = t.voice.testTtsBtn;
    }

    // Tab 4: System
    const paneSys = modal.querySelector('#tab-system');
    if (paneSys) {
      const titles = paneSys.querySelectorAll('.settings-pane__title');
      if (titles[0]) titles[0].textContent = t.system.replayTitle;
      if (titles[1]) titles[1].textContent = t.system.historyTitle;
      const descs = paneSys.querySelectorAll('.settings-pane__desc');
      if (descs[0]) descs[0].textContent = t.system.replayDesc;
      if (descs[1]) descs[1].textContent = t.system.historyDesc;

      const labels = paneSys.querySelectorAll('.settings-form__group > label');
      if (labels[0]) labels[0].textContent = t.system.replayLabel;
      if (labels[1]) labels[1].textContent = t.system.sleepLabel;
      if (labels[2]) labels[2].textContent = t.system.holoSleepLabel;

      const gamerPilot = paneSys.querySelector('label[for="cfg-gamer-pilot"]');
      if (gamerPilot) gamerPilot.textContent = t.system.gamerPilot;

      const hookLabel = paneSys.querySelector('label[for="cfg-agent-hook"]');
      if (hookLabel && t.system.agentHookLabel) hookLabel.textContent = t.system.agentHookLabel;

      const clearBtn = paneSys.querySelector('#cfg-clear-history-btn');
      if (clearBtn) clearBtn.textContent = t.system.clearHistoryBtn;
    }

    // Footer
    const saveBtn = modal.querySelector('#cfg-save-btn');
    if (saveBtn) saveBtn.textContent = t.footer.saveBtn;
  }
}
