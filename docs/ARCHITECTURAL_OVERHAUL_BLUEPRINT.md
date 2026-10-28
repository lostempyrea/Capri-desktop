# CAPRI DESKTOP — ARCHITECTURAL OVERHAUL BLUEPRINT
**Role:** Chief Architect
**System:** Cyberpunk Hologram Construct Assistant v2.5
**Date:** 2026-10-27

---

## 1. RED TEAMING / DEVIL'S ADVOCATE (Failure Scenarios & Edge Cases)

### Subsystem 1: Mini Biochip + Hologram Projection Deck
1. **Edge Case 1.1: Rapid Multi-Trigger Race Condition**
   - *Attack Scenario:* User presses `Alt+V`, says "Hey Capri", and clicks the Biochip in rapid succession within 200ms while the construct is in Hibernated Mini mode.
   - *Failure Mode:* Unstow animations overlap, `this.busy` locks up, multiple projection decks spawn or cancel each other's timers, leaving the deck invisible while click-through remains blocked.
   - *Defense:* Atomic state transition lock (`transitioningState: boolean`), centralized `comeOut()` mutex, and cancellation of pending transitions before starting a new state.
2. **Edge Case 1.2: Screen Resolution / DPI Change / Multi-Monitor Shift**
   - *Attack Scenario:* User unplugs an external 4K monitor or switches DPI scaling from 150% to 100% while Hologram Deck is projected.
   - *Failure Mode:* Hologram Deck projects outside the visible screen bounds or becomes clipped; mouse coordinates mismatch canvas DPR.
   - *Defense:* Debounced window resize and display change listener (`fitOverlay()` and `repositionHologram()`), dynamically clamping the deck to screen work area with a 24px margin.
3. **Edge Case 1.3: Canvas Memory Leak on Long-Running Background Loop**
   - *Attack Scenario:* Capri runs for 72 hours continuously in Hibernated Mini or Awake Mini mode.
   - *Failure Mode:* Continuous `requestAnimationFrame` and particle generation accumulates garbage collector strain or memory leaks in 2D context paths.
   - *Defense:* In Hibernated Mini, RAF loop is completely paused or throttled to 1 FPS via `setTimeout(1000)`. Particles are pre-allocated in a fixed static pool of 16 particles (no dynamic `new Object()` inside the render loop).

### Subsystem 2: Rolling Ring-Buffer Instant Replay ("Clip That")
1. **Edge Case 2.1: Out-Of-Memory (OOM) via Unbounded Blob Allocation**
   - *Attack Scenario:* System audio or 60 FPS video capture produces unexpectedly large chunks (e.g. 4K 144Hz desktop), or buffer array fails to shift old elements.
   - *Failure Mode:* Electron renderer process memory balloons to 2-3 GB, triggering Chromium crash error 11 (OOM).
   - *Defense:* Hard cap of max 30 chunks (for 60s) or 15 chunks (for 30s) AND total byte size cap of 120MB. If accumulated buffer exceeds 120MB, oldest chunks are aggressively dropped regardless of chunk count.
2. **Edge Case 2.2: Stream Interruption Mid-Record / Display Media Revocation**
   - *Attack Scenario:* User changes display resolution, or Windows UAC secure desktop darkens the screen, killing the active WebRTC desktop capture track.
   - *Failure Mode:* `MediaRecorder.ondataavailable` stops firing, buffer freezes with empty or stale data, subsequent "Clip that" attempts fail or produce corrupted 0-byte MP4s.
   - *Defense:* Track listener on `videoTrack.onended` and watchdog checking last chunk timestamp. If no chunk received for > 5 seconds during active buffer mode, automatically restart display capture pipeline silently.
3. **Edge Case 2.3: FFmpeg Transcoding Hang / Process Zombie**
   - *Attack Scenario:* Disk write error, antivirus file-locking on temp file, or corrupted WebM header causes `ffmpeg` child process to hang indefinitely.
   - *Failure Mode:* Main process locks up waiting for `ffmpeg` promise, IPC freezes, disk temp folder accumulates orphaned gigabytes.
   - *Defense:* Spawn `ffmpeg` with strict 8-second timeout (`AbortController` / `setTimeout` with `SIGKILL`), clean up temp files in `finally` block, and validate output file exists and is > 10KB before replying.

### Subsystem 3: Multi-Provider AI Vault & Edge-TTS
1. **Edge Case 3.1: Cascading Rate Limit (429) & Malformed JSON**
   - *Attack Scenario:* Primary Groq API key hits daily rate limit; secondary OpenRouter key is invalid/expired; tertiary local Ollama is offline.
   - *Failure Mode:* Infinite retry loops or unhandled Promise rejections freeze chat UI with endless spinner.
   - *Defense:* Circuit breaker pattern: each provider has a failure counter. If 429/401 occurs, provider is marked inactive for 60 seconds and auto-failover advances down the chain. If all providers fail, a clean fallback error message is rendered immediately with a button to open Settings.
