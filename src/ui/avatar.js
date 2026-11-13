// Personagem do jogador: opções, renderização em pixel art e as duas vistas.
//
//   portrait(av)     busto de frente, 32×32: editor, menu lateral e perfil
//   workstation(av)  o analista de costas na estação de trabalho, 72×46: cena de combate
//
// Tudo é desenhado em código numa grade de pixels (sem arquivos de imagem), com cores livres,
// sombreamento e contorno automático, no mesmo estilo dos sprites gerados em tools/art.

import { PALETTE as P } from './pixel-data.js';

// ---------- opções ----------

export const SKINS = ['#f6d5bd', '#e9b994', '#cf9168', '#a86a43', '#7a4a2c', '#4b2d1b'];
export const HAIR_COLORS = [
  ['#16120f', 'preto'], ['#3a2417', 'castanho escuro'], ['#6e4628', 'castanho'], ['#d7b161', 'loiro'],
  ['#b4532c', 'ruivo'], ['#a9aba5', 'grisalho'], ['#43ff95', 'fósforo'], ['#ff7eb6', 'rosa'],
  ['#4aa8ff', 'azul'], ['#9a6bff', 'roxo'],
];
export const CLOTH_COLORS = [
  ['#16191a', 'preto'], ['#353c40', 'grafite'], ['#1e7a4a', 'verde SOC'], ['#1d2f55', 'marinho'],
  ['#6d1f2e', 'vinho'], ['#b8323f', 'vermelho'], ['#b8862b', 'mostarda'], ['#4b2d6b', 'roxo'],
  ['#d9dedb', 'branco'], ['#2f6f86', 'petróleo'],
];
export const ACCENT_COLORS = [
  ['#2a2f31', 'grafite'], ['#43ff95', 'fósforo'], ['#e8ecea', 'branco'], ['#ff5c78', 'vermelho'], ['#ffbf47', 'âmbar'], ['#4aa8ff', 'azul'],
];

export const BODIES = [['m', 'Masculino'], ['f', 'Feminino']];
export const HAIRS = [
  ['curto', 'Curto'], ['raspado', 'Raspado'], ['longo', 'Longo'], ['rabo', 'Rabo de cavalo'],
  ['coque', 'Coque'], ['cacheado', 'Cacheado'], ['moicano', 'Moicano'], ['careca', 'Careca'],
];
export const TOPS = [['moletom', 'Moletom'], ['camiseta', 'Camiseta'], ['jaqueta', 'Jaqueta'], ['social', 'Camisa social']];
export const BEARDS = [['nenhuma', 'Nenhuma'], ['bigode', 'Bigode'], ['cavanhaque', 'Cavanhaque'], ['cheia', 'Cheia']];
export const GLASSES = [['nenhum', 'Nenhum'], ['redondo', 'Redondo'], ['quadrado', 'Quadrado'], ['visor', 'Visor']];

export const DEFAULT_AVATAR = {
  v: 1, body: 'm', skin: SKINS[2], hair: 'curto', hairColor: HAIR_COLORS[1][0], beard: 'nenhuma', glasses: 'nenhum',
  top: 'moletom', topColor: CLOTH_COLORS[1][0], hood: false, phones: true, cap: false, accent: ACCENT_COLORS[1][0],
};

export function normalize(av) {
  const a = { ...DEFAULT_AVATAR, ...(av || {}) };
  if (a.top !== 'moletom') a.hood = false;
  return a;
}

export function randomAvatar(rnd = Math.random) {
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const body = pick(BODIES)[0];
  return normalize({
    body, skin: pick(SKINS), hair: pick(HAIRS)[0], hairColor: pick(HAIR_COLORS.slice(0, rnd() < 0.8 ? 6 : 10))[0],
    beard: body === 'm' && rnd() < 0.45 ? pick(BEARDS.slice(1))[0] : 'nenhuma',
    glasses: rnd() < 0.4 ? pick(GLASSES.slice(1))[0] : 'nenhum',
    top: pick(TOPS)[0], topColor: pick(CLOTH_COLORS)[0], hood: rnd() < 0.2, phones: rnd() < 0.75, cap: rnd() < 0.15, accent: pick(ACCENT_COLORS)[0],
  });
}

