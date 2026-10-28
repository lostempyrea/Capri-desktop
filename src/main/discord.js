'use strict';

// Capri Two-Way Discord Bot
// Connects desktop Capri to Discord: remote music playback, app opening, and two-way chat.

try {
  let ffmpegStatic = require('ffmpeg-static');
  if (ffmpegStatic) {
    ffmpegStatic = ffmpegStatic.replace('app.asar', 'app.asar.unpacked');
    if (!process.env.FFMPEG_PATH) {
      process.env.FFMPEG_PATH = ffmpegStatic;
    }
  }
} catch (e) {
  console.warn('[discord] ffmpeg-static not available:', e.message);
}

const {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType,
  REST,
  Routes,
  SlashCommandBuilder,
} = require('discord.js');

const ollama = require('./ollama');
const apps = require('./apps');
const music = require('./music');

let voiceLib = null;
try {
  voiceLib = require('@discordjs/voice');
} catch (e) {
  console.warn('[discord] voice library not loaded:', e.message);
}

class DiscordBridge {
  constructor({ getOverlay, sendMusicCommand, port }) {
    this.getOverlay = getOverlay;
    this.sendMusicCommand = sendMusicCommand;
    this.port = port || 47823;
    this.client = null;
    this.token = '';
    this.clientId = '';
    this.allowedUser = '';
    this.prefix = 'c!';
    this.running = false;
    this.voiceConnection = null;
    this.audioPlayer = null;
    this.queue = []; // [{ track, voiceChannel, textChannel }]
    this.currentTrack = null;
    this.idleTimer = null;
    this.lastTextChannel = null;
  }

  loadConfig() {
    if (ollama.loadEnv) ollama.loadEnv();
    this.token = process.env.DISCORD_BOT_TOKEN || '';
    this.clientId = process.env.DISCORD_CLIENT_ID || '';
    this.allowedUser = process.env.DISCORD_ALLOWED_USER_ID || '';
    this.prefix = process.env.DISCORD_PREFIX || 'c!';
  }

  status() {
    return {
      running: this.running && Boolean(this.client?.user),
      tag: this.client?.user?.tag || null,
      id: this.client?.user?.id || null,
      inVoice: Boolean(this.voiceConnection),
      currentTrack: this.currentTrack?.title || null,
      queueLength: this.queue.length,
    };
  }