2. **Edge Case 3.2: Edge-TTS WebSocket Connection Drop & Text Truncation**
   - *Attack Scenario:* Network hiccup interrupts Microsoft Edge TTS WebSocket mid-sentence.
   - *Failure Mode:* Audio stream cuts off, lipsync gets stuck in open-mouth position, response speech stops.
   - *Defense:* Timeout on initial handshake (3s), fallback to native Web Speech Synthesis (`window.speechSynthesis`) or local audio blip sequence if Edge-TTS fails.
3. **Edge Case 3.3: Incompatible Model Capabilities (Vision on Text-Only Model)**
   - *Attack Scenario:* User asks "look at my screen", but active provider only has a text model (e.g. `llama-3.3-70b-versatile` without vision support).
   - *Failure Mode:* Provider returns 400 Bad Request ("model does not support images").
   - *Defense:* Explicit model separation in settings: `activeChatModel` vs `activeVisionModel`. When Vision task is requested, the system strictly routes only to designated vision-capable models (e.g. Gemini 1.5 Flash or Groq Llama 3.2 Vision).

---

## 2. INVERSION THINKING (Catastrophic Failure Modes & Proactive Defenses)

| Catastrophic Failure | How It Happens | Proactive Defense Architecture |
| :--- | :--- | :--- |
| **1. UI Freezes / Click-through Permanently Broken** | `setIgnoreMouseEvents` gets out of sync with mouse position, leaving Capri unclickable or desktop unclickable. | Never rely solely on DOM `mousemove`. Query OS cursor via Electron `screen.getCursorScreenPoint()` upon state changes, and implement 5-second sanity check. |
| **2. SSD Thrashing / Disk Bloat** | Continuous video recording writes non-stop to disk for hours. | **Zero-Disk Ring Buffer**: Store chunks strictly in RAM FIFO array. Disk is ONLY touched when the user explicitly triggers "Clip That". |
| **3. Microphone / Wake Word Goes Deaf** | Windows power-management suspends Chromium AudioContext or USB headset enters sleep. | Dual Watchdog: Active AudioContext resume check on every wake event + 30s background self-healing pulse. |
| **4. AI API Key Leak or Loss** | Storing plain keys in `.env` overwritten or lost during updates. | Store multi-API vault in local `config.json` in user's `app.getPath('userData')`, completely independent of source code. |

---

## 3. TRADE-OFF MATRICES

### Matrix A: Instant Replay Buffer Architecture
| Criteria | Option 1: File-Segment Chunks on SSD | Option 2: Electron Native C++ Addon (OBS libobs) | Option 3: Web Audio + WebRTC Ring-Buffer in RAM (Selected) |
| :--- | :--- | :--- | :--- |
| **Latency** | Medium (~2.5s to read & remux) | Ultra Low (< 500ms) | **Low (< 1.2s to mux and save)** |
| **RAM Usage** | Lowest (< 15 MB) | Medium (~120 MB) | **Controlled (~30-60 MB in RAM)** |
| **CPU/GPU Overhead** | High (constant SSD I/O + encoder) | High (requires native compile) | **Low (hardware accelerated WebCodecs/MediaRecorder)** |
| **Failure Risk** | High (SSD wear & orphaned temp files) | Extreme (native crashes bring down Electron) | **Low (isolated in memory, auto GC on drop)** |
| **Maintainability** | High | Low (complex node-gyp bindings) | **Highest (standard Web APIs + static ffmpeg)** |
*Decision:* **Option 3** is strictly superior for stability, zero SSD wear, and cross-machine reliability.

### Matrix B: Hologram Projection Deck UI Architecture
| Criteria | Option 1: Separate Transparent BrowserWindow | Option 2: HTML Overlay with CSS 3D Transforms (Selected) | Option 3: Offscreen WebGL Compositor |
| :--- | :--- | :--- | :--- |
| **Latency** | High (IPC message latency between windows) | **Instant (Zero IPC, shared render DOM)** | Low |
| **Memory / CPU** | High (2 separate Electron renderer processes) | **Minimal (Single renderer, GPU layer)** | High (continuous shader draw) |
| **Click Handling** | Buggy (window layering & focus stealing) | **Flawless (Unified hit-testing & click-through)** | Complex (manual raycasting) |
| **Maintainability** | Medium | **Highest (modular CSS + vanilla ES6 modules)** | Lowest |
*Decision:* **Option 2** maintains 1 single unified renderer context, zero IPC latency for animations, and exact alignment with Mini Biochip.

### Matrix C: Multi-Provider AI & TTS Architecture
| Criteria | Option 1: Hardcoded Single Provider | Option 2: Full Proxy Server Process | Option 3: Direct Multi-Provider Vault with Auto-Failover (Selected) |
| :--- | :--- | :--- | :--- |
| **Reliability** | Low (single point of failure) | Medium (extra port & process to manage) | **Highest (instant fallbacks Groq -> Gemini -> OpenRouter -> Ollama)** |
| **Setup Barrier** | Requires manual `.env` edits | Requires docker / local server | **Zero (in-app Cyberpunk Settings Deck)** |
| **TTS Quality** | Robotic browser synthesis | Heavy cloud TTS with high latency | **Ultra Natural Edge-TTS + Web Audio Glitch Filter** |
*Decision:* **Option 3** gives maximum autonomy, multi-key resilience, and professional user experience.
