# Capri Desktop Development Rules

## 1. Zero Root Pollution Rule
- **ABSOLUTELY NO** creation of `.md`, `.txt`, `.log`, `.bak`, or test scripts in the root directory.
- All documentation and reports must reside in `docs/`.
- All backups must reside in `_backups/`.

## 2. Strict Folder Responsibility
- `src/main/`: Electron Main Process, OS hooks, IPC handlers, Discord bot, TTS pipeline, HTTP Bridge. **NO UI/DOM code.**
- `src/renderer/`: HUD, Biochip, Quick Bar, Chat Panel, assets.
- `hooks/`: Integration scripts for external agents (Antigravity, VSCode, CLI).
- `scripts/`: Build tools, sprite generation, system verification tools.

## 3. Core Coding Standards
- **Language**: All UI/HUD text must be in English (`en`).
- **Security**: Never hardcode API keys or tokens. Use `config.json` (local, untracked) or environment variables.

## 4. Directory-Specific Guidelines
- **`src/main/`**: Only contains system-level logic. If it interacts with the DOM, it must use `ipcMain` to send events to `src/renderer/`.
- **`src/renderer/`**: Contains the visuals and character logic. Must be lean and performance-focused, relying on `src/main/` for OS-level integration.
- **`hooks/`**: Specialized integration scripts. Should fail silently if the target process is not active.