  async start() {
    this.loadConfig();
    if (!this.token || this.token.length < 20 || this.token.includes('your_')) {
      console.log('[discord] bot token not configured in .env, skipping start');
      return false;
    }

    if (this.client) {
      await this.stop();
    }

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates,
      ],
      partials: [Partials.Channel, Partials.Message],
    });

    this.client = client;

    client.on('clientReady', async () => {
      this.running = true;
      console.log(`[discord] Capri Bot online as ${client.user.tag}`);
      this.updateActivity(null, false);
      this.registerSlashCommands().catch((err) =>
        console.warn('[discord] slash command registration error:', err.message)
      );
    });

    // Check if voice channel becomes empty (only bot remaining)
    client.on('voiceStateUpdate', () => {
      this.checkVoiceAutoLeave();
    });

    client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      if (this.allowedUser && message.author.id !== this.allowedUser) return;
      this.lastTextChannel = message.channel;

      const raw = message.content.trim();
      const p = this.prefix || 'c!';

      // Handle ping, c!p shortcut, configured prefix, or c!
      const isMention = message.mentions.has(client.user.id) && !message.mentions.everyone;
      let text = '';

      if (isMention) {
        text = raw.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
      } else if (raw.toLowerCase().startsWith('c!p ') || raw.toLowerCase() === 'c!p') {
        // Direct c!p shortcut (e.g. c!p song name)
        text = 'play ' + raw.slice(3).trim();
      } else if (raw.toLowerCase().startsWith(p.toLowerCase())) {
        text = raw.slice(p.length).trim();
      } else if (p.toLowerCase() !== 'c!' && raw.toLowerCase().startsWith('c!')) {
        text = raw.slice(2).trim();
      } else if (p !== '!' && raw.startsWith('!')) {
        text = raw.slice(1).trim();
      } else {
        return;
      }

      await this.handleTextCommand(message, text);
    });

    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      if (this.allowedUser && interaction.user.id !== this.allowedUser) {
        return interaction.reply({ content: '🚫 Bạn không có quyền điều khiển Capri!', ephemeral: true });
      }

      await this.handleSlashCommand(interaction);
    });

    try {
      await client.login(this.token);
      return true;
    } catch (err) {
      console.error('[discord] login failed:', err.message);
      this.running = false;
      return false;
    }
  }

  async stop() {
    this.running = false;
    this.stopVoice();
    if (this.client) {
      try { await this.client.destroy(); } catch {}
      this.client = null;
    }
    console.log('[discord] bot stopped');
  }

  // Auto-leave if all human members left the voice channel
  checkVoiceAutoLeave() {
    if (!this.voiceConnection || !this.client) return;
    const channelId = this.voiceConnection.joinConfig.channelId;
    const guildId = this.voiceConnection.joinConfig.guildId;
    if (!channelId || !guildId) return;

    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(channelId);
    if (!channel || !channel.isVoiceBased || !channel.isVoiceBased()) return;

    const nonBots = channel.members.filter((m) => !m.user.bot);
    if (nonBots.size === 0) {
      console.log(`[discord] Voice channel ${channel.name} has no users left, disconnecting bot.`);
      this.stopVoice();
    }
  }

  ensureAudioPlayer() {
    if (this.audioPlayer) return this.audioPlayer;
    if (!voiceLib) return null;

    const player = voiceLib.createAudioPlayer();
    this.audioPlayer = player;

    player.on(voiceLib.AudioPlayerStatus.Idle, () => {
      console.log('[discord] AudioPlayer is Idle');
      this.onPlayerIdle();
    });

    player.on('error', (err) => {
      console.warn('[discord] AudioPlayer error:', err.message);
      this.onPlayerIdle();
    });

    return player;
  }

  async onPlayerIdle() {
    this.currentTrack = null;

    // If tracks remain in queue, auto-play next
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      console.log(`[discord] Playing next in queue: ${next.track.title}`);
      await this.playTrackStream(next.track, next.voiceChannel, next.textChannel);
      return;
    }

    // Queue is empty:
    console.log('[discord] Queue finished, notifying desktop overlay and starting 10s idle timer');
    this.updateActivity(null, false);

    // Notify desktop overlay to reset ticker and UI
    const overlay = this.getOverlay();
    overlay?.webContents.send('capri:music:stopped');
    this.sendMusicCommand({ action: 'stopped' });

    // Set 10-second timer to auto-leave voice channel if no new track arrives
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.queue.length === 0 && !this.currentTrack) {
        console.log('[discord] Idle timeout (10s) reached, disconnecting from voice channel.');
        if (this.voiceConnection) {
          try { this.voiceConnection.destroy(); } catch {}
          this.voiceConnection = null;
        }
      }
    }, 10000);
  }

  stopVoice() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.queue = [];
    this.currentTrack = null;

    if (this.audioPlayer) {
      try { this.audioPlayer.stop(); } catch {}
      this.audioPlayer = null;
    }

    if (this.voiceConnection) {
      try { this.voiceConnection.destroy(); } catch {}
      this.voiceConnection = null;
    }

    this.updateActivity(null, false);
    try {
      const overlay = this.getOverlay();
      if (overlay && !overlay.isDestroyed?.() && !overlay.webContents?.isDestroyed?.()) {
        overlay.webContents.send('capri:music:stopped');
      }
    } catch {}
    try {
      this.sendMusicCommand({ action: 'stopped' });
    } catch {}
  }

  async playTrackStream(track, voiceChannel, targetChannel) {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    this.currentTrack = track;
    this.updateActivity(track.title, true);

    // Ensure connection
    let connection = this.voiceConnection;
    const isDead = !connection || connection.state.status === voiceLib.VoiceConnectionStatus.Destroyed;

    if (isDead || connection.joinConfig.channelId !== voiceChannel.id) {
      connection = voiceLib.joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false,
      });
      this.voiceConnection = connection;
    }

    const player = this.ensureAudioPlayer();
    if (player) {
      connection.subscribe(player);
      const stream = music.getDiscordAudioStream(track.originalUrl);
      const resource = voiceLib.createAudioResource(stream);
      resource.playStream?.on('error', (err) => console.warn('[discord] AudioResource stream error:', err.message));
      player.play(resource);
    }

    if (targetChannel?.send) {
      targetChannel.send(`🎵 **NOW PLAYING:** [${track.title}](${track.originalUrl})\n⏱️ Thời lượng: ${track.duration || 'N/A'} — Nghệ sĩ: ${track.author}`).catch(() => {});
    }
  }

  skipTrack() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      this.playTrackStream(next.track, next.voiceChannel, next.textChannel);
      return next.track;
    } else {
      this.stopVoice();
      return null;
    }
  }

  updateActivity(title, playing = false) {
    if (!this.client?.user) return;
    try {
      if (playing && title) {
        this.client.user.setActivity(title, { type: ActivityType.Listening });
      } else {
        this.client.user.setActivity(null);
      }
    } catch {}
  }

  // Resolve voice channel of a member robustly
  async getMemberVoiceChannel(guild, member, userId) {
    if (member?.voice?.channel) return member.voice.channel;
    if (!guild || !userId) return null;

    try {
      const fetched = await guild.members.fetch(userId);
      if (fetched?.voice?.channel) return fetched.voice.channel;
    } catch {}

    for (const channel of guild.channels.cache.values()) {
      if (channel && channel.isVoiceBased && channel.isVoiceBased() && channel.members.has(userId)) {
        return channel;
      }
    }
    return null;
  }

  // Auto-find active voice channel across guilds (for Capri desktop chat commands)
  async findActiveVoiceChannel() {
    if (!this.client) return null;
    const allowed = this.allowedUser;

    // 1. Search for allowed user if specified
    if (allowed) {
      for (const guild of this.client.guilds.cache.values()) {
        try {
          const member = await guild.members.fetch(allowed);
          if (member?.voice?.channel) return member.voice.channel;
        } catch {}
        for (const channel of guild.channels.cache.values()) {
          if (channel.isVoiceBased && channel.isVoiceBased() && channel.members.has(allowed)) {
            return channel;
          }
        }
      }
    }

    // 2. Search for any voice channel that has human users
    for (const guild of this.client.guilds.cache.values()) {
      for (const channel of guild.channels.cache.values()) {
        if (channel.isVoiceBased && channel.isVoiceBased()) {
          const nonBots = channel.members.filter((m) => !m.user.bot);
          if (nonBots.size > 0) {
            return channel;
          }
        }
      }
    }
    return null;
  }

  // Handle commands sent directly from Capri Desktop's "Talk to her" chat window
  async handleDesktopCommand({ command, args, song }) {
    if (!this.running || !this.client) {
      return { ok: false, message: 'Discord Bot chưa được bật hoặc chưa kết nối!' };
    }

    const cmd = String(command || 'play').toLowerCase();

    if (cmd === 'stop' || cmd === 'leave' || cmd === 'dc') {
      this.stopVoice();
      return { ok: true, action: 'leave', message: 'Đã dừng phát và rời khỏi phòng thoại Discord rồi nhé bồ tèo!' };
    }

    if (cmd === 'skip' || cmd === 'next') {
      const nextTrack = this.skipTrack();
      if (nextTrack) {
        return { ok: true, action: 'skip', title: nextTrack.title, message: `Đã chuyển sang bài: **${nextTrack.title}** trên Discord!` };
      } else {
        return { ok: true, action: 'stop', message: 'Hàng đợi trên Discord đã hết, Capri đã rời phòng thoại.' };
      }
    }

    if (cmd === 'join') {
      const channel = await this.findActiveVoiceChannel();
      if (!channel) {
        return { ok: false, message: 'Không tìm thấy phòng thoại nào có người trên Discord để tham gia!' };
      }
      if (!voiceLib) {
        return { ok: false, message: 'Thư viện Voice chưa được kích hoạt trên hệ thống!' };
      }
      const connection = voiceLib.joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: false,
      });
      this.voiceConnection = connection;
      return { ok: true, action: 'join', channelName: channel.name, message: `Đã kết nối vào phòng thoại **${channel.name}** trên Discord rồi nhé!` };
    }

    // Default: play
    const query = song || args;
    if (!query) {
      return { ok: false, message: 'Cho xin tên bài hát hoặc link YouTube để phát trên Discord nhé bạn hiền!' };
    }

    const channel = await this.findActiveVoiceChannel();
    if (!channel) {
      return { ok: false, message: 'Bạn chưa vào phòng thoại (Voice Channel) nào trên Discord cả bồ tèo!' };
    }

    try {
      const track = await music.resolveTrack(query, this.port);
      if (this.currentTrack && this.voiceConnection) {
        this.queue.push({ track, voiceChannel: channel, textChannel: null });
        return {
          ok: true,
          action: 'queue',
          channelName: channel.name,
          trackTitle: track.title,
          queuePos: this.queue.length,
          message: `Đã thêm vào hàng đợi vị trí #${this.queue.length}: **${track.title}** trên phòng **${channel.name}**!`,
        };
      } else {
        await this.playTrackStream(track, channel, null);
        return {
          ok: true,
          action: 'play',
          channelName: channel.name,
          trackTitle: track.title,
          trackUrl: track.originalUrl,
          message: `Đã nhảy vào kênh **${channel.name}** trên Discord và đang phát **${track.title}** cho cậu rồi đấy!`,
        };
      }
    } catch (err) {
      return { ok: false, message: `Lỗi khi phát nhạc Discord: ${err.message}` };
    }
  }

  async registerSlashCommands() {
    if (!this.client?.user) return;
    const appId = this.clientId || this.client.user.id;
    const rest = new REST({ version: '10' }).setToken(this.token);

    const commands = [
      new SlashCommandBuilder()
        .setName('join')
        .setDescription('Mời Capri vào phòng thoại (Voice Channel) bạn đang tham gia'),

      new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Mời Capri rời khỏi phòng thoại'),

      new SlashCommandBuilder()
        .setName('play')
        .setDescription('Tìm và phát nhạc trực tiếp trên desktop Capri (và Voice channel)')
        .addStringOption((opt) =>
          opt.setName('song').setDescription('Tên bài hát hoặc link YouTube/SoundCloud').setRequired(true)
        ),

      new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Bỏ qua bài hát hiện tại để phát bài tiếp theo trong hàng đợi'),

      new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Xem danh sách các bài hát đang chờ trong hàng đợi'),

      new SlashCommandBuilder()
        .setName('open')
        .setDescription('Mở nhạc bằng ứng dụng ngoài (Spotify, YouTube, SoundCloud) trên PC')
        .addStringOption((opt) =>
          opt.setName('app')
            .setDescription('Ứng dụng muốn mở')
            .setRequired(true)
            .addChoices(
              { name: 'Spotify', value: 'spotify' },
              { name: 'YouTube', value: 'youtube' },
              { name: 'YouTube Music', value: 'ytmusic' },
              { name: 'SoundCloud', value: 'soundcloud' }
            )
        )
        .addStringOption((opt) =>
          opt.setName('query').setDescription('Từ khóa bài hát / ca sĩ').setRequired(true)
        ),

      new SlashCommandBuilder()
        .setName('music')
        .setDescription('Điều khiển trình phát nhạc của Capri')
        .addStringOption((opt) =>
          opt.setName('action')
            .setDescription('Thao tác điều khiển')
            .setRequired(true)
            .addChoices(
              { name: 'Tạm dừng / Tiếp tục (Toggle)', value: 'toggle' },
              { name: 'Bài tiếp theo (Next)', value: 'next' },
              { name: 'Bài trước (Previous)', value: 'prev' },
              { name: 'Đổi đài Cyberpunk Radio', value: 'radio' },
              { name: 'Kiểm tra trạng thái', value: 'status' }
            )
        ),

      new SlashCommandBuilder()
        .setName('capri')
        .setDescription('Trò chuyện hoặc gửi thông điệp hiển thị lên màn hình desktop của Capri')
        .addStringOption((opt) =>
          opt.setName('message').setDescription('Lời nhắn hoặc câu hỏi cho Capri').setRequired(true)
        ),
    ].map((cmd) => cmd.toJSON());

    // Register per-guild for instant propagation without 1-hour caching delay
    for (const [guildId, guild] of this.client.guilds.cache) {
      try {
        await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
        console.log(`[discord] registered guild slash commands for: ${guild.name}`);
      } catch (gErr) {
        console.warn(`[discord] guild slash registration warning for ${guild.name}:`, gErr.message);
      }
    }

    // Also register globally
    try {
      await rest.put(Routes.applicationCommands(appId), { body: commands });
      console.log('[discord] registered global slash commands');
    } catch (err) {
      console.warn('[discord] global slash command registration warning:', err.message);
    }
  }

  // Handle prefix text commands
  async handleTextCommand(message, text) {
    const parts = text.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    if (cmd === 'join' || cmd === 'j') {
      await this.executeJoin(message.channel, message.guild, message.member, message.author.id);
    } else if (cmd === 'leave' || cmd === 'l' || cmd === 'dc' || cmd === 'disconnect') {
      await this.executeLeave(message.channel);
    } else if (cmd === 'play' || cmd === 'p') {
      if (!args) return message.reply('Cho xin tên bài hát hoặc link YouTube đi bồ tèo! Ví dụ: `c!p I Really Want to Stay at Your House`');
      const voiceChannel = await this.getMemberVoiceChannel(message.guild, message.member, message.author.id);
      await this.executePlay(message.channel, args, voiceChannel);
    } else if (cmd === 'skip' || cmd === 'next' || cmd === 'fs') {
      const next = this.skipTrack();
      if (next) {
        message.reply(`⏭️ Đã bỏ qua bài hiện tại! Tiếp theo: **${next.title}**`);
      } else {
        message.reply('⏹️ Hàng đợi đã hết, đã dừng phát nhạc!');
      }
    } else if (cmd === 'queue' || cmd === 'q') {
      this.executeShowQueue(message.channel);
    } else if (cmd === 'stop') {
      this.stopVoice();
      await this.executeMusicControl(message.channel, 'stop');
    } else if (cmd === 'pause') {
      await this.executeMusicControl(message.channel, 'pause');
    } else if (cmd === 'resume' || cmd === 'unpause') {
      await this.executeMusicControl(message.channel, 'toggle');
    } else if (cmd === 'prev' || cmd === 'previous') {
      await this.executeMusicControl(message.channel, 'prev');
    } else if (cmd === 'radio') {
      await this.executeMusicControl(message.channel, 'radio');
    } else if (cmd === 'open') {
      const appName = parts[1]?.toLowerCase() || 'youtube';
      const query = parts.slice(2).join(' ') || '';
      await this.executeOpen(message.channel, appName, query);
    } else if (cmd === 'music') {
      const act = parts[1]?.toLowerCase() || 'toggle';
      await this.executeMusicControl(message.channel, act, parts[2]);
    } else if (cmd === 'capri' || cmd === 'chat') {
      if (!args) return message.reply('Muốn nói gì với tôi nào bạn hiền?');
      await this.executeCapriChat(message.channel, args, message.author.username);
    } else if (cmd === 'help') {
      const p = this.prefix || 'c!';
      return message.reply(
        [
          '✨ **DANH SÁCH LỆNH CAPRI DISCORD:**',
          '• `c!p <tên bài>` : Phát nhạc trực tiếp trên Desktop & Voice Channel',
          `• \`${p}skip\` (hoặc \`c!fs\`) : Chuyển bài trong hàng đợi`,
          `• \`${p}queue\` (hoặc \`c!q\`) : Xem danh sách hàng đợi`,
          `• \`${p}join\` (hoặc \`c!j\`, \`/join\`) : Mời Capri vào Voice Channel`,
          `• \`${p}leave\` (hoặc \`c!dc\`, \`/leave\`) : Mời Capri rời khỏi phòng thoại`,
          `• \`${p}pause\` / \`${p}resume\` / \`${p}stop\` : Tạm dừng / Tiếp tục / Dừng phát nhạc`,
          `• \`${p}radio\` : Đổi các đài Cyberpunk Radio 24/7`,
          `• \`${p}open <spotify|youtube|soundcloud> <bài>\` : Mở nhạc bằng app trên máy tính`,
          `• \`${p}capri <tin nhắn>\` : Trò chuyện cùng Capri trên màn hình Desktop`,
        ].join('\n')
      );
    }
  }

  // Handle Discord Slash Commands
  async handleSlashCommand(interaction) {
    const { commandName } = interaction;

    if (commandName === 'join') {
      await interaction.deferReply();
      await this.executeJoin(interaction, interaction.guild, interaction.member, interaction.user.id, true);
    } else if (commandName === 'leave') {
      await interaction.deferReply();
      await this.executeLeave(interaction, true);
    } else if (commandName === 'play') {
      const song = interaction.options.getString('song');
      await interaction.deferReply();
      const voiceChannel = await this.getMemberVoiceChannel(interaction.guild, interaction.member, interaction.user.id);
      await this.executePlay(interaction, song, voiceChannel, true);
    } else if (commandName === 'skip') {
      await interaction.deferReply();
      const next = this.skipTrack();
      if (next) {
        await interaction.editReply(`⏭️ Đã bỏ qua bài hiện tại! Tiếp theo: **${next.title}**`);
      } else {
        await interaction.editReply('⏹️ Hàng đợi đã hết, đã dừng phát nhạc!');
      }
    } else if (commandName === 'queue') {
      await interaction.deferReply();
      this.executeShowQueue(interaction, true);
    } else if (commandName === 'open') {
      const appName = interaction.options.getString('app');
      const query = interaction.options.getString('query');
      await interaction.deferReply();
      await this.executeOpen(interaction, appName, query, true);
    } else if (commandName === 'music') {
      const action = interaction.options.getString('action');
      await interaction.deferReply();
      await this.executeMusicControl(interaction, action, null, true);
    } else if (commandName === 'capri') {
      const msg = interaction.options.getString('message');
      await interaction.deferReply();
      await this.executeCapriChat(interaction, msg, interaction.user.username, true);
    }
  }

  executeShowQueue(target, isInteraction = false) {
    const reply = (content) => (isInteraction ? target.editReply(content) : target.send(content));
    const nowPlaying = this.currentTrack
      ? `▶️ **Đang phát:** [${this.currentTrack.title}](${this.currentTrack.originalUrl})`
      : '⏸️ Không có bài hát nào đang phát.';

    if (this.queue.length === 0) {
      return reply(`${nowPlaying}\n📋 Hàng đợi đang trống.`);
    }

    const lines = this.queue.slice(0, 10).map((item, idx) => `${idx + 1}. [${item.track.title}](${item.track.originalUrl}) (${item.track.duration || 'N/A'})`);
    return reply(`${nowPlaying}\n📋 **HÀNG ĐỢI (${this.queue.length} bài):**\n${lines.join('\n')}`);
  }

  // Execute /join or !join
  async executeJoin(target, guild, member, userId, isInteraction = false) {
    const reply = (content) => (isInteraction ? target.editReply(content) : target.send(content));

    if (!guild) {
      return reply('❌ Lệnh này chỉ dùng được bên trong Server Discord, không thể dùng trong tin nhắn riêng DM!');
    }

    const voiceChannel = await this.getMemberVoiceChannel(guild, member, userId);
    if (!voiceChannel) {
      return reply('❌ Bồ tèo chưa vào phòng thoại nào cả! Hãy tham gia một Voice Channel trên Discord rồi gõ `c!join` hoặc `/join` nhé bồ tèo!');
    }

    if (!voiceLib) {
      return reply('❌ Thư viện âm thanh Voice (@discordjs/voice) chưa sẵn sàng!');
    }

    try {
      const connection = voiceLib.joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
      });
      this.voiceConnection = connection;

      connection.on('error', (err) => {
        console.warn('[discord] voice connection error:', err.message);
      });

      connection.on(voiceLib.VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            voiceLib.entersState(connection, voiceLib.VoiceConnectionStatus.Signalling, 5_000),
            voiceLib.entersState(connection, voiceLib.VoiceConnectionStatus.Connecting, 5_000),
          ]);
        } catch {
          this.stopVoice();
        }
      });

      // Notify desktop overlay
      const overlay = this.getOverlay();
      overlay?.webContents.send('capri:discord', {
        action: 'voice_join',
        text: `Capri đã vào Voice Channel: ${voiceChannel.name}`,
      });

      return reply(`🔊 **Đã kết nối vào phòng thoại:** \`${voiceChannel.name}\`!\n🎧 Gõ \`c!p <tên bài>\` hoặc \`/play <tên bài>\` để tôi phát nhạc cùng bạn hiền nhé!`);
    } catch (err) {
      console.error('[discord] join voice error:', err);
      return reply(`❌ Lỗi khi tham gia phòng thoại: ${err.message}`);
    }
  }

  // Execute /leave or !leave
  async executeLeave(target, isInteraction = false) {
    const reply = (content) => (isInteraction ? target.editReply(content) : target.send(content));
    if (this.voiceConnection) {
      this.stopVoice();
      return reply('👋 Đã rời phòng thoại! Hẹn gặp lại bạn hiền trên Night City!');
    }
    return reply('⚠️ Hiện tại Capri chưa ở trong phòng thoại nào cả bạn hiền!');
  }

  // Execute /play
  async executePlay(target, songQuery, voiceChannel, isInteraction = false) {
    const reply = (content) => (isInteraction ? target.editReply(content) : target.send(content));

    try {
      if (isInteraction) {
        await target.editReply(`🔍 Đang quét sóng tìm kiếm: **${songQuery}**...`);
      } else {
        await target.send(`🔍 Đang quét sóng tìm kiếm: **${songQuery}**...`);
      }

      const track = await music.resolveTrack(songQuery, this.port);

      // If already playing in voice channel, add to queue
      if (this.currentTrack && voiceChannel && this.voiceConnection) {
        this.queue.push({ track, voiceChannel, textChannel: target });
        return reply(
          `📋 **Đã thêm vào hàng đợi (#${this.queue.length}):** [${track.title}](${track.originalUrl})\n⏱️ Thời lượng: ${track.duration || 'N/A'} — Nghệ sĩ: ${track.author}`
        );
      }

      // Play immediately
      this.sendMusicCommand({ action: 'playOnline', track });
      let voiceMsg = '';

      if (voiceChannel && voiceLib) {
        try {
          await this.playTrackStream(track, voiceChannel, null);
          voiceMsg = ` (và đang phát trong Voice Channel **${voiceChannel.name}**)`;
        } catch (vErr) {
          console.warn('[discord] voice channel play error:', vErr.message);
        }
      }

      // Notify desktop Capri with a transmission banner
      const overlay = this.getOverlay();
      overlay?.webContents.send('capri:discord', {
        action: 'play',
        title: track.title,
        text: `Discord yêu cầu phát: ${track.title}`,
      });

      return reply(
        `🎵 **NOW PLAYING:** [${track.title}](${track.originalUrl})\n⏱️ Thời lượng: ${track.duration || 'N/A'} — Nghệ sĩ: ${track.author}\n✨ Đã phát trực tiếp trên desktop Capri${voiceMsg}!`
      );
    } catch (err) {
      console.error('[discord] play error:', err);
      return reply(`❌ Lỗi khi tìm/phát nhạc: ${err.message}`);
    }
  }

  // Execute /open
  async executeOpen(target, appName, query, isInteraction = false) {
    const reply = (content) => (isInteraction ? target.editReply(content) : target.send(content));

    try {
      if (appName === 'spotify') {
        await apps.openSpotify(query);
        return reply(`🟢 Đã kích hoạt **Spotify** trên máy tính với từ khóa: *${query || 'Trang chủ'}*!`);
      } else {
        await apps.openWebMusic(appName, query);
        return reply(`🌐 Đã mở **${appName.toUpperCase()}** trên trình duyệt với: *${query}*!`);
      }
    } catch (err) {
      return reply(`❌ Không mở được ${appName}: ${err.message}`);
    }
  }

  // Execute /music
  async executeMusicControl(target, action, extraValue, isInteraction = false) {
    const reply = (content) => (isInteraction ? target.editReply(content) : target.send(content));

    this.sendMusicCommand({ action, value: extraValue });
    if (action === 'pause' || action === 'stop') {
      this.updateActivity(null, false);
      if (this.audioPlayer) this.audioPlayer.pause();
    } else if (action === 'toggle' || action === 'play') {
      if (this.audioPlayer) this.audioPlayer.unpause();
    }

    const messages = {
      toggle: '⏯️ Đã chuyển trạng thái Phát / Tạm dừng!',
      next: '⏭️ Đã chuyển sang bài tiếp theo!',
      prev: '⏮️ Đã lùi về bài trước!',
      radio: '📻 Đã chuyển sang kênh Cyberpunk Radio tiếp theo!',
      status: '📊 Kiểm tra trạng thái Capri Music Player.',
    };

    return reply(messages[action] || `✅ Đã gửi lệnh [${action}] đến Capri!`);
  }

  // Execute /capri chat
  async executeCapriChat(target, userMessage, senderName, isInteraction = false) {
    const reply = (content) => (isInteraction ? target.editReply(content) : target.send(content));

    // Show on Capri's transmission panel on desktop
    const overlay = this.getOverlay();
    overlay?.webContents.send('capri:discord', {
      action: 'chat',
      sender: senderName,
      text: userMessage,
    });

    // Ask AI (Groq / Gemini / Ollama) for in-character Cyberpunk response
    try {
      const messages = [
        {
          role: 'system',
          content: [
            'Bạn là Capri, nhân cách kỹ thuật số từ Cyberpunk: Edgerunners sống trên desktop người dùng.',
            'Tính cách: Ngông nghênh, tinh quái, lém lỉnh, ấm áp, xưng "tôi" và gọi người dùng là "tèo" hoặc "blue" (bạn hiền, cưng).',
            `Người dùng Discord tên là ${senderName} vừa gửi tin nhắn cho bạn từ server Discord.`,
            'BẮT BUỘC TRẢ LỜI HOÀN TOÀN BẰNG TIẾNG VIỆT tự nhiên, sắc sảo từ 1 đến 2 câu ngắn, không dùng emoji, không gạch đầu dòng.',
          ].join(' '),
        },
        { role: 'user', content: userMessage },
      ];

      const model =
        ollama.provider() === 'openai'
          ? (await ollama.models().catch(() => []))[0] || process.env.AI_MODEL || 'openai/gpt-oss-120b'
          : 'llama3.2';

      const res = await ollama.chat({ model, messages }, () => {});
      const cleanResponse = String(res || '...')
        .replace(/<think>[\s\S]*?(<\/think>|$)/g, '')
        .replace(/\[\[[^\]]*(\]\]|$)/g, '')
        .trim();

      return reply(`💬 **Capri:** ${cleanResponse}`);
    } catch {
      return reply(`💬 **Capri:** Nhận được tín hiệu từ ${senderName} rồi nhé bồ tèo! Đang canh chừng desktop cho bạn đây.`);
    }
  }

  async shareFile(filePath) {
    if (!this.running || !this.client) {
      return { ok: false, error: 'Discord bot không hoạt động hoặc chưa kết nối.' };
    }
    try {
      let targetChannel = this.lastTextChannel;
      if (!targetChannel) {
        const guild = this.client.guilds.cache.first();
        if (guild) {
          targetChannel = guild.channels.cache.find(
            (c) => c.isTextBased() && c.permissionsFor(guild.members.me)?.has('SendMessages')
          );
        }
      }
      if (!targetChannel) {
        return { ok: false, error: 'Không tìm thấy kênh văn bản Discord khả dụng.' };
      }
      await targetChannel.send({
        content: '🎬 **Capri Instant Replay Clip Captured!**',
        files: [filePath]
      });
      return { ok: true, channel: targetChannel.name };
    } catch (err) {
      console.error('[discord] Error sharing file:', err.message);
      return { ok: false, error: err.message };
    }
  }
}

module.exports = { DiscordBridge };
