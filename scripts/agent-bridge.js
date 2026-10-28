#!/usr/bin/env node
// agent-bridge.js
// Dual-role script:
//   1) Workspace Watcher – monitors a directory for file changes and forwards
//      structured events to Capri's HTTP bridge.
//   2) MCP Server (stdio) – exposes Model Context Protocol tools so AI agents
//      (Antigravity / Gemini CLI / Cursor) can push status updates to Capri.
//
// Usage:
//   node agent-bridge.js --watch [dir]      # file-watcher mode
//   node agent-bridge.js --mcp              # MCP stdio server mode
//   node agent-bridge.js --watch [dir] --mcp # both modes simultaneously
//   node agent-bridge.js <dir>              # shorthand for --watch <dir>
//   node agent-bridge.js                    # prints help
//
// Environment variables:
//   CAPRI_WATCH_DIR  – directory to watch (fallback when no CLI arg)
//   CAPRI_PORT       – Capri HTTP bridge port (default 47823)

'use strict';

// ---------------------------------------------------------------------------
// 0. Emergency guard: Disabled by default unless explicitly forced
// ---------------------------------------------------------------------------
if (process.env.FORCE_ENABLE_BRIDGE !== 'true') {
  console.log('[Bridge] Agent bridge is disabled by default (FORCE_ENABLE_BRIDGE!=true). Exiting cleanly.');
  process.exit(0);
}

const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const crypto = require('crypto');
const readline = require('readline');

// ---------------------------------------------------------------------------
// 1. Single-Instance Lock via Local Port (TCP 43224)
// ---------------------------------------------------------------------------
const LOCK_PORT = 43224;

let lockAcquired = false;
const lockServer = net.createServer();
lockServer.once('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('[Bridge] Một tiến trình agent-bridge đã đang chạy. Tự động thoát tiến trình trùng lặp.');
    process.exit(0);
  }
});
lockServer.listen(LOCK_PORT, '127.0.0.1', () => {
  lockAcquired = true;
});
lockServer.unref();

function waitForLock() {
  if (lockAcquired) return Promise.resolve();
  return new Promise((resolve) => {
    lockServer.once('listening', resolve);
  });
}

let shutdownFn = null;

// ---------------------------------------------------------------------------
// Constants & configuration
// ---------------------------------------------------------------------------

const DEFAULT_PORT = 47823;
const BRIDGE_HOST = '127.0.0.1';
const DEBOUNCE_MS = 300; // debounce rapid file-system events (300ms)

// Patterns to ignore completely (Requirement 2)
const IGNORED_PATTERNS = [
  /node_modules/,
  /\.git/,
  /dist/,
  /_backups/,
  /captures/,
  /Videos/,
  /Pictures/,
  /\.tmp/,
  /\.gemini/,
  /\.DS_Store/,
  /Thumbs\.db/,
  /__pycache__/,
  /capri-project/i,
  /capri-desktop/i,
  /\.claude/i,
  /renderer\.log/i,
  /startup_.*\.log/i,
];

// Directories whose changes hint at build / test output
const BUILD_OUTPUT_DIRS = new Set([
  'dist', 'build', 'out', 'output', '.next', '.nuxt', '.svelte-kit',
  'coverage', '__coverage__', '.nyc_output', 'test-results', 'junit',
  'target', 'bin', 'obj',
]);

