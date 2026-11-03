# CAPRI DESKTOP — PROJECT MASTER PLAN

**Status:** Draft / Active
**Date:** 2026-11-01

---

## Phase 1: Architecture & Refactoring (Reducing God Nodes)
- [ ] **Refactor `boot()` in `app.js`**: Split into `LifecycleManager`, `AssetLoader`, and `ServiceRegistry`.
- [ ] **Decouple `Capri` class**: Separate animation state machine from coordinate/physics logic.
- [ ] **Refactor `Chip` & `BiochipMatrixRig`**: Separate procedural animation logic from rendering.
- [ ] **Establish Event Bus**: Implement a central `ipcRenderer` event wrapper to reduce direct dependencies.
- [x] **Clean Root Enforcement**: Move all loose files to `docs/` and `scripts/`. [DONE]

## Phase 2: UI/UX & Interaction Stability
- [ ] **8-State Animation Polish**:
    - [ ] `IDLE`: Improve pupil tracking and floating bits.
    - [ ] `PANIC`: Fix jitter during drag.
    - [ ] `ACTIVE`: Sync soundwave bars with real RMS data.
- [ ] **Quick Bar (Textbox) Stability**: Fix layout alignment and prevent hit-test kinking between Mic and Input.
- [ ] **Intro Sequence Sync**: Ensure startup greeting only triggers AFTER the teleport animation finishes.
- [ ] **Multi-Monitor Edge Clamping**: Better support for various DPI scales and monitor configurations.

## Phase 3: Connecting Isolated Modules (Bridging Knowledge Gaps)
- [ ] **Hardware-to-Biochip (Telemetry)**: Link `HardwareGuardian` to Biochip expression (e.g., Overdrive state when RAM/CPU is high).
- [ ] **Full TTS Lip-Sync Integration**: Sync Biochip mouth movement with the dynamic TTS analyzer.
- [x] **VSCode Agent Hook Extension**: Expand hooks to catch file saves, task failures, and terminal alerts. [DONE]
- [ ] **Discord & Media Synchronization**: Sync Discord voice state with HUD visuals.

## Phase 4: Performance, Security & Release
- [x] **FPS Throttling**: Reduce loop to 1 FPS when `hibernated`. [DONE]
- [x] **Memory Leak Defense**: Limit `InstantReplayBuffer` to 120MB in RAM. [DONE]
- [ ] **AI Provider Circuit Breaker**: Auto-failover logic for AI Chat providers (Groq/Gemini).
- [ ] **Automated Smoke Test Suite**: Expand `scripts/verify-*` to run in a single suite.

---

## Priority Tasks for Next Session
1. **Refactor `boot()`**: The current 1000-line startup function is the biggest stability risk.
2. **Hardware Telemetry**: Connect `HardwareGuardian` to the UI for better ambient feedback.
3. **Lip-Sync Completion**: Match the Biochip's procedural mouth with the AI's speech output.
