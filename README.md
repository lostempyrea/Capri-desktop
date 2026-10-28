# ⚡ Capri Desktop — Cyberpunk Edition

<p align="center">
  <img src="docs/intro.png" alt="Capri Desktop Banner" width="720" />
</p>

<p align="center">
  <strong>An Intelligent Desktop Pet & Cyberpunk HUD Companion</strong><br>
  <em>Living on your desktop, narrating AI coding actions, listening to voice commands, and clipping your gaming highlights.</em>
</p>

<p align="center">
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-%3E%3D20.0.0-339933?logo=node.js&logoColor=white" alt="Node.js" /></a>
  <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/Electron-44.x-47848F?logo=electron&logoColor=white" alt="Electron" /></a>
  <a href="package.json"><img src="https://img.shields.io/badge/Version-1.3.3--cyberpunk--edition-00f0ff?style=flat-square" alt="Version" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License" /></a>
  <a href="README.fr.md"><img src="https://img.shields.io/badge/Lang-Français-ff007f.svg?style=flat-square" alt="French" /></a>
</p>

---

## 🌟 Overview

**Capri Desktop** is an ambient, high-performance desktop companion built on Electron and web technologies, inspired by the netrunner aesthetic of *Cyberpunk: Edgerunners*. 

Unlike intrusive overlay tools, Capri lives primarily inside a lightweight, circular **Mini Biochip HUD** docked quietly at the corner of your screen. When paired with AI Coding Assistants (**Google Antigravity, Claude Code, Gemini CLI, Cursor**) or triggered via voice, Capri springs to life: commenting on code diffs, sparking red electricity on running bash commands, celebrating green tests with anime cut-ins, and clipping your best gaming clutches.

---

## ⚡ Key Architectural Highlights

### 1. Primary HUD: The Mini Biochip
* **Docked & Minimal**: Anchored neatly at the bottom corner of your display, zero desktop clutter.
* **Audio-Reactive Neon Ring**: Dynamic pulsating outer ring driven by real-time microphone RMS volume.
* **Hover Quick-Input**: Hover over the Biochip to reveal a streamlined quick-prompt input box. Press `Enter` to ask questions or issue immediate commands without opening heavy windows.
* **Overhead Speech Stack**: Capri speaks via a speech bubble floating right above the Biochip, clamped dynamically to screen boundaries to prevent any off-screen clipping.
* **Drag-and-Clamp**: Click and drag the Biochip anywhere across multiple monitors with automatic edge collision snapping.

### 2. On-Demand Cyberpunk Chat & Holographic Console
* **On-Demand Only**: The full holographic chat frame stays hidden until you click the Biochip or press a hotkey.
* **Dynamic Canvas Sprite Avatar**: Capri's avatar is rendered on an HTML5 Canvas slicing real-time sprite sheets, reacting with live facial expressions (neutral, thinking, speaking, grinning, error shock).
* **Symmetrical 40px Avatars**: Pixel-perfect alignment for both Capri and User bubbles.
* **Canvas Avatar Upload Engine**: Upload any custom user avatar image; Capri automatically center-crops (`object-fit: cover`) to a 128×128 canvas and encodes a lightweight Base64 PNG (~15KB) stored securely in local configuration.
* **Persistent History**: Session messages are preserved across reboots with clear history management.

### 3. Top-Left Status Ticker (Telemetry Bar)
* **Flush Top-Left (0px, 0px)**: Anchored directly against the screen boundary with zero dead space.
* **Live Telemetry Feed**: Displays background AI tool executions (`[ AGENT // EDITING: <file> ]`, `[ AGENT // BASH: "npm test" ]`, `VOICE: LISTENING...`, `REPLAY: BUFFERING...`).
* **Interactive & Draggable**: Drag directly via mouse or `Alt + Click` to reposition.
* **Custom Positioning Presets**: Choose between *Top-Left*, *Top-Center*, *Top-Right*, *Bottom-Left*, or fine-tune exact pixel coordinates with *Custom Offset X/Y* (-10px to 500px).

### 4. 2-Layer AI Agent Hook (Antigravity & Claude Code)
* **In-Process Watcher (Zero Zombie)**: Monitors file edits and agent transcripts in real-time with 400ms debounce and anti-self-trigger loop prevention.
* **Non-Blocking HTTP Bridge**: Listens on port `43225` (`/hook`) to catch agent tool dispatches (`Edit`, `Bash`, `Read`, `Grep`).
* **Live Emotes & Terminal Takeover**: Capri jacks into mock terminals, unleashes red lightning arcs, points out active tasks, and performs victory fanfare upon task completion.
* **Built-in Hook Tester**: One-click test button in Settings -> System to simulate agent events immediately.