// Extensions commonly produced by build tools
const BUILD_OUTPUT_EXTS = new Set([
  '.map', '.min.js', '.min.css', '.bundle.js', '.chunk.js',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a short unique session id. */
function generateSessionId() {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString('hex');
  return `capri-${ts}-${rand}`;
}

/** Resolve the Capri bridge port from env or default. */
function getBridgePort() {
  const envPort = process.env.CAPRI_PORT;
  if (envPort) {
    const parsed = parseInt(envPort, 10);
    if (!Number.isNaN(parsed) && parsed > 0 && parsed < 65536) return parsed;
  }
  return DEFAULT_PORT;
}

/**
 * POST a JSON event to Capri's HTTP bridge.
 * Fire-and-forget – errors are logged but never thrown.
 */
function sendEvent(port, event) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(event);
    const options = {
      hostname: BRIDGE_HOST,
      port,
      path: '/event',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 5000,
    };

    try {
      const req = http.request(options, (res) => {
        // Drain the response so the socket is freed
        res.resume();
        resolve(true);
      });

      req.on('error', (err) => {
        // Bridge may not be running yet – that's okay, don't crash.
        if (err.code !== 'ECONNREFUSED') {
          logWarn(`Bridge POST failed: ${err.message}`);
        }
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.write(payload);
      req.end();
    } catch (err) {
      logWarn(`Bridge POST exception: ${err.message}`);
      resolve(false);
    }
  });
}

/** Build an event payload matching Capri Brain's expected schema. */
function makeEvent(hookName, sessionId, cwd, extra = {}) {
  return {
    hook_event_name: hookName,
    session_id: sessionId,
    cwd: cwd || process.cwd(),
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Logging helpers – write to stderr so stdout stays clean for MCP stdio
// ---------------------------------------------------------------------------

function logInfo(msg) {
  process.stderr.write(`[agent-bridge] ${msg}\n`);
}

function logWarn(msg) {
  process.stderr.write(`[agent-bridge] WARN: ${msg}\n`);
}

function logError(msg) {
  process.stderr.write(`[agent-bridge] ERROR: ${msg}\n`);
}

// ---------------------------------------------------------------------------
// Workspace Watcher
// ---------------------------------------------------------------------------

class WorkspaceWatcher {
  constructor(watchDir, port, sessionId) {
    this.watchDir = path.resolve(watchDir);
    this.port = port;
    this.sessionId = sessionId;
    this._watcher = null;
    this._debounceTimers = new Map();
    this._closed = false;
    this._sessionActive = false;
    this._modifiedFiles = new Set();
    this._idleTimer = null;
  }

  /** Start watching and emit SessionStart. */
  async start() {
    const normalized = path.resolve(this.watchDir).replace(/\\/g, '/').toLowerCase();
    if (normalized.includes('capri-project') || normalized.includes('capri-desktop') || normalized.includes('.gemini/antigravity/scratch')) {
      logWarn(`Refusing to watch Capri own project directory to prevent feedback loop: ${this.watchDir}`);
      return;
    }

    logInfo(`Watcher: watching ${this.watchDir} (session ${this.sessionId})`);

    await sendEvent(
      this.port,
      makeEvent('SessionStart', this.sessionId, this.watchDir, {
        source: 'startup',
        agent_source: 'Antigravity',
      })
    );

    try {
      this._watcher = fs.watch(
        this.watchDir,
        { recursive: true, persistent: true },
        (eventType, filename) => {
          if (this._closed) return;
          this._onFsEvent(eventType, filename);
        }
      );

      this._watcher.on('error', (err) => {
        logError(`Watcher error: ${err.message}`);
      });
    } catch (err) {
      logError(`Failed to start watcher: ${err.message}`);
    }
  }

  /** Debounced handler for raw fs events. */
  _onFsEvent(eventType, filename) {
    if (!filename) return;

    // Ignore common noise: dotfiles, node_modules, .git
    if (this._shouldIgnore(filename)) return;

    const key = filename;
    if (this._debounceTimers.has(key)) {
      clearTimeout(this._debounceTimers.get(key));
    }

    this._debounceTimers.set(
      key,
      setTimeout(() => {
        this._debounceTimers.delete(key);
        this._processFileEvent(eventType, filename);
      }, DEBOUNCE_MS)
    );
  }

  /** Decide whether to ignore this path (lightweight, junk/build directory filtering). */
  _shouldIgnore(filename) {
    if (!filename) return true;
    const normalized = filename.replace(/\\/g, '/');
    for (const pattern of IGNORED_PATTERNS) {
      if (pattern.test(normalized)) {
        return true;
      }
    }
    return false;
  }

  /** Schedule auto-completion celebration after edits stop. */
  _scheduleCompletion() {
    if (this._idleTimer) clearTimeout(this._idleTimer);
    this._idleTimer = setTimeout(async () => {
      if (!this._sessionActive || this._modifiedFiles.size === 0) return;
      const count = this._modifiedFiles.size;
      const filesSummary = Array.from(this._modifiedFiles)
        .slice(0, 3)
        .map((f) => path.basename(f))
        .join(', ');
      const more = count > 3 ? ` (+${count - 3} more)` : '';

      logInfo(`Watcher: all quiet for 4s, celebrating ${count} file changes`);
      await sendEvent(
        this.port,
        makeEvent('Stop', this.sessionId, this.watchDir, {
          agent_source: 'Antigravity',
          last_assistant_message: `Saved changes to ${count} file(s): ${filesSummary}${more}`,
        })
      );
      this._sessionActive = false;
      this._modifiedFiles.clear();
    }, 4500);
  }

  /** Map a file-system event to a Capri hook event and send it. */
  async _processFileEvent(eventType, filename) {
    const fullPath = path.join(this.watchDir, filename);

    // If no active task session, start one so Capri perches on the window
    if (!this._sessionActive) {
      this._sessionActive = true;
      await sendEvent(
        this.port,
        makeEvent('UserPromptSubmit', this.sessionId, this.watchDir, {
          prompt: `Updating ${path.basename(filename)}`,
          agent_source: 'Antigravity',
        })
      );
    }

    // Determine if the file still exists (rename event can mean delete)
    let exists = false;
    try {
      fs.accessSync(fullPath);
      exists = true;
    } catch {
      // file was deleted
    }

    // Check if this looks like build / test output
    const isBuildOutput = this._isBuildOutput(filename);
    const isError = /error|fail|crash/i.test(filename);

    if (!exists) {
      const event = makeEvent('PreToolUse', this.sessionId, this.watchDir, {
        tool_name: 'Write',
        tool_input: {
          file_path: fullPath,
          action: 'delete',
        },
      });
      await sendEvent(this.port, event);
      this._scheduleCompletion();
      return;
    }

    this._modifiedFiles.add(fullPath);

    if (isError) {
      // Error file created/updated -> hurt animation
      const event = makeEvent('PostToolUseFailure', this.sessionId, this.watchDir, {
        tool_name: 'Bash',
        tool_input: { command: filename },
        error: `Detected error in ${path.basename(filename)}`,
      });
      await sendEvent(this.port, event);
    } else if (isBuildOutput) {
      // Build output -> trigger red sparks
      const event = makeEvent('PreToolUse', this.sessionId, this.watchDir, {
        tool_name: 'Bash',
        tool_input: {
          command: `build ${path.basename(filename)}`,
          description: `Build ${path.basename(filename)}`,
        },
      });
      await sendEvent(this.port, event);
    } else {
      // Normal file edit/create
      const toolName = eventType === 'rename' ? 'Write' : 'Edit';
      const event = makeEvent('PreToolUse', this.sessionId, this.watchDir, {
        tool_name: toolName,
        tool_input: { file_path: fullPath },
      });
      await sendEvent(this.port, event);
    }

    this._scheduleCompletion();
  }

  /** Heuristic: does the filename look like build/test output? */
  _isBuildOutput(filename) {
    const parts = filename.split(path.sep);
    for (const part of parts) {
      if (BUILD_OUTPUT_DIRS.has(part)) return true;
    }
    const ext = path.extname(filename);
    if (BUILD_OUTPUT_EXTS.has(ext)) return true;
    // Check compound extensions like .min.js
    const base = path.basename(filename);
    for (const bext of BUILD_OUTPUT_EXTS) {
      if (base.endsWith(bext)) return true;
    }
    return false;
  }

  /** Stop watching and emit SessionEnd. */
  async stop() {
    if (this._closed) return;
    this._closed = true;

    // Clear pending debounce timers
    for (const timer of this._debounceTimers.values()) {
      clearTimeout(timer);
    }
    this._debounceTimers.clear();

    if (this._watcher) {
      try {
        this._watcher.close();
      } catch {
        // ignore
      }
    }

    await sendEvent(
      this.port,
      makeEvent('SessionEnd', this.sessionId, this.watchDir)
    );
    logInfo('Watcher: stopped.');
  }
}

// ---------------------------------------------------------------------------
// MCP Server (stdio, JSON-RPC 2.0)
// ---------------------------------------------------------------------------

/**
 * Minimal MCP server that reads newline-delimited JSON-RPC from stdin and
 * writes responses to stdout.
 */
class McpServer {
  constructor(port, sessionId) {
    this.port = port;
    this.sessionId = sessionId;
    this._initialized = false;
    this._closed = false;
    this._rl = null;

    // Tool definitions exposed via MCP
    this.tools = [
      {
        name: 'capri_start',
        description:
          'Signal that a new user prompt / task has started. Capri perches on your window and gets ready to work.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'The user prompt or task goal.',
            },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'capri_thinking',
        description:
          'Signal that the agent is currently thinking or processing. Capri perches on the window and counts thinking seconds.',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Optional description of what the agent is thinking about.',
            },
          },
          required: [],
        },
      },
      {
        name: 'capri_tool_use',
        description:
          'Signal that the agent is using a tool (reading a file, editing, running a command, etc.).',
        inputSchema: {
          type: 'object',
          properties: {
            tool_name: {
              type: 'string',
              description:
                'Name of the tool being used: Read, Write, Edit, MultiEdit, Bash, PowerShell, WebFetch, WebSearch, Agent, Task, Grep, Glob.',
            },
            tool_input: {
              type: 'object',
              description:
                'Tool-specific input. E.g. { "file_path": "..." }, { "command": "...", "description": "..." }, { "pattern": "..." }, { "url": "..." }, { "query": "..." }.',
            },
          },
          required: ['tool_name'],
        },
      },
      {
        name: 'capri_permission',
        description:
          'Signal that the agent needs user confirmation, permission, or input. Capri enters alert mode and points at your window.',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The permission question or prompt message for the user.',
            },
          },
          required: ['message'],
        },
      },
      {
        name: 'capri_done',
        description:
          'Signal that the agent has finished a task. Capri teleports to center stage and celebrates with a victory pose!',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Summary of what was accomplished.',
            },
          },
          required: [],
        },
      },
      {
        name: 'capri_error',
        description: 'Signal that a tool or command encountered an error.',
        inputSchema: {
          type: 'object',
          properties: {
            tool_name: {
              type: 'string',
              description: 'Name of the tool that failed (e.g. Bash, PowerShell, Write).',
            },
            error: {
              type: 'string',
              description: 'Description of the error.',
            },
          },
          required: ['error'],
        },
      },
      {
        name: 'capri_say',
        description:
          'Show a speech bubble / notification from Capri with custom text.',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The message to display.',
            },
          },
          required: ['message'],
        },
      },
    ];
  }

  /** Start reading from stdin. */
  start() {
    logInfo(`MCP: server ready (session ${this.sessionId})`);

    this._rl = readline.createInterface({
      input: process.stdin,
      terminal: false,
    });

    this._rl.on('line', (line) => {
      if (this._closed) return;
      this._handleLine(line);
    });

    this._rl.on('close', () => {
      logInfo('MCP: stdin closed, shutting down...');
      this._closed = true;
      if (typeof shutdownFn === 'function') {
        shutdownFn('MCP-stdin-closed');
      } else {
        process.exit(0);
      }
    });

    process.stdin.on('end', () => {
      logInfo('MCP: stdin end, shutting down...');
      if (typeof shutdownFn === 'function') {
        shutdownFn('MCP-stdin-end');
      } else {
        process.exit(0);
      }
    });

    // Send SessionStart for MCP mode as well
    sendEvent(
      this.port,
      makeEvent('SessionStart', this.sessionId, process.cwd(), {
        source: 'startup',
      })
    );
  }

  /** Parse and dispatch a single JSON-RPC line. */
  _handleLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return;

    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch (err) {
      logWarn(`MCP: invalid JSON: ${err.message}`);
      return;
    }

    // JSON-RPC 2.0 notifications (no id) – we just acknowledge
    if (msg.id === undefined || msg.id === null) {
      this._handleNotification(msg);
      return;
    }

    // JSON-RPC 2.0 requests (have id)
    this._handleRequest(msg);
  }

  /** Handle JSON-RPC notifications (no response expected). */
  _handleNotification(msg) {
    const method = msg.method;
    if (method === 'notifications/initialized') {
      this._initialized = true;
      logInfo('MCP: client initialized.');
    } else if (method === 'notifications/cancelled') {
      logInfo(`MCP: request ${msg.params?.requestId} cancelled.`);
    }
    // Other notifications are silently accepted
  }

  /** Handle JSON-RPC requests and send a response. */
  async _handleRequest(msg) {
    const { id, method, params } = msg;

    try {
      switch (method) {
        case 'initialize':
          this._sendResponse(id, {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: { listChanged: false },
            },
            serverInfo: {
              name: 'capri-agent-bridge',
              version: '1.0.0',
            },
          });
          break;

        case 'tools/list':
          this._sendResponse(id, { tools: this.tools });
          break;

        case 'tools/call':
          await this._handleToolCall(id, params);
          break;

        case 'ping':
          this._sendResponse(id, {});
          break;

        default:
          this._sendError(id, -32601, `Method not found: ${method}`);
          break;
      }
    } catch (err) {
      logError(`MCP: error handling method "${method}": ${err.message}`);
      this._sendError(id, -32603, `Internal error: ${err.message}`);
    }
  }

  /** Dispatch an MCP tool call to the appropriate handler. */
  async _handleToolCall(id, params) {
    const toolName = params?.name;
    const args = params?.arguments || {};

    switch (toolName) {
      case 'capri_start': {
        const event = makeEvent('UserPromptSubmit', this.sessionId, process.cwd(), {
          prompt: args.prompt || 'Working on task...',
          agent_source: 'Antigravity',
        });
        await sendEvent(this.port, event);
        this._sendToolResult(id, 'Task started. Capri is now watching.');
        break;
      }

      case 'capri_thinking': {
        const event = makeEvent('UserPromptSubmit', this.sessionId, process.cwd(), {
          prompt: args.message || 'Thinking…',
          agent_source: 'Antigravity',
        });
        await sendEvent(this.port, event);
        this._sendToolResult(id, 'Thinking status sent to Capri.');
        break;
      }

      case 'capri_tool_use': {
        const event = makeEvent('PreToolUse', this.sessionId, process.cwd(), {
          tool_name: args.tool_name || 'Bash',
          tool_input: args.tool_input || {},
          agent_source: 'Antigravity',
        });
        await sendEvent(this.port, event);
        this._sendToolResult(id, `Tool use (${args.tool_name}) sent to Capri.`);
        break;
      }

      case 'capri_permission': {
        const event = makeEvent('Notification', this.sessionId, process.cwd(), {
          notification_type: 'permission_prompt',
          message: args.message || 'Permission required',
          agent_source: 'Antigravity',
        });
        await sendEvent(this.port, event);
        this._sendToolResult(id, 'Permission prompt sent to Capri.');
        break;
      }

      case 'capri_done': {
        const event = makeEvent('Stop', this.sessionId, process.cwd(), {
          last_assistant_message: args.message || 'Task completed.',
          agent_source: 'Antigravity',
        });
        await sendEvent(this.port, event);
        this._sendToolResult(id, 'Done status sent to Capri.');
        break;
      }

      case 'capri_error': {
        const event = makeEvent('PostToolUseFailure', this.sessionId, process.cwd(), {
          tool_name: args.tool_name || 'Agent',
          tool_input: {},
          error: args.error || 'Unknown error',
          agent_source: 'Antigravity',
        });
        await sendEvent(this.port, event);
        this._sendToolResult(id, 'Error status sent to Capri.');
        break;
      }

      case 'capri_say': {
        const event = makeEvent('Notification', this.sessionId, process.cwd(), {
          notification_type: 'idle_prompt',
          message: args.message || '',
          agent_source: 'Antigravity',
        });
        await sendEvent(this.port, event);
        this._sendToolResult(id, 'Message sent to Capri.');
        break;
      }

      default:
        this._sendError(id, -32602, `Unknown tool: ${toolName}`);
        break;
    }
  }

  // ---- JSON-RPC response helpers ----

  _sendResponse(id, result) {
    this._writeStdout({
      jsonrpc: '2.0',
      id,
      result,
    });
  }

  _sendError(id, code, message) {
    this._writeStdout({
      jsonrpc: '2.0',
      id,
      error: { code, message },
    });
  }

  _sendToolResult(id, text) {
    this._sendResponse(id, {
      content: [{ type: 'text', text }],
      isError: false,
    });
  }

  _writeStdout(obj) {
    try {
      const json = JSON.stringify(obj);
      process.stdout.write(json + '\n');
    } catch (err) {
      logError(`MCP: failed to write response: ${err.message}`);
    }
  }

  /** Clean up. */
  async stop() {
    if (this._closed) return;
    this._closed = true;

    if (this._rl) {
      try {
        this._rl.close();
      } catch {
        // ignore
      }
    }

    await sendEvent(
      this.port,
      makeEvent('SessionEnd', this.sessionId, process.cwd())
    );
    logInfo('MCP: stopped.');
  }
}

