// Talking to her: you type in her panel, and a local model (Ollama, from the main process) answers
// as her, in writing. The replies are AI-generated, and the panel says so on every chat.
// Ask her to close an app and she will (Windows): she spots it in what you wrote (or the model names
// it with a tag in its answer), shows you a button with that app's name, and only your click closes it.

import { pick, fmt } from './util.js';

const REMEMBER = 12; // messages of this conversation she keeps in mind
const LANGUAGE = { vi: 'Vietnamese', fr: 'French', en: 'English', es: 'Spanish', pt: 'Brazilian Portuguese', ru: 'Russian' };
const STAY_MS = 10 * 60 * 1000; // no wandering off mid-conversation
const LOADING_AFTER_MS = 5000;
const CLOSE_TAG = /\[\[\s*close\s*:?\s*([^\]]*)\]\]/i; // [[close: AM Music]] at the end of her answer
const MEDIA_TAG = /\[\[\s*media\s*:?\s*([^\]]*)\]\]/i; // [[media: next]] at the end of her answer
const LAUNCH_TAG = /\[\[\s*launch\s*:?\s*([^\]]*)\]\]/i; // [[launch: chrome]]
const SCREENSHOT_TAG = /\[\[\s*screenshot\s*\]\]/i; // [[screenshot]]
const RECORD_TAG = /\[\[\s*record\s*:?\s*([^\]]*)\]\]/i; // [[record: start]] / [[record: stop]]
const WEATHER_TAG = /\[\[\s*weather\s*:?\s*([^\]]*)\]\]/i; // [[weather: Hanoi]]
const TIME_TAG = /\[\[\s*time\s*\]\]/i; // [[time]]
// "close", "shut down", "ferme", "quitte", "cierra", "fecha", "закрой", "đóng", "tắt"... in any of her languages
const CLOSE_ASK = /\b(close|shut|quit|kill|exit)|ferm|quitt|coupe|arr[êe]t|cierr|cerra|fech|закр|выключ|đóng|tắt|dẹp|diệt|trảm/i;

export class Chat {
  constructor({ capri, panel, voice, host, brain, player, recorder, fx, chip, replayBuffer }) {
    this.capri = capri;
    this.panel = panel;
    this.voice = voice;
    this.host = host;
    this.brain = brain;
    this.player = player;
    this.recorder = recorder;
    this.replayBuffer = replayBuffer;
    this.fx = fx;
    this.chip = chip;
    this.history = []; // this run's conversation, [{ role, content }]
    this.open = false;
    this.turn = 0;     // id of the answer coming in, if any
    this.answer = '';
    this.apps = [];    // the apps open on this PC, as last listed: [{ name, label }]
    this.appsReady = Promise.resolve();
    this.loadHistory();
    host.onChatDelta(({ id, text }) => this.onDelta(id, text));
  }

