'use strict';

// Antigravity In-Process Agent Webhook & File Watcher Engine
// Runs 100% inside Electron Main process. Eliminates all external node.exe child processes.
// Listens on 127.0.0.1:43225 with 400ms debounce and strict file loop prevention.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const PORT = 43225;
const HOST = '127.0.0.1';
const DEBOUNCE_MS = 400;

// Strictly blacklisted files/directories to avoid infinite loops and background noise
const BLACKLIST_PATTERNS = [
  /config\.json$/i,
  /chat-history.*\.json$/i,
  /startup_err\.log$/i,
  /debug\.log$/i,
  /\.(mp3|wav|ogg|webm|mp4)$/i,
  /[\\/]_backups[\\/]/i,
  /[\\/]old_assets[\\/]/i,
  /[\\/]node_modules[\\/]/i,
  /[\\/]\.git[\\/]/i,
  /[\\/]dist[\\/]/i,
];

function isBlacklisted(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const normalized = filePath.replace(/\\/g, '/');
  return BLACKLIST_PATTERNS.some((pattern) => pattern.test(normalized) || pattern.test(filePath));
}

function pickEmoteForTool(tool = '', file = '') {
  const t = String(tool).toLowerCase();
  if (t.includes('edit') || t.includes('write') || t.includes('create') || t.includes('modify')) {
    return 'bolt';
  }
  if (t.includes('bash') || t.includes('command') || t.includes('exec') || t.includes('run')) {
    return 'point';
  }
  if (t.includes('read') || t.includes('view') || t.includes('inspect') || t.includes('cat')) {
    return 'watch';
  }
  if (t.includes('grep') || t.includes('glob') || t.includes('search') || t.includes('fetch') || t.includes('web')) {
    return 'satellite';
  }
  if (t.includes('done') || t.includes('finish') || t.includes('stop') || t.includes('success')) {
    return 'victory';
  }
  return 'point';
}

function formatTargetFromTool(tool = '', input = {}) {
  const t = String(tool).toLowerCase();
  const filePath = input.file_path || input.path || input.file || input.Path || '';
  const fName = filePath ? path.basename(filePath) : '';

  if (t.includes('edit') || t.includes('write')) {
    return fName ? `EDITING: ${fName}` : 'EDITING CODE';
  }
  if (t.includes('bash') || t.includes('command') || t.includes('exec')) {
    const cmd = input.command || input.CommandLine || '';
    const shortCmd = cmd ? String(cmd).slice(0, 24) : 'RUNNING COMMAND';
    return `EXEC: ${shortCmd}`;
  }
  if (t.includes('read')) {
    return fName ? `ANALYZING: ${fName}` : 'ANALYZING CODE';
  }
  if (t.includes('grep') || t.includes('glob') || t.includes('search')) {
    return 'SEARCHING WORKSPACE...';
  }
  if (t.includes('agent') || t.includes('subagent')) {
    return 'SUBAGENT ACTIVE...';
  }
  return `${String(tool).toUpperCase()} ACTIVE`;
}

function ensureHookSettings() {
  try {
    const home = os.homedir();
    const configDirs = [
      path.join(home, '.gemini'),
      path.join(home, '.claude'),
    ];

    const hookSpec = {
      PreToolUse: [
        {
          command: `curl -s -X POST http://127.0.0.1:${PORT}/hook -H "Content-Type: application/json" -d "{\\"event\\":\\"PreToolUse\\",\\"tool\\":\\"$TOOL_NAME\\"}"`,
        },
      ],
      PostToolUse: [
        {
          command: `curl -s -X POST http://127.0.0.1:${PORT}/hook -H "Content-Type: application/json" -d "{\\"event\\":\\"PostToolUse\\",\\"tool\\":\\"$TOOL_NAME\\"}"`,
        },
      ],
    };

    for (const dir of configDirs) {
      if (fs.existsSync(dir)) {
        const sPath = path.join(dir, 'settings.json');
        let current = {};
        if (fs.existsSync(sPath)) {
          try {
            current = JSON.parse(fs.readFileSync(sPath, 'utf8'));
          } catch {}
        }
        if (!current.hooks) {
          current.hooks = hookSpec;
          fs.writeFileSync(sPath, JSON.stringify(current, null, 2), 'utf8');
          console.log(`[antigravity-hook] Registered hook config in ${sPath}`);
        }
      }
    }
  } catch (err) {
    console.warn('[antigravity-hook] Error configuring hook settings:', err.message);
  }
}

class AntigravityHook {
  constructor() {
    this.server = null;
    this.onActivity = null;
    this.debounceTimer = null;
    this.lastEvent = null;
    this.watchers = [];
  }