// ---------------------------------------------------------------------------
// CLI parsing & main entry point
// ---------------------------------------------------------------------------

function printHelp() {
  const text = `
capri agent-bridge – Workspace watcher & MCP server for Capri Desktop

Usage:
  agent-bridge.js [options] [directory]

Options:
  --watch [dir]    Run as file watcher. Uses [dir], positional arg, or
                   CAPRI_WATCH_DIR env variable.
  --mcp            Run as MCP stdio server (JSON-RPC over stdin/stdout).
  --help, -h       Show this help message.

Environment:
  CAPRI_WATCH_DIR  Directory to watch (fallback).
  CAPRI_PORT       Capri HTTP bridge port (default: ${DEFAULT_PORT}).

Examples:
  # Watch the current project directory
  agent-bridge.js --watch ./my-project

  # Run as MCP server for AI agent integration
  agent-bridge.js --mcp

  # Run both modes simultaneously
  agent-bridge.js --watch ./my-project --mcp

  # Shorthand: positional directory implies --watch
  agent-bridge.js ./my-project
`.trim();
  console.log(text);
}

function parseArgs(argv) {
  const args = argv.slice(2); // skip node + script path
  const result = {
    watchMode: false,
    mcpMode: false,
    watchDir: null,
    showHelp: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.showHelp = true;
      return result;
    }

    if (arg === '--mcp') {
      result.mcpMode = true;
      continue;
    }

    if (arg === '--watch') {
      result.watchMode = true;
      // Check if the next arg is a directory (not a flag)
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        result.watchDir = args[i + 1];
        i++; // skip next
      }
      continue;
    }

    // Positional argument – treat as directory
    if (!arg.startsWith('--')) {
      result.watchDir = arg;
      continue;
    }
  }

  // Resolve watch directory from env if not set
  if (!result.watchDir && process.env.CAPRI_WATCH_DIR) {
    result.watchDir = process.env.CAPRI_WATCH_DIR;
  }

  // If CAPRI_WATCH_DIR is set but --watch was not explicitly passed, enable watch
  if (result.watchDir && !result.mcpMode) {
    result.watchMode = true;
  }

  // If --watch was passed without a dir, default to CAPRI_WATCH_DIR or cwd
  if (result.watchMode && !result.watchDir) {
    result.watchDir = process.env.CAPRI_WATCH_DIR || process.cwd();
  }

  // Default: if a directory is provided as positional but no flags, watch mode
  if (result.watchDir && !result.watchMode && !result.mcpMode) {
    result.watchMode = true;
  }

  return result;
}