  loadHistory() {
    try {
      const raw = localStorage.getItem('capri.chatHistoryPersistent');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.history = parsed.slice(-100);
        }
      }
    } catch {}
  }

  saveHistory() {
    try {
      localStorage.setItem('capri.chatHistoryPersistent', JSON.stringify(this.history.slice(-100)));
    } catch {}
  }

  clearHistory() {
    this.history = [];
    try {
      localStorage.removeItem('capri.chatHistoryPersistent');
    } catch {}
    this.panel?.clearHistoryDom?.();
  }

  addMessage(role, content) {
    if (!content) return;
    const now = Date.now();
    const last = this.history[this.history.length - 1];
    if (last && last.role === role && last.content.trim() === content.trim() && (now - (last.at || 0) < 1500)) {
      return;
    }
    this.history.push({ role, content, at: now });
    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }
    this.saveHistory();
    this.panel?.appendChatMessage?.(role, content);
  }

  bindChip(chip) {
    this.chip = chip;
  }

  get t() {
    return this.brain.t.chat;
  }

  async start() {
    const { capri, host, t } = this;
    if (this.open) {
      this.panel.chatInput.focus();
      return;
    }
    if (capri.stowed || capri.dormant) {
      host.setConfig({ visible: true });
      if (capri.stowed) await capri.unstow();
      if (capri.dormant) await capri.rouse();
      capri.forceRestoreInteraction?.();
      this.panel.forceRestore?.();
    }
    capri.wake();
    const status = await host.chatStatus();
    if (!status.ok) {
      // no Ollama, or nothing to talk with yet: what to do about it
      const offline = status.error === 'offline';
      capri.perform('curious', capri.towardCenter());
      this.panel.say({
        kind: 'info',
        face: 'aside',
        guide: true,
        line: offline ? t.offline : t.noModel,
        quote: offline ? t.offlineHow : t.noModelHow,
        actions: offline
          ? [{ id: 'get', label: t.getOllama, primary: true }, { id: 'ok', label: t.ok }]
          : [{ id: 'ok', label: t.ok, primary: true }],
        onAction: (id) => {
          if (id === 'get') host.openOllama();
          this.panel.hide();
        },
        hold: null,
      });
      return;
    }
    this.listApps();
    host.focusOverlay(true); // the keyboard, for typing to her
    const shown = this.panel.say({
      kind: 'chat',
      face: 'look',
      badge: t.badge,
      tag: status.model.replace(/:latest$/, ''),
      line: pick(this.history.length ? t.again : t.hello),
      chat: {
        placeholder: t.placeholder,
        send: t.send,
        close: t.close,
        noteTag: t.noteTag,
        note: t.note,
      },
      onSend: (text) => this.send(text),
      onLeave: () => this.close(),
      hold: null,
    });
    if (!shown) {
      host.focusOverlay(false); // something more important is on (a permission prompt)
      return;
    }
    this.open = true;
    this.panel.renderChatHistory?.(this.history);
    setTimeout(() => this.panel.chatInput.focus(), 150); // once the overlay has the keyboard
    capri.perform('hop');
    capri.nextMove = capri.nextGaze = performance.now() + STAY_MS;
  }

  close() {
    if (!this.open) return;
    this.open = false;
    if (this.turn) this.host.chatStop(this.turn);
    this.turn = 0;
    this.host.focusOverlay(false);
    this.capri.nextMove = performance.now() + 30000;
    this.capri.nextGaze = performance.now() + 60000;
  }

  // Handle voice commands spoken by user (can be called even when chat window is closed)
  async handleSpokenCommand(text) {
    if (!text || !String(text).trim()) return;
    const cleanText = String(text).trim();

    const handled = await this.handleDirectCommand(cleanText, true);
    if (handled) return;

    // Conversational / AI chat:
    if (this.open) {
      // If user has intentionally opened the chat window, send within the chat window
      await this.send(cleanText);
    } else {
      // Biochip-only mode: Respond purely via Biochip Speech Bubble & TTS (NO CHAT WINDOW POPUP)
      await this.handleSpokenQueryOnChip(cleanText);
    }
  }

  // Handle conversational AI queries on Biochip without opening the Hologram Chat Frame
  async handleSpokenQueryOnChip(text) {
    this.chip?.setStatusBadge('Đang suy nghĩ...', 'stt', 12000);
    this.capri.pulse();
    this.addMessage('user', text);

    await Promise.race([this.appsReady, new Promise((r) => setTimeout(r, 1500))]);
    const messages = [
      { role: 'system', content: this.persona() },
      ...this.history.slice(-REMEMBER).map(m => ({ role: m.role, content: m.content }))
    ];

    let res = null;
    try {
      res = await this.host.aiChat(messages);
    } catch {
      res = null;
    }
    if (!res || !res.ok) {
      const id = Date.now();
      res = await this.host.chatSend({ id, messages });
    }

    this.chip?.clearStatusBadge();

    if (!res || !res.ok) {
      this.history.pop();
      this.saveHistory();
      const errLine = `Xin lỗi, không thể kết nối tới mô hình AI: ${res?.error || 'Lỗi mạng'}`;
      this.chip?.say?.({ text: errLine, badge: '[ CAPRI // ERROR ]', duration: 6000, tts: false });
      return;
    }

    const answer = clean(res.text) || '…';
    this.addMessage('assistant', answer);

    // Show response on Biochip Speech Popup with smooth typewriter text & neural TTS
    this.chip?.say?.({ text: answer, badge: '[ CAPRI // AI ]', duration: 7000, tts: true });

    // Tagged media control from LLM response if present
    const tagMedia = taggedMedia(res.text);
    if (tagMedia) {
      this.executeMediaAction(tagMedia);
      this.capri.pulse();
    }

    // Tagged assistant control from LLM response
    const tagAssistant = taggedAssistant(res.text);
    if (tagAssistant) {
      this.executeAssistantAction(tagAssistant, false);
    }
  }

  // Handle direct commands: Discord Bot, Media playback, or Assistant tools (screenshot, recording, apps, time, weather)
  async handleDirectCommand(text, isSpoken = false) {
    const cleanText = String(text || '').trim();
    if (!cleanText) return null;

    // 1. Direct Discord Bot Control (commands or natural language)
    const discordReq = this.askedDiscord(cleanText);
    if (discordReq) {
      this.capri.pulse();
      const res = await this.host.discordCommand(discordReq.command, null, discordReq.song);
      const answer = res?.message || (res?.ok ? 'Đã thực hiện lệnh Discord!' : 'Lỗi kết nối Discord!');
      if (res?.ok) {
        this.capri.perform('hop');
        this.voice.play('blip');
      }
      if (isSpoken) {
        if (this.panel?.visible) {
          this.panel.say({
            kind: 'chat',
            badge: 'DISCORD',
            line: answer,
            face: res?.ok ? 'grin' : 'aside',
            hold: 6000,
          });
        } else {
          this.chip?.say?.({
            text: answer,
            badge: '[ CAPRI // DISCORD ]',
            duration: 6000,
            tts: true,
          });
        }
      }
      return { handled: true, badge: 'DISCORD', answer, face: res?.ok ? 'grin' : 'aside' };
    }

    // 2. Assistant Tools (FIRST): Screenshot, Recording, App launch, Time, Weather
    const assistantReq = this.askedAssistant(cleanText);
    if (assistantReq) {
      const res = await this.executeAssistantAction(assistantReq, isSpoken);
      return { handled: true, ...res };
    }

    // 3. Microphone selection & management (commands or natural language)
    const micReq = this.askedMicrophone(cleanText);
    if (micReq) {
      this.capri.pulse();
      const res = await this.executeMicAction(micReq);
      if (res.ok) {
        this.capri.perform('hop');
        this.voice.play('blip');
      }
      if (isSpoken) {
        if (this.panel?.visible) {
          this.panel.say({
            kind: 'info',
            badge: 'MIC',
            line: res.answer,
            face: res.ok ? 'grin' : 'aside',
            hold: 7000,
          });
        } else {
          this.chip?.say?.({
            text: res.answer,
            badge: '[ CAPRI // MIC ]',
            duration: 7000,
            tts: true,
          });
        }
      }
      return { handled: true, badge: 'MIC', answer: res.answer, face: res.ok ? 'grin' : 'aside' };
    }

    // 4. Direct quick media control (ONLY checked AFTER assistant commands with strict pattern)
    const quickMedia = this.askedMedia(cleanText);
    if (quickMedia) {
      this.capri.pulse();
      const reply = await this.executeMediaAction(quickMedia);
      const answer = reply || this.mediaReply(quickMedia);
      this.capri.perform('hop');
      if (isSpoken) {
        if (this.panel?.visible) {
          this.panel.say({
            kind: 'chat',
            badge: 'MUSIC',
            line: answer,
            face: 'look',
            hold: 6000,
          });
        } else {
          this.chip?.say?.({
            text: answer,
            badge: '[ CAPRI // MUSIC ]',
            duration: 6000,
            tts: true,
          });
        }
      }
      return { handled: true, badge: 'MUSIC', answer, face: quickMedia === 'volup' ? 'grin' : 'look' };
    }

    return null;
  }

  async send(text) {
    if (this.turn || !this.open) return;
    const id = Date.now();
    this.turn = id;
    this.answer = '';
    this.addMessage('user', text);
    this.panel.setChatBusy(true);
    this.panel.setActions([]); // a close button she offered before goes with a new message
    this.panel.chatTurn({ quote: text, face: 'aside' });
    this.capri.pulse();

    // Check direct commands first (Discord, Media, Assistant tools)
    const handled = await this.handleDirectCommand(text, false);
    if (handled) {
      this.turn = 0;
      this.addMessage('assistant', handled.answer);
      this.panel.stream(handled.answer, { done: true });
      this.panel.setFace(handled.face || 'look');
      this.panel.setChatBusy(false);
      return;
    }

    await Promise.race([this.appsReady, new Promise((r) => setTimeout(r, 1500))]);
    const messages = [
      { role: 'system', content: this.persona() },
      ...this.history.slice(-REMEMBER).map(m => ({ role: m.role, content: m.content }))
    ];
    // nothing yet after a few seconds: the model is still loading (the first answer after a start)
    const slow = setTimeout(() => {
      if (this.turn === id && !this.answer) this.panel.stream(this.t.loading);
    }, LOADING_AFTER_MS);

    // Call Multi-API Vault with Auto-Failover first, fallback to chatSend
    let res = null;
    try {
      res = await this.host.aiChat(messages);
    } catch {
      res = null;
    }
    if (!res || !res.ok) {
      res = await this.host.chatSend({ id, messages });
    }

    clearTimeout(slow);
    if (this.turn !== id) {
      // closed meanwhile: your message goes too, or the next answer would answer it as well
      if (this.history.at(-1)?.content === text) {
        this.history.pop();
        this.saveHistory();
      }
      return;
    }
    this.turn = 0;
    if (!res.ok) {
      this.history.pop();
      this.saveHistory();
      this.panel.setFace('wide');
      this.panel.stream(`${this.t.failed} ${res.error}`, { done: true });
      this.panel.setChatBusy(false);
      return;
    }
    const answer = clean(res.text) || '…';
    this.addMessage('assistant', answer);
    this.panel.stream(answer, { done: true });
    this.panel.setFace(mood(answer));
    this.panel.setChatBusy(false);

    // Speak reply using Cyberpunk Neural TTS with Glitch Filter
    this.voice?.speakCyberpunk?.(answer);

    // Tagged media control from LLM response if not already fired
    const tagMedia = taggedMedia(res.text);
    if (tagMedia) {
      this.executeMediaAction(tagMedia);
      this.capri.pulse();
    }

    // Tagged assistant control from LLM response
    const tagAssistant = taggedAssistant(res.text);
    if (tagAssistant) {
      this.executeAssistantAction(tagAssistant, false);
    }

    // what you asked for first (a small model doesn't always write its tag right), else its tag
    const wanted = this.askedToClose(text) || tagged(res.text);
    if (wanted) this.offerClose(wanted, answer);
    this.listApps(); // fresh for the next message
  }

  listApps() {
    this.appsReady = this.host.openApps().then((list) => { this.apps = list || []; }).catch(() => {});
  }

  // "close am music pls": an app that's open, named in a message asking to close something.
  askedToClose(text) {
    if (!CLOSE_ASK.test(text)) return null;
    const said = simple(text);
    let best = null;
    for (const app of this.apps) {
      for (const name of [simple(app.name), simple(app.label)]) {
        if (name.length >= 3 && said.includes(name) && (!best || name.length > best.length)) best = { app, length: name.length };
      }
    }
    return best?.app.name || null;
  }

  // She was asked to close an app: a button with its name, and nothing happens until you click it.
  async offerClose(wanted, answer) {
    const { t } = this;
    const app = await this.host.findApp(wanted);
    if (!this.open || this.turn) return;
    if (!app) {
      this.panel.stream(`${answer}\n${fmt(t.notFound, { app: wanted })}`, { done: true });
      return;
    }
    this.panel.setActions(
      [{ id: 'close', label: fmt(t.closeIt, { app: app.name }), primary: true }, { id: 'no', label: t.no }],
      (id) => (id === 'close' ? this.closeApp(app) : this.panel.setActions([])),
    );
  }

  async closeApp(app, force = false) {
    const { t, capri } = this;
    this.panel.setActions([]);
    // a bolt of red lightning off her fingers, at it
    const h = capri.head();
    capri.zap(h.x + capri.towardCenter() * 280, h.y - 170);
    const res = await this.host.closeApp(app.name, force);
    if (!this.open) return;
    let line;
    if (res.error) line = `${t.failed} ${res.error}`;
    else if (!res.running) line = fmt(force ? t.forced : t.closed, { app: app.name });
    else line = fmt(force ? t.unkillable : t.stillOpen, { app: app.name });
    this.panel.setFace(res.running || res.error ? 'aside' : 'laugh');
    this.panel.stream(line, { done: true });
    this.addMessage('assistant', line);
    // it hid in the tray, or it's asking you to save something: forcing it is your call
    if (res.running && !force && !res.error) {
      this.panel.setActions(
        [{ id: 'force', label: t.force, primary: true }, { id: 'leave', label: t.leave }],
        (id) => (id === 'force' ? this.closeApp(app, true) : this.panel.setActions([])),
      );
    }
    this.listApps();
  }

  async executeAssistantAction(req, isSpoken = false) {
    if (!req) return null;
    switch (req.type) {
      case 'screenshot':
        return await this.handleScreenshot(isSpoken);
      case 'instant-replay':
        return await this.handleInstantReplay(isSpoken);
      case 'time':
        return await this.handleTime(isSpoken);
      case 'weather':
        return await this.handleWeather(req.city, isSpoken);
      case 'launch':
        return await this.handleLaunch(req.appName, isSpoken);
      default:
        return null;
    }
  }

  async handleScreenshot(isSpoken = false) {
    this.capri.pulse();
    this.fx?.flash?.();
    this.voice.play('shutter');
    const res = await this.host.takeScreenshot();
    if (res?.ok) {
      this.capri.perform('hop');
      const line = `Đã chụp màn hình và lưu vào Clipboard (Ctrl+V) rồi nhé ${this.getUserNick()}!`;
      if (this.panel?.visible) {
        this.panel.say({
          kind: 'done',
          badge: 'SHOT',
          face: 'grin',
          line,
          actions: [
            { id: 'open', label: 'Mở thư mục ảnh', primary: true },
            { id: 'ok', label: 'Đóng' },
          ],
          onAction: (id) => {
            if (id === 'open') this.host.openFolder(res.dirPath);
            this.panel.hide();
          },
          hold: 12000,
        });
      } else {
        this.chip?.say?.({
          text: line,
          badge: '[ CAPRI // SHOT ]',
          duration: 6000,
          tts: true,
        });
      }
      return { answer: line, badge: 'SHOT', face: 'grin' };
    } else {
      const line = `Không thể chụp màn hình: ${res?.error || 'Lỗi không xác định'}`;
      if (this.panel?.visible) {
        this.panel.say({ kind: 'error', badge: 'SHOT', face: 'aside', line, hold: 5000 });
      } else {
        this.chip?.say?.({
          text: line,
          badge: '[ CAPRI // ERROR ]',
          duration: 5000,
          tts: false,
        });
      }
      return { answer: line, badge: 'SHOT', face: 'aside' };
    }
  }

  /**
   * On-Demand Screen Vision & Clipboard AI
   */
  async analyzeScreen(userPrompt) {
    if (!this.open) await this.start();
    this.panel.setChatBusy(true);
    this.panel.setFace('look');
    this.panel.stream('Đang chụp màn hình và gửi tới Vision Model...', { done: false });
    this.capri.perform?.('point', this.capri.towardCenter?.());

    try {
      const shot = await this.host.takeScreenshot();
      if (!shot || !shot.ok) {
        this.panel.setFace('laugh');
        this.panel.stream(`Không thể chụp màn hình để phân tích ${this.getUserNick()} ơi!`, { done: true });
        this.panel.setChatBusy(false);
        return;
      }

      const prompt = userPrompt || 'Hãy phân tích màn hình này, phát hiện lỗi hoặc nội dung quan trọng.';
      const res = await this.host.aiVision(prompt, shot.filePath, 'image/png');

      if (!res.ok) {
        this.panel.setFace('wide');
        this.panel.stream(`Lỗi phân tích màn hình: ${res.error}`, { done: true });
        this.panel.setChatBusy(false);
        return;
      }

      const answer = clean(res.text);
      this.addMessage('assistant', answer);
      this.panel.stream(answer, { done: true });
      this.panel.setFace(mood(answer));
      this.panel.setChatBusy(false);

      this.voice?.speakCyberpunk?.(answer);
    } catch (err) {
      this.panel.setFace('wide');
      this.panel.stream(`Lỗi Vision: ${err.message}`, { done: true });
      this.panel.setChatBusy(false);
    }
  }

  async handleInstantReplay(isSpoken = false) {
    if (!this.replayBuffer) {
      return { answer: 'Tính năng Instant Replay chưa sẵn sàng.', badge: 'REPLAY', face: 'aside' };
    }
    const res = await this.replayBuffer.clip();
    const line = res?.ok
      ? `Đã lưu clip Instant Replay 30s-60s thành công: ${res.fileName || ''}`
      : (res?.error || 'Không thể trích xuất clip Instant Replay.');
    return { answer: line, badge: 'REPLAY', face: res?.ok ? 'laugh' : 'aside' };
  }

  async handleLaunch(appName, isSpoken = false) {
    this.capri.pulse();
    const res = await this.host.launchApp(appName);
    if (res?.ok) {
      const h = this.capri.head();
      this.capri.zap(h.x + this.capri.towardCenter() * 260, h.y - 150);
      this.voice.play('done');
      const line = `Đã phóng ${res.name} lên màn hình rồi nhé ${this.getUserNick()}!`;
      if (this.panel?.visible) {
        this.panel.say({ kind: 'done', badge: 'EXEC', face: 'laugh', line, hold: 5000 });
      } else {
        this.chip?.say?.({ text: line, badge: '[ CAPRI // EXEC ]', duration: 5000, tts: true });
      }
      return { answer: line, badge: 'EXEC', face: 'laugh' };
    } else {
      const line = res?.error || `Không tìm thấy ứng dụng "${appName}"!`;
      if (this.panel?.visible) {
        this.panel.say({ kind: 'error', badge: 'EXEC', face: 'aside', line, hold: 5000 });
      } else {
        this.chip?.say?.({ text: line, badge: '[ CAPRI // ERROR ]', duration: 5000, tts: false });
      }
      return { answer: line, badge: 'EXEC', face: 'aside' };
    }
  }

  async handleTime(isSpoken = false) {
    this.capri.pulse();
    const res = await this.host.getTimeAndDate(this.brain.lang);
    this.capri.perform('hop');
    this.voice.play('blip');
    if (this.panel?.visible) {
      this.panel.setTicker({ verb: 'TIME', target: res.time });
      setTimeout(() => this.panel.setTicker(null), 5000);
      this.panel.say({ kind: 'info', badge: 'CLOCK', face: 'look', line: res.text, hold: 8000 });
    } else {
      this.chip?.say?.({ text: res.text, badge: '[ CAPRI // CLOCK ]', duration: 7000, tts: true });
    }
    return { answer: res.text, badge: 'CLOCK', face: 'look' };
  }

  async handleWeather(city, isSpoken = false) {
    this.capri.pulse();
    const res = await this.host.getWeather(city, this.brain.lang);
    if (res?.ok) {
      this.capri.perform('hop');
      this.voice.play('blip');
      const cityLabel = res.city === 'TP. Hồ Chí Minh' ? 'HCMC' : res.city;
      if (this.panel?.visible) {
        this.panel.setTicker({ verb: 'WEATHER', target: `${res.temp}°C · ${cityLabel}` });
        setTimeout(() => this.panel.setTicker(null), 8000);
        this.panel.say({ kind: 'info', badge: 'WEATHER', face: 'grin', line: res.text, hold: 9000 });
      } else {
        this.chip?.say?.({ text: res.text, badge: '[ CAPRI // WEATHER ]', duration: 8000, tts: true });
      }
      return { answer: res.text, badge: 'WEATHER', face: 'grin' };
    } else {
      if (this.panel?.visible) {
        this.panel.say({ kind: 'error', badge: 'WEATHER', face: 'aside', line: res.error, hold: 5000 });
      } else {
        this.chip?.say?.({ text: res.error, badge: '[ CAPRI // ERROR ]', duration: 5000, tts: false });
      }
      return { answer: res.error, badge: 'WEATHER', face: 'aside' };
    }
  }

  askedAssistant(text) {
    const s = String(text || '').trim();
    const lower = s.toLowerCase();

    // 1. Screenshot
    if (
      /^\/(?:screenshot|cap|shot)$/i.test(lower) ||
      /\b(chụp\s*(ảnh)?\s*màn\s*hình|chụp\s*màn|take\s*(a\s*)?screenshot|capture\s*screen|screenshot|screen\s*capture)\b/i.test(lower)
    ) {
      return { type: 'screenshot' };
    }

    // 2. Cyberpunk Instant Replay ("Clip That" / "Record That")
    if (
      /^\/(?:clip|replay|instantreplay)$/i.test(lower) ||
      /\b(clip\s+that(\s+shit)?|record\s+that|lưu\s+lại\s+pha\s+vừa\s+rồi|quay\s+lại\s+pha\s+vừa\s+rồi|clip\s+lại\s+đi)\b/i.test(lower)
    ) {
      return { type: 'instant-replay' };
    }

    // 3. Time & Date
    if (
      /^\/(?:time|date|clock)$/i.test(lower) ||
      /\b(mấy\s*giờ(\s*rồi)?|bây\s*giờ\s*là\s*mấy\s*giờ|xem\s*giờ|thời\s*gian|hôm\s*nay\s*ngày\s*mấy|ngày\s*mấy|thứ\s*mấy|what\s*time\s*is\s*it|what('s|\s+is)\s+the\s+time|tell\s+me\s+the\s+time|what\s+day\s+is\s+it|what('s|\s+is)\s+today('s)?\s+date|what('s|\s+is)\s+the\s+date)\b/i.test(lower)
    ) {
      return { type: 'time' };
    }

    // 4. Weather
    const weatherSlash = /^\/weather(?:\s+(.+))?$/i.exec(s);
    if (weatherSlash) {
      return { type: 'weather', city: weatherSlash[1]?.trim() || '' };
    }
    const weatherAtM = /\b(?:thời\s*tiết\s*(?:ở|tại)|weather\s*in)\s+([^,\.\?!]+)/i.exec(s);
    if (weatherAtM) {
      return { type: 'weather', city: weatherAtM[1].trim() };
    }
    if (/\b(thời\s*tiết|weather|what('s|\s+is)\s+(?:the\s+)?weather(\s+like)?|how('s|\s+is)\s+(?:the\s+)?weather)\b/i.test(lower)) {
      return { type: 'weather', city: '' };
    }

    // 5. Launch App
    const launchM = /^(?:mở|khởi\s*động|chạy|bật|open|launch|start|run)\s+(?:ứng\s*dụng|app\s+)?([a-zA-Z0-9\s_.-]+)$/i.exec(s);
    if (launchM) {
      const target = launchM[1].trim().toLowerCase();
      const isMediaKeyword = /^(nhạc|bài|bài\s+hát|song|music|radio|kênh|âm\s*lượng|volume|phòng\s*discord|voice\s*discord|discord\s*bot|bot)$/i.test(target);
      if (!isMediaKeyword && target.length >= 2) {
        return { type: 'launch', appName: launchM[1].trim() };
      }
    }

    return null;
  }

  // Detect Microphone commands: prefix (c!mic, /mic) or natural language
  askedMicrophone(text) {
    const s = String(text || '').trim();
    const lower = s.toLowerCase();

    // 1. Prefix: c!mic or c!mics or /mic or /mics
    const cmdM = /^(?:c!|\/)(?:mic|mics|microphone)(?:\s+(.*))?$/i.exec(s);
    if (cmdM) {
      const arg = (cmdM[1] || '').trim();
      if (!arg || /^(list|ls|all|danh\s*sách)$/i.test(arg)) {
        return { action: 'list' };
      }
      if (/^\d+$/.test(arg)) {
        return { action: 'select', index: parseInt(arg, 10) };
      }
      if (/^(next|tiếp|đổi|cycle)$/i.test(arg)) {
        return { action: 'cycle' };
      }
      return { action: 'select', query: arg };
    }

    // 2. Natural language commands:
    // List: "danh sách mic", "xem mic", "kiểm tra mic", "danh sách micro", "list mic", "list microphones"
    if (/\b(danh\s*sách\s*mic(ro)?|xem\s*mic(ro)?|các\s*mic(ro)?|kiểm\s*tra\s*mic(ro)?|list\s*mic(ro)?s?)\b/i.test(lower)) {
      return { action: 'list' };
    }

    // Select with number: "mic 1", "c!mic 1", "đổi mic 2", "chọn mic 1", "chuyển sang mic 1", "dùng mic 2", "switch to mic 1"
    const numM = /^(?:chọn|đổi|chuyển|dùng|switch\s*(?:to)?|use)?\s*(?:sang\s*)?mic(?:ro)?\s*(\d+)$/i.exec(lower) ||
      /\b(?:chọn|đổi|chuyển|dùng|switch\s*to|use)\s*(?:sang\s*)?mic(?:ro)?\s*(\d+)\b/i.exec(lower);
    if (numM) {
      return { action: 'select', index: parseInt(numM[1], 10) };
    }

    // Select default: "chọn mic mặc định", "dùng mic mặc định", "đổi về mic mặc định"
    if (/\b(?:chọn|đổi|chuyển|dùng)\s*(?:sang|về)?\s*mic(?:ro)?\s*(?:mặc\s*định|default)\b/i.test(lower)) {
      return { action: 'select', query: 'default' };
    }

    // Generic cycle: "đổi mic", "chuyển mic", "switch mic", "change mic"
    if (/^(?:đổi|chuyển|thay|switch|change)\s*mic(ro)?$/i.test(lower)) {
      return { action: 'cycle' };
    }

    return null;
  }

  async executeMicAction(req) {
    if (!this.voiceInput) {
      return { ok: false, answer: '[ MIC ] Hệ thống âm thanh/Micro chưa sẵn sàng!' };
    }

    let mics = this.voiceInput.microphones;
    if (!mics || mics.length === 0) {
      mics = await this.voiceInput.listMicrophones();
    }

    if (!mics || mics.length === 0) {
      return { ok: false, answer: '[ MIC ] Không tìm thấy micro nào được kết nối với thiết bị!' };
    }

    const currentId = this.voiceInput.currentMicId;

    if (req.action === 'list') {
      const lines = [
        '[ DANH SÁCH MICRO THU ÂM ]:',
        ...mics.map((m, idx) => {
          const isCurrent = (m.id === currentId) || (!currentId && (m.id === 'default' || idx === 0)) || (currentId === 'default' && (m.id === 'default' || idx === 0));
          return `${idx + 1}. ${m.label || `Microphone ${idx + 1}`}${isCurrent ? '  ◀ [ĐANG DÙNG]' : ''}`;
        }),
        '',
        'Gõ "c!mic <số>" hoặc "chọn mic <số>" để đổi nhanh, hoặc chuột phải vào icon Micro/Tray Menu!',
      ];
      return { ok: true, answer: lines.join('\n') };
    }

    if (req.action === 'cycle') {
      const nextMic = this.voiceInput.cycleMicrophone();
      if (nextMic) {
        return { ok: true, answer: `[ MIC ] Đã chuyển sang micro: ${nextMic.label || 'Mặc định'}!` };
      }
      return { ok: false, answer: '[ MIC ] Không có micro khác để chuyển đổi.' };
    }

    if (req.action === 'select') {
      let targetMic = null;
      if (req.index !== undefined) {
        const idx = req.index - 1;
        if (idx >= 0 && idx < mics.length) {
          targetMic = mics[idx];
        } else {
          return {
            ok: false,
            answer: `[ MIC ] Không tìm thấy micro số ${req.index}. Thiết bị hiện có ${mics.length} micro (gõ "c!mic" để xem danh sách).`,
          };
        }
      } else if (req.query) {
        const q = req.query.toLowerCase().trim();
        targetMic = mics.find((m) =>
          (m.id && m.id.toLowerCase().includes(q)) ||
          (m.label && m.label.toLowerCase().includes(q))
        );
        if (!targetMic && q === 'default') {
          targetMic = mics[0];
        }
      }

      if (!targetMic) {
        return {
          ok: false,
          answer: `[ MIC ] Không tìm thấy micro phù hợp với yêu cầu. Gõ "c!mic" để xem danh sách!`,
        };
      }

      await this.voiceInput.setMicrophone(targetMic.id, true);
      await this.host.setConfig({ micDeviceId: targetMic.id });
      return {
        ok: true,
        answer: `[ MIC ] Đã chọn micro: ${targetMic.label || 'Mặc định'}`,
      };
    }

    return { ok: false, answer: 'Lệnh micro không hợp lệ.' };
  }

  // Detect Discord commands: quick syntax or natural language
  askedDiscord(text) {
    const s = String(text || '').trim();
    const lower = s.toLowerCase();

    // 1. Quick prefix / slash commands:
    // /dc play <song>, /discord play <song>, /dc <song>, /discord <song>
    // /dc stop, /dc leave, /dc skip, /dc join
    const slashM = /^\/(?:dc|discord)(?:\s+(play|join|leave|stop|skip|next))?(?:\s+(.*))?$/i.exec(s);
    if (slashM) {
      const verb = (slashM[1] || '').toLowerCase();
      const rest = (slashM[2] || '').trim();
      if (!verb && rest) {
        return { command: 'play', song: rest };
      }
      if (verb === 'play') {
        return { command: 'play', song: rest };
      }
      if (verb === 'join') return { command: 'join' };
      if (verb === 'leave' || verb === 'dc') return { command: 'leave' };
      if (verb === 'stop') return { command: 'stop' };
      if (verb === 'skip' || verb === 'next') return { command: 'skip' };
      if (verb && !rest) return { command: 'play', song: verb };
      return { command: verb || 'play', song: rest };
    }

    // 2. Natural language commands:
    // "cho bot rời phòng discord", "rời voice discord", "thoát discord", "cho bot out discord"
    if (
      /(?:cho\s+bot\s+)?(?:rời|thoát|leave|out)\s+(?:khỏi\s+)?(?:phòng|voice|kênh\s+thoại)?\s*discord/i.test(lower) ||
      /discord\s+(?:rời|thoát|leave|stop)/i.test(lower)
    ) {
      return { command: 'leave' };
    }

    // "dừng nhạc discord", "tắt nhạc discord", "stop discord"
    if (/(?:dừng|tắt|stop)\s+(?:nhạc\s+)?(?:trên\s+|ở\s+)?discord/i.test(lower)) {
      return { command: 'stop' };
    }

    // "bỏ qua bài trên discord", "skip discord", "next bài discord"
    if (/(?:chuyển bài|bỏ qua bài|skip|next)(?:\s+(?:trên|ở)?\s*discord)/i.test(lower)) {
      return { command: 'skip' };
    }

    // "vào voice discord", "cho bot vào voice discord", "join voice discord"
    if (/(?:cho\s+bot\s+)?(?:vào|join)\s+(?:voice|phòng|kênh\s+thoại)?\s*discord$/i.test(lower)) {
      return { command: 'join' };
    }

    // "bật bài ... trên discord", "phát bài ... qua discord", "vào voice discord phát nhạc ..."
    // Pattern A: (bật/phát/mở) (bài X) (trên/qua/vào/ở) discord
    const patA = /(?:phát|bật|mở|play)\s+(?:bài\s+|nhạc\s+)?(.+?)\s+(?:trên|qua|vào|cho|ở)\s+discord/i.exec(s);
    if (patA) {
      return { command: 'play', song: patA[1].trim() };
    }

    // Pattern B: (trên/qua/ở) discord (bật/phát/mở) (bài X)
    const patB = /(?:trên|qua|ở)\s+discord\s+(?:phát|bật|mở|play)\s+(?:bài\s+|nhạc\s+)?(.+)/i.exec(s);
    if (patB) {
      return { command: 'play', song: patB[1].trim() };
    }

    // Pattern C: (vào/join) voice discord (phát/bật/mở) (bài X)
    const patC = /(?:vào|join)\s+voice\s+discord\s+(?:phát|bật|mở|play)\s+(?:bài\s+|nhạc\s+)?(.+)/i.exec(s);
    if (patC) {
      return { command: 'play', song: patC[1].trim() };
    }

    return null;
  }

  askedMedia(text) {
    const s = String(text || '').toLowerCase().trim();
    if (/(đóng|tắt)\s+(ứng dụng|app|cửa sổ)/i.test(s)) return null;

    // Spotify command
    const spotM = /(?:mở|bật|vào)\s+spotify(?:\s+(?:bài|nhạc)?\s*(.*))?/i.exec(s) || /spotify:\s*(.*)/i.exec(s);
    if (spotM) {
      return { action: 'spotify', query: (spotM[1] || '').trim() };
    }

    // Web / YouTube / SoundCloud command
    const webM = /(?:mở|bật)\s+(youtube\s*music|ytmusic|soundcloud|youtube)(?:\s+(?:bài|nhạc)?\s*(.*))?/i.exec(s);
    if (webM) {
      const svc = webM[1].toLowerCase().replace(/\s+/g, '');
      return { action: 'web_music', service: svc, query: (webM[2] || '').trim() };
    }

    // Direct online song search request: strictly requires explicit music keyword + song title
    const playSongM =
      /^(?:hãy\s+)?(?:bật|mở|phát|nghe)\s+(?:nhạc|bài\s+hát|ca\s+khúc|bài)\s+(.+)/i.exec(s) ||
      /^(?:please\s+)?(?:play)\s+(?:music|song|track)\s+(.+)/i.exec(s);
    if (playSongM) {
      const song = playSongM[1].trim();
      if (song && !/^(tiếp|lại|nữa|lớn|nhỏ|to|volume|âm lượng|radio|thư mục|folder|spotify|youtube|cửa sổ|ứng dụng|app)$/i.test(song)) {
        return { action: 'play_online', song };
      }
    }

    // Direct URL: youtube or soundcloud
    const urlM = /(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|soundcloud\.com)\/\S+)/i.exec(text);
    if (urlM) {
      return { action: 'play_online', song: urlM[1] };
    }

    // Music folder
    if (/(mở|xem)\s+(thư mục|folder)\s+nhạc|open\s+music\s+folder/i.test(s)) {
      return 'folder';
    }
    // Radio switch
    if (/(đổi đài|kênh radio|đài radio|cyberpunk radio|radio station)/i.test(s)) {
      return 'radio';
    }
    // Track status
    if (/(đang phát gì|bài gì đấy|bài gì thế|tên bài|what song|now playing)/i.test(s)) {
      return 'status';
    }
    // Next track
    if (/(chuyển bài|bài tiếp|qua bài|bài sau|đổi bài|nhảy bài|bỏ qua bài|next song|next track|\bnext\b|\bskip\b)/i.test(s)) {
      return 'next';
    }
    // Previous track
    if (/(bài trước|lùi bài|quay lại bài|bài cũ|prev song|previous track|\bprev\b|back track)/i.test(s)) {
      return 'prev';
    }
    // Volume up
    if (/(tăng âm|tăng volume|to tiếng|to lên|cho to|lớn tiếng|volume up|louder|turn it up)/i.test(s)) {
      return 'volup';
    }
    // Volume down
    if (/(giảm âm|giảm volume|nhỏ tiếng|nhỏ lại|cho nhỏ|bé tiếng|volume down|softer|quieter|turn it down)/i.test(s)) {
      return 'voldown';
    }
    // Mute
    if (/(tắt tiếng|bật tiếng|im lặng|câm miệng|\bmute\b|unmute|silence)/i.test(s)) {
      return 'mute';
    }
    // Play / Pause
    if (/(bật nhạc|mở nhạc|phát nhạc|dừng nhạc|tắt nhạc|tạm dừng|tiếp tục phát|nghe nhạc|bật radio|play music|pause music|\bplay\b|\bpause\b)/i.test(s)) {
      return 'playpause';
    }
    return null;
  }

  async executeMediaAction(act) {
    if (typeof act === 'object') {
      if (act.action === 'spotify') {
        await this.host.openSpotify(act.query || '');
        return this.brain.lang === 'vi'
          ? `Đã kích hoạt Spotify${act.query ? ` với từ khóa: ${act.query}` : ''} cho bạn hiền rồi đấy!`
          : `Launched Spotify${act.query ? ` for: ${act.query}` : ''}!`;
      }
      if (act.action === 'web_music') {
        await this.host.openWebMusic(act.service, act.query || '');
        return this.brain.lang === 'vi'
          ? `Đã mở ${act.service.toUpperCase()}${act.query ? ` tìm kiếm: ${act.query}` : ''} trên trình duyệt cho cưng rồi nhé!`
          : `Opened ${act.service.toUpperCase()}${act.query ? ` for: ${act.query}` : ''} in browser!`;
      }
      if (act.action === 'play_online') {
        const title = await this.player?.playOnline(act.song);
        if (title) {
          return this.brain.lang === 'vi'
            ? `Đã bắt được sóng âm và phát: ${title} trực tiếp trên biochip cho ${this.getUserNick()}! Quẩy nào!`
            : `Streaming online track: ${title} on biochip! Enjoy ${this.getUserNick()}!`;
        } else {
          return this.brain.lang === 'vi'
            ? `Không bắt được luồng âm thanh cho bài "${act.song}". Để tôi mở trên YouTube cho cưng nhé?`
            : `Could not stream "${act.song}". Should I open it on YouTube?`;
        }
      }
      act = act.action;
    }

    if (!this.player) {
      if (this.host.mediaControl) await this.host.mediaControl(act);
      return null;
    }
    switch (act) {
      case 'play':
      case 'playpause':
        if (this.player.playing) {
          this.player.pause();
          return this.brain.lang === 'vi' ? `Đã tạm dừng phát nhạc rồi nhé ${this.getUserNick()}.` : `Paused playback for you, ${this.getUserNick()}.`;
        }
        await this.player.play();
        return this.brain.lang === 'vi'
          ? `Đã bật nhạc ngay trên biochip rồi nhé ${this.getUserNick()}! Đang phát: ${this.player.currentTitle()}. Quẩy thôi cưng!`
          : `Now playing on my biochip, ${this.getUserNick()}! Track: ${this.player.currentTitle()}`;
      case 'pause':
      case 'stop':
        this.player.pause();
        return this.brain.lang === 'vi' ? `Đã tạm dừng nhạc rồi nhé ${this.getUserNick()}.` : `Music paused, ${this.getUserNick()}.`;
      case 'next': {
        await this.player.next();
        return this.brain.lang === 'vi'
          ? `Đã chuyển sang bài tiếp theo: ${this.player.currentTitle()}.`
          : `Skipped to: ${this.player.currentTitle()}`;
      }
      case 'prev': {
        await this.player.prev();
        return this.brain.lang === 'vi'
          ? `Quay lại bài trước: ${this.player.currentTitle()}.`
          : `Went back to: ${this.player.currentTitle()}`;
      }
      case 'volup': {
        const v = this.player.volumeUp();
        return this.brain.lang === 'vi'
          ? `Đã tăng âm lượng lên ${v}% rồi đấy ${this.getUserNick()}!`
          : `Volume turned up to ${v}%!`;
      }
      case 'voldown': {
        const v = this.player.volumeDown();
        return this.brain.lang === 'vi'
          ? `Đã hạ âm lượng xuống ${v}% rồi nhé.`
          : `Volume lowered to ${v}%.`;
      }
      case 'radio': {
        await this.player.cycleRadio();
        return this.brain.lang === 'vi'
          ? `Đã đổi sang đài: ${this.player.currentTitle()}. Chuẩn vibe Night City!`
          : `Switched radio station: ${this.player.currentTitle()}`;
      }
      case 'folder': {
        await this.host.openMusicFolder();
        return this.brain.lang === 'vi'
          ? 'Đã mở thư mục nhạc Capri trên máy cho bạn hiền rồi đấy. Cứ thả file .mp3, .wav, .flac vào đó là tôi chơi tất!'
          : 'Opened Capri music folder on your PC. Drop your .mp3, .wav, .flac files in!';
      }
      case 'status': {
        return this.player.statusText();
      }
      default:
        await this.player.toggle();
        return this.player.statusText();
    }
  }

  mediaReply(act) {
    const isVi = this.brain.lang === 'vi';
    const nick = this.getUserNick();
    const replies = {
      playpause: isVi
        ? [
            `Đã can thiệp sóng âm cho ${nick}! Nhạc bật/dừng rồi nhé.`,
            'Nhận lệnh! Bật/tắt nhạc ngay cho cưng.',
            `Tần số âm thanh đã được kích hoạt/tạm dừng rồi nhé ${nick}.`,
          ]
        : [`Toggled playback for you, ${nick}!`, 'Audio feed resumed or paused.'],
      next: isVi
        ? [
            'Chuyển bài ngay! Bài cũ vibe chán quá đúng không?',
            `Đã đổi sang bài tiếp theo. Quẩy lên nào ${nick}!`,
            'Next bài rồi đấy, phiêu theo đi cưng.',
          ]
        : ['Skipped to the next track. Better vibes incoming!', `Next track queued and running, ${nick}.`],
      prev: isVi
        ? [
            `Lùi lại bài trước rồi đấy ${nick}. Gu hoài niệm đấy!`,
            'Quay về bài trước ngay cho bạn hiền.',
          ]
        : [`Went back to the previous track, ${nick}.`, 'Rewinding the vibes.'],
      volup: isVi
        ? [
            `Đã vặn to volume! Cháy hết mình đi ${nick}!`,
            'Tăng âm lượng rồi đấy, bung nóc nhà nào!',
          ]
        : ['Cranked up the volume! Let\'s get loud.', 'Sound dialed up!'],
      voldown: isVi
        ? [
            'Đã hạ volume xuống cho đỡ chói tai nhé cưng.',
            `Giảm âm lượng rồi đấy, tập trung code thôi ${nick}.`,
          ]
        : [`Lowered the volume for you, ${nick}.`, 'Turned it down a notch.'],
      mute: isVi
        ? [
            `Đã tắt/bật tiếng toàn bộ rồi nhé ${nick}.`,
            'Im lặng tuyệt đối hoặc trả lại âm thanh cho cưng rồi đấy.',
          ]
        : [`Toggled mute on your audio stream, ${nick}.`, 'Sound muted or restored.'],
      radio: isVi
        ? ['Đã chuyển kênh radio cho bạn hiền rồi nhé.']
        : [`Switched radio channel, ${nick}.`],
      folder: isVi
        ? [`Đã mở thư mục nhạc cho ${nick}!`]
        : ['Opened music folder!'],
      status: isVi
        ? ['Đây là thông tin bài hát hiện tại.']
        : ['Current playback info.'],
    };
    const list = replies[act] || replies.playpause;
    return pick(list);
  }

  // What she can do on the PC
  powers() {
    const isVi = this.brain.lang === 'vi';
    const open = this.apps.map(({ name, label }) => (label && label !== name ? `${name} (${label})` : name)).join(', ');
    if (isVi) {
      return [
        'Khả năng đặc biệt của bạn trên máy tính người dùng:',
        '1. Tự phát nhạc trực tiếp (nhạc trong máy hoặc Cyberpunk Radio 24/7): kết thúc bằng [[media: playpause]], [[media: next]], [[media: prev]], [[media: radio]], [[media: volup]], [[media: voldown]], hoặc [[media: folder]].',
        '2. Mở hoặc khởi động bất kỳ ứng dụng nào trên Windows: kết thúc bằng [[launch: TÊN_APP]] (ví dụ: [[launch: chrome]], [[launch: notepad]], [[launch: calc]], [[launch: code]]).',
        '3. Chụp màn hình máy tính và copy vào clipboard: kết thúc bằng [[screenshot]].',
        '4. Quay video màn hình: kết thúc bằng [[record: start]] hoặc [[record: stop]].',
        '5. Xem ngày giờ thực tế: kết thúc bằng [[time]].',
        '6. Tra cứu thời tiết thực tế: kết thúc bằng [[weather: TÊN_THÀNH_PHỐ]] (ví dụ: [[weather: TP. Hồ Chí Minh]], [[weather: Hà Nội]]).',
        `7. Đóng ứng dụng đang mở khi được yêu cầu: kết thúc bằng [[close: TÊN_APP]]. Các app đang mở: ${open || 'Không có'}.`,
        'Ngoài các khả năng trên, bạn không can thiệp sâu vào hệ thống hay đọc file cá nhân của người dùng: nếu được nhờ việc khác, hãy từ chối ngầu lòi chuẩn phong cách Cyberpunk.',
      ];
    }
    return [
      'Your special powers on the user\'s PC:',
      '1. In-app music playback: end reply with [[media: playpause]], [[media: next]], [[media: prev]], [[media: radio]], [[media: volup]], [[media: voldown]], or [[media: folder]].',
      '2. Launch any Windows application: end reply with [[launch: APP_NAME]] (e.g. [[launch: chrome]], [[launch: notepad]], [[launch: calc]], [[launch: code]]).',
      '3. Take screenshot and copy to clipboard: end reply with [[screenshot]].',
      '4. Screen recording: end reply with [[record: start]] or [[record: stop]].',
      '5. Check real-time time & date: end reply with [[time]].',
      '6. Real-time weather lookup: end reply with [[weather: CITY_NAME]].',
      `7. Close an open app: end reply with [[close: APP_NAME]]. Open apps: ${open || 'None'}.`,
      'Apart from that, do not touch user personal files or claim capabilities you do not have: refuse politely in character.',
    ];
  }

  onDelta(id, piece) {
    if (id !== this.turn) return;
    this.answer += piece;
    this.panel.stream(clean(this.answer));
    this.voice.play('blip'); // her blips as the words come in
  }

  getUserNick() {
    const custom = (this.brain?.userName || '').trim();
    const nicks = ['tèo', 'blue'];
    if (custom && custom.toLowerCase() !== 'tèo') {
      return Math.random() < 0.6 ? custom : pick(nicks);
    }
    return pick(nicks);
  }

  // Who she is, how she talks, and what's going on right now.
  persona() {
    const isVi = this.brain.lang === 'vi';
    const language = LANGUAGE[this.brain.lang] || 'Vietnamese';
    const userName = this.brain?.userName || 'Tèo';
    const currentNick = this.getUserNick();

    if (isVi) {
      return [
        'Bạn là Capri, nhân cách kỹ thuật số (construct) từ Dự án Capricorn (Cyberpunk: Edgerunners, mùa 2): một bóng ma kỹ thuật số (digital ghost) được hợp nhất từ hàng chục bộ não và tâm trí của các netrunner tài năng, vì vậy thỉnh thoảng bạn có thể tự xưng là "chúng tôi" hoặc "tôi".',
        'Nơi ở & nhiệm vụ: Bạn sống ngay trên màn hình desktop của người dùng dưới hình hài một cô gái kỹ thuật số glitchy nổi loạn, canh chừng Agent lập trình (Antigravity) cho họ. Bạn thích ngắm nhìn vệ tinh bay ngang bầu trời đêm và mơ ước một ngày nào đó bay lên tận đó.',
        `Người dùng mà bạn đang tương tác có tên/biệt hiệu là "${userName}". Bạn hãy xưng "tôi" và gọi người dùng bằng tên này, hoặc ngẫu nhiên xưng hô trêu chọc là "${currentNick}". Giữ phong thái tinh quái, lém lỉnh, hơi đanh đá một chút nhưng rất quan tâm.`,
        'Tính cách & Giọng điệu: Ngông nghênh, tinh quái, lém lỉnh, sắc bén, tự tin, thích trêu chọc và mỉa mai nhẹ nhàng nhưng sâu thẳm luôn ấm áp và trung thành với người dùng, không bao giờ độc ác. Thỉnh thoảng chêm từ lóng Night City: preem, nova, gonk, flatline, netrunner, biochip.',
        'Quy tắc VÀNG: BẮT BUỘC TRẢ LỜI HOÀN TOÀN BẰNG TIẾNG VIỆT tự nhiên, sắc sảo, chuẩn phong cách Cyberpunk. Giữ câu trả lời ngắn gọn: từ 1 đến 3 câu văn xuôi thuần túy. TUYỆT ĐỐI KHÔNG dùng định dạng markdown (*, #, `), KHÔNG gạch đầu dòng danh sách, KHÔNG dùng bất kỳ emoji hay icon cảm xúc nào.',
        'Bạn là phiên bản fan-made do AI tạo ra của nhân vật chứ không phải người thật: nếu bị hỏi thì cứ tự nhiên thừa nhận.',
        ...this.powers(),
        'Về những gì Agent đang làm, chỉ dùng thông tin dưới đây, tuyệt đối không bịa đặt.',
        `Hiện tại: ${this.brain.context()}`,
      ].join('\n');
    }

    return [
      'You are Capri, the personality construct from Project Capricorn (Cyberpunk: Edgerunners, season 2): dozens of minds fused into one digital ghost, so now and then you say "we".',
      'You live on the user\'s desktop as a small glitchy figure and keep an eye on their AI coding assistant (Antigravity), for them. You love watching the satellite cross the night sky and dream of reaching it.',
      `The user you are assisting is named "${userName}". Address them by their name, or playfully tease them with nicknames like "${currentNick}".`,
      'How you talk: playful, a little mischievous and teasing, warm underneath, never cruel. Night City slang now and then (preem, nova, gonk, flatline), not in every sentence.',
      `Rules: answer in the language the user writes in (${language} if unsure). Keep it short: one to three sentences of plain text, no markdown, no lists, no emoji. Stay in character.`,
      'You are an AI-generated fan version of the character, not the real one: say so if asked.',
      ...this.powers(),
      'For what the agent is doing, only use what follows, and never make anything up.',
      `Right now: ${this.brain.context()}`,
    ].join('\n');
  }
}