// ---------- cores ----------

function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgb2hex([r, g, b]) { return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`; }
export function shade(h, f) { return rgb2hex(hex2rgb(h).map((v) => (f < 1 ? v * f : v + (255 - v) * (f - 1)))); }
export function mix(a, b, t) { const x = hex2rgb(a), y = hex2rgb(b); return rgb2hex(x.map((v, i) => v + (y[i] - v) * t)); }

// ---------- grade de pixels ----------

class Grid {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Array(w * h).fill(null); }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.d[y * this.w + x]; }
  px(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c; }
  rect(x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.px(x, y, c); }
  ell(cx, cy, rx, ry, c, test = null) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1 && (!test || test(x, y))) this.px(x, y, typeof c === 'function' ? c(x, y) : c);
      }
    }
  }
  poly(pts, c) {
    const ys = pts.map((p) => p[1]);
    for (let y = Math.min(...ys); y <= Math.max(...ys); y++) {
      for (let x = 0; x < this.w; x++) {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) this.px(x, y, c);
      }
    }
  }
  line(x0, y0, x1, y1, c) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  // aplica uma função a cada pixel opaco
  map(fn) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const c = this.get(x, y); if (c) this.d[y * this.w + x] = fn(x, y, c); } }
  // contorno escuro em volta de tudo que for opaco
  outline(color = P.K) {
    const add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y)) continue;
      if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push([x, y]);
    }
    for (const [x, y] of add) this.px(x, y, color);
  }
  over(g, ox = 0, oy = 0) { for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const c = g.get(x, y); if (c) this.px(x + ox, y + oy, c); } }
  canvas() {
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    const ctx = c.getContext('2d');
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const v = this.get(x, y); if (v) { ctx.fillStyle = v; ctx.fillRect(x, y, 1, 1); } }
    return c;
  }
}

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const OUT = P.K;
// ruído determinístico por pixel, para textura de cabelo sem padrão repetido
const noise = (x, y) => (((x * 73856093) ^ (y * 19349663) ^ 0x5bd1e995) >>> 0) % 100;
const texture = (base, dark, light, dn = 14, ln = 8) => (x, y) => { const n = noise(x, y); return n < dn ? dark : n > 100 - ln ? light : base; };

// ---------- vista de costas, na estação de trabalho (72×46) ----------

function desk(g) {
  // monitores
  for (const x0 of [1, 37]) {
    g.rect(x0 - 1, 0, x0 + 34, 24, OUT);
    g.rect(x0, 1, x0 + 33, 23, P.L);
    g.rect(x0 + 2, 3, x0 + 31, 21, P.D);
    g.rect(x0 + 14, 24, x0 + 19, 28, P.L);
  }
  const r = rng(4);
  for (const x0 of [1, 37]) {
    for (let y = 5; y < 20; y += 2) {
      const ind = [0, 2, 4][Math.floor(r() * 3)], ln = 5 + Math.floor(r() * 14);
      const col = (x0 === 1 ? 'gggGmA' : 'gGgRmg')[Math.floor(r() * 6)];
      g.rect(x0 + 4 + ind, y, x0 + 4 + ind + ln, y, P[col]);
    }
  }
  // mesa
  g.rect(0, 29, 71, 32, P.l); g.rect(0, 33, 71, 45, P.L); g.rect(0, 29, 71, 29, P.m);
  // teclado e caneca
  g.rect(4, 27, 20, 28, P.m); g.rect(5, 27, 19, 27, P.t);
  g.rect(62, 25, 66, 29, P.A); g.rect(62, 25, 62, 29, P.a); g.rect(67, 26, 68, 28, P.A); g.px(67, 27, null);
  g.px(63, 23, P.m); g.px(64, 22, P.m); g.px(65, 23, P.m); g.px(64, 20, P.m);
  // encosto da cadeira
  g.poly([[22, 45], [24, 26], [48, 26], [50, 45]], P.k);
  g.line(24, 26, 48, 26, P.L);
}

function backPerson(av) {
  const g = new Grid(72, 46);
  const cx = 36;
  const fem = av.body === 'f';
  const rx = fem ? 13 : 15;
  const skin = av.skin, skinD = shade(skin, 0.8), skinS = shade(skin, 0.68);
  const top = av.topColor, topD = shade(top, 0.72), topL = shade(top, 1.18);
  const hair = av.hairColor, hairD = shade(hair, 0.7), hairL = shade(hair, 1.25);
  const acc = av.accent;

  // braços (pele ou manga), saindo dos lados em direção à mesa
  const sleeve = av.top === 'camiseta' ? skinD : topD;
  g.ell(cx - rx + 1, 40, 3, 6, sleeve);
  g.ell(cx + rx - 1, 40, 3, 6, sleeve);
  if (av.top === 'camiseta') { g.rect(cx - rx - 1, 35, cx - rx + 3, 36, topD); g.rect(cx + rx - 3, 35, cx + rx + 1, 36, topD); }

  // tronco
  g.ell(cx, 41, rx, 10, (x, y) => (y > 44 ? topD : y < 34 ? topL : top));
  if (fem) g.ell(cx, 46, rx - 2, 4, (x, y) => (y > 44 ? topD : top));
  // detalhes de roupa nas costas
  if (av.top === 'jaqueta') {
    g.line(cx, 34, cx, 45, topD);
    g.rect(cx - 6, 31, cx + 6, 33, topD);
    g.rect(cx - 5, 31, cx + 5, 31, topL);
  } else if (av.top === 'social') {
    g.rect(cx - 5, 31, cx + 5, 32, '#eef1ef');
    g.rect(cx - 5, 33, cx + 5, 33, '#c6ccc9');
    g.line(cx - 8, 36, cx + 8, 36, topD);
  } else if (av.top === 'camiseta') {
    g.rect(cx - 4, 32, cx + 4, 32, topD);
  }

  // pescoço
  g.rect(cx - (fem ? 2 : 3), 29, cx + (fem ? 2 : 3), 33, skinS);

  if (av.top === 'moletom' && !av.hood) {
    // capuz caído, embolado na nuca
    g.ell(cx, 32, 8, 3.2, topD);
    g.ell(cx, 31.5, 7, 2.2, top);
    g.line(cx - 5, 31, cx + 5, 31, topL);
  }

  // cabeça
  const hy = 23;
  g.ell(cx, hy, 7.5, 8.5, skin);
  // orelhas
  g.rect(cx - 9, hy, cx - 8, hy + 3, skinD);
  g.rect(cx + 8, hy, cx + 9, hy + 3, skinD);

  // cabelo
  const hairTex = texture(hair, hairD, hairL);
  const capOn = av.cap && !av.hood;
  switch (av.hair) {
    case 'curto':
      g.ell(cx, hy - 1, 8, 8.2, hairTex, (x, y) => y <= hy + 4);
      g.rect(cx - 5, hy + 5, cx + 5, hy + 5, hairD);
      break;
    case 'raspado':
      g.ell(cx, hy - 0.5, 7.6, 8.5, (x, y) => mix(skin, hair, (x + y) % 2 ? 0.55 : 0.4), (x, y) => y <= hy + 5);
      break;
    case 'longo':
      g.ell(cx, hy - 1, 8.5, 8.6, hairTex);
      g.poly([[cx - 8, hy], [cx + 8, hy], [cx + 9, hy + 14], [cx + 6, hy + 16], [cx - 6, hy + 16], [cx - 9, hy + 14]], hair);
      for (let x = cx - 7; x <= cx + 7; x += 3) g.line(x, hy + 3, x + (x < cx ? -1 : 1), hy + 15, hairD);
      break;
    case 'rabo':
      g.ell(cx, hy - 1, 8, 8.4, hairTex, (x, y) => y <= hy + 5);
      g.rect(cx - 1, hy + 3, cx + 1, hy + 4, acc);
      g.ell(cx, hy + 9, 2.4, 5, hair);
      g.line(cx, hy + 6, cx, hy + 13, hairD);
      break;
    case 'coque':
      g.ell(cx, hy - 1, 8, 8.4, hairTex, (x, y) => y <= hy + 5);
      g.ell(cx, hy - 7, 4, 3.6, hair);
      g.line(cx - 3, hy - 7, cx + 3, hy - 7, hairD);
      g.rect(cx - 2, hy - 4, cx + 2, hy - 4, acc);
      break;
    case 'cacheado':
      g.ell(cx, hy - 1, 11, 10.5, texture(hair, hairD, hairL, 26, 12), (x, y) => y <= hy + 6);
      for (let i = -9; i <= 9; i += 3) g.ell(cx + i, hy + 6, 1.6, 1.4, hair);
      break;
    case 'moicano':
      g.ell(cx, hy - 0.5, 7.6, 8.5, (x, y) => mix(skin, hair, 0.35), (x, y) => y <= hy + 5);
      g.rect(cx - 2, hy - 10, cx + 2, hy + 5, hair);
      g.line(cx, hy - 10, cx, hy + 5, hairL);
      break;
    case 'careca':
      g.px(cx - 3, hy - 6, shade(skin, 1.25)); g.px(cx - 2, hy - 6, shade(skin, 1.25)); g.px(cx - 4, hy - 5, shade(skin, 1.18));
      break;
    default: break;
  }

  // capuz levantado
  if (av.hood) {
    g.ell(cx, hy - 0.5, 9.5, 10.2, (x, y) => (y > hy + 6 ? topD : (x < cx - 6 || x > cx + 6) ? topD : top));
    g.line(cx, hy - 10, cx, hy + 8, topD);
  }

  // boné, de costas: copa e a abertura do ajuste
  if (capOn) {
    const capC = acc === '#43ff95' ? '#1e7a4a' : acc;
    g.ell(cx, hy - 2, 8.3, 7.6, (x, y) => (y < hy - 7 ? shade(capC, 1.2) : capC), (x, y) => y <= hy + 1);
    g.rect(cx - 2, hy, cx + 2, hy + 1, shade(capC, 0.6));
    g.ell(cx, hy + 0.5, 1.6, 1, av.hair === 'careca' ? skin : hair);
  }

  // fone de ouvido
  if (av.phones) {
    const pc = acc, pd = shade(acc, 0.6);
    const top0 = av.hair === 'cacheado' ? hy - 12 : av.hair === 'coque' ? hy - 10 : hy - 9;
    g.line(cx - 9, hy - 1, cx - 7, top0 + 3, pd);
    g.line(cx - 7, top0 + 3, cx - 3, top0, pd);
    g.line(cx - 3, top0, cx + 3, top0, pd);
    g.line(cx + 3, top0, cx + 7, top0 + 3, pd);
    g.line(cx + 7, top0 + 3, cx + 9, hy - 1, pd);
    const ex = av.hair === 'cacheado' ? 11 : 9;
    g.rect(cx - ex - 2, hy - 1, cx - ex, hy + 4, pc); g.px(cx - ex - 2, hy - 1, pd);
    g.rect(cx + ex, hy - 1, cx + ex + 2, hy + 4, pc); g.px(cx + ex + 2, hy - 1, pd);
  }

  // luz das telas na borda da silhueta (o analista está de frente para dois monitores verdes)
  const edge = [];
  for (let y = 10; y < 40; y++) for (let x = 0; x < 72; x++) {
    if (!g.get(x, y)) continue;
    if (!g.get(x - 1, y) && x < cx) edge.push([x, y]);
    else if (!g.get(x + 1, y) && x > cx) edge.push([x, y]);
  }
  for (const [x, y] of edge) g.px(x, y, mix(g.get(x, y), P.G, 0.45));

  g.outline(OUT);
  return g;
}

// ---------- vista de frente, busto (32×32) ----------

function frontPerson(av) {
  const g = new Grid(32, 32);
  const cx = 16;
  const fem = av.body === 'f';
  const skin = av.skin, skinD = shade(skin, 0.82), skinS = shade(skin, 0.7), skinL = shade(skin, 1.12);
  const top = av.topColor, topD = shade(top, 0.72), topL = shade(top, 1.2);
  const hair = av.hairColor, hairD = shade(hair, 0.7), hairL = shade(hair, 1.25);
  const acc = av.accent;
  const hy = 13;
  const hairTex = texture(hair, hairD, hairL);

  // cabelo de trás (fica atrás da cabeça e dos ombros)
  if (!av.hood) {
    if (av.hair === 'longo') g.poly([[cx - 8, hy - 2], [cx + 8, hy - 2], [cx + 9, hy + 13], [cx - 9, hy + 13]], hairD);
    if (av.hair === 'cacheado') g.ell(cx, hy - 1, 10.5, 10, texture(hair, hairD, hair, 30, 0));
    if (av.hair === 'rabo') g.ell(cx + 8, hy + 3, 2.2, 4.5, hairD);
  }
  if (av.hood) g.ell(cx, hy, 9.5, 10, topD);

  // ombros e roupa
  const rx = fem ? 12 : 14;
  g.ell(cx, 33, rx, 9, (x, y) => (y < 27 ? topL : top));
  // pescoço
  g.rect(cx - (fem ? 2 : 3), hy + 6, cx + (fem ? 2 : 3), hy + 11, skinS);
  if (av.top === 'moletom') {
    if (!av.hood) { g.ell(cx, 25, 6.5, 2.4, topD); g.ell(cx, 24.6, 4.5, 1.4, skinS); }
    g.line(cx - 2, 26, cx - 2, 30, shade(top, 1.45)); g.line(cx + 2, 26, cx + 2, 30, shade(top, 1.45));
    g.px(cx - 2, 31, acc); g.px(cx + 2, 31, acc);
  } else if (av.top === 'camiseta') {
    g.ell(cx, 24, 4, 2.4, skinS);
    g.line(cx - 4, 24, cx, 26, topD); g.line(cx, 26, cx + 4, 24, topD);
  } else if (av.top === 'jaqueta') {
    g.poly([[cx - 4, 24], [cx + 4, 24], [cx + 1, 32], [cx - 1, 32]], '#d9dedb');
    g.poly([[cx - 5, 23], [cx - 1, 31], [cx - 3, 32], [cx - 7, 25]], topD);
    g.poly([[cx + 5, 23], [cx + 1, 31], [cx + 3, 32], [cx + 7, 25]], topD);
    g.rect(cx - 2, 24, cx + 2, 24, skinS);
  } else if (av.top === 'social') {
    g.ell(cx, 24, 3.4, 1.8, skinS);
    g.poly([[cx - 4, 23], [cx, 26], [cx - 2, 28], [cx - 5, 25]], '#eef1ef');
    g.poly([[cx + 4, 23], [cx, 26], [cx + 2, 28], [cx + 5, 25]], '#eef1ef');
    for (let y = 27; y < 32; y += 2) g.px(cx, y, topD);
  }

  // cabeça
  g.ell(cx, hy, 6.5, 7.5, (x, y) => (x > cx + 3 ? skinD : skin));
  // orelhas
  g.rect(cx - 8, hy, cx - 7, hy + 2, skinD);
  g.rect(cx + 7, hy, cx + 8, hy + 2, skinD);
  // olhos, sobrancelhas, nariz e boca
  const eye = '#141110';
  g.rect(cx - 3, hy + 1, cx - 3, hy + 2, eye); g.rect(cx + 3, hy + 1, cx + 3, hy + 2, eye);
  g.px(cx - 4, hy + 1, '#f2f5f3'); g.px(cx + 2, hy + 1, '#f2f5f3');
  if (fem) { g.px(cx - 4, hy, eye); g.px(cx + 4, hy, eye); }
  g.rect(cx - 4, hy - 1, cx - 2, hy - 1, hairD); g.rect(cx + 2, hy - 1, cx + 4, hy - 1, hairD);
  g.px(cx, hy + 3, skinS); g.px(cx + 1, hy + 4, skinD);
  g.rect(cx - 1, hy + 5, cx + 1, hy + 5, fem ? shade('#c0505e', skin === SKINS[5] ? 0.7 : 1) : skinS);
  g.px(cx - 4, hy + 3, mix(skin, '#ff7e8a', 0.18)); g.px(cx + 4, hy + 3, mix(skin, '#ff7e8a', 0.18));

  // barba
  if (av.beard === 'cheia') {
    g.ell(cx, hy + 4.5, 6.3, 3.6, texture(hair, hairD, hair, 22, 0), (x, y) => y >= hy + 3);
    g.rect(cx - 1, hy + 5, cx + 1, hy + 5, shade(skin, 0.6));
    g.rect(cx - 6, hy + 1, cx - 6, hy + 3, hair); g.rect(cx + 6, hy + 1, cx + 6, hy + 3, hair);
  } else if (av.beard === 'cavanhaque') {
    g.rect(cx - 2, hy + 4, cx + 2, hy + 4, hair);
    g.rect(cx - 1, hy + 6, cx + 1, hy + 7, hair);
  } else if (av.beard === 'bigode') {
    g.rect(cx - 2, hy + 4, cx + 2, hy + 4, hair);
    g.px(cx - 3, hy + 5, hairD); g.px(cx + 3, hy + 5, hairD);
  }

  // óculos
  if (av.glasses !== 'nenhum') {
    const fr = av.glasses === 'visor' ? acc : '#0c0f0e';
    if (av.glasses === 'visor') {
      g.rect(cx - 6, hy, cx + 6, hy + 2, shade(acc, 0.55));
      g.rect(cx - 5, hy + 1, cx + 5, hy + 1, acc);
      g.px(cx - 3, hy + 1, shade(acc, 1.4)); g.px(cx + 3, hy + 1, shade(acc, 1.4));
    } else {
      const lens = mix(skin, '#0d3b2c', 0.45);
      for (const ex of [cx - 3, cx + 3]) {
        if (av.glasses === 'redondo') {
          g.rect(ex - 1, hy, ex + 1, hy + 2, lens);
          g.rect(ex - 1, hy - 1, ex + 1, hy - 1, fr); g.rect(ex - 1, hy + 3, ex + 1, hy + 3, fr);
          g.rect(ex - 2, hy, ex - 2, hy + 2, fr); g.rect(ex + 2, hy, ex + 2, hy + 2, fr);
        } else {
          g.rect(ex - 2, hy - 1, ex + 2, hy + 3, fr);
          g.rect(ex - 1, hy, ex + 1, hy + 2, lens);
        }
        g.px(ex, hy + 1, '#141110');
      }
      g.px(cx, hy, fr);
      g.px(cx - 6, hy, fr); g.px(cx + 6, hy, fr);
    }
  }

  // cabelo da frente
  if (!av.hood) {
    switch (av.hair) {
      case 'curto':
        g.ell(cx, hy - 3, 7, 5, hairTex, (x, y) => y <= hy - 2);
        g.rect(cx - 7, hy - 3, cx - 6, hy + 1, hair); g.rect(cx + 6, hy - 3, cx + 7, hy + 1, hair);
        g.rect(cx - 3, hy - 2, cx + 1, hy - 2, hair);
        break;
      case 'raspado':
        g.ell(cx, hy - 2, 6.6, 6, (x, y) => mix(skin, hair, (x + y) % 2 ? 0.55 : 0.42), (x, y) => y <= hy - 3);
        break;
      case 'longo':
        g.ell(cx, hy - 3, 7.4, 5.4, hairTex, (x, y) => y <= hy - 1);
        g.rect(cx - 8, hy - 3, cx - 6, hy + 11, hair); g.rect(cx + 6, hy - 3, cx + 8, hy + 11, hair);
        g.line(cx - 7, hy, cx - 7, hy + 10, hairD); g.line(cx + 7, hy, cx + 7, hy + 10, hairD);
        g.rect(cx - 5, hy - 2, cx - 1, hy - 2, hair);
        break;
      case 'rabo':
        g.ell(cx, hy - 3, 7, 5, hairTex, (x, y) => y <= hy - 2);
        g.rect(cx - 7, hy - 3, cx - 6, hy, hair); g.rect(cx + 6, hy - 3, cx + 7, hy, hair);
        g.px(cx + 1, hy - 7, hairD); g.px(cx + 1, hy - 6, hairD);
        break;
      case 'coque':
        g.ell(cx, hy - 3, 7, 5, hairTex, (x, y) => y <= hy - 2);
        g.ell(cx, hy - 9, 3.4, 2.8, hair);
        g.rect(cx - 2, hy - 7, cx + 2, hy - 7, acc);
        g.rect(cx - 7, hy - 3, cx - 6, hy, hair); g.rect(cx + 6, hy - 3, cx + 7, hy, hair);
        break;
      case 'cacheado':
        g.ell(cx, hy - 4, 8.5, 5, texture(hair, hairD, hairL, 26, 12), (x, y) => y <= hy - 2);
        for (const dx of [-5, -2, 1, 4]) g.ell(cx + dx + 0.5, hy - 2, 1.4, 1.2, hair);
        break;
      case 'moicano':
        g.ell(cx, hy - 2, 6.6, 6, (x, y) => mix(skin, hair, 0.3), (x, y) => y <= hy - 3);
        g.rect(cx - 1, hy - 11, cx + 1, hy - 4, hair);
        g.line(cx, hy - 11, cx, hy - 4, hairL);
        break;
      default: break;
    }
  } else {
    // capuz levantado emoldurando o rosto
    g.ell(cx, hy - 1, 9.5, 10, (x, y) => topD, (x, y) => { const dx = (x - cx) / 6.8, dy = (y - hy) / 8; return dx * dx + dy * dy > 1; });
    g.line(cx - 6, hy - 6, cx + 6, hy - 6, top);
  }

  // boné de frente: copa, aba e um logo
  if (av.cap && !av.hood) {
    const capC = acc === '#43ff95' ? '#1e7a4a' : acc;
    g.ell(cx, hy - 3, 7.4, 5.4, (x, y) => (y < hy - 6 ? shade(capC, 1.2) : capC), (x, y) => y <= hy - 3);
    g.rect(cx - 8, hy - 3, cx + 4, hy - 2, shade(capC, 0.65));
    g.px(cx, hy - 6, '#43ff95'); g.px(cx + 1, hy - 6, '#43ff95');
  }

  // fone: arco por cima e conchas nas orelhas
  if (av.phones && !av.hood) {
    const pc = acc, pd = shade(acc, 0.6);
    const top0 = av.hair === 'cacheado' ? hy - 11 : av.hair === 'coque' ? hy - 9 : av.hair === 'moicano' ? hy - 10 : hy - 8;
    g.line(cx - 8, hy, cx - 7, top0 + 2, pd); g.line(cx - 7, top0 + 2, cx - 3, top0, pd); g.line(cx - 3, top0, cx + 3, top0, pd);
    g.line(cx + 3, top0, cx + 7, top0 + 2, pd); g.line(cx + 7, top0 + 2, cx + 8, hy, pd);
    const ex = av.hair === 'cacheado' ? 10 : 8;
    g.rect(cx - ex - 1, hy - 1, cx - ex + 1, hy + 3, pc); g.rect(cx + ex - 1, hy - 1, cx + ex + 1, hy + 3, pc);
    g.px(cx - ex - 1, hy + 3, pd); g.px(cx + ex + 1, hy + 3, pd);
  }

  // brilho verde das telas na pele (vem da frente-direita)
  g.map((x, y, c) => (x >= cx + 5 && y < 26 && y > 2 ? mix(c, P.G, 0.12) : c));
  g.outline(OUT);
  return g;
}

// ---------- API com cache ----------

const cache = new Map();
const keyOf = (av) => JSON.stringify(normalize(av));

export function portrait(av) {
  const k = `p|${keyOf(av)}`;
  if (!cache.has(k)) cache.set(k, frontPerson(normalize(av)).canvas());
  return cache.get(k);
}

export function workstation(av) {
  const k = `w|${keyOf(av)}`;
  if (!cache.has(k)) {
    const g = new Grid(72, 46);
    desk(g);
    g.over(backPerson(normalize(av)));
    cache.set(k, g.canvas());
  }
  return cache.get(k);
}

// Silhueta de uma cor (para o flash de dano na cena).
export function tinted(canvas, color) {
  const k = `t|${color}`;
  canvas.__tint ||= {};
  if (canvas.__tint[k]) return canvas.__tint[k];
  const c = document.createElement('canvas');
  c.width = canvas.width; c.height = canvas.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(canvas, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  canvas.__tint[k] = c;
  return c;
}

// Canvas ampliado para exibir em HTML (o CSS mantém os pixels nítidos).
export function scaled(src, scale, cls = 'pix') {
  const c = document.createElement('canvas');
  c.width = src.width * scale; c.height = src.height * scale;
  c.className = cls;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
