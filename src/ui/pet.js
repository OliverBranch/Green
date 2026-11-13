// O gato do analista: opções, desenho em pixel art e quadros de animação.
//
//   portrait(pet, frame)   gato sentado de frente, 32×32: editor, canto da tela e perfil
//   deskCat(pet, frame)    função que desenha o gatinho (13×14) na mesa, ao lado do analista
//
// frame: { tail: 0|1, blink: bool, happy: bool, sleep: bool }

import { PALETTE as P } from './pixel-data.js';
import { Grid, shade, mix, noise, OUT } from './avatar.js';

export const FUR_COLORS = [
  ['#1d1b1e', 'preto'], ['#6f7378', 'cinza'], ['#8a9aac', 'azul-russo'], ['#efebe3', 'branco'], ['#e6cc9a', 'creme'],
  ['#e0883a', 'laranja'], ['#b07a4f', 'canela'], ['#5e3d2a', 'chocolate'], ['#43ff95', 'fósforo'], ['#ff9ec9', 'chiclete'],
];
export const EYE_COLORS = [
  ['#7fdc5a', 'verde'], ['#f2d24b', 'amarelo'], ['#f0a23a', 'âmbar'], ['#5fb6ff', 'azul'], ['#c8743a', 'cobre'], ['#43ff95', 'fósforo'], ['#ff5c78', 'vermelho'],
];
export const PATTERNS = [
  ['solido', 'Sólido'], ['listrado', 'Listrado'], ['manchado', 'Manchado'], ['frajola', 'Frajola'], ['siames', 'Siamês'], ['tricolor', 'Tricolor'],
];
export const EXPRESSIONS = [['normal', 'Normal'], ['sonolento', 'Sonolento'], ['feliz', 'Feliz'], ['desconfiado', 'Desconfiado']];
export const EARS = [['pontudas', 'Pontudas'], ['dobradas', 'Dobradas'], ['grandes', 'Grandes']];
export const TAILS = [['longo', 'Longo'], ['felpudo', 'Felpudo'], ['curto', 'Curto']];
export const SIZES = [['filhote', 'Filhote'], ['normal', 'Adulto'], ['gordinho', 'Gordinho']];
export const NECKS = [['nenhum', 'Nada'], ['coleira', 'Coleira'], ['sino', 'Com sino'], ['gravata', 'Gravata'], ['bandana', 'Bandana']];
export const NECK_COLORS = [
  ['#ff5c78', 'vermelho'], ['#43ff95', 'fósforo'], ['#4aa8ff', 'azul'], ['#ffbf47', 'âmbar'], ['#9a6bff', 'roxo'], ['#e8ecea', 'branco'], ['#1d1b1e', 'preto'],
];

export const DEFAULT_PET = {
  v: 1, name: 'Bit', fur: FUR_COLORS[5][0], fur2: FUR_COLORS[7][0], pattern: 'listrado', eyes: EYE_COLORS[0][0], eyes2: EYE_COLORS[3][0],
  hetero: false, cross: false, expr: 'normal', ears: 'pontudas', tail: 'longo', size: 'normal', neck: 'coleira', neckColor: NECK_COLORS[0][0],
};

export const NAMES = ['Bit', 'Byte', 'Kernel', 'Sudo', 'Root', 'Pixel', 'Nyan', 'Cookie', 'Hash', 'Ping', 'Tux', 'Grep', 'Bug', 'Nmap', 'Proxy', 'Salt'];

export function normalizePet(p) {
  const x = { ...DEFAULT_PET, ...(p || {}) };
  x.name = String(x.name || 'Bit').trim().slice(0, 14) || 'Bit';
  return x;
}

