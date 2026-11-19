import React, { useEffect, useRef, useState } from 'react';

interface Props {
  onFinished: () => void;
  /** 有声自动播放被浏览器拦截时为 true：提示用户点击开声 */
  soundBlocked?: boolean;
}

/**
 * 开场动画：2D  Canvas 粒子圣诞树「汇聚成型」效果
 * 灵感来源：星光圣诞-雪景版.html（已按本站金色冬日主题重新配色）
 * 流程：星光尘埃从四周飞入 → 树体逐层汇聚 → 丝带缠绕 → 顶星点亮
 *       → 停留片刻后自动淡出（也可点击跳过）
 */

const TAU = 2 * Math.PI;
const TREE_HEIGHT = 453;
const ASSEMBLED = 4.4;
const HOLD_SECONDS = 1.7;
const FADE_MS = 1300;

// 金色冬日配色（由深金到暖白）
const palette = [
  [255, 190, 100], [255, 208, 130], [255, 224, 160],
  [255, 238, 200], [255, 248, 230]
];
const ink = palette.map(c => c.join(','));

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (v: number) => v * v * (3 - 2 * v);
const smooth = (a: number, b: number, x: number) => ease(clamp((x - a) / (b - a)));

let randomState = 1225;
function random() {
  randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
  return randomState / 4294967296;
}
const bell = () => random() + random() + random() - 1.5;
const choose = (weights: number[]) => {
  let chance = random();
  for (let i = 0; i < weights.length; i++) {
    chance -= weights[i];
    if (chance < 0) return i;
  }
  return weights.length - 1;
};

const BRANCH_TIERS = 11;
const WRAP_TURNS = 4.25;
const WRAP_OFFSET = .42;

function envelope(height: number) {
  return 180 * Math.pow(1 - clamp(height), 1.14) + 2;
}

function branchRadius(height: number, angle: number) {
  const fringe = .010 * Math.sin(angle * 5 + height * 40) + .006 * Math.sin(angle * 9 - height * 63);
  const tier = clamp((height + fringe) * BRANCH_TIERS, 0, BRANCH_TIERS - .001);
  const taper = 1 - (tier % 1) * .26;
  const twigs = .96 + .044 * Math.cos(7 * angle + Math.floor(tier) * 2.38) +
    .027 * Math.cos(13 * angle - Math.floor(tier) * 1.52);
  return envelope(height) * taper * twigs;
}

function ribbonAngle(height: number, spin: number) {
  return height * TAU * WRAP_TURNS + spin + WRAP_OFFSET;
}

interface TreePoint {
  x: number; z: number; y: number; kind: number;
  brightness: number; size: number; tint: number;
  phaseSin: number; phaseCos: number;
  delay: number; origin: number; distance: number; lift: number;
}

const tree: TreePoint[] = [];
function addTreePoint(angle: number, radius: number, y: number, kind: number, brightness: number, size: number, tint: number) {
  const phase = random() * TAU;
  tree.push({
    x: Math.cos(angle) * radius, z: Math.sin(angle) * radius,
    y, kind, brightness, size, tint,
    phaseSin: Math.sin(phase), phaseCos: Math.cos(phase),
    delay: random() * .97,
    origin: random() * TAU,
    distance: 240 + random() * 390,
    lift: (random() - .51) * 580
  });
}

// 深色内部层次，把雪的层次连成整体树冠
for (let i = 0; i < 3540; i++) {
  const height = Math.pow(random(), 1.65);
  const angle = random() * TAU;
  const radius = branchRadius(height, angle) * (.12 + .86 * Math.sqrt(random()));
  addTreePoint(angle, radius, height * TREE_HEIGHT + bell() * 9, 0, .13 + random() * .32,
    .68 + Math.pow(random(), 2) * 1.47, choose([.38, .36, .17, .085, .005]));
}

// 附着在枝干表面的积雪，外缘更厚
for (let i = 0; i < 12920; i++) {
  const height = Math.pow(random(), 1.46);
  const angle = random() * TAU;
  const tips = .5 + .5 * Math.cos(angle * 7 + height * 89);
  const patch = .5 + .5 * Math.cos(angle * 3 - height * 36 + 1.1) *
    Math.sin(angle * 8 + height * 83);
  const radius = branchRadius(height, angle) * (.64 + .38 * Math.pow(random(), .57)) + bell() * 7;
  const y = height * TREE_HEIGHT + bell() * (8 - 3 * height);
  const size = .61 + Math.pow(random(), 2.22) * (1.73 + tips * .69);
  const brightness = (.24 + .56 * random()) * (.71 + .33 * patch + .12 * tips);
  addTreePoint(angle, radius, y, 2, brightness, size, choose([.018, .121, .314, .535, .012]));
}

