'use strict';

// The tray menu (and the one she opens when you right-click her), in every language she speaks.
// The order of this object is the order of the Language submenu.

const TRAY = {
  vi: {
    name: 'Tiếng Việt',
    online: (port) => `Capri — đang nghe trên ${port}`,
    teleport: 'Dịch chuyển', satellite: 'Ngắm vệ tinh', demo: 'Xem diễn thử', help: 'Hướng dẫn sử dụng',
    report: 'Nhật ký nhiệm vụ', talk: 'Tám chuyện với cô ấy', chatModel: 'Model AI', noOllama: 'Không tìm thấy Ollama',
    inAppMusic: 'Máy phát nhạc Capri (In-App)', musicPlay: 'Phát / Tạm dừng', musicNext: 'Bài tiếp theo', musicPrev: 'Bài trước đó',
    musicShuffle: 'Phát ngẫu nhiên', musicFolder: 'Mở thư mục nhạc...', musicRadio: 'Kênh Radio Cyberpunk',
    musicVol: 'Âm lượng', musicTracks: 'Bài hát trong máy',
    radioPlaza: 'Nightwave Plaza 🌌 (Vaporwave / Synth)', radioDefcon: 'DEF CON Radio ⚡ (Hacker Synth)', radioGroove: 'Groove Salad ☕ (Chill Ambient)',
    media: 'Điều khiển Spotify / Media ngoài', mediaPlay: 'Phát / Tạm dừng', mediaNext: 'Bài tiếp theo', mediaPrev: 'Bài trước đó',
    mediaVolUp: 'Tăng âm lượng', mediaVolDown: 'Giảm âm lượng', mediaMute: 'Tắt / Bật tiếng',
    show: 'Gọi cô ấy ra', hide: 'Cất vào biochip',
    size: 'Kích cỡ', small: 'Nhỏ', medium: 'Vừa', large: 'Lớn', sound: 'Âm thanh', mute: 'Tắt tiếng',
    soundsDir: 'Mở thư mục âm thanh tùy chỉnh', screen: 'Màn hình', wander: 'Lượn lờ khi rảnh rỗi',
    possess: 'Chiếm giữ cửa sổ của tôi', lang: 'Ngôn ngữ', auto: 'Tự động (hệ thống)', startup: 'Khởi động cùng Windows',
    hooksOn: 'Hook Agent: Đã cài đặt', hooksOff: 'Cài đặt hook Agent',
    hooksRemove: 'Gỡ bỏ hook Agent', quit: 'Thoát',
  },
  en: {
    name: 'English',
    online: (port) => `Capri — listening on ${port}`,
    teleport: 'Teleport', satellite: 'Look at the satellite', demo: 'Play demo', help: 'How does it work?',
    report: 'Mission report', talk: 'Talk to her', chatModel: 'AI model (Ollama)', noOllama: 'Ollama not found',
    inAppMusic: 'Capri Music Player (In-App)', musicPlay: 'Play / Pause', musicNext: 'Next track', musicPrev: 'Previous track',
    musicShuffle: 'Shuffle', musicFolder: 'Open music folder...', musicRadio: 'Cyberpunk Radio',
    musicVol: 'Volume', musicTracks: 'Local tracks',
    radioPlaza: 'Nightwave Plaza 🌌 (Vaporwave / Synth)', radioDefcon: 'DEF CON Radio ⚡ (Hacker Synth)', radioGroove: 'Groove Salad ☕ (Chill Ambient)',
    media: 'External Spotify / Media control', mediaPlay: 'Play / Pause', mediaNext: 'Next track', mediaPrev: 'Previous track',
    mediaVolUp: 'Volume up', mediaVolDown: 'Volume down', mediaMute: 'Mute / Unmute',
    show: 'Bring her back', hide: 'Put her away',
    size: 'Size', small: 'Small', medium: 'Medium', large: 'Large', sound: 'Sound', mute: 'Mute',
    soundsDir: 'Open custom sounds folder', screen: 'Screen', wander: 'Wander around when idle',
    possess: 'Possess my windows', lang: 'Language', auto: 'Automatic (system)', startup: 'Start with Windows',
    hooksOn: 'Claude Code hooks: installed', hooksOff: 'Install Claude Code hooks',
    hooksRemove: 'Remove Claude Code hooks', quit: 'Quit',
  },
};

module.exports = { TRAY, LANGS: Object.keys(TRAY) };