export function randomPet(rnd = Math.random) {
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  return normalizePet({
    name: pick(NAMES), fur: pick(FUR_COLORS.slice(0, rnd() < 0.85 ? 8 : 10))[0], fur2: pick(FUR_COLORS.slice(0, 8))[0],
    pattern: pick(PATTERNS)[0], eyes: pick(EYE_COLORS)[0], eyes2: pick(EYE_COLORS)[0], hetero: rnd() < 0.15, cross: rnd() < 0.15,
    expr: pick(EXPRESSIONS)[0], ears: rnd() < 0.75 ? 'pontudas' : pick(EARS)[0], tail: pick(TAILS)[0], size: pick(SIZES)[0],
    neck: pick(NECKS)[0], neckColor: pick(NECK_COLORS)[0],
  });
}

const PINK = '#f08aa0';
const WHITE = '#efece6';
const GOLD = '#ffcf4a';
const isLight = (hex) => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 > 150; };

// cor do pelo num ponto, conforme o padrão. `part`: 'head' | 'body' | 'tail' | 'ear' | 'paw'
function furAt(pet, x, y, part, geo) {
  const { cx, hy, by } = geo;
  const base = pet.pattern === 'tricolor' ? WHITE : pet.pattern === 'siames' ? shade(pet.fur, 1.12) : pet.fur;
  const second = pet.fur2;
  const inE = (ex, ey, rx, ry) => ((x - ex) / rx) ** 2 + ((y - ey) / ry) ** 2 <= 1;
  const s = geo.scale;
  switch (pet.pattern) {
    case 'listrado': {
      if (part === 'head' && y <= hy - geo.hry * 0.35 && [-2, 0, 2].map((d) => cx + d * s).some((v) => Math.abs(x - v) < 0.5)) return second;
      if (part === 'head' && Math.abs(y - (hy + s)) < 0.5 && Math.abs(x - cx) >= geo.hrx - 2.2 * s) return second;
      if (part === 'body' && Math.abs(x - cx) > 1.5 * s) {
        // faixas que descem nas laterais, uma a cada 3 linhas
        const band = Math.round(y - Math.abs(x - cx) * 0.45 - (x < cx ? 0 : 1));
        if (((band % 3) + 3) % 3 === 0) return second;
      }
      if (part === 'tail' && Math.round(x * 0.7 + y * 0.7) % 3 === 0) return second;
      return base;
    }
    case 'manchado':
      if (inE(cx - 3.5 * s, hy - 2 * s, 3 * s, 2.6 * s) || inE(cx + 4 * s, by - 1 * s, 3.4 * s, 3 * s) || inE(cx - 4.5 * s, by + 4 * s, 2.4 * s, 2 * s)) return second;
      if (part === 'tail' && y < by) return second;
      if (part === 'ear' && x < cx) return second;
      return base;
    case 'tricolor':
      if (inE(cx - 3.5 * s, hy - 2 * s, 3.2 * s, 2.6 * s) || inE(cx + 4.5 * s, by + 1 * s, 3.2 * s, 3.6 * s) || (part === 'ear' && x < cx)) return pet.fur;
      if (inE(cx + 3 * s, hy - 2.5 * s, 2.6 * s, 2 * s) || inE(cx - 4 * s, by + 3 * s, 2.6 * s, 2.6 * s) || (part === 'ear' && x > cx) || part === 'tail') return second;
      return base;
    case 'frajola':
      if (inE(cx, by + 1 * s, 3.4 * s, geo.bry - 1 * s) || inE(cx, hy + 2.6 * s, 3 * s, 2 * s) || part === 'paw') return WHITE;
      if (part === 'tail' && y < by - 2 * s) return WHITE;
      return base;
    case 'siames':
      if (part === 'ear' || part === 'tail' || part === 'paw') return second;
      if (part === 'head' && inE(cx, hy + 2 * s, 3.8 * s, 3.2 * s)) return mix(base, second, inE(cx, hy + 2.6 * s, 2.4 * s, 2 * s) ? 0.9 : 0.45);
      return base;
    default:
      return base;
  }
}