// 每一层外缘的雪团更亮
for (let tier = 0; tier < BRANCH_TIERS; tier++) {
  const layer = tier / BRANCH_TIERS;
  const count = Math.round(250 + 1290 * Math.pow(1 - layer, 1.65));
  for (let i = 0; i < count; i++) {
    const angle = random() * TAU;
    const lobes = Math.cos(angle * (tier < 5 ? 7 : 5) + tier * 2.38);
    const height = (tier + .18 + lobes * .105 + bell() * .18 +
      Math.pow(random(), 2) * .18) / BRANCH_TIERS;
    const outer = branchRadius(height, angle);
    const depth = .55 + .49 * Math.pow(random(), .58);
    const radius = outer * depth + bell() * (4.5 - 2.3 * layer);
    const y = height * TREE_HEIGHT + bell() * (7.3 - layer * 3.6);
    const brightness = (.47 + random() * .40) * (.86 + lobes * .12);
    const size = .94 + Math.pow(random(), 2.25) * (1.85 - layer * .48);
    addTreePoint(angle, radius, y, 3, brightness, size, choose([.005, .026, .216, .75, .003]));
  }
}

// 丝带上的闪光粒子
for (let i = 0; i < 1410; i++) {
  const height = Math.pow(random(), 1.29);
  const angle = ribbonAngle(height, 0) + bell() * .44;
  const radius = envelope(height) * 1.036 + bell() * (7 - 3 * height);
  addTreePoint(angle, radius, height * TREE_HEIGHT + bell() * 8 + 3,
    1, .33 + random() * .52, .63 + Math.pow(random(), 2.65) * 1.46,
    choose([.025, .106, .214, .333, .322]));
}

const stars = Array.from({ length: 275 }, () => ({
  x: random(), y: random(), phase: random() * TAU,
  size: .52 + Math.pow(random(), 5) * 1.65,
  strength: .21 + random() * .58,
  tint: choose([.12, .11, .21, .31, .25])
}));

const dust = Array.from({ length: 2230 }, () => ({
  angle: random() * TAU,
  radius: 23 + 555 * Math.pow(random(), 1.14),
  height: -13 + 22 * random() + Math.pow(random(), 5) * 12,
  size: .39 + Math.pow(random(), 3) * 1.64,
  phase: random() * TAU,
  strength: .11 + .53 * random(),
  tint: choose([.29, .31, .22, .16, .02])
}));

const flakes = Array.from({ length: 268 }, (_, index) => ({
  x: random(), y: random(), phase: random() * TAU,
  speed: .022 + Math.pow(random(), 1.6) * .065,
  sway: .009 + .027 * random(),
  size: .61 + Math.pow(random(), 2.7) * 2.35,
  strength: .30 + random() * .42,
  glyph: index < 19
}));

const glints = Array.from({ length: 39 }, () => ({
  height: random() * .91, phase: random() * TAU,
  frequency: 1.05 + random() * 2.5, size: 2 + random() * 5
}));

