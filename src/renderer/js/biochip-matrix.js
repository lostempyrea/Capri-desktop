// CAPRI // BIOCHIP BEHAVIOR MATRIX RIG (v2.0)
// High-Performance 60 FPS Procedural Rig for Capri's Living Biochip Construct
// Supports all 8 States:
//   01. IDLE (Mouse tracking, natural blink, floating binary bits)
//   02. WINK & BLINK (Droopy winking lid, sharp X eye, 4-point star lens flare)
//   03. ACTIVE & JOY (Happy crescents ^ ^, jumping equalizer soundwave bars, lip-sync chin triangle)
//   04. SLEEP / OFFLINE (Dim purple tint, slit & X eyes, floating z Z Z)
//   05. PANIC / DRAGGED (Squeezed > < eyes, jitter shake, sweat/alert, bursting broken shards)
//   06. GLITCH / CRITICAL ERROR (RGB chromatic split, scanlines, sliced displacement, ERR_CODE)
//   07. OVERDRIVE (Fractured green armor plates, swarm of eyes, crackling lightning bolts)
//   08. TELEPORT / TRANSIT (Horizontal motion speed streaks, eye beams, pixel dissolve)

import { rand, clamp } from './util.js';

export const MATRIX_STATES = [
  'idle',
  'wink',
  'active',
  'sleep',
  'panic',
  'glitch',
  'overdrive',
  'transit'
];

