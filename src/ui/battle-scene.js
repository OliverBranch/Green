// Cena em pixel art dos incidentes: canvas de 256×144 ampliado sem suavização.
// A cena só desenha e anima. Quem decide o que acontece é o motor (battle.js) e a tela (battle-view.js),
// que chamam os efeitos daqui e aguardam as promessas para encadear a animação na ordem certa.

import { PALETTE as P, sprite, spritePixels, drawText, textWidth, iconCanvas } from './pixel.js';
import { prefersReducedMotion } from './dom.js';

import { workstation, tinted } from './avatar.js';

export const W = 256;
export const H = 144;

const HORIZON = 78;
const ENEMY_X = 166;
const ENEMY_FOOT = 88;
const OP_X = 4;
const OP_Y = H - 46;
const BARRIER_X = 84;

// Cada inimigo é uma pilha de camadas de sprite: [nome, dx, dy, animação]. Tamanho calculado das camadas.
const ENEMIES = {
  moth: { lift: 30, layers: [['mothWings', 0, 0, 'flap'], ['mothBody', 0, 0]] },
  rat: { lift: 6, layers: [['rat', 0, 0, 'squash']] },
  ratking: { lift: 2, layers: [['rat', 0, 9, 'squash'], ['crown', 15, 0, 'bob']] },
  lock: { lift: 0, layers: [['lockShackle', 0, 0, 'shackle'], ['lockBody', 0, 23]] },
  fish: { lift: 24, layers: [['fish', 0, 0, 'swim']] },
  keys: { lift: 20, layers: [['keys', 0, 0, 'float']] },
  probe: { lift: 26, layers: [['probe', 0, 0, 'float']] },
  larva: { lift: 2, layers: [['larva', 0, 0, 'squash']] },
  drop: { lift: 4, layers: [['drop', 0, 0, 'squash']] },
  ghost: { lift: 16, layers: [['ghost', 0, 0, 'float']] },
  penguin: { lift: 0, layers: [['penguin', 0, 0, 'waddle']] },
  beetle: { lift: 2, layers: [['beetle', 0, 0, 'squash']] },
  cloudlet: { lift: 24, layers: [['cloudlet', 0, 0, 'float']] },
  eraser: { lift: 0, layers: [['eraser', 0, 0, 'waddle']] },
  echo: { lift: 2, layers: [['echo', 0, 0, 'bob']] },
  brute: { lift: 0, layers: [['brute', 0, 0, 'squash']] },
  oracle: { lift: 0, layers: [['oracle', 0, 0, 'float']] },
  storm: { lift: 12, layers: [['storm', 0, 0, 'float']] },
  swarm: { lift: 2, layers: [['probe', 0, 24, 'b1'], ['probe', 36, 0, 'b2'], ['probe', 70, 22, 'b3'], ['probe', 18, 46, 'b4'], ['probe', 54, 46, 'b5']] },
};

function enemyDef(kind) {
  const d = ENEMIES[kind] || ENEMIES.moth;
  if (!d.w) {
    let w = 0, h = 0;
    for (const [name, dx, dy] of d.layers) { const img = sprite(name); w = Math.max(w, dx + img.width); h = Math.max(h, dy + img.height); }
    d.w = w; d.h = h;
  }
  return d;
}

export function enemyLayers(kind) { return (ENEMIES[kind] || ENEMIES.moth).layers; }

const rand = (a, b) => a + Math.random() * (b - a);
const ease = (t) => 1 - Math.pow(1 - t, 3);