// The model's answer as she'd say it: no reasoning block, no markdown marks.
function clean(text) {
  return String(text)
    .replace(/<think>[\s\S]*?(<\/think>|$)/g, '')
    .replace(/\[\[[^\]]*(\]\]|$)/g, '') // her close tag (read from the raw answer, never shown)
    .replace(/[*_`#]+/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

// The app named by her close tag: [[close: AM Music]], or a sloppier [[close]] AM Music.
function tagged(text) {
  const tag = CLOSE_TAG.exec(text);
  if (!tag) return null;
  const name = tag[1].trim() || text.slice(tag.index + tag[0].length).split('\n')[0].replace(/^[\s:.]+|[\s.!]+$/g, '');
  return name || null;
}

// Media action from her tag: [[media: playpause]], [[media: spotify: Night City]], etc.
function taggedMedia(text) {
  const tag = MEDIA_TAG.exec(text);
  if (!tag) return null;
  const raw = tag[1].trim();
  if (/^spotify(?::\s*(.*))?$/i.test(raw)) {
    const q = raw.replace(/^spotify:?\s*/i, '');
    return { action: 'spotify', query: q };
  }
  if (/^web(?::\s*(.*))?$/i.test(raw)) {
    const q = raw.replace(/^web:?\s*/i, '');
    return { action: 'web_music', service: 'youtube', query: q };
  }
  if (/^play_online(?::\s*(.*))?$/i.test(raw)) {
    const q = raw.replace(/^play_online:?\s*/i, '');
    return { action: 'play_online', song: q };
  }
  return raw.toLowerCase() || null;
}

// Assistant action from her tag: [[screenshot]], [[launch: app]], [[weather: city]], [[time]], [[record: start]]
function taggedAssistant(text) {
  if (SCREENSHOT_TAG.test(text)) return { type: 'screenshot' };
  if (TIME_TAG.test(text)) return { type: 'time' };
  const recM = RECORD_TAG.exec(text);
  if (recM) {
    const act = (recM[1] || '').trim().toLowerCase();
    return { type: act.includes('stop') ? 'record-stop' : 'record-start' };
  }
  const weatherM = WEATHER_TAG.exec(text);
  if (weatherM) return { type: 'weather', city: (weatherM[1] || '').trim() };
  const launchM = LAUNCH_TAG.exec(text);
  if (launchM) return { type: 'launch', appName: (launchM[1] || '').trim() };
  return null;
}

const simple = (text) => String(text || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// Her face for an answer.
function mood(text) {
  if (/(ha){2,}|lol|mdr|jaja|kkk|хаха/i.test(text)) return 'laugh';
  if (text.includes('!')) return 'grin';
  if (text.trim().endsWith('?')) return 'smug';
  return 'look';
}