export class BiochipMatrixRig {
  constructor() {
    // 1. Binary Bits for State 01 (IDLE)
    this.binaryBits = Array.from({ length: 12 }, (_, i) => ({
      x: rand(-46, 46),
      y: rand(-38, 38),
      char: i % 2 === 0 ? '1' : '0',
      speed: rand(0.3, 0.7),
      opacity: rand(0.3, 0.8),
      size: rand(8, 10)
    }));

    // 2. Active & Joy Sparkles for State 03
    this.joySparkles = Array.from({ length: 10 }, () => ({
      x: rand(-48, 48),
      y: rand(-32, 28),
      vy: rand(-0.4, -0.9),
      vx: rand(-0.2, 0.2),
      size: rand(1.5, 3.5),
      alpha: rand(0.4, 0.9),
      phase: rand(0, Math.PI * 2)
    }));

    // 3. Sleep Particles for State 04
    this.sleepZs = [
      { x: 26, y: -8, char: 'z', size: 9, speed: 0.35, offset: 0 },
      { x: 34, y: -18, char: 'Z', size: 12, speed: 0.38, offset: 1.2 },
      { x: 42, y: -30, char: 'Z', size: 15, speed: 0.42, offset: 2.4 }
    ];

    // 4. Panic Shards for State 05
    this.panicShards = Array.from({ length: 12 }, () => ({
      x: rand(-35, 35),
      y: rand(15, 25),
      vx: rand(-1.2, 1.2),
      vy: rand(0.8, 2.5),
      rot: rand(0, Math.PI * 2),
      vrot: rand(-0.08, 0.08),
      size: rand(3, 6.5),
      alpha: rand(0.6, 1)
    }));

    // 5. Overdrive Eyes for State 07
    this.overdriveEyes = [
      { x: -28, y: -8, r: 6.5, lookX: -3, lookY: -2 },
      { x: -14, y: 10, r: 5, lookX: -1, lookY: 3 },
      { x: 0, y: -12, r: 7, lookX: 0, lookY: -4 },
      { x: 16, y: 8, r: 5.5, lookX: 3, lookY: 2 },
      { x: 26, y: -6, r: 7.5, lookX: 4, lookY: -1 },
      { x: -6, y: 4, r: 4.5, lookX: -2, lookY: -1 }
    ];

    // 6. Transit Pixels for State 08
    this.transitPixels = Array.from({ length: 18 }, () => ({
      x: rand(-55, 55),
      y: rand(-22, 22),
      len: rand(8, 28),
      speed: rand(2, 6),
      alpha: rand(0.4, 0.95),
      height: rand(1.5, 3)
    }));

    // Reusable poly helper
    this._poly = (ctx, pts, dx = 0, dy = 0) => {
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px + dx, py + dy) : ctx.moveTo(px + dx, py + dy)));
      ctx.closePath();
    };

    // Base face polygon vertices (at K = 1.0)
    this.facePts = [
      [-48, -18],
      [-12, -22],
      [48, -25],
      [45, 20],
      [14, 22],
      [-14, 22],
      [-45, 22]
    ];

    // Left & Right eye socket vertices
    this.leftSocketPts = [
      [-36, -9],
      [-8, -7],
      [-10, 9],
      [-34, 7]
    ];

    this.rightSocketPts = [
      [8, -7],
      [36, -9],
      [34, 7],
      [10, 9]
    ];
  }

  /**
   * Main Render Entrypoint
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx Center X
   * @param {number} cy Center Y
   * @param {number} k Scale factor (e.g. 0.65)
   * @param {Object} opts
   */
  render(ctx, cx, cy, k, opts = {}) {
    const {
      state = 'idle',
      now = performance.now(),
      look = null,
      eyes = [1, 1],
      audioRms = 0,
      calm = false
    } = opts;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(k, k);

    // Apply State-Specific Pre-Passes & Dynamics
    if (state === 'panic') {
      // Trembling jitter shake
      const jx = rand(-2.5, 2.5);
      const jy = rand(-2.5, 2.5);
      ctx.translate(jx, jy);
    }

    // 1. Draw Environmental Aura / Particles behind mask
    this.drawBackgroundFx(ctx, state, now, calm, audioRms);

    // 2. Draw Main Base Mask Body (with chromatic split for glitch)
    if (state === 'glitch') {
      this.drawGlitchMask(ctx, now);
    } else if (state === 'overdrive') {
      this.drawOverdriveMask(ctx, now);
    } else {
      this.drawStandardMask(ctx, state, now);
    }

    // 3. Draw Eyes / Sockets according to State
    this.drawEyes(ctx, state, now, look, eyes, audioRms);

    // 4. Draw Lip-sync Chin Triangle / Mouth
    this.drawMouth(ctx, state, now, audioRms);

    // 5. Draw Foreground FX & HUD Emotes
    this.drawForegroundFx(ctx, state, now, calm, audioRms);

    ctx.restore();
  }

  // ==========================================
  // 1. BASE MASK RENDERING
  // ==========================================

  drawStandardMask(ctx, state, now) {
    let fill = '#00ff66';
    let border = '#00ff66';
    let bevel = '#7b3dff';
    let shadowColor = '#00ff66';
    let shadowBlur = 12;

    if (state === 'sleep') {
      fill = '#261442';
      border = '#7b3dff';
      bevel = '#140826';
      shadowColor = '#7b3dff';
      shadowBlur = 4;
    } else if (state === 'panic') {
      fill = '#00ff88';
      border = '#ff2152';
      bevel = '#ff0055';
      shadowColor = '#ff2152';
      shadowBlur = 10;
    } else if (state === 'transit') {
      fill = '#00ffaa';
      border = '#00f0ff';
      bevel = '#0066ff';
      shadowColor = '#00f0ff';
      shadowBlur = 18;
    }

    // Deep Violet Bevel Underlayer
    this._poly(ctx, this.facePts, 3, 3);
    ctx.fillStyle = bevel;
    ctx.fill();

    // Main Face Slab
    this._poly(ctx, this.facePts);
    ctx.fillStyle = fill;
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = shadowBlur;
    ctx.fill();

    // Crisp Glowing Border
    ctx.strokeStyle = border;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'miter';
    ctx.stroke();

    ctx.shadowBlur = 0; // Reset shadow for interior
  }

  drawGlitchMask(ctx, now) {
    // 1. Red Shift
    ctx.save();
    this._poly(ctx, this.facePts, -3, -1);
    ctx.fillStyle = '#ff2152';
    ctx.shadowColor = '#ff2152';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();

    // 2. Cyan Shift
    ctx.save();
    this._poly(ctx, this.facePts, 3, 1);
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();

    // 3. Main Green Body with horizontal sliced displacement
    ctx.save();
    this._poly(ctx, this.facePts);
    ctx.fillStyle = '#00ff66';
    ctx.fill();

    // Horizontal scanlines / slices
    ctx.fillStyle = 'rgba(10, 15, 25, 0.7)';
    for (let y = -22; y <= 22; y += 4) {
      if (Math.sin(y * 10 + now * 0.05) > 0.2) {
        ctx.fillRect(-50, y, 100, 2);
      }
    }

    // Sliced displacement glitch bars
    const sliceY = -12 + (Math.sin(now * 0.02) * 14);
    ctx.fillStyle = '#ff2152';
    ctx.fillRect(-48 + rand(-6, 6), sliceY, 96, 3);
    ctx.restore();
  }

  drawOverdriveMask(ctx, now) {
    // Fractured Multi-Layered Armor Plates
    const plateOffset1 = Math.sin(now * 0.01) * 2;
    const plateOffset2 = Math.cos(now * 0.01) * 2;

    // Bevel layer
    this._poly(ctx, this.facePts, 4, 4);
    ctx.fillStyle = '#4c1d95';
    ctx.fill();

    // Plate 1: Left upper shard
    ctx.beginPath();
    ctx.moveTo(-48 + plateOffset1, -18);
    ctx.lineTo(-8, -21);
    ctx.lineTo(-12, 18);
    ctx.lineTo(-45 + plateOffset1, 22);
    ctx.closePath();
    ctx.fillStyle = '#00ff66';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Plate 2: Right upper shard
    ctx.beginPath();
    ctx.moveTo(-4, -21);
    ctx.lineTo(48 - plateOffset2, -25);
    ctx.lineTo(45 - plateOffset2, 20);
    ctx.lineTo(-8, 20);
    ctx.closePath();
    ctx.fillStyle = '#00e575';
    ctx.fill();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Plate 3: Center lower chevron
    ctx.beginPath();
    ctx.moveTo(-18, -6);
    ctx.lineTo(18, -6);
    ctx.lineTo(12, 24);
    ctx.lineTo(-12, 24);
    ctx.closePath();
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.shadowBlur = 0;
  }

  // ==========================================
  // 2. EYE SOCKETS & RETINAS
  // ==========================================

  drawEyes(ctx, state, now, look, eyes, audioRms) {
    // Left eye center: (-22, -1)
    // Right eye center: (22, -3)

    // Handle states with custom eyes first
    if (state === 'wink') {
      this.drawWinkEyes(ctx, now);
      return;
    }
    if (state === 'active') {
      this.drawActiveEyes(ctx, now);
      return;
    }
    if (state === 'sleep') {
      this.drawSleepEyes(ctx);
      return;
    }
    if (state === 'panic') {
      this.drawPanicEyes(ctx);
      return;
    }
    if (state === 'overdrive') {
      this.drawOverdriveEyes(ctx, now);
      return;
    }

    // Default Eyes: 01. IDLE, 06. GLITCH, 08. TRANSIT
    this.drawStandardEyes(ctx, state, now, look, eyes);
  }

  drawStandardEyes(ctx, state, now, look, eyes) {
    const leftOpen = eyes[0] !== undefined ? eyes[0] : 1;
    const rightOpen = eyes[1] !== undefined ? eyes[1] : 1;

    // Sockets (Ink Black Hexagons)
    this._poly(ctx, this.leftSocketPts);
    ctx.fillStyle = '#050811';
    ctx.fill();

    this._poly(ctx, this.rightSocketPts);
    ctx.fillStyle = '#050811';
    ctx.fill();

    // Mouse Tracking Look Vector
    let lx = 0;
    let ly = 0;
    if (look) {
      lx = clamp(look.x * 0.45, -5.5, 5.5);
      ly = clamp(look.y * 0.45, -4.5, 4.5);
    }

    const drawRetina = (cx, cy, open, isRight = false) => {
      if (open < 0.15) {
        // Closed Eye Slit (Blink)
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy);
        ctx.lineTo(cx + 10, cy);
        ctx.strokeStyle = '#00ff66';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        return;
      }

      ctx.save();
      // Clip to socket
      this._poly(ctx, isRight ? this.rightSocketPts : this.leftSocketPts);
      ctx.clip();

      const rx = cx + lx;
      const ry = cy + ly;

      // Electric Blue Iris
      ctx.beginPath();
      ctx.arc(rx, ry, 7.5, 0, Math.PI * 2);
      ctx.fillStyle = state === 'glitch' ? '#ff0055' : '#0066ff';
      ctx.shadowColor = '#00d2ff';
      ctx.shadowBlur = 10;
      ctx.fill();

      // Outer Iris Ring
      ctx.beginPath();
      ctx.arc(rx, ry, 7.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Bright Neon White Pupil
      ctx.beginPath();
      ctx.arc(rx, ry, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 6;
      ctx.fill();

      // Glitch chromatic echo on eye
      if (state === 'glitch') {
        ctx.beginPath();
        ctx.arc(rx + 2, ry, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#00ffff';
        ctx.fill();
      }

      ctx.restore();
    };

    drawRetina(-22, -1, leftOpen, false);
    drawRetina(22, -3, rightOpen, true);
  }

  drawWinkEyes(ctx, now) {
    // Sockets
    this._poly(ctx, this.leftSocketPts);
    ctx.fillStyle = '#050811';
    ctx.fill();
    this._poly(ctx, this.rightSocketPts);
    ctx.fillStyle = '#050811';
    ctx.fill();

    // Left Eye: Drooping/Sleepy Wink
    ctx.save();
    this._poly(ctx, this.leftSocketPts);
    ctx.clip();
    // Drooping blue iris peeking out
    ctx.beginPath();
    ctx.arc(-22, 3, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#0066ff';
    ctx.fill();
    // Eyelid curve covering top half
    ctx.beginPath();
    ctx.moveTo(-36, -2);
    ctx.quadraticCurveTo(-22, 6, -8, -1);
    ctx.lineTo(-8, -12);
    ctx.lineTo(-36, -12);
    ctx.closePath();
    ctx.fillStyle = '#00ff66';
    ctx.fill();
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Right Eye: Sharp Cyber X
    ctx.save();
    const rx = 22;
    const ry = -3;
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10;

    ctx.beginPath();
    ctx.moveTo(rx - 8, ry - 7);
    ctx.lineTo(rx + 8, ry + 7);
    ctx.moveTo(rx + 8, ry - 7);
    ctx.lineTo(rx - 8, ry + 7);
    ctx.stroke();

    // 4-Point Rotating & Pulsing Star Flare at X intersection
    const pulse = 1 + 0.25 * Math.sin(now * 0.008);
    const starRot = now * 0.002;
    ctx.translate(rx, ry);
    ctx.rotate(starRot);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 12;

    const rMain = 13 * pulse;
    const rSub = 4.5 * pulse;
    ctx.beginPath();
    // Long 4 rays
    ctx.moveTo(0, -rMain);
    ctx.lineTo(0, rMain);
    ctx.moveTo(-rMain, 0);
    ctx.lineTo(rMain, 0);
    // Short 4 diagonal rays
    ctx.moveTo(-rSub, -rSub);
    ctx.lineTo(rSub, rSub);
    ctx.moveTo(rSub, -rSub);
    ctx.lineTo(-rSub, rSub);
    ctx.stroke();

    // Center star diamond
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -3.5);
    ctx.lineTo(3.5, 0);
    ctx.lineTo(0, 3.5);
    ctx.lineTo(-3.5, 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  drawActiveEyes(ctx, now) {
    // Sockets
    this._poly(ctx, this.leftSocketPts);
    ctx.fillStyle = '#050811';
    ctx.fill();
    this._poly(ctx, this.rightSocketPts);
    ctx.fillStyle = '#050811';
    ctx.fill();

    // Happy Crescents ^ ^ (Smooth glowing neon arches)
    const drawHappyArc = (cx, cy) => {
      ctx.save();
      ctx.beginPath();
      // Upward happy inverted arch / crescent
      ctx.moveTo(cx - 9, cy + 3);
      ctx.quadraticCurveTo(cx, cy - 6, cx + 9, cy + 3);
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 3.6;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.stroke();

      // Inner white glint
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy + 2);
      ctx.quadraticCurveTo(cx, cy - 4, cx + 6, cy + 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    };

    drawHappyArc(-22, 0);
    drawHappyArc(22, -2);
  }

  drawSleepEyes(ctx) {
    // Sockets
    this._poly(ctx, this.leftSocketPts);
    ctx.fillStyle = '#050811';
    ctx.fill();
    this._poly(ctx, this.rightSocketPts);
    ctx.fillStyle = '#050811';
    ctx.fill();

    // Left Eye: Flat Sleepy Slit -
    ctx.beginPath();
    ctx.moveTo(-31, 0);
    ctx.lineTo(-13, 0);
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Right Eye: Dim X Mark
    const rx = 22;
    const ry = -2;
    ctx.beginPath();
    ctx.moveTo(rx - 7, ry - 6);
    ctx.lineTo(rx + 7, ry + 6);
    ctx.moveTo(rx + 7, ry - 6);
    ctx.lineTo(rx - 7, ry + 6);
    ctx.strokeStyle = '#6d28d9';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  drawPanicEyes(ctx) {
    // Sockets
    this._poly(ctx, this.leftSocketPts);
    ctx.fillStyle = '#050811';
    ctx.fill();
    this._poly(ctx, this.rightSocketPts);
    ctx.fillStyle = '#050811';
    ctx.fill();

    // Squeezed > < Wedge Eyes
    ctx.save();
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'miter';
    ctx.shadowColor = '#00ff66';
    ctx.shadowBlur = 8;

    // Left Eye: > pointing rightwards
    ctx.beginPath();
    ctx.moveTo(-31, -6);
    ctx.lineTo(-15, 0);
    ctx.lineTo(-31, 6);
    ctx.stroke();

    // Right Eye: < pointing leftwards
    ctx.beginPath();
    ctx.moveTo(31, -8);
    ctx.lineTo(15, -2);
    ctx.lineTo(31, 4);
    ctx.stroke();
    ctx.restore();
  }

  drawOverdriveEyes(ctx, now) {
    ctx.save();
    for (const e of this.overdriveEyes) {
      // Small black eye socket
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 2, 0, Math.PI * 2);
      ctx.fillStyle = '#050811';
      ctx.fill();

      // Electric Blue Iris
      ctx.beginPath();
      ctx.arc(e.x + e.lookX, e.y + e.lookY, e.r, 0, Math.PI * 2);
      ctx.fillStyle = '#0066ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;
      ctx.fill();

      // White Pupil
      ctx.beginPath();
      ctx.arc(e.x + e.lookX, e.y + e.lookY, e.r * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.restore();
  }

  // ==========================================
  // 3. MOUTH & LIP-SYNC
  // ==========================================

  drawMouth(ctx, state, now, audioRms) {
    // Lip-sync chin triangle below face
    const baseY = 24;
    let mouthOffset = 0;
    let mouthScale = 1;

    if (state === 'active') {
      // Dynamic mouth bobbing & scaling proportional to volume
      mouthOffset = Math.sin(now * 0.02) * (2 + audioRms * 5);
      mouthScale = 1 + audioRms * 0.6;
    } else if (state === 'glitch') {
      mouthOffset = rand(-2, 2);
    }

    ctx.save();
    ctx.translate(0, baseY + mouthOffset);
    ctx.scale(mouthScale, mouthScale);

    if (state === 'glitch') {
      // Glitch chromatic split on mouth
      ctx.beginPath();
      ctx.moveTo(-10 - 2, 0);
      ctx.lineTo(10 - 2, 0);
      ctx.lineTo(0 - 2, 14);
      ctx.closePath();
      ctx.fillStyle = '#ff2152';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-10 + 2, 0);
      ctx.lineTo(10 + 2, 0);
      ctx.lineTo(0 + 2, 14);
      ctx.closePath();
      ctx.fillStyle = '#00f0ff';
      ctx.fill();
    }

    // White chin triangle pointing downwards (or slight arrowhead)
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(10, 0);
    ctx.lineTo(0, 14);
    ctx.closePath();

    ctx.fillStyle = state === 'sleep' ? '#7b3dff' : '#ffffff';
    ctx.shadowColor = state === 'sleep' ? '#7b3dff' : '#00f0ff';
    ctx.shadowBlur = state === 'active' ? 14 : 6;
    ctx.fill();

    ctx.strokeStyle = state === 'sleep' ? '#4c1d95' : '#00ff66';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();
  }

  // ==========================================
  // 4. BACKGROUND & FOREGROUND STATE FX
  // ==========================================

  drawBackgroundFx(ctx, state, now, calm, audioRms) {
    // 01. IDLE: Floating Binary Bits (0 & 1)
    if (state === 'idle' && !calm) {
      ctx.save();
      ctx.font = '600 9px monospace';
      ctx.textAlign = 'center';
      for (const bit of this.binaryBits) {
        bit.y -= bit.speed;
        if (bit.y < -45) bit.y = 42;
        ctx.fillStyle = `rgba(56, 189, 248, ${bit.opacity})`;
        ctx.fillText(bit.char, bit.x, bit.y);
      }
      ctx.restore();
    }

    // 03. ACTIVE & JOY: Equalizer Soundwave Bars on Left & Right Flanks
    if (state === 'active') {
      ctx.save();
      const numBars = 4;
      const barW = 3;
      const barGap = 4;

      const drawBars = (baseX, dir) => {
        for (let i = 0; i < numBars; i++) {
          const bx = baseX + dir * (i * (barW + barGap));
          const freq = Math.sin(now * 0.015 + i * 0.8);
          const barH = 6 + Math.abs(freq) * 14 + audioRms * 22;
          const by = -barH / 2;

          ctx.fillStyle = '#00f0ff';
          ctx.shadowColor = '#00f0ff';
          ctx.shadowBlur = 8;
          ctx.fillRect(bx, by, barW, barH);
        }
      };

      drawBars(-52, -1); // Left flank
      drawBars(52, 1);   // Right flank
      ctx.restore();
    }

    // 07. OVERDRIVE: Crackling Lightning Bolts
    if (state === 'overdrive') {
      ctx.save();
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 10;

      const drawBolt = (sx, sy, tx, ty) => {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        const steps = 4;
        let cx = sx;
        let cy = sy;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const nx = sx + (tx - sx) * t + rand(-8, 8);
          const ny = sy + (ty - sy) * t + rand(-8, 8);
          ctx.lineTo(nx, ny);
          cx = nx;
          cy = ny;
        }
        ctx.lineTo(tx, ty);
        ctx.stroke();
      };

      if (Math.random() < 0.65) {
        drawBolt(-48, -20, rand(-65, -75), rand(-45, 10));
        drawBolt(48, -22, rand(65, 75), rand(-45, 10));
        drawBolt(rand(-20, 20), 22, rand(-30, 30), rand(35, 50));
      }
      ctx.restore();
    }

    // 08. TELEPORT / TRANSIT: Speed Streaks & Lens Flare Beams
    if (state === 'transit') {
      ctx.save();
      // Eye laser beams
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 16;
      ctx.fillRect(-85, -2, 170, 2.5);
      ctx.fillRect(-85, -4, 170, 2.5);

      // Trailing speed lines
      ctx.fillStyle = '#00ff66';
      for (const p of this.transitPixels) {
        p.x += p.speed;
        if (p.x > 65) p.x = -65;
        ctx.globalAlpha = p.alpha;
        ctx.fillRect(p.x, p.y, p.len, p.height);
      }
      ctx.restore();
    }
  }

  drawForegroundFx(ctx, state, now, calm, audioRms) {
    // 02. WINK & BLINK: Sparkles & +WINK Tag
    if (state === 'wink') {
      ctx.save();
      ctx.font = '700 9px monospace';
      ctx.fillStyle = '#00ff88';
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 6;
      ctx.fillText('+WINK', 26, 26);
      ctx.restore();
    }

    // 03. ACTIVE & JOY: Floating Cyan Sparkles & STIM_ACTIVE
    if (state === 'active' && !calm) {
      ctx.save();
      for (const s of this.joySparkles) {
        s.y += s.vy;
        s.x += s.vx;
        if (s.y < -45) {
          s.y = 25;
          s.x = rand(-48, 48);
        }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 240, 255, ${s.alpha})`;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 6;
        ctx.fill();
      }

      ctx.font = '600 8px monospace';
      ctx.fillStyle = '#00f0ff';
      ctx.fillText('STIM_ACTIVE', 18, 30);
      ctx.restore();
    }

    // 04. SLEEP: Floating z Z Z Letters
    if (state === 'sleep' && !calm) {
      ctx.save();
      ctx.font = '700 13px monospace';
      ctx.fillStyle = '#a855f7';
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 8;
      for (const z of this.sleepZs) {
        const driftY = ((now * 0.02 * z.speed + z.offset * 15) % 40);
        const curY = z.y - driftY;
        const curX = z.x + Math.sin(now * 0.003 + z.offset) * 4;
        ctx.font = `700 ${z.size}px monospace`;
        ctx.fillText(z.char, curX, curY);
      }
      ctx.restore();
    }

    // 05. PANIC: Broken Green Polygon Shards & Sweat Teardrop
    if (state === 'panic') {
      ctx.save();
      // Sweat Teardrop dripping on left temple
      ctx.beginPath();
      ctx.arc(-42, -6, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 6;
      ctx.fill();

      // Bursting Broken Shards tumbling downwards
      for (const s of this.panicShards) {
        s.y += s.vy;
        s.x += s.vx;
        s.rot += s.vrot;
        if (s.y > 55) {
          s.y = 20;
          s.x = rand(-35, 35);
        }
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.fillStyle = '#00ff66';
        ctx.shadowColor = '#00ff66';
        ctx.shadowBlur = 6;
        ctx.fillRect(-s.size / 2, -s.size / 2, s.size, s.size);
        ctx.restore();
      }

      // ALERT: DRAG Text
      ctx.font = '700 8px monospace';
      ctx.fillStyle = '#ff2152';
      ctx.shadowColor = '#ff2152';
      ctx.shadowBlur = 6;
      ctx.textAlign = 'center';
      ctx.fillText('ALERT: DRAG', 0, 42);
      ctx.restore();
    }

    // 06. GLITCH: ERR_CODE Flasher
    if (state === 'glitch') {
      ctx.save();
      ctx.font = '700 8px monospace';
      ctx.fillStyle = '#ff2152';
      ctx.shadowColor = '#ff2152';
      ctx.shadowBlur = 8;
      ctx.fillText('ERR_CODE', -46, -26);
      ctx.fillText('0xDEAD', 26, 26);
      ctx.restore();
    }

    // 08. TRANSIT: WARP_TRANSIT_ACTIVE
    if (state === 'transit') {
      ctx.save();
      ctx.font = '700 8px monospace';
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;
      ctx.fillText('WARP_TRANSIT_ACTIVE', -25, -28);
      ctx.restore();
    }
  }
}