const IntroOverlay: React.FC<Props> = ({ onFinished, soundBlocked }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dismissRef = useRef<() => void>(() => {});
  const [fading, setFading] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) { onFinished(); return; }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const stackedLayout = window.matchMedia('(orientation: portrait), (max-width: 650px)');
    const shortLandscape = window.matchMedia('(orientation: landscape) and (max-height: 450px)');

    // 按颜色与不透明度分桶，减少 canvas 状态切换
    const shadeSteps = 8;
    const buckets: number[][] = Array.from({ length: palette.length * shadeSteps }, () => []);
    const bucketColors = buckets.map((_, i) =>
      'rgba(' + ink[Math.floor(i / shadeSteps)] + ',' + Math.pow((i % shadeSteps + 1) / shadeSteps, 1.3) + ')');
    const opacitySteps = Array.from({ length: 257 }, (_, i) =>
      clamp(Math.round(Math.pow(i / 256, 1 / 1.3) * shadeSteps) - 1, 0, shadeSteps - 1));

    let width = 0, height = 0, ratio = 1, compact = false;
    let centerX = 0, baseY = 0, scale = 1, verticalScale = 1;
    let background: HTMLCanvasElement | null = null;
    let playhead = reducedMotion.matches ? ASSEMBLED : 0;
    let lastTime = 0;
    let frame = 0;
    let pointerX = 0, pointerY = 0, driftX = 0, driftY = 0;
    let dismissed = false;
    let hintTimer = 0;

    function point(x: number, y: number, size: number, opacity: number, tint: number) {
      if (opacity < .033 || x < -15 || x > width + 15 || y < -15 || y > height + 15) return;
      const step = opacitySteps[Math.min(256, Math.round(opacity * 256))];
      buckets[tint * shadeSteps + step].push(x, y, size);
    }

    function paintPoints() {
      for (let i = 0; i < buckets.length; i++) {
        const batch = buckets[i];
        if (!batch.length) continue;
        ctx.fillStyle = bucketColors[i];
        for (let j = 0; j < batch.length; j += 3) {
          const size = batch[j + 2];
          ctx.fillRect(batch[j] - size / 2, batch[j + 1] - size / 2, size, size);
        }
        batch.length = 0;
      }
    }

    function makeGlow(tint: number) {
      const layer = document.createElement('canvas');
      layer.width = layer.height = 96;
      const brush = layer.getContext('2d')!;
      const glow = brush.createRadialGradient(48, 48, 0, 48, 48, 48);
      glow.addColorStop(0, 'rgba(255,250,240,.94)');
      glow.addColorStop(.09, 'rgba(' + ink[tint] + ',.69)');
      glow.addColorStop(.23, 'rgba(' + ink[tint] + ',.24)');
      glow.addColorStop(.55, 'rgba(' + ink[tint] + ',.055)');
      glow.addColorStop(1, 'rgba(' + ink[tint] + ',0)');
      brush.fillStyle = glow;
      brush.fillRect(0, 0, 96, 96);
      return layer;
    }

    const deepGoldGlow = makeGlow(0);
    const paleGoldGlow = makeGlow(4);

    function haze(brush: CanvasRenderingContext2D, x: number, y: number, radiusX: number, radiusY: number, stops: [number, string][]) {
      brush.save();
      brush.translate(x, y);
      brush.scale(radiusX, radiusY);
      const gradient = brush.createRadialGradient(0, 0, 0, 0, 0, 1);
      for (const [offset, color] of stops) gradient.addColorStop(offset, color);
      brush.fillStyle = gradient;
      brush.fillRect(-1, -1, 2, 2);
      brush.restore();
    }

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      if (!width || !height) return;
      compact = stackedLayout.matches && !shortLandscape.matches;
      ratio = Math.min(window.devicePixelRatio || 1, compact ? 1.55 : 1.85);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      centerX = width * .5;
      const greetingEl = document.querySelector('.intro-greeting');
      const greetingTop = greetingEl ? greetingEl.getBoundingClientRect().top : height * .72;
      const availableTop = height * (compact ? .115 : .07);
      baseY = greetingTop - Math.max(17, height * (compact ? .022 : .030));
      scale = Math.min((baseY - availableTop) / 515, width / (compact ? 439 : 740), 2.05);
      scale = Math.max(.12, scale);
      verticalScale = compact ? Math.min((baseY - availableTop) / 500, scale * 1.20) : scale;
      verticalScale = Math.max(.12, verticalScale);

      background = document.createElement('canvas');
      background.width = canvas.width;
      background.height = canvas.height;
      const brush = background.getContext('2d', { alpha: false })!;
      brush.setTransform(ratio, 0, 0, ratio, 0, 0);
      const night = brush.createLinearGradient(0, 0, width * .22, height);
      night.addColorStop(0, '#141a2e');
      night.addColorStop(.53, '#0c1122');
      night.addColorStop(1, '#070b18');
      brush.fillStyle = night;
      brush.fillRect(0, 0, width, height);

      // 树冠与地面的暖金色光晕
      haze(brush, centerX, baseY - 265 * scale, 380 * scale, 382 * scale,
        [[0, '#4a3a1ecf'], [.39, '#33270fa9'], [.71, '#22180669'], [1, '#22180600']]);
      haze(brush, centerX, baseY + 3 * scale, 493 * scale, 101 * scale,
        [[0, '#7a5a20a3'], [.43, '#4d3a1563'], [1, '#2c1f0800']]);

      // 几道斜射的暖光
      for (const [location, slant, spread, intensity] of [
        [.20, -.37, .13, '42'], [.31, -.23, .11, '31'], [.43, -.17, .18, '28'],
        [.69, .31, .15, '37'], [.79, .15, .22, '28'], [.89, .32, .13, '27']
      ] as [number, number, number, string][]) {
        brush.save();
        brush.translate(width * location, height * .115);
        brush.rotate(slant);
        haze(brush, 0, 0, Math.max(42, width * spread), height * .57,
          [[0, '#d9a95c' + intensity], [.5, '#b0803a22'], [1, '#b0803a00']]);
        brush.restore();
      }
      render();
    }

    // 带轻微倾斜的透视投影，展现螺旋丝带的纵深
    const projection = { x: 0, y: 0, depth: 1 };
    function project(x: number, y: number, z: number) {
      const cameraDepth = .9922 * z - .125 * (y - 220);
      const factor = 935 / (935 - cameraDepth);
      projection.x = centerX + (x + driftX) * scale * factor;
      projection.y = baseY - (y * .9922 + z * .125 - driftY) * verticalScale * factor;
      projection.depth = factor;
      return projection;
    }

    function glow(sprite: HTMLCanvasElement, x: number, y: number, size: number, opacity: number) {
      ctx.globalAlpha = clamp(opacity);
      ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
      ctx.globalAlpha = 1;
    }

    function cross(x: number, y: number, size: number, opacity: number, color: string) {
      ctx.globalAlpha = clamp(opacity);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x - size, y);
      ctx.quadraticCurveTo(x - .68, y - .55, x, y - size);
      ctx.quadraticCurveTo(x + .68, y - .55, x + size, y);
      ctx.quadraticCurveTo(x + .68, y + .55, x, y + size);
      ctx.quadraticCurveTo(x - .68, y + .55, x - size, y);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    function drawStars(time: number, unit: number) {
      for (const star of stars) {
        const x = star.x * width + driftX * .18;
        const y = star.y * height + driftY * .18;
        const pulse = .72 + .28 * Math.sin(time * 1.4 + star.phase);
        point(x, y, star.size * unit, pulse * star.strength, star.tint);
        if (star.size > 1.88 && pulse > .8) {
          glow(paleGoldGlow, x, y, star.size * 9 * unit, pulse * star.strength * .52);
        }
      }
      paintPoints();

      // 偶发的流星
      const passage = (time + 3) % 12.5;
      if (passage > 1.3 || time < ASSEMBLED || reducedMotion.matches) return;
      const fraction = passage / 1.3;
      const x = width * (.26 + .47 * fraction);
      const y = height * (.07 + .20 * fraction);
      const tail = Math.min(width * .15, 128) * Math.sin(Math.PI * fraction);
      const endY = y - tail * .36;
      const trail = ctx.createLinearGradient(x, y, x - tail - .01, endY);
      trail.addColorStop(0, '#ffedccdd');
      trail.addColorStop(.2, '#ffd88a6b');
      trail.addColorStop(1, '#ffd88a00');
      ctx.strokeStyle = trail;
      ctx.lineWidth = .9;
      ctx.beginPath();
      ctx.moveTo(x - tail, endY);
      ctx.lineTo(x, y);
      ctx.stroke();
      glow(paleGoldGlow, x, y, 18 * unit, Math.sin(Math.PI * fraction));
    }

    function drawGround(time: number, unit: number, presence: number) {
      const orbit = time * .115;
      const stride = compact ? 2 : 1;
      for (let i = 0; i < dust.length; i += stride) {
        const mote = dust[i];
        const angle = mote.angle + orbit * (1.9 - mote.radius * .002) + mote.radius * .0089;
        const r = mote.radius + 9 * Math.sin(angle * 2 + mote.phase);
        const position = project(Math.cos(angle) * r, mote.height, Math.sin(angle) * r);
        const light = (.63 + .37 * Math.sin(time * 2.7 + mote.phase)) * mote.strength;
        const rings = .46 + .54 * Math.pow(.5 + .5 * Math.cos(r * .082 - angle * 1.6), 2);
        const fade = Math.max(.18, 1 - mote.radius / 646);
        point(position.x, position.y, mote.size * unit * position.depth, light * rings * fade * presence, mote.tint);
      }
      paintPoints();

      const ring = project(0, .8, 0);
      const x = ring.x;
      const y = ring.y;
      for (let i = 0; i < 8; i++) {
        const radius = (102 + i * 30) * scale;
        const sweep = orbit * (1.8 - i * .13) + i * 1.73;
        ctx.strokeStyle = 'rgba(255,206,130,' + (.31 / (1 + i * .27) * presence) + ')';
        ctx.lineWidth = (.86 - i * .043) * unit;
        ctx.beginPath();
        ctx.ellipse(x, y + i * 1.7 * scale, radius, radius * .183, 0, sweep, sweep + .82 + i * .053);
        ctx.stroke();
      }
    }

    function drawRibbon(time: number, unit: number, spin: number) {
      const reveal = smooth(1.24, 3.85, time);
      if (reveal === 0) return;
      for (const front of [false, true]) {
        ctx.beginPath();
        let connected = false;
        for (let i = 0; i <= Math.ceil(480 * reveal); i++) {
          const h = i / 480;
          const theta = ribbonAngle(h, spin);
          const radius = envelope(h) * 1.036;
          const z = Math.sin(theta) * radius;
          if ((z >= 0) !== front) {
            connected = false;
            continue;
          }
          const position = project(Math.cos(theta) * radius, h * TREE_HEIGHT + 3, z);
          if (connected) ctx.lineTo(position.x, position.y);
          else ctx.moveTo(position.x, position.y);
          connected = true;
        }
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const [w, color] of [
          [14.0, 'rgba(255,196,110,.038)'],
          [6.2, 'rgba(255,214,140,.12)'],
          [2.6, 'rgba(255,228,170,.27)'],
          [.95, 'rgba(255,244,220,.48)']
        ] as [number, string][]) {
          ctx.globalAlpha = (front ? .88 : .42) * Math.min(1, reveal * 3);
          ctx.lineWidth = w * unit;
          ctx.strokeStyle = color;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      if (reveal < 1) {
        const theta = ribbonAngle(reveal, spin);
        const radius = envelope(reveal) * 1.036;
        const tip = project(Math.cos(theta) * radius, reveal * TREE_HEIGHT + 3, Math.sin(theta) * radius);
        const sparkle = Math.sin(Math.PI * reveal) * .95;
        glow(deepGoldGlow, tip.x, tip.y, 108 * unit, sparkle);
        cross(tip.x, tip.y, 11 * unit, sparkle, '#fff6e4');
      }
    }

    function drawTopper(time: number, unit: number) {
      const reveal = smooth(2.9, 4.35, time);
      if (!reveal) return;
      const star = project(0, TREE_HEIGHT + 23, 4);
      const pulse = .81 + .19 * Math.sin(time * 2.8);
      const radius = 18 * unit;
      glow(deepGoldGlow, star.x, star.y, radius * 11, reveal * .64);
      glow(paleGoldGlow, star.x, star.y, radius * 4.5, reveal * pulse);
      ctx.save();
      ctx.translate(star.x, star.y);
      ctx.rotate(Math.PI / 4);
      cross(0, 0, radius * .76, reveal * .46, '#ffe1a8');
      ctx.restore();
      cross(star.x, star.y, radius, reveal * pulse, '#fff6e4');
    }

    function drawTree(time: number, unit: number) {
      const spin = time * .176;
      const cosSpin = Math.cos(spin);
      const sinSpin = Math.sin(spin);
      const sinPulse = Math.sin(time * 2.7);
      const cosPulse = Math.cos(time * 2.7);
      const breathing = 1 + .01 * Math.sin(time * 1.3);
      const assembling = time < ASSEMBLED;
      const stride = compact ? 2 : 1;
      const snowPointUnit = unit * (compact ? 1.10 : 1.02);
      drawRibbon(time, unit, spin);

      for (let i = 0; i < tree.length; i += stride) {
        const flake = tree[i];
        let x = (flake.x * cosSpin - flake.z * sinSpin) * breathing;
        let z = (flake.x * sinSpin + flake.z * cosSpin) * breathing;
        const pulse = flake.phaseSin * cosPulse + flake.phaseCos * sinPulse;
        let altitude = flake.y + pulse * (flake.kind >= 2 ? .72 : 1.4);
        let reveal = 1;

        if (assembling) {
          const delay = clamp(flake.y / TREE_HEIGHT) * .97 + flake.delay;
          const arrival = smooth(delay, delay + 2.21, time);
          const incoming = flake.origin + time * (1.05 + .55 * flake.delay);
          const orbit = (1 - arrival) * flake.distance * (.83 + arrival * .27);
          x = x * arrival + Math.cos(incoming) * orbit;
          z = z * arrival + Math.sin(incoming) * orbit * .58;
          altitude = mix(215 + flake.lift, altitude, arrival);
          reveal = (.21 + .79 * arrival) * smooth(0, .63, time);
        }

        const position = project(x, altitude, z);
        const settled = flake.kind >= 2;
        const branchCap = flake.kind === 3;
        const lit = branchCap ? clamp(.80 + z / 320, .34, 1.13) :
          clamp((settled ? .77 : .68) + z / 246, .37, 1.15);
        const twinkle = settled ? .91 + .09 * pulse : .76 + .24 * pulse;
        const size = flake.size * (settled ? snowPointUnit : unit) * position.depth;
        point(position.x, position.y, size, flake.brightness * twinkle * lit * reveal, flake.tint);
      }
      paintPoints();

      // 丝带上的游走闪光
      const ribbonReady = smooth(1.6, 3.7, time);
      for (const glint of glints) {
        const pulse = Math.pow(.5 + .5 * Math.sin(time * glint.frequency + glint.phase), 11);
        if (pulse * ribbonReady < .16) continue;
        const theta = ribbonAngle(glint.height, spin);
        const radius = envelope(glint.height) * 1.036;
        const z = Math.sin(theta) * radius;
        const position = project(Math.cos(theta) * radius, glint.height * TREE_HEIGHT + 3, z);
        const brightness = pulse * ribbonReady * clamp(.69 + z / 270, .25, 1);
        const size = glint.size * unit;
        glow(glint.phase > 3 ? deepGoldGlow : paleGoldGlow, position.x, position.y, size * 5.8, brightness * .68);
        cross(position.x, position.y, size, brightness * .83, '#fff6e4');
      }
      drawTopper(time, unit);
    }

    function drawSnowflakeShape(x: number, y: number, radius: number, angle: number, opacity: number) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.globalAlpha = opacity;
      ctx.lineWidth = .65;
      ctx.strokeStyle = '#ffeedd';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const direction = i * Math.PI / 3;
        const dx = Math.cos(direction);
        const dy = Math.sin(direction);
        const arm = radius * .69;
        ctx.moveTo(0, 0);
        ctx.lineTo(dx * radius, dy * radius);
        ctx.moveTo(dx * arm - dy * radius * .20, dy * arm + dx * radius * .20);
        ctx.lineTo(dx * radius * .48, dy * radius * .48);
        ctx.lineTo(dx * arm + dy * radius * .20, dy * arm - dx * radius * .20);
      }
      ctx.stroke();
      ctx.restore();
    }

    function drawSnowfall(time: number, unit: number) {
      const stride = compact ? 2 : 1;
      for (let i = 0; i < flakes.length; i += stride) {
        const flake = flakes[i];
        const path = (flake.y + time * flake.speed) % 1;
        const swing = Math.sin(time * .82 + flake.phase);
        const x = width * (flake.x + swing * flake.sway) + driftX * .42;
        const y = path * (height + 38) - 19;
        const fade = smooth(0, .08, path) * (1 - smooth(.91, 1, path));
        const brightness = fade * flake.strength * (.82 + .18 * swing);
        const nearTree = Math.abs(x - centerX) < scale * 190 && y < baseY && y > baseY - TREE_HEIGHT * verticalScale;
        if (flake.glyph && !nearTree) {
          drawSnowflakeShape(x, y, (2.5 + flake.size) * unit, time * .24 + flake.phase, brightness * .73);
        } else {
          point(x, y, flake.size * unit, brightness, i % 5 === 0 ? 2 : 3);
          if (flake.size > 2.24 && !nearTree) glow(deepGoldGlow, x, y, 17 * unit, brightness * .27);
        }
      }
      paintPoints();
    }

    function render() {
      if (!background) return;
      const unit = clamp(scale, .62, 1.46);
      const presence = .3 + smooth(.25, 2.9, playhead) * .7;
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(background, 0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      drawStars(playhead, unit);
      drawGround(playhead, unit, presence);
      drawTree(playhead, unit);
      drawSnowfall(playhead, unit);
      ctx.globalCompositeOperation = 'source-over';
    }

    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      setFading(true);
      window.setTimeout(() => {
        if (!finishedRef.current) {
          finishedRef.current = true;
          onFinished();
        }
      }, FADE_MS);
    }
    dismissRef.current = dismiss;

    function tick(now: number) {
      frame = 0;
      if (document.hidden) return;
      const elapsed = lastTime ? Math.min((now - lastTime) / 1000, .064) : 0;
      lastTime = now;
      playhead += elapsed;
      const follow = 1 - Math.exp(-elapsed * 4);
      driftX = mix(driftX, pointerX, follow);
      driftY = mix(driftY, pointerY, follow);
      render();

      if (playhead >= ASSEMBLED && !hintVisible) setHintVisible(true);
      if (playhead >= ASSEMBLED + HOLD_SECONDS && !dismissed) {
        dismiss();
        return;
      }
      frame = requestAnimationFrame(tick);
    }

    function schedule() {
      lastTime = 0;
      if (frame) cancelAnimationFrame(frame);
      frame = !document.hidden ? requestAnimationFrame(tick) : 0;
    }

    // 点击：动画中 → 立即完成汇聚；已成型 → 直接进入主场景
    function handleClick() {
      if (dismissed) return;
      if (playhead < ASSEMBLED) {
        playhead = ASSEMBLED;
        setHintVisible(true);
        render();
      } else {
        dismiss();
      }
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerType === 'touch' || reducedMotion.matches) return;
      pointerX = (event.clientX / width - .5) * 22;
      pointerY = (event.clientY / height - .5) * 12;
    }
    function handlePointerLeave() { pointerX = pointerY = 0; }
    function handleVisibility() { schedule(); }

    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerleave', handlePointerLeave);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('resize', resize);

    resize();

    if (reducedMotion.matches) {
      // 减少动态偏好：展示成型后的静态画面片刻后直接进入
      render();
      hintTimer = window.setTimeout(dismiss, 1600);
    } else {
      schedule();
    }

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(hintTimer);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('resize', resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[100] transition-opacity duration-[1300ms] ease-out ${fading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      style={{ background: '#070b18' }}
      aria-hidden={fading}
    >
      <canvas ref={canvasRef} className="intro-canvas absolute inset-0 w-full h-full block" style={{ touchAction: 'manipulation' }} />

      {/* 暗角 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 44%, transparent 53%, rgba(4,6,14,0.62) 100%)' }}
      />

      {/* 节日问候语 */}
      <header className="intro-greeting absolute text-center pointer-events-none"
              style={{ left: 'max(18px, env(safe-area-inset-left))', right: 'max(18px, env(safe-area-inset-right))', bottom: 'clamp(38px, 6.2vh, 86px)' }}>
        <h1 className="font-display italic m-0"
            style={{
              fontWeight: 500,
              fontSize: 'clamp(35px, 5.25vw, 79px)',
              letterSpacing: '-0.02em',
              lineHeight: 1.09,
              color: '#fff4dd',
              textShadow: '0 2px 9px #17100a, 0 0 28px rgba(255,205,110,0.38)'
            }}>
          Merry Christmas
        </h1>
        <p className="m-0 mt-1.5"
           style={{
             color: '#f0d9a8',
             fontSize: 'clamp(11px, 1.02vw, 15px)',
             letterSpacing: '.22em',
             lineHeight: 1.65,
             textShadow: '0 2px 8px #070b18'
           }}>
          愿今夜的星光，落在你身旁。
        </p>
        <p className={`m-0 mt-3 text-[11px] tracking-[.3em] text-amber-200/70 transition-opacity duration-700 ${hintVisible ? 'opacity-100 shimmer' : 'opacity-0'}`}>
          {soundBlocked ? '🔇 浏览器拦截了自动发声 · 点击任意处进入并开启音乐' : '点击任意处 · 进入璀璨圣诞树'}
        </p>
      </header>

      {/* 跳过按钮 */}
      <button
        type="button"
        onClick={() => dismissRef.current()}
        className="absolute top-4 right-4 z-10 px-3.5 py-1.5 rounded-full border border-amber-200/25 bg-black/50 text-amber-200/80 text-xs tracking-widest backdrop-blur-md hover:border-amber-300/60 hover:text-amber-200 transition-colors cursor-pointer"
        style={{ fontFamily: "'Noto Serif SC', serif" }}
      >
        跳过 ›
      </button>
    </div>
  );
};

export default IntroOverlay;