### 5. Whisper Voice & Passive Noise Cancellation
* **Voice Activity Detection (VAD)**: Passive listening mode keeps animations completely dark during background conversations or ambient room noise.
* **Wake Words**: Wakes up instantly on `"Hey Capri"`, `"Hi Capri"`, or `"Capri ơi"` (Vietnamese & English support).
* **Speech-to-Text**: Powered by Groq Cloud Whisper (`whisper-large-v3-turbo`) or local Whisper models with sub-second transcription latency.

### 6. Instant Replay Ring-Buffer (Clipping Engine)
* **Continuous Rolling Buffer**: Keeps the last 30–60 seconds of screen and audio in an offline circular buffer using FFmpeg.
* **Zero Button Clutter**: Manual start/stop recording is eliminated in favor of instant voice commands:
  * *"record that"*
  * *"clip that"*
  * *"clip that shit"*
  * *"lưu lại pha vừa rồi"*
  * *"clip lại đi"*
* Saved clips are exported straight to your `Videos/Capri_Clips/` directory with timestamped MP4s.

### 7. Multi-Provider AI LLM Vault
* **Groq Cloud (Recommended)**: Ultra-fast inference with Llama 3.3 70B & DeepSeek models.
* **Google Gemini Studio**: Gemini 2.0 Flash / Pro integrations.
* **OpenAI / OpenRouter**: GPT-4o, Claude 3.5 Sonnet, etc.
* **Ollama (100% Offline)**: Local model execution (`llama3`, `mistral`, `qwen`).

### 8. Cyberpunk HUD Themes
* **Theme Presets**:
  * `Dark Matter` (Classic deep void and purple misregistered glow)
  * `Neon Horizon` (Cyan and electric magenta)
  * `Crimson Protocol` (High-alert red netrunner aesthetic)
  * `Matrix Console` (Phosphor green telemetry)
* **Custom Glass Styling**: Adjustable backdrop blur (8px–32px) and opacity sliders.

---

## 🛠️ Installation & Setup

### Prerequisites
* [Node.js](https://nodejs.org/) **>= 20.0.0**
* `npm` or `bun`
* Windows 10/11 (macOS and Linux supported)

### Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/lostempyrea/Capri-desktop.git
   cd Capri-desktop
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure API Keys** (Optional, for LLM chat & Voice):
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Fill in your free API keys:
   * **Groq API Key** (for fast chat & Whisper STT): [console.groq.com](https://console.groq.com)
   * **Gemini API Key**: [aistudio.google.com](https://aistudio.google.com/apikey)

4. **Launch Capri**:
   ```bash
   npm start
   ```

5. **Create Desktop Shortcut**:
   ```bash
   npm run shortcut
   ```

---

## 🎯 Keyboard Shortcuts & Voice Commands

| Action | Voice Trigger (EN / VI) | Shortcut |
| :--- | :--- | :--- |
| **Wake Up / Listen** | `"Hey Capri"`, `"Hi Capri"`, `"Capri ơi"` | Click Mic `🎙️` |
| **Instant Replay Clip** | `"record that"`, `"clip that"`, `"lưu lại pha vừa rồi"`, `"clip lại đi"` | — |
| **Open Chat & Settings** | Click Biochip Core | `Ctrl + Shift + C` |
| **Quick Prompt** | Hover over Biochip -> Type in Quick-Input | `Enter` |
| **Drag Status Ticker** | Mouse Drag or `Alt + Click Drag` | — |
| **Toggle Mute** | `"mute"`, `"im lặng đi"` | Tray Menu |

---

## 🤖 Antigravity / Claude Code Hook Integration

To enable Capri to narrate your coding sessions with **Google Antigravity** or **Claude Code**:

1. Open Capri's Settings -> **Hệ thống (System)**.
2. Toggle **Antigravity Agent Hook** to `ON`.
3. Click **[ TEST AGENT HOOK ]** to preview Capri's live reaction.
4. When editing files or running tests in your IDE, Capri will automatically track progress and sit on active windows.

---

## 🔒 Privacy & Security

* **Local-First Processing**: Capri runs entirely on your local machine.
* **Offline Gaming Buffers**: The Instant Replay buffer writes to temporary memory/disk locally and never transmits recordings over the internet.
* **Credentials Protected**: All API keys in `.env` and `config.json` are excluded from version control via `.gitignore`.

---

## 📜 License & Credits

* **License**: [MIT License](LICENSE)
* **Inspiration**: Project Capricorn from *Cyberpunk: Edgerunners* by Studio Trigger and CD PROJEKT RED.
* **Engine & Craft**: Created with love by the Capri Desktop community.