  triggerActivity(act) {
    if (!act || !this.onActivity) return;
    this.lastEvent = act;
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      if (this.onActivity && this.lastEvent) {
        try {
          this.onActivity(this.lastEvent);
        } catch (err) {
          console.warn('[antigravity-hook] Error in onActivity handler:', err.message);
        }
      }
    }, DEBOUNCE_MS);
  }

  start({ onActivity } = {}) {
    if (this.server) {
      console.log('[antigravity-hook] Server already running.');
      return;
    }

    this.onActivity = onActivity || null;

    // 1. Start In-Process HTTP Webhook Server (Port 43225)
    this.server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          service: 'capri-antigravity-in-process-hook',
          port: PORT,
          pid: process.pid,
        }));
        return;
      }

      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 1024 * 1024) req.destroy();
        });

        req.on('end', () => {
          let data = null;
          try {
            data = JSON.parse(body);
          } catch {
            data = { text: body };
          }

          const tool = data.tool_name || data.tool || data.action || data.event || 'Edit';
          const file = data.file || data.path || data.file_path || (data.tool_input?.file_path) || '';

          if (file && isBlacklisted(file)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, ignored: true, reason: 'blacklisted_path' }));
            return;
          }

          const target = formatTargetFromTool(tool, data.tool_input || { file });
          const emote = pickEmoteForTool(tool, file);

          this.triggerActivity({
            verb: 'AGENT',
            target,
            emote,
            file,
            tool,
            timestamp: Date.now(),
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, debounced: true }));
        });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not_found' }));
    });

    this.server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[antigravity-hook] Port ${PORT} in use, skipping HTTP bind.`);
      } else {
        console.error('[antigravity-hook] Server error:', err.message);
      }
    });

    try {
      this.server.listen(PORT, HOST, () => {
        console.log(`[antigravity-hook] In-process hook listening on http://${HOST}:${PORT} (PID: ${process.pid})`);
      });
    } catch (e) {
      console.warn('[antigravity-hook] Failed to bind server:', e.message);
    }

    // 2. Start In-Process Source Code Watcher (src/, scripts/)
    const codeDirs = [
      path.resolve(__dirname, '..', '..', 'src'),
      path.resolve(__dirname, '..', '..', 'scripts'),
    ];
    for (const d of codeDirs) {
      if (fs.existsSync(d)) {
        try {
          const w = fs.watch(d, { recursive: true }, (eventType, filename) => {
            if (!filename || isBlacklisted(filename)) return;
            if (!/\.(js|css|html|ts|json)$/i.test(filename)) return;
            this.triggerActivity({
              verb: 'AGENT',
              target: `EDITING: ${path.basename(filename)}`,
              emote: eventType === 'rename' ? 'bolt' : 'point',
            });
          });
          this.watchers.push(w);
        } catch (e) {
          console.warn('[antigravity-hook] Could not watch code dir:', d, e.message);
        }
      }
    }

    // 3. Start In-Process Antigravity Runtime Watcher (~/.gemini/antigravity)
    try {
      const home = os.homedir();
      const agyBase = path.join(home, '.gemini', 'antigravity');
      const agyWatchDirs = [
        path.join(agyBase, '.system_generated', 'tasks'),
        path.join(agyBase, 'logs'),
      ];

      for (const d of agyWatchDirs) {
        if (fs.existsSync(d)) {
          const w = fs.watch(d, { recursive: true }, (_eventType, filename) => {
            if (!filename || isBlacklisted(filename)) return;
            const isTask = filename.includes('task');
            this.triggerActivity({
              verb: 'AGENT',
              target: isTask ? 'EXECUTING TASK...' : 'SUBAGENT ACTIVE...',
              emote: 'satellite',
            });
          });
          this.watchers.push(w);
        }
      }
    } catch (e) {
      console.warn('[antigravity-hook] Antigravity runtime watcher skipped:', e.message);
    }

    // 4. Auto-configure hook settings in ~/.gemini/settings.json
    ensureHookSettings();
  }

  stop() {
    clearTimeout(this.debounceTimer);
    for (const w of this.watchers) {
      try { w.close(); } catch {}
    }
    this.watchers = [];

    if (this.server) {
      try {
        this.server.close();
        console.log('[antigravity-hook] Server closed.');
      } catch {}
      this.server = null;
    }
  }

  isRunning() {
    return Boolean(this.server && this.server.listening);
  }
}

const antigravityHook = new AntigravityHook();

module.exports = {
  antigravityHook,
  AntigravityHook,
};
