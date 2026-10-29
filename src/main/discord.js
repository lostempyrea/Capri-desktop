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
const configStore = require('./config-store');

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
    let token = process.env.DISCORD_BOT_TOKEN || '';
    let allowed = process.env.DISCORD_ALLOWED_USER_ID || process.env.DISCORD_USER_ID || '';
    try {
      const cfg = configStore.load();
      if (cfg?.discordToken) token = cfg.discordToken;
      if (cfg?.discordUserId) allowed = cfg.discordUserId;
    } catch {}
    this.token = token;
    this.clientId = process.env.DISCORD_CLIENT_ID || '';
    this.allowedUser = allowed;
    this.prefix = process.env.DISCORD_PREFIX || 'c!';
  }

  async restart(newToken = null) {
    if (newToken) {
      this.token = newToken;
    }
    console.log('[discord] Restarting Capri Discord bridge...');
    await this.stop();
    return await this.start();
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
        return interaction.reply({ content: '🚫 You do not have permission to control Capri!', ephemeral: true });
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
    try {
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

      try {
        this.updateActivity(null, false);
      } catch {}

      try {
        const overlay = this.getOverlay();
        if (overlay && !overlay.isDestroyed?.() && !overlay.webContents?.isDestroyed?.()) {
          overlay.webContents.send('capri:music:stopped');
        }
      } catch {}

      try {
        this.sendMusicCommand({ action: 'stopped' });
      } catch {}
    } catch (err) {
      console.warn('[discord] stopVoice cleanup:', err.message);
    }
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
      targetChannel.send(`🎵 **NOW PLAYING:** [${track.title}](${track.originalUrl})\n⏱️ Duration: ${track.duration || 'N/A'} — Artist: ${track.author}`).catch(() => {});
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

  // Dynamic multi-guild target voice channel resolution
  async resolveTargetVoiceChannel({ userId = null, member = null, guild = null } = {}) {
    if (!this.client) return null;

    // 1. Direct member voice channel if provided and active
    if (member?.voice?.channel) {
      return member.voice.channel;
    }

    // 2. Identify target user ID
    let targetId = userId || member?.id || this.allowedUser;
    if (!targetId) {
      try {
        const cfg = configStore.load();
        targetId = cfg?.discordUserId || '';
      } catch {}
    }

    // 3. Scan specified guild if provided
    if (guild && targetId) {
      try {
        const m = await guild.members.fetch(targetId).catch(() => null);
        if (m?.voice?.channel) return m.voice.channel;
      } catch {}
      for (const channel of guild.channels.cache.values()) {
        if (channel?.isVoiceBased && channel.isVoiceBased() && channel.members.has(targetId)) {
          return channel;
        }
      }
    }

    // 4. Scan all guilds in client.guilds.cache for this user
    if (this.client.guilds?.cache && targetId) {
      const targetLower = String(targetId).toLowerCase();
      for (const g of this.client.guilds.cache.values()) {
        try {
          const m = await g.members.fetch(targetId).catch(() => null);
          if (m?.voice?.channel) return m.voice.channel;
        } catch {}
        for (const channel of g.channels.cache.values()) {
          if (channel?.isVoiceBased && channel.isVoiceBased()) {
            for (const mem of channel.members.values()) {
              if (
                mem.id === targetId ||
                mem.user.id === targetId ||
                mem.user.username.toLowerCase() === targetLower ||
                mem.displayName.toLowerCase() === targetLower
              ) {
                return channel;
              }
            }
          }
        }
      }
    }

    // 5. Fallback: Find voice channel across all guilds with highest human (non-bot) member count
    let bestChannel = null;
    let maxHumans = 0;
    if (this.client.guilds?.cache) {
      for (const g of this.client.guilds.cache.values()) {
        for (const channel of g.channels.cache.values()) {
          if (channel?.isVoiceBased && channel.isVoiceBased()) {
            const nonBots = channel.members.filter((m) => !m.user.bot).size;
            if (nonBots > maxHumans) {
              maxHumans = nonBots;
              bestChannel = channel;
            }
          }
        }
      }
    }

    return bestChannel;
  }

  // Helper to connect/reconnect to a voice channel, destroying stale connection if channel changed
  connectToVoiceChannel(voiceChannel) {
    if (!voiceLib || !voiceChannel) return null;
    let connection = this.voiceConnection;
    const isDead = !connection || connection.state.status === voiceLib.VoiceConnectionStatus.Destroyed;

    if (isDead || connection.joinConfig.channelId !== voiceChannel.id) {
      if (connection && !isDead) {
        try { connection.destroy(); } catch {}
      }
      connection = voiceLib.joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
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
    }

    return connection;
  }

  // Resolve voice channel of a member robustly across current guild and all known guilds
  async getMemberVoiceChannel(guild, member, userId) {
    return await this.resolveTargetVoiceChannel({ userId, member, guild });
  }

  // Auto-find active voice channel across guilds (for Capri desktop chat commands)
  async findActiveVoiceChannel(overrideUser = null) {
    return await this.resolveTargetVoiceChannel({ userId: overrideUser });
  }

  // Handle commands sent directly from Capri Desktop's "Talk to her" chat window
  async handleDesktopCommand({ command, args, song }) {
    if (!this.running || !this.client) {
      return { ok: false, message: 'Discord bot is not enabled or not connected.' };
    }

    const cmd = String(command || 'play').toLowerCase();

    if (cmd === 'stop' || cmd === 'leave' || cmd === 'dc') {
      this.stopVoice();
      return { ok: true, action: 'leave', message: 'Playback stopped and left Discord voice channel, choom!' };
    }

    if (cmd === 'skip' || cmd === 'next') {
      const nextTrack = this.skipTrack();
      if (nextTrack) {
        return { ok: true, action: 'skip', title: nextTrack.title, message: `Skipped to: **${nextTrack.title}** on Discord!` };
      } else {
        return { ok: true, action: 'stop', message: 'Discord queue finished. Capri left the voice channel.' };
      }
    }

    if (cmd === 'join') {
      const channel = await this.resolveTargetVoiceChannel();
      if (!channel) {
        return { ok: false, message: 'No active Discord voice channel with members found to join.' };
      }
      if (!voiceLib) {
        return { ok: false, message: 'Voice library is not active on this system.' };
      }

      this.connectToVoiceChannel(channel);
      return { ok: true, action: 'join', channelName: channel.name, message: `Connected to voice channel **${channel.name}** on Discord!` };
    }

    // Default: play
    const query = song || args;
    if (!query) {
      return { ok: false, message: 'Provide a song title or YouTube link to stream on Discord!' };
    }

    const channel = await this.resolveTargetVoiceChannel();
    if (!channel) {
      return { ok: false, message: 'You are not currently in any Discord voice channel, partner!' };
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
          message: `Added track to queue position #${this.queue.length}: **${track.title}** in **${channel.name}**!`,
        };
      } else {
        this.connectToVoiceChannel(channel);
        await this.playTrackStream(track, channel, null);
        return {
          ok: true,
          action: 'play',
          channelName: channel.name,
          trackTitle: track.title,
          trackUrl: track.originalUrl,
          message: `Joined voice channel **${channel.name}** on Discord and streaming **${track.title}** now!`,
        };
      }
    } catch (err) {
      return { ok: false, message: `Discord playback error: ${err.message}` };
    }
  }

  async registerSlashCommands() {
    if (!this.client?.user) return;
    const appId = this.clientId || this.client.user.id;
    const rest = new REST({ version: '10' }).setToken(this.token);

    const commands = [
      new SlashCommandBuilder()
        .setName('join')
        .setDescription('Invite Capri into the Voice Channel you are currently in'),

      new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Disconnect Capri from the Voice Channel'),

      new SlashCommandBuilder()
        .setName('play')
        .setDescription('Find and play music on desktop Capri and Discord Voice Channel')
        .addStringOption((opt) =>
          opt.setName('song').setDescription('Song title or YouTube/SoundCloud URL').setRequired(true)
        ),

      new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip current song and play next track in queue'),

      new SlashCommandBuilder()
        .setName('queue')
        .setDescription('View queued tracks'),

      new SlashCommandBuilder()
        .setName('open')
        .setDescription('Open music using an external app (Spotify, YouTube, SoundCloud) on PC')
        .addStringOption((opt) =>
          opt.setName('app')
            .setDescription('Target application')
            .setRequired(true)
            .addChoices(
              { name: 'Spotify', value: 'spotify' },
              { name: 'YouTube', value: 'youtube' },
              { name: 'YouTube Music', value: 'ytmusic' },
              { name: 'SoundCloud', value: 'soundcloud' }
            )
        )
        .addStringOption((opt) =>
          opt.setName('query').setDescription('Song query or artist name').setRequired(true)
        ),

      new SlashCommandBuilder()
        .setName('music')
        .setDescription('Control Capri desktop music player')
        .addStringOption((opt) =>
          opt.setName('action')
            .setDescription('Playback control action')
            .setRequired(true)
            .addChoices(
              { name: 'Play / Pause (Toggle)', value: 'toggle' },
              { name: 'Next Track', value: 'next' },
              { name: 'Previous Track', value: 'prev' },
              { name: 'Switch Cyberpunk Radio', value: 'radio' },
              { name: 'Check Player Status', value: 'status' }
            )
        ),

      new SlashCommandBuilder()
        .setName('capri')
        .setDescription('Chat with Capri or display a message on her desktop HUD')
        .addStringOption((opt) =>
          opt.setName('message').setDescription('Message or question for Capri').setRequired(true)
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
      if (!args) return message.reply('Please provide a song title or YouTube link! Example: `c!p I Really Want to Stay at Your House`');
      const voiceChannel = await this.getMemberVoiceChannel(message.guild, message.member, message.author.id);
      await this.executePlay(message.channel, args, voiceChannel);
    } else if (cmd === 'skip' || cmd === 'next' || cmd === 'fs') {
      const next = this.skipTrack();
      if (next) {
        message.reply(`⏭️ Skipped current track! Next up: **${next.title}**`);
      } else {
        message.reply('⏹️ Queue empty, stopped audio playback!');
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
      if (!args) return message.reply('What is on your mind, choom?');
      await this.executeCapriChat(message.channel, args, message.author.username);
    } else if (cmd === 'help') {
      const p = this.prefix || 'c!';
      return message.reply(
        [
          '✨ **CAPRI DISCORD BOT COMMANDS:**',
          `• \`${p}p <song>\` : Play music on Desktop & Discord Voice Channel`,
          `• \`${p}skip\` (or \`${p}fs\`) : Skip current playing song`,
          `• \`${p}queue\` (or \`${p}q\`) : View current track queue`,
          `• \`${p}join\` (or \`${p}j\`, \`/join\`) : Summon Capri to your Voice Channel`,
          `• \`${p}leave\` (or \`${p}dc\`, \`/leave\`) : Disconnect Capri from Voice Channel`,
          `• \`${p}pause\` / \`${p}resume\` / \`${p}stop\` : Playback controls`,
          `• \`${p}radio\` : Switch to next Cyberpunk Radio station`,
          `• \`${p}open <spotify|youtube|soundcloud> <song>\` : Launch app on host PC`,
          `• \`${p}capri <message>\` : Chat with Capri on desktop HUD`,
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
        await interaction.editReply(`⏭️ Skipped current track! Next up: **${next.title}**`);
      } else {
        await interaction.editReply('⏹️ Queue empty, stopped audio playback!');
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
      ? `▶️ **Now Playing:** [${this.currentTrack.title}](${this.currentTrack.originalUrl})`
      : '⏸️ No track is currently playing.';

    if (this.queue.length === 0) {
      return reply(`${nowPlaying}\n📋 Queue is empty.`);
    }

    const lines = this.queue.slice(0, 10).map((item, idx) => `${idx + 1}. [${item.track.title}](${item.track.originalUrl}) (${item.track.duration || 'N/A'})`);
    return reply(`${nowPlaying}\n📋 **QUEUE (${this.queue.length} tracks):**\n${lines.join('\n')}`);
  }

  // Execute /join or !join
  async executeJoin(target, guild, member, userId, isInteraction = false) {
    const reply = (content) => (isInteraction ? target.editReply(content) : target.send(content));

    if (!guild) {
      return reply('❌ This command can only be used inside a Discord server, not in DMs!');
    }

    let voiceChannel = await this.resolveTargetVoiceChannel({ userId, member, guild });
    if (!voiceChannel) {
      return reply('❌ You are not in any voice channel! Please join a Discord Voice Channel and try again.');
    }

    if (!voiceLib) {
      return reply('❌ Voice library (@discordjs/voice) is not ready on this system!');
    }

    try {
      this.connectToVoiceChannel(voiceChannel);

      // Notify desktop overlay
      const overlay = this.getOverlay();
      overlay?.webContents.send('capri:discord', {
        action: 'voice_join',
        text: `Capri joined Voice Channel: ${voiceChannel.name}`,
      });

      return reply(`🔊 **Connected to Voice Channel:** \`${voiceChannel.name}\`!\n🎧 Type \`c!p <song>\` or \`/play <song>\` to spin tracks together!`);
    } catch (err) {
      console.error('[discord] join voice error:', err);
      return reply(`❌ Error joining voice channel: ${err.message}`);
    }
  }

  // Execute /leave or !leave
  async executeLeave(target, isInteraction = false) {
    const reply = (content) => (isInteraction ? target.editReply(content) : target.send(content));
    if (this.voiceConnection) {
      this.stopVoice();
      return reply('👋 Left voice channel! Catch you later in Night City, choom!');
    }
    return reply('⚠️ Capri is not currently in any voice channel.');
  }

  // Execute /play
  async executePlay(target, songQuery, voiceChannel, isInteraction = false) {
    const reply = (content) => (isInteraction ? target.editReply(content) : target.send(content));

    try {
      if (isInteraction) {
        await target.editReply(`🔍 Scanning frequencies for: **${songQuery}**...`);
      } else {
        await target.send(`🔍 Scanning frequencies for: **${songQuery}**...`);
      }

      const track = await music.resolveTrack(songQuery, this.port);

      // Auto-resolve voice channel if not provided
      if (!voiceChannel) {
        voiceChannel = await this.findActiveVoiceChannel();
      }

      // If already playing in voice channel, add to queue
      if (this.currentTrack && voiceChannel && this.voiceConnection) {
        this.queue.push({ track, voiceChannel, textChannel: target });
        return reply(
          `📋 **Added to queue (#${this.queue.length}):** [${track.title}](${track.originalUrl})\n⏱️ Duration: ${track.duration || 'N/A'} — Artist: ${track.author}`
        );
      }

      // Play immediately
      this.sendMusicCommand({ action: 'playOnline', track });
      let voiceMsg = '';

      if (voiceChannel && voiceLib) {
        try {
          this.connectToVoiceChannel(voiceChannel);
          await this.playTrackStream(track, voiceChannel, null);
          voiceMsg = ` (and broadcasting in Voice Channel **${voiceChannel.name}**)`;
        } catch (vErr) {
          console.warn('[discord] voice channel play error:', vErr.message);
        }
      }

      // Notify desktop Capri with a transmission banner
      const overlay = this.getOverlay();
      overlay?.webContents.send('capri:discord', {
        action: 'play',
        title: track.title,
        text: `Discord playback requested: ${track.title}`,
      });

      return reply(
        `🎵 **NOW PLAYING:** [${track.title}](${track.originalUrl})\n⏱️ Duration: ${track.duration || 'N/A'} — Artist: ${track.author}\n✨ Streaming live on Capri's desktop${voiceMsg}!`
      );
    } catch (err) {
      console.error('[discord] play error:', err);
      return reply(`❌ Error playing audio: ${err.message}`);
    }
  }

  // Execute /open
  async executeOpen(target, appName, query, isInteraction = false) {
    const reply = (content) => (isInteraction ? target.editReply(content) : target.send(content));

    try {
      if (appName === 'spotify') {
        await apps.openSpotify(query);
        return reply(`🟢 Launched **Spotify** on PC for query: *${query || 'Home'}*!`);
      } else {
        await apps.openWebMusic(appName, query);
        return reply(`🌐 Opened **${appName.toUpperCase()}** in browser for: *${query}*!`);
      }
    } catch (err) {
      return reply(`❌ Failed to launch ${appName}: ${err.message}`);
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
      toggle: '⏯️ Toggled Play / Pause state!',
      next: '⏭️ Skipped to next track!',
      prev: '⏮️ Returned to previous track!',
      radio: '📻 Switched to next Cyberpunk Radio station!',
      status: '📊 Capri Music Player status checked.',
    };

    return reply(messages[action] || `✅ Sent command [${action}] to Capri!`);
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
            'You are Capri, a sharp digital construct from Cyberpunk: Edgerunners living on user desktop.',
            'Personality: Witty, cyberpunk street-smart, playful, warm, addresses user as "choom", "partner", or "blue".',
            `Discord user ${senderName} just sent you a message from the Discord server.`,
            'Respond in 1-2 punchy, natural sentences in English. No markdown bullet points, no emojis.',
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
      return reply(`💬 **Capri:** Signal received loud and clear from ${senderName}! Holding down the desktop for you, choom.`);
    }
  }

  async shareFile(filePath) {
    if (!this.running || !this.client) {
      return { ok: false, error: 'Discord bot is not active or connected.' };
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
        return { ok: false, error: 'No available Discord text channel found to share clip.' };
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
