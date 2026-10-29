'use strict';

const net = require('node:net');
const path = require('node:path');

// Default client ID for Capri Construct (or operator override)
const DEFAULT_CLIENT_ID = '1285223011470577715';

const OPCODES = {
  HANDSHAKE: 0,
  FRAME: 1,
  CLOSE: 2,
  PING: 3,
  PONG: 4,
};

class DiscordRpcPipe {
  constructor(clientId = DEFAULT_CLIENT_ID) {
    this.clientId = clientId;
    this.socket = null;
    this.connected = false;
    this.enabled = true;
    this.retryTimer = null;
    this.startTime = Math.floor(Date.now() / 1000);
    this.currentActivity = {
      state: 'Cyberpunk Biochip Online',
      details: 'Pair-Programming with Capri',
      timestamps: { start: this.startTime },
      assets: {
        large_image: 'capri',
        large_text: 'Capri Construct',
        small_image: 'chip',
        small_text: 'Biochip Linked',
      },
    };
  }

  getPipePath(index = 0) {
    if (process.platform === 'win32') {
      return `\\\\.\\pipe\\discord-ipc-${index}`;
    }
    const tempDir = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || '/tmp';
    return path.join(tempDir, `discord-ipc-${index}`);
  }

  start() {
    if (!this.enabled || this.connected || this.socket) return;
    this.connectPipe(0);
  }

  stop() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.destroy();
      } catch {}
      this.socket = null;
    }
    this.connected = false;
  }

  connectPipe(pipeIndex = 0) {
    if (pipeIndex > 9 || !this.enabled) {
      // Discord not running or pipe unavailable, retry quietly later
      this.scheduleRetry(60000);
      return;
    }

    const pipePath = this.getPipePath(pipeIndex);
    const sock = net.createConnection(pipePath);

    sock.on('connect', () => {
      this.socket = sock;
      this.connected = true;
      this.sendHandshake();
    });

    sock.on('data', (data) => {
      this.handleData(data);
    });

    sock.on('error', () => {
      sock.destroy();
      if (!this.connected) {
        // Try next pipe index
        this.connectPipe(pipeIndex + 1);
      }
    });

    sock.on('close', () => {
      this.socket = null;
      this.connected = false;
      this.scheduleRetry(30000);
    });
  }

  scheduleRetry(delay = 30000) {
    if (this.retryTimer || !this.enabled) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.enabled && !this.connected) {
        this.connectPipe(0);
      }
    }, delay);
  }

  encode(opcode, payload) {
    const json = JSON.stringify(payload);
    const len = Buffer.byteLength(json);
    const packet = Buffer.alloc(8 + len);
    packet.writeInt32LE(opcode, 0);
    packet.writeInt32LE(len, 4);
    packet.write(json, 8, len, 'utf8');
    return packet;
  }

  send(opcode, payload) {
    if (!this.socket || !this.connected) return;
    try {
      const packet = this.encode(opcode, payload);
      this.socket.write(packet);
    } catch {}
  }

  sendHandshake() {
    this.send(OPCODES.HANDSHAKE, {
      v: 1,
      client_id: this.clientId,
    });
  }

  handleData(buffer) {
    if (buffer.length < 8) return;
    const opcode = buffer.readInt32LE(0);
    const length = buffer.readInt32LE(4);
    const payloadStr = buffer.toString('utf8', 8, 8 + length);

    try {
      const data = JSON.parse(payloadStr);
      if (data.cmd === 'DISPATCH' && data.evt === 'READY') {
        // Handshake acknowledged, send initial rich presence
        this.updatePresence();
      }
    } catch {}
  }

  setActivity(partial) {
    this.currentActivity = { ...this.currentActivity, ...partial };
    if (this.connected) {
      this.updatePresence();
    }
  }

  updatePresence() {
    this.send(OPCODES.FRAME, {
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity: this.currentActivity,
      },
      nonce: `capri-${Date.now()}`,
    });
  }

  getStatus() {
    return {
      connected: this.connected,
      enabled: this.enabled,
      pipe: this.connected ? 'active' : 'idle',
    };
  }
}

const rpcInstance = new DiscordRpcPipe();

module.exports = {
  DiscordRpcPipe,
  discordRpc: rpcInstance,
};