function shadeFur(c, x, y, geo, part) {
  const n = noise(x, y);
  let f = 1;
  if (part === 'body' && y > geo.by + geo.bry * 0.45) f = 0.82;
  if (x > geo.cx + geo.hrx * 0.55 && part === 'head') f = 0.9;
  if (n < 8) f *= 0.9; else if (n > 94) f *= 1.08;
  return f === 1 ? c : shade(c, f);
}

const GEOS = {
  filhote: { hy: 14, hrx: 7.2, hry: 6.2, by: 25.2, brx: 6, bry: 5.8 },
  normal: { hy: 12, hrx: 7.5, hry: 6.3, by: 23, brx: 8, bry: 8.2 },
  gordinho: { hy: 12, hrx: 8, hry: 6.6, by: 23.6, brx: 10.4, bry: 8 },
};

// ---------- vista grande, sentado de frente (32×32) ----------

function drawBig(pet, frame = {}) {
  const g = new Grid(32, 32);
  const geo = { cx: 16, scale: 1, ...GEOS[pet.size] };
  const { cx, hy, hrx, hry, by, brx, bry } = geo;
  const parts = new Map(); // pixel -> parte, para aplicar o padrão
  const put = (x, y, part) => { parts.set(`${x},${y}`, part); g.px(x, y, '#000001'); };
  const ell = (ex, ey, rx, ry, part) => {
    for (let y = Math.floor(ey - ry); y <= Math.ceil(ey + ry); y++) for (let x = Math.floor(ex - rx); x <= Math.ceil(ex + rx); x++) {
      if (((x - ex) / rx) ** 2 + ((y - ey) / ry) ** 2 <= 1) put(x, y, part);
    }
  };

  // rabo (atrás do corpo, enrolado do lado direito)
  const sway = frame.tail ? 1 : 0;
  const r = pet.tail === 'felpudo' ? 2 : 1.3;
  const tailPts = pet.tail === 'curto'
    ? [[cx + brx - 2, by + bry - 1.5], [cx + brx + 1, by + bry - 2.5]]
    : [[cx + brx - 2, by + bry - 1], [cx + brx + 2, by + bry - 2.5], [cx + Math.min(brx + 3.5, 14), by + 2], [cx + Math.min(brx + 2.5 + sway * 1.5, 14.5), by - 3 - sway], [cx + Math.min(brx + 0.5 + sway * 2.5, 14.5), by - 5.5 - sway * 0.5]];
  for (let i = 0; i < tailPts.length - 1; i++) {
    const [x0, y0] = tailPts[i], [x1, y1] = tailPts[i + 1];
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
    for (let t = 0; t <= steps; t++) ell(x0 + ((x1 - x0) * t) / steps, y0 + ((y1 - y0) * t) / steps, r, r, 'tail');
  }

  // corpo, patas, cabeça e orelhas
  ell(cx, by, brx, bry, 'body');
  for (let y = 30; y < 32; y++) for (let x = 0; x < 32; x++) { if (parts.get(`${x},${y}`) === 'body') { g.px(x, y, null); parts.delete(`${x},${y}`); } }
  ell(cx - 3, by + bry - 1.6, 2.2, 1.5, 'paw');
  ell(cx + 3, by + bry - 1.6, 2.2, 1.5, 'paw');
  ell(cx, hy, hrx, hry, 'head');
  ell(cx - hrx + 1.5, hy + 2, 2.4, 2, 'head');
  ell(cx + hrx - 1.5, hy + 2, 2.4, 2, 'head');
  const earTip = pet.ears === 'grandes' ? hry + 5 : pet.ears === 'dobradas' ? hry + 1 : hry + 3.5;
  const earPolys = [
    [[cx - hrx + 0.5, hy - 1], [cx - hrx + 1.5, hy - earTip], [cx - 1.5, hy - hry + 0.5]],
    [[cx + hrx - 0.5, hy - 1], [cx + hrx - 1.5, hy - earTip], [cx + 1.5, hy - hry + 0.5]],
  ];
  if (pet.ears === 'grandes') { earPolys[0][1][0] -= 1; earPolys[1][1][0] += 1; }
  const tmp = new Grid(32, 32);
  for (const pts of earPolys) tmp.poly(pts.map(([x, y]) => [Math.round(x), Math.round(y)]), '#e');
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (tmp.get(x, y) && !parts.has(`${x},${y}`)) put(x, y, 'ear');

  // pinta com o padrão
  for (const [k, part] of parts) {
    const [x, y] = k.split(',').map(Number);
    g.px(x, y, shadeFur(furAt(pet, x, y, part, geo), x, y, geo, part));
  }
  // dedinhos das patas
  for (const px of [cx - 3, cx + 3]) g.px(px, Math.round(by + bry - 1.2), shade(g.get(px, Math.round(by + bry - 2)) || pet.fur, 0.7));

  // parte de dentro das orelhas
  const innerC = mix(PINK, pet.fur, 0.35);
  if (pet.ears === 'dobradas') {
    for (const sx of [-1, 1]) { g.line(Math.round(cx + sx * (hrx - 1)), Math.round(hy - hry - 0.5), Math.round(cx + sx * 2.5), Math.round(hy - hry + 0.5), shade(pet.fur, 0.7)); }
  } else {
    const t = pet.ears === 'grandes' ? hry + 3.5 : hry + 2;
    g.poly([[Math.round(cx - hrx + 2), Math.round(hy - 2)], [Math.round(cx - hrx + 2), Math.round(hy - t)], [Math.round(cx - 3), Math.round(hy - hry + 1)]], innerC);
    g.poly([[Math.round(cx + hrx - 2), Math.round(hy - 2)], [Math.round(cx + hrx - 2), Math.round(hy - t)], [Math.round(cx + 3), Math.round(hy - hry + 1)]], innerC);
  }

  // olhos
  const eyeL = pet.eyes, eyeR = pet.hetero ? pet.eyes2 : pet.eyes;
  const dark = '#0c0a0c';
  const lid = shade(pet.pattern === 'tricolor' ? WHITE : pet.fur, 0.55);
  const ey = hy;
  const eyesAt = [[cx - 4, eyeL, 1], [cx + 4, eyeR, -1]]; // centro x, cor, direção do nariz
  const closed = frame.blink || frame.sleep;
  for (const [ex, col, toNose] of eyesAt) {
    if (closed) { g.rect(ex - 1, ey + 1, ex + 1, ey + 1, dark); continue; }
    if (frame.happy || pet.expr === 'feliz') { g.px(ex - 1, ey + 1, dark); g.px(ex, ey, dark); g.px(ex + 1, ey + 1, dark); continue; }
    g.rect(ex - 1, ey - 1, ex + 1, ey + 1, col);
    const pupil = ex + (pet.cross ? toNose : 0);
    g.rect(pupil, ey - 1, pupil, ey + 1, dark);
    g.px(ex - 1, ey - 1, mix(col, '#ffffff', 0.55));
    if (pet.expr === 'sonolento') { g.rect(ex - 1, ey - 1, ex + 1, ey - 1, lid); g.rect(ex - 1, ey, ex + 1, ey, lid); g.px(pupil, ey + 1, dark); }
    if (pet.expr === 'desconfiado') { g.rect(ex - 1, ey - 1, ex + 1, ey - 1, lid); g.px(toNose > 0 ? ex - 1 : ex + 1, ey, lid); }
  }
  // nariz e boca
  const nose = pet.fur === '#ff9ec9' ? '#d0506e' : PINK;
  g.rect(cx - 1, hy + 3, cx + 1, hy + 3, nose); g.px(cx, hy + 4, nose);
  g.px(cx - 1, hy + 5, dark); g.px(cx + 1, hy + 5, dark);
  if (frame.happy) g.px(cx, hy + 6, '#e05a78');

  // pescoço: coleira, sino, gravata ou bandana
  const ny = Math.round(hy + hry - 0.5);
  const nc = pet.neckColor, nd = shade(nc, 0.65);
  if (pet.neck === 'coleira' || pet.neck === 'sino') {
    g.rect(cx - 5, ny, cx + 5, ny + 1, nc); g.rect(cx - 5, ny + 1, cx + 5, ny + 1, nd);
    if (pet.neck === 'sino') { g.rect(cx - 1, ny + 2, cx + 1, ny + 3, GOLD); g.px(cx, ny + 3, shade(GOLD, 0.6)); g.px(cx - 1, ny + 2, shade(GOLD, 1.3)); }
  } else if (pet.neck === 'gravata') {
    g.poly([[cx - 4, ny], [cx - 1, ny + 1], [cx - 4, ny + 3]], nc); g.poly([[cx + 4, ny], [cx + 1, ny + 1], [cx + 4, ny + 3]], nc);
    g.rect(cx - 1, ny + 1, cx + 1, ny + 2, nd);
  } else if (pet.neck === 'bandana') {
    g.poly([[cx - 6, ny], [cx + 6, ny], [cx, ny + 6]], nc);
    g.px(cx - 2, ny + 1, nd); g.px(cx + 2, ny + 2, nd); g.px(cx, ny + 3, nd); g.px(cx - 3, ny + 3, shade(nc, 1.4));
  }

  // luz verde das telas
  g.map((x, y, c) => (x <= cx - 4 && y > 3 ? mix(c, P.G, 0.08) : c));
  g.outline(OUT);

  // bigodes por cima do contorno
  const wc = isLight(pet.pattern === 'tricolor' || pet.pattern === 'frajola' ? WHITE : pet.fur) ? '#8a8f8c' : '#dfe6e2';
  g.line(cx - 5, hy + 3, cx - 10, hy + 2, wc); g.line(cx - 5, hy + 4, cx - 10, hy + 5, wc);
  g.line(cx + 5, hy + 3, cx + 10, hy + 2, wc); g.line(cx + 5, hy + 4, cx + 10, hy + 5, wc);
  if (frame.sleep) { g.px(cx + 9, hy - 8, P.W); g.px(cx + 10, hy - 8, P.W); g.px(cx + 9, hy - 7, P.W); g.px(cx + 10, hy - 6, P.W); g.px(cx + 9, hy - 6, P.W); }
  return g;
}