export function createScene(canvas, { enemy = 'moth', avatar = null, onReady } = {}) {
  const opImg = avatar ? workstation(avatar) : sprite('operator');
  const opHitImg = avatar ? tinted(opImg, P.R) : sprite('operator', P.R);
  const ctx = canvas.getContext('2d');
  canvas.width = W; canvas.height = H;
  ctx.imageSmoothingEnabled = false;
  const reduced = prefersReducedMotion();

  const def = enemyDef(enemy);
  const st = {
    elite: false, boss: false,
    vis: 40, integrity: 1, presence: 1, exposed: false, enraged: false, blind: false,
    shields: 0, posture: false, intentGlow: 0, foeBlock: false, stunned: false,
  };
  const fx = [];
  const particles = [];
  let shake = 0;
  let flash = null;          // { color, a }
  let enemyHit = 0;          // brilho branco após dano
  let enemyKnock = 0;
  let enemyAlpha = 1;
  let enemyGone = false;
  let opHit = 0;
  let barrierPulse = 0;
  let t0 = performance.now();
  let last = t0;
  let raf = 0;
  let running = true;
  const leds = Array.from({ length: 70 }, () => ({ x: Math.floor(rand(0, W)), y: Math.floor(rand(16, HORIZON - 6)), p: rand(0, 6), c: [P.g, P.G, P.A, P.g, P.R][Math.floor(rand(0, 5))] }));
  const dust = Array.from({ length: 26 }, () => ({ x: rand(0, W), y: rand(0, H), s: rand(4, 14) }));
  let noise = [];
  let noiseT = 0;

  function enemyBox() {
    const bob = reduced ? 0 : Math.sin((performance.now() - t0) / (st.enraged ? 260 : 520)) * 2;
    const x = Math.round(ENEMY_X - def.w / 2 + enemyKnock);
    const y = Math.round(ENEMY_FOOT - def.h - def.lift + bob);
    return { x, y, w: def.w, h: def.h, cx: x + def.w / 2, cy: y + def.h / 2 };
  }
  const opMid = () => ({ x: OP_X + 52, y: OP_Y + 8 });

  // ---------- desenho ----------

  function drawBackground(now) {
    const dark = st.blind ? 0.55 : 0;
    // parede de fundo
    const g = ctx.createLinearGradient(0, 0, 0, HORIZON);
    g.addColorStop(0, '#010703');
    g.addColorStop(1, st.enraged ? '#1a0609' : '#05170d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, HORIZON);
    // racks
    for (let i = 0; i < 8; i++) {
      const x = 4 + i * 32;
      ctx.fillStyle = '#03110a';
      ctx.fillRect(x, 14, 26, HORIZON - 14);
      ctx.fillStyle = '#082414';
      ctx.fillRect(x, 14, 26, 1);
      for (let y = 18; y < HORIZON - 4; y += 5) {
        ctx.fillStyle = '#0a2a18';
        ctx.fillRect(x + 2, y, 22, 3);
      }
    }
    for (const l of leds) {
      const on = Math.sin(now / 300 + l.p * 7) > 0.2;
      if (!on) continue;
      ctx.fillStyle = l.c;
      ctx.globalAlpha = 0.35 + 0.5 * Math.min(1, st.vis / 70) - dark * 0.3;
      ctx.fillRect(l.x, l.y, 1, 1);
    }
    ctx.globalAlpha = 1;
    // chão em perspectiva
    ctx.fillStyle = '#020a05';
    ctx.fillRect(0, HORIZON, W, H - HORIZON);
    ctx.strokeStyle = st.enraged ? 'rgba(255,92,120,.18)' : 'rgba(67,255,149,.14)';
    ctx.lineWidth = 1;
    const scroll = ((now / 40) % 12) / 12;
    for (let i = 0; i < 12; i++) {
      const k = (i + scroll) / 12;
      const y = Math.round(HORIZON + Math.pow(k, 2.2) * (H - HORIZON));
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke();
    }
    for (let i = -14; i <= 14; i++) {
      ctx.beginPath();
      ctx.moveTo(ENEMY_X + i * 6 + 0.5, HORIZON);
      ctx.lineTo(ENEMY_X + i * 46 + 0.5, H);
      ctx.stroke();
    }
    // horizonte
    ctx.fillStyle = st.enraged ? 'rgba(255,92,120,.5)' : 'rgba(67,255,149,.35)';
    ctx.fillRect(0, HORIZON, W, 1);
    // partículas de dados subindo
    for (const d of dust) {
      d.y -= d.s * 0.016;
      if (d.y < 0) { d.y = H; d.x = rand(0, W); }
      ctx.fillStyle = st.enraged ? 'rgba(255,92,120,.35)' : 'rgba(67,255,149,.25)';
      ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 2);
    }
  }

  function drawPlatform(now) {
    const cx = ENEMY_X, cy = ENEMY_FOOT + 2;
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ellipse(cx, cy, 40, 7, true);
    const col = st.enraged ? P.R : P.G;
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.5;
    ellipse(cx, cy, 40, 7, false);
    ctx.globalAlpha = 0.25;
    ellipse(cx, cy, 32, 5, false);
    ctx.globalAlpha = 1;
    // marcas girando
    for (let i = 0; i < 10; i++) {
      const a = now / 1400 + (i / 10) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(a) * 40);
      const y = Math.round(cy + Math.sin(a) * 7);
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 2, 1);
    }
  }

  function ellipse(cx, cy, rx, ry, fill) {
    ctx.beginPath();
    ctx.ellipse(cx, cy + 0.5, rx, ry, 0, 0, Math.PI * 2);
    if (fill) ctx.fill(); else ctx.stroke();
  }

  function drawEnemy(now) {
    if (enemyGone) return;
    const b = enemyBox();
    const visA = 0.45 + 0.55 * Math.min(1, st.vis / 70);
    ctx.globalAlpha = enemyAlpha * visA;
    const t = (now - t0) / 1000;
    // aberração cromática quando acabou de levar dano
    if (enemyHit > 0.2 && !reduced) {
      ctx.globalAlpha = enemyAlpha * 0.6;
      drawEnemyParts(b, t, 'tintR', -2);
      drawEnemyParts(b, t, 'tintG', 2);
      ctx.globalAlpha = enemyAlpha * visA;
    }
    if ((st.elite || st.enraged) && !reduced) {
      const pulse = 0.35 + 0.3 * Math.sin(now / 180);
      ctx.globalAlpha = enemyAlpha * pulse;
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawEnemyParts(b, t, 'aura', ox, oy);
      ctx.globalAlpha = enemyAlpha * visA;
    }
    drawEnemyParts(b, t, null, 0);
    if (enemyHit > 0) {
      ctx.globalAlpha = Math.min(1, enemyHit) * enemyAlpha;
      drawEnemyParts(b, t, 'white', 0);
    }
    ctx.globalAlpha = 1;
    // neblina de baixa visibilidade
    const fog = Math.max(0, (70 - st.vis) / 70);
    if (fog > 0.02) {
      if (now - noiseT > 90) {
        noiseT = now;
        noise = [];
        const n = Math.floor(fog * 260);
        for (let i = 0; i < n; i++) noise.push([Math.floor(rand(b.x - 14, b.x + b.w + 14)), Math.floor(rand(b.y - 10, ENEMY_FOOT + 4)), Math.random() < 0.5]);
      }
      for (const [x, y, light] of noise) {
        ctx.fillStyle = light ? 'rgba(67,255,149,.35)' : 'rgba(1,8,4,.85)';
        ctx.fillRect(x, y, light ? 1 : 2, 1);
      }
    }
    // bloqueio do inimigo: colchetes ciano em volta
    if (st.foeBlock) {
      const pulse = 0.55 + 0.35 * Math.sin(now / 240);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = P.W;
      const pad = 3;
      for (let y = b.y - pad; y < b.y + b.h + pad; y += 4) { ctx.fillRect(b.x - pad - 4, y, 1, 2); ctx.fillRect(b.x + b.w + pad + 3, y, 1, 2); }
      ctx.globalAlpha = 1;
    }
    // atordoado: estrelinhas girando acima
    if (st.stunned && !enemyGone) {
      for (let i = 0; i < 3; i++) {
        const a = now / 300 + (i / 3) * Math.PI * 2;
        ctx.fillStyle = i % 2 ? P.A : P.W;
        ctx.fillRect(Math.round(b.cx + Math.cos(a) * 12), Math.round(b.y - 6 + Math.sin(a) * 3), 2, 2);
      }
    }
    // mira de exposto
    if (st.exposed) {
      const pulse = Math.floor(now / 160) % 2;
      ctx.fillStyle = P.R;
      const pad = 6 + pulse;
      corner(b.x - pad, b.y - pad, 1, 1);
      corner(b.x + b.w + pad, b.y - pad, -1, 1);
      corner(b.x - pad, b.y + b.h + pad, 1, -1);
      corner(b.x + b.w + pad, b.y + b.h + pad, -1, -1);
    }
    // varredura de alta visibilidade
    if (st.vis >= 70) {
      const sy = b.y + ((now / 12) % (b.h + 10)) - 5;
      ctx.fillStyle = 'rgba(219,255,241,.22)';
      ctx.fillRect(b.x - 4, Math.round(sy), b.w + 8, 1);
    }
  }

  function corner(x, y, sx, sy) {
    ctx.fillRect(x, y, 5 * sx, 1);
    ctx.fillRect(x, y, 1, 5 * sy);
  }

  function drawEnemyParts(b, t, mode, dx, dy = 0) {
    const tint = mode === 'white' ? P.W : mode === 'tintR' ? P.R : mode === 'tintG' ? P.G : mode === 'aura' ? P.R : null;
    const speed = st.enraged ? 1.8 : 1;
    def.layers.forEach(([name, lx, ly, anim], i) => {
      const img = sprite(name, tint);
      let x = b.x + lx + dx, y = b.y + ly + dy, w = img.width, h = img.height;
      if (!reduced && anim) {
        if (anim === 'flap') {
          const flap = 0.72 + 0.28 * Math.abs(Math.sin(t * 4.2 * speed));
          const root = 18;
          h = Math.max(4, Math.round(img.height * flap));
          y = b.y + ly + dy + root - Math.round(root * flap);
        } else if (anim === 'shackle') {
          y -= Math.round(Math.max(0, Math.sin(t * 1.6 * speed)) * (st.enraged ? 5 : 2));
        } else if (anim === 'squash') {
          const sq = Math.round(Math.sin(t * 3 * speed));
          y -= sq; h += sq;
        } else if (anim === 'float') {
          y += Math.round(Math.sin(t * 1.7 * speed + i) * 2);
        } else if (anim === 'swim') {
          y += Math.round(Math.sin(t * 2.4 * speed) * 2);
          x += Math.round(Math.sin(t * 1.2 * speed) * 2);
        } else if (anim === 'waddle') {
          x += Math.round(Math.sin(t * 3 * speed));
        } else if (anim === 'bob' || anim.startsWith('b')) {
          y += Math.round(Math.sin(t * 3.4 * speed + i * 1.3) * 2);
        }
      }
      ctx.drawImage(img, 0, 0, img.width, img.height, x, y, w, h);
    });
  }

  function drawOperator(now) {
    const shakeX = opHit > 0 && !reduced ? Math.round(rand(-2, 2)) : 0;
    ctx.drawImage(opImg, OP_X + shakeX, OP_Y);
    // telas piscando: verdes quando estável, vermelhas quando a integridade cai
    const danger = st.integrity < 0.35;
    const flick = (Math.sin(now / 90) + 1) / 2;
    ctx.globalAlpha = 0.08 + flick * 0.06;
    ctx.fillStyle = danger ? P.R : P.G;
    ctx.fillRect(OP_X + 3 + shakeX, OP_Y + 3, 30, 19);
    ctx.fillRect(OP_X + 39 + shakeX, OP_Y + 3, 30, 19);
    ctx.globalAlpha = 1;
    if (opHit > 0) {
      ctx.globalAlpha = Math.min(1, opHit) * 0.8;
      ctx.drawImage(opHitImg, OP_X + shakeX, OP_Y);
      ctx.globalAlpha = 1;
    }
  }

  function drawBarrier(now) {
    const strength = Math.min(1, (st.shields + (st.posture ? 1 : 0)) / 2) + barrierPulse;
    if (strength <= 0.01) return;
    const a = Math.min(0.95, 0.3 + strength * 0.5);
    const hot = barrierPulse > 0.3;
    const col = hot ? P.W : P.G;
    const top = 84, bottom = H - 4, x0 = BARRIER_X;
    // campo de força: faixa translúcida, linhas de varredura subindo e borda frontal tracejada
    for (let k = 0; k < 10; k++) {
      ctx.globalAlpha = a * (0.16 - k * 0.014);
      ctx.fillStyle = col;
      ctx.fillRect(x0 + k, top, 1, bottom - top);
    }
    const scroll = reduced ? 0 : Math.floor(now / 70) % 5;
    for (let y = bottom - scroll; y > top; y -= 5) {
      const wob = reduced ? 0 : Math.round(Math.sin(now / 260 + y / 9) * 1.2);
      ctx.globalAlpha = a * 0.45;
      ctx.fillStyle = col;
      ctx.fillRect(x0 + 1 + wob, y, 7, 1);
    }
    ctx.globalAlpha = a;
    ctx.fillStyle = col;
    for (let y = top; y < bottom; y += 3) {
      const wob = reduced ? 0 : Math.round(Math.sin(now / 200 + y / 6) * 0.8);
      ctx.fillRect(x0 + 9 + wob, y, 1, 2);
    }
    // nós do escudo
    for (let y = top + 6; y < bottom; y += 14) {
      ctx.globalAlpha = a * (0.6 + 0.4 * Math.sin(now / 150 + y));
      ctx.fillRect(x0 + 8, y, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  function drawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      ctx.globalAlpha = Math.min(1, p.life / (p.fade || 0.4));
      ctx.fillStyle = p.c;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s || 1, p.s || 1);
    }
    ctx.globalAlpha = 1;
  }

  function overlay() {
    // linhas de varredura internas e vinheta
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    for (let y = 0; y < H; y += 2) ctx.fillRect(0, y, W, 1);
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, st.integrity < 0.3 ? 'rgba(60,0,10,.55)' : 'rgba(0,0,0,.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    if (st.blind) {
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.save();
    if (shake > 0 && !reduced) ctx.translate(Math.round(rand(-shake, shake)), Math.round(rand(-shake, shake)));
    drawBackground(now);
    drawPlatform(now);
    drawEnemy(now);
    drawBarrier(now);
    drawOperator(now);
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.t += dt;
      f.draw(ctx, Math.min(1, f.t / f.dur), now);
      if (f.t >= f.dur) { fx.splice(i, 1); f.done?.(); }
    }
    drawParticles(dt);
    ctx.restore();
    if (flash) {
      ctx.globalAlpha = flash.a;
      ctx.fillStyle = flash.color;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      flash.a -= dt * 2.4;
      if (flash.a <= 0) flash = null;
    }
    overlay();
    shake = Math.max(0, shake - dt * 14);
    enemyHit = Math.max(0, enemyHit - dt * 3);
    opHit = Math.max(0, opHit - dt * 3);
    enemyKnock *= 0.86;
    barrierPulse = Math.max(0, barrierPulse - dt * 1.6);
    raf = requestAnimationFrame(frame);
  }

  // ---------- efeitos ----------

  const wait = (ms) => new Promise((r) => setTimeout(r, reduced ? Math.min(ms, 120) : ms));

  function add(dur, draw) {
    return new Promise((resolve) => fx.push({ t: 0, dur: reduced ? Math.min(dur, 0.15) : dur, draw, done: resolve }));
  }

  function burst(x, y, color, n = 16, speed = 60, opts = {}) {
    if (reduced) n = Math.min(n, 4);
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(speed * 0.3, speed);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (opts.up || 0), c: color, life: rand(0.3, 0.8), s: Math.random() < 0.3 ? 2 : 1, g: opts.g ?? 80 });
    }
  }

  function number(x, y, text, color, scale = 2) {
    const w = textWidth(text, scale);
    return add(0.9, (c, p) => {
      c.globalAlpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
      drawText(c, text, Math.round(x - w / 2), Math.round(y - ease(p) * 18), color, scale);
      c.globalAlpha = 1;
    });
  }

  function banner(text, color = P.G, sub = '') {
    return add(1.15, (c, p) => {
      const inP = Math.min(1, p / 0.15);
      const outP = p > 0.8 ? (p - 0.8) / 0.2 : 0;
      const hgt = Math.round(30 * inP * (1 - outP));
      if (hgt <= 0) return;
      c.fillStyle = 'rgba(1,8,4,.82)';
      c.fillRect(0, 60 - hgt / 2, W, hgt);
      c.fillStyle = color;
      c.fillRect(0, 60 - hgt / 2, W, 1);
      c.fillRect(0, 60 + hgt / 2 - 1, W, 1);
      if (hgt > 22) {
        const sc = 3;
        const w = textWidth(text, sc);
        const jit = p < 0.25 && !reduced ? Math.round(rand(-2, 2)) : 0;
        drawText(c, text, Math.round(W / 2 - w / 2) + jit, sub ? 48 : 53, color, sc);
        if (sub) { const sw = textWidth(sub, 1); drawText(c, sub, Math.round(W / 2 - sw / 2), 67, P.t, 1); }
      }
    });
  }

  function projectile(from, to, color, { dur = 0.45, size = 2, trail = 6, arc = -18, wobble = 0 } = {}) {
    const pts = [];
    return add(dur, (c, p) => {
      const e = ease(p);
      const x = from.x + (to.x - from.x) * e + (wobble ? Math.sin(p * 20) * wobble : 0);
      const y = from.y + (to.y - from.y) * e + Math.sin(p * Math.PI) * arc;
      pts.push([x, y]);
      if (pts.length > trail) pts.shift();
      pts.forEach(([px, py], i) => {
        c.globalAlpha = (i + 1) / pts.length * 0.8;
        c.fillStyle = color;
        c.fillRect(Math.round(px), Math.round(py), size, size);
      });
      c.globalAlpha = 1;
      c.fillStyle = P.W;
      c.fillRect(Math.round(x), Math.round(y), size, size);
    });
  }

  async function volley(from, to, color, n = 3, opts = {}) {
    const shots = [];
    for (let i = 0; i < n; i++) {
      shots.push(projectile({ x: from.x + rand(-3, 3), y: from.y + rand(-3, 3) }, { x: to.x + rand(-6, 6), y: to.y + rand(-6, 6) }, color, { ...opts, arc: (opts.arc ?? -18) + rand(-8, 8) }));
      await wait(70);
    }
    await Promise.all(shots);
  }

  const api = {
    set(partial) { Object.assign(st, partial); },

    async radar() {
      const o = opMid();
      const b = enemyBox();
      const dist = Math.hypot(b.cx - o.x, b.cy - o.y) + 20;
      await add(0.6, (c, p) => {
        c.strokeStyle = P.W;
        c.globalAlpha = 1 - p;
        c.beginPath(); c.arc(o.x, o.y, p * dist, -1.3, 0.2); c.stroke();
        c.globalAlpha = (1 - p) * 0.5;
        c.beginPath(); c.arc(o.x, o.y, p * dist * 0.8, -1.3, 0.2); c.stroke();
        c.globalAlpha = 1;
      });
    },

    async hunt(amount, crit = false) {
      const o = opMid(), b = enemyBox();
      await volley(o, { x: b.cx, y: b.cy }, crit ? P.W : P.G, crit ? 5 : 3, { dur: 0.42 });
      api.hitEnemy(amount, crit ? P.W : P.G);
    },

    hitEnemy(amount, color = P.G, crit = false) {
      const b = enemyBox();
      enemyHit = 1;
      enemyKnock = 6;
      shake = Math.max(shake, crit ? 4 : 2);
      burst(b.cx, b.cy, color, crit ? 28 : 14, crit ? 90 : 60);
      if (amount) number(b.cx + rand(-6, 6), b.y - 2, `-${amount}`, crit ? P.W : P.G, crit ? 3 : 2);
    },

    async heal(amount) {
      const o = opMid();
      for (let i = 0; i < (reduced ? 2 : 14); i++) particles.push({ x: o.x + rand(-26, 26), y: o.y + rand(0, 26), vx: 0, vy: rand(-28, -14), c: i % 3 ? P.G : P.W, life: rand(0.6, 1.1), s: 1, g: 0, fade: 0.5 });
      number(o.x, o.y - 8, `+${amount}`, P.G);
      await wait(500);
    },

    async shield() {
      barrierPulse = 1;
      const o = opMid();
      burst(BARRIER_X + 8, o.y + 20, P.G, 12, 30, { g: 0 });
      await wait(450);
    },

    async posture() {
      barrierPulse = 0.7;
      await wait(250);
    },

    async cleanse() {
      const o = opMid();
      await add(0.5, (c, p) => {
        c.strokeStyle = P.W;
        c.globalAlpha = 1 - p;
        c.strokeRect(Math.round(o.x - 30 - p * 8), Math.round(o.y - 12 - p * 6), Math.round(60 + p * 16), Math.round(40 + p * 12));
        c.globalAlpha = 1;
      });
    },

    async boost() {
      const o = opMid();
      number(o.x, o.y - 6, '+BANDA', P.A, 1);
      burst(o.x, o.y, P.A, 10, 40, { g: 0 });
      await wait(350);
    },

    async cable() {
      flash = { color: P.W, a: 0.6 };
      shake = 3;
      await wait(380);
    },

    banner(text, color = P.G, sub = '') { return banner(text, color, sub); },

    // golpe do inimigo (0.4): bloqueado inteiro bate na barreira; senão acerta o operador
    async strike({ amount, absorbed, quick = false }) {
      const b = enemyBox();
      const o = opMid();
      await add(quick ? 0.18 : 0.28, (c, p) => {
        c.strokeStyle = P.R;
        c.globalAlpha = 1 - p;
        c.beginPath(); c.arc(b.cx, b.cy, 6 + p * 20, 0, Math.PI * 2); c.stroke();
        c.globalAlpha = 1;
      });
      if (!amount) {
        await volley({ x: b.cx - 10, y: b.cy }, { x: BARRIER_X + 4, y: o.y + 18 }, P.R, 2, { dur: 0.36, arc: -10, wobble: 1 });
        barrierPulse = 1;
        burst(BARRIER_X + 4, o.y + 18, P.W, 14, 60);
        number(BARRIER_X + 4, o.y + 4, `BLOQ ${absorbed}`, P.W, 1);
        shake = Math.max(shake, 1);
      } else {
        await volley({ x: b.cx - 10, y: b.cy }, { x: o.x, y: o.y + 6 }, P.R, 3, { dur: 0.4, arc: -14, wobble: 1.5 });
        if (absorbed) { barrierPulse = 0.8; number(BARRIER_X + 4, o.y + 4, `BLOQ ${absorbed}`, P.W, 1); }
        opHit = 1;
        shake = 4;
        flash = { color: P.R, a: 0.3 };
        burst(o.x, o.y + 6, P.R, 18, 70);
        number(o.x + 18, o.y - 4, `-${amount}`, P.R);
      }
    },

    async enemyShield(amount) {
      const b = enemyBox();
      st.foeBlock = true;
      await add(0.4, (c, p) => {
        c.strokeStyle = P.W;
        c.globalAlpha = 1 - p;
        c.strokeRect(Math.round(b.x - 4 - p * 6), Math.round(b.y - 4 - p * 6), Math.round(b.w + 8 + p * 12), Math.round(b.h + 8 + p * 12));
        c.globalAlpha = 1;
      });
      if (amount) number(b.cx, b.y - 4, `+${amount} BLOQ`, P.W, 1);
    },

    async enemyBuff(text = '+FORCA') {
      const b = enemyBox();
      flash = { color: P.R, a: 0.18 };
      burst(b.cx, b.cy, P.R, 16, 40, { g: -20 });
      number(b.cx, b.y - 4, text, P.R, 1);
      await wait(420);
    },

    async enemyHeal(amount) {
      const b = enemyBox();
      for (let i = 0; i < (reduced ? 2 : 10); i++) particles.push({ x: b.cx + rand(-14, 14), y: b.cy + rand(-6, 14), vx: 0, vy: rand(-24, -10), c: P.G, life: rand(0.5, 0.9), s: 1, g: 0, fade: 0.4 });
      number(b.cx, b.y - 4, `+${amount}`, P.G, 1);
      await wait(380);
    },

    async negated(text = 'ANULADO') {
      barrierPulse = 1;
      await banner(text, P.W, 'golpe anulado pela análise');
    },

    async stun() {
      st.stunned = true;
      flash = { color: P.W, a: 0.4 };
      await banner('ATORDOADO', P.A, 'o chefe perde a próxima ação');
    },

    hurt(amount) {
      const o = opMid();
      number(o.x + 18, o.y - 4, `-${amount}`, P.R);
    },

    async cornered() {
      const b = enemyBox();
      await add(0.6, (c, p) => {
        c.globalAlpha = 1 - p;
        drawText(c, '...', Math.round(b.cx - 5), b.y - 8, P.A, 2);
        c.globalAlpha = 1;
      });
    },

    async phase(text, title = 'FASE 2') {
      st.enraged = true;
      flash = { color: P.R, a: 0.5 };
      shake = 6;
      await banner(title, P.R, text || '');
    },

    async advance() {
      flash = { color: P.R, a: 0.25 };
      await wait(200);
    },

    async win() {
      const b = enemyBox();
      enemyGone = true;
      const step = reduced ? 6 : 1;
      def.layers.forEach(([name, lx, ly], li) => {
        const px = spritePixels(name);
        for (let i = 0; i < px.length; i += step) {
          const p = px[i];
          particles.push({ x: b.x + lx + p.x, y: b.y + ly + p.y, vx: rand(-24, 24), vy: rand(-50, -6), c: p.c, life: rand(0.7, 1.8), s: 1, g: 30 + li * 8, fade: 0.8 });
        }
      });
      flash = { color: P.W, a: 0.7 };
      await wait(700);
      await banner('AMEACA CONTIDA', P.G, 'atacante expulso da rede');
    },

    async lose(reason) {
      flash = { color: P.R, a: 0.8 };
      shake = 8;
      st.integrity = 0;
      await wait(500);
      await banner(reason === 'objective' ? 'OBJETIVO ATINGIDO' : 'SISTEMAS CAIRAM', P.R, 'incidente perdido');
    },

    iconAt(name, x, y, color) { ctx.drawImage(iconCanvas(name, color), x, y); },

    destroy() { running = false; cancelAnimationFrame(raf); },
  };

  raf = requestAnimationFrame((t) => { last = t; frame(t); onReady?.(); });
  return api;
}
