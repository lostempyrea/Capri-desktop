// Capri Voice Timer & Focus Guardian
// Handles voice countdown timers and 2-hour continuous work health alerts.

function getNick() {
  try {
    const custom = (localStorage.getItem('capri.userName') || '').trim();
    const nicks = ['tèo', 'blue'];
    if (custom && custom.toLowerCase() !== 'tèo') {
      return Math.random() < 0.6 ? custom : nicks[Math.floor(Math.random() * nicks.length)];
    }
    return nicks[Math.floor(Math.random() * nicks.length)];
  } catch {
    return Math.random() < 0.5 ? 'tèo' : 'blue';
  }
}

export class TimerGuardian {
  constructor({ host, panel, voice, capri }) {
    this.host = host;
    this.panel = panel;
    this.voice = voice;
    this.capri = capri;

    this.activeTimers = new Map(); // id -> { title, endsAt, timerId }
    this.sessionStartTime = Date.now();
    this.lastRestReminder = Date.now();
    this.restIntervalMs = 2 * 60 * 60 * 1000; // 2 hours

    this.startFocusWatch();
  }

  setTimer(minutes, title = 'Hẹn giờ') {
    const mins = Math.max(1, Math.min(180, Number(minutes) || 1));
    const durationMs = mins * 60 * 1000;
    const endsAt = Date.now() + durationMs;
    const id = `timer_${Date.now()}`;

    const timerId = setTimeout(() => {
      this.triggerAlarm(id, title, mins);
    }, durationMs);

    this.activeTimers.set(id, { title, endsAt, timerId, mins });
    this.voice.play('star');

    this.panel.say({
      kind: 'info',
      face: 'smug',
      badge: 'TIMER SET',
      line: `⏱️ Đã đặt hẹn giờ ${mins} phút cho "${title}"! Tôi sẽ nhắc bạn khi hết giờ.`,
      hold: 4000
    });

    return { ok: true, id, mins };
  }

  triggerAlarm(id, title, mins) {
    this.activeTimers.delete(id);
    this.voice.play('alert');
    this.capri.perform?.('cheer');

    const nick = getNick();
    const msg = `HẾT GIỜ! Đã hết ${mins} phút hẹn giờ cho "${title}". ${nick.charAt(0).toUpperCase() + nick.slice(1)} hãy kiểm tra nhé!`;

    this.panel.say({
      kind: 'alert',
      face: 'wide',
      badge: 'ALARM',
      line: msg,
      hold: 15000,
      actions: [
        { id: 'ok', label: 'Đã rõ!', primary: true }
      ],
      onAction: () => this.panel.hide()
    });

    // Voice announcement
    this.voice.speakCyberpunk?.(msg);
  }

  startFocusWatch() {
    setInterval(() => {
      const now = Date.now();
      if (now - this.lastRestReminder >= this.restIntervalMs) {
        this.lastRestReminder = now;
        this.triggerFocusReminder();
      }
    }, 60000); // Check every minute
  }

  triggerFocusReminder() {
    this.voice.play('alert');
    const nick = getNick();
    const msg = `Cảnh báo Focus Guardian: Bạn đã làm việc liên tục 2 giờ! Hãy vươn vai, uống nước và để mắt nghỉ 5 phút nhé ${nick}.`;
    this.panel.say({
      kind: 'alert',
      face: 'calm',
      badge: 'FOCUS GUARDIAN',
      line: msg,
      hold: 12000,
      actions: [{ id: 'rest', label: 'Nghỉ 5 phút', primary: true }],
      onAction: () => this.panel.hide()
    });
    this.voice.speakCyberpunk?.(msg);
  }
}