async function main() {
  await waitForLock();

  const opts = parseArgs(process.argv);

  if (opts.showHelp) {
    printHelp();
    process.exit(0);
  }

  // Default: if no mode selected, default to watching current working directory
  if (!opts.watchMode && !opts.mcpMode) {
    opts.watchMode = true;
    opts.watchDir = process.cwd();
    logInfo(`No options provided; defaulting to watching ${opts.watchDir}`);
  }

  // Validate watch dir if watch mode is requested
  if (opts.watchMode) {
    if (!opts.watchDir) {
      logError('Watch mode requires a directory. Pass --watch <dir> or set CAPRI_WATCH_DIR.');
      process.exit(1);
    }

    const resolvedDir = path.resolve(opts.watchDir);
    try {
      const stat = fs.statSync(resolvedDir);
      if (!stat.isDirectory()) {
        logError(`Not a directory: ${resolvedDir}`);
        process.exit(1);
      }
    } catch (err) {
      logError(`Cannot access directory: ${resolvedDir} (${err.message})`);
      process.exit(1);
    }
    opts.watchDir = resolvedDir;
  }

  const port = getBridgePort();
  const sessionId = generateSessionId();

  logInfo(`Bridge port: ${port}`);
  logInfo(`Session ID: ${sessionId}`);

  // Components to manage
  let watcher = null;
  let mcp = null;

  // ---- Graceful shutdown ----
  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logInfo(`Received ${signal}, shutting down…`);

    const tasks = [];
    if (watcher) tasks.push(watcher.stop());
    if (mcp) tasks.push(mcp.stop());

    try {
      await Promise.allSettled(tasks);
    } catch {
      // best effort
    }

    try {
      lockServer.close();
    } catch {
      // best effort
    }

    process.exit(0);
  }

  shutdownFn = shutdown;

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('exit', () => {
    try {
      if (watcher) watcher.stop();
      if (mcp) mcp.stop();
      lockServer.close();
    } catch {}
  });

  // Windows: handle Ctrl+C on raw stdin
  if (process.platform === 'win32') {
    process.on('SIGHUP', () => shutdown('SIGHUP'));
  }

  // Handle uncaught errors globally – never crash
  process.on('uncaughtException', (err) => {
    logError(`Uncaught exception: ${err.message}`);
    logError(err.stack || '');
  });
  process.on('unhandledRejection', (reason) => {
    logError(`Unhandled rejection: ${reason}`);
  });

  // ---- Start components ----

  if (opts.watchMode) {
    watcher = new WorkspaceWatcher(opts.watchDir, port, sessionId);
    await watcher.start();
  }

  if (opts.mcpMode) {
    mcp = new McpServer(port, sessionId);
    mcp.start();
  }

  logInfo('Agent bridge is running. Press Ctrl+C to stop.');
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main().catch((err) => {
  logError(`Fatal: ${err.message}`);
  process.exit(1);
});