// ---------- gatinho na mesa (13×14), desenhado direto na estação de trabalho ----------

function drawSmall(pet, frame = {}) {
  const g = new Grid(16, 15);
  const fat = pet.size === 'gordinho', kit = pet.size === 'filhote';
  const geo = { cx: 6, hy: kit ? 6 : 5, hrx: kit ? 3.6 : 3.4, hry: 2.9, by: 10.5, brx: fat ? 4.8 : kit ? 3.2 : 3.9, bry: kit ? 3 : 3.6, scale: 0.5 };
  const { cx, hy, hrx, hry, by, brx, bry } = geo;
  const parts = new Map();
  const put = (x, y, part) => { if (x >= 0 && y >= 0 && x < 16 && y < 15) { parts.set(`${x},${y}`, part); g.px(x, y, '#000001'); } };
  const ell = (ex, ey, rx, ry, part) => {
    for (let y = Math.floor(ey - ry); y <= Math.ceil(ey + ry); y++) for (let x = Math.floor(ex - rx); x <= Math.ceil(ex + rx); x++) if (((x - ex) / rx) ** 2 + ((y - ey) / ry) ** 2 <= 1) put(x, y, part);
  };
  // rabo
  const sway = frame.tail ? 1 : 0;
  const pts = pet.tail === 'curto' ? [[cx + brx - 1, by + 2.5], [cx + brx + 0.8, by + 2]] : [[cx + brx - 1, by + 2.5], [cx + brx + 1.2, by + 1.5], [cx + brx + 1.5 + sway * 0.6, by - 1.2], [cx + brx + 0.8 + sway, by - 3]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    for (let t = 0; t <= 6; t++) ell(x0 + ((x1 - x0) * t) / 6, y0 + ((y1 - y0) * t) / 6, pet.tail === 'felpudo' ? 1 : 0.6, pet.tail === 'felpudo' ? 1 : 0.6, 'tail');
  }
  ell(cx, by, brx, bry, 'body');
  for (let x = 0; x < 16; x++) for (const y of [14]) { g.px(x, y, null); parts.delete(`${x},${y}`); }
  ell(cx, hy, hrx, hry, 'head');
  // orelhas
  const ears = pet.ears === 'dobradas' ? [[cx - 3, hy - 3], [cx + 3, hy - 3]] : [[cx - 3, hy - 3], [cx - 3, hy - 4], [cx - 2, hy - 3], [cx + 3, hy - 3], [cx + 3, hy - 4], [cx + 2, hy - 3]];
  if (pet.ears === 'grandes') ears.push([cx - 3, hy - 5], [cx + 3, hy - 5]);
  for (const [x, y] of ears) put(x, y, 'ear');
  // patas
  put(cx - 1, by + 3, 'paw'); put(cx + 1, by + 3, 'paw');
  for (const [k, part] of parts) {
    const [x, y] = k.split(',').map(Number);
    let c = furAt(pet, x, y, part, geo);
    if (pet.pattern === 'listrado' && part === 'body' && y % 2 === 0 && Math.abs(x - cx) > 0) c = pet.fur2;
    if (pet.pattern === 'listrado' && part === 'head' && y === hy - 2 && x === cx) c = pet.fur2;
    if (pet.pattern === 'frajola' && part === 'body' && Math.abs(x - cx) <= 1 && y >= by - 2) c = WHITE;
    if (pet.pattern === 'frajola' && part === 'head' && y === hy + 1 && Math.abs(x - cx) <= 1) c = WHITE;
    if (pet.pattern === 'siames' && part === 'head' && Math.abs(x - cx) <= 1 && y >= hy) c = pet.fur2;
    g.px(x, y, part === 'body' && y > by + 1.5 ? shade(c, 0.85) : c);
  }
  // rosto
  const dark = '#0c0a0c';
  const closed = frame.blink || frame.sleep || pet.expr === 'feliz';
  if (closed) { g.px(cx - 2, hy, dark); g.px(cx + 2, hy, dark); }
  else { g.px(cx - 2, hy, pet.eyes); g.px(cx + 2, hy, pet.hetero ? pet.eyes2 : pet.eyes); }
  g.px(cx, hy + 1, PINK);
  if (pet.neck !== 'nenhum') {
    g.rect(cx - 2, hy + 3, cx + 2, hy + 3, pet.neckColor);
    if (pet.neck === 'sino') g.px(cx, hy + 4, GOLD);
    if (pet.neck === 'gravata') { g.px(cx - 1, hy + 4, pet.neckColor); g.px(cx + 1, hy + 4, pet.neckColor); }
    if (pet.neck === 'bandana') g.px(cx, hy + 4, pet.neckColor);
  }
  g.outline(OUT);
  return g;
}

// ---------- API com cache ----------

const cache = new Map();
const key = (pet, frame) => `${JSON.stringify(normalizePet(pet))}|${JSON.stringify(frame || {})}`;

export function portrait(pet, frame = {}) {
  const k = `b|${key(pet, frame)}`;
  if (!cache.has(k)) cache.set(k, drawBig(normalizePet(pet), frame).canvas());
  return cache.get(k);
}

// Devolve [função de desenho para avatar.workstation, chave de cache].
export function deskCat(pet, frame = {}) {
  if (!pet) return [null, ''];
  const k = key(pet, frame);
  if (!cache.has(`s|${k}`)) cache.set(`s|${k}`, drawSmall(normalizePet(pet), frame));
  const g = cache.get(`s|${k}`);
  return [(grid, ox, oy) => grid.over(g, ox, oy), k];
}
