// Utilitários de pixel art: converte as grades de texto em canvas, gera ícones e escreve com a fonte 3×5.

import { PALETTE, SPRITES, ICONS, FONT } from './pixel-data.js';

export { PALETTE, SPRITES, ICONS };

const cache = new Map();

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Sprite colorido. `tint` opcional pinta todos os pixels opacos com uma cor (silhueta para flashes).
export function sprite(name, tint = null) {
  const key = `${name}|${tint || ''}`;
  if (cache.has(key)) return cache.get(key);
  const rows = SPRITES[name];
  const w = Math.max(...rows.map((r) => r.length));
  const c = makeCanvas(w, rows.length);
  const ctx = c.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      ctx.fillStyle = tint || PALETTE[ch];
      ctx.fillRect(x, y, 1, 1);
    }
  });
  cache.set(key, c);
  return c;
}

// Lista de pixels opacos de um sprite (para a desintegração em partículas).
export function spritePixels(name) {
  const rows = SPRITES[name];
  const out = [];
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== '.' && row[x] !== 'K') out.push({ x, y, c: PALETTE[row[x]] }); });
  return out;
}

export function iconCanvas(name, color = PALETTE.G, scale = 1) {
  const key = `icon|${name}|${color}|${scale}`;
  if (cache.has(key)) return cache.get(key);
  const rows = ICONS[name] || ICONS.target;
  const c = makeCanvas(9 * scale, 9 * scale);
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  rows.forEach((row, y) => { for (let x = 0; x < 9; x++) if (row[x] === '#') ctx.fillRect(x * scale, y * scale, scale, scale); });
  cache.set(key, c);
  return c;
}

const urlCache = new Map();
export function iconURL(name, color = PALETTE.G) {
  const key = `${name}|${color}`;
  if (!urlCache.has(key)) urlCache.set(key, iconCanvas(name, color, 2).toDataURL());
  return urlCache.get(key);
}

export function textWidth(str, scale = 1) {
  return str.length * 4 * scale - scale;
}

// Escreve com a fonte 3×5. Acentos caem para a letra base.
export function drawText(ctx, str, x, y, color, scale = 1, shadow = PALETTE.K) {
  const s = String(str).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const pass = (col, ox, oy) => {
    ctx.fillStyle = col;
    let cx = x + ox;
    for (const ch of s) {
      const g = FONT[ch] || FONT['?'];
      for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 3; gx++) {
        if (g[gy][gx] === '#') ctx.fillRect(cx + gx * scale, y + oy + gy * scale, scale, scale);
      }
      cx += 4 * scale;
    }
  };
  if (shadow) pass(shadow, scale, scale);
  pass(color, 0, 0);
}
