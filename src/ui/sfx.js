// Efeitos sonoros sintetizados (WebAudio, onda quadrada de 8 bits). Nenhum arquivo de áudio.
// Respeita a configuração settings.sound; o contexto só nasce no primeiro gesto do usuário.

import * as store from '../state.js';

let ac = null;
let master = null;

function ctx() {
  if (!store.get()?.settings?.sound) return null;
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.07;
    master.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

function tone(freq, dur, { type = 'square', at = 0, slide = 0, vol = 1 } = {}) {
  const a = ctx();
  if (!a) return;
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, { at = 0, vol = 0.6 } = {}) {
  const a = ctx();
  if (!a) return;
  const t = a.currentTime + at;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  const g = a.createGain();
  g.gain.value = vol;
  src.buffer = buf;
  src.connect(g); g.connect(master);
  src.start(t);
}

export const sfx = {
  click: () => tone(880, 0.04, { vol: 0.5 }),
  select: () => { tone(660, 0.05); tone(990, 0.06, { at: 0.05 }); },
  scan: () => tone(300, 0.35, { type: 'triangle', slide: 900, vol: 0.7 }),
  shoot: () => tone(1200, 0.12, { slide: -800, vol: 0.6 }),
  hit: () => { noise(0.12, { vol: 0.8 }); tone(140, 0.12, { slide: -60 }); },
  crit: () => { tone(523, 0.08); tone(784, 0.08, { at: 0.08 }); tone(1046, 0.18, { at: 0.16 }); noise(0.1, { at: 0.02 }); },
  shield: () => { tone(440, 0.1, { type: 'triangle' }); tone(880, 0.16, { type: 'triangle', at: 0.06 }); },
  contain: () => { tone(220, 0.06); tone(660, 0.12, { at: 0.05 }); },
  hurt: () => { noise(0.25, { vol: 0.9 }); tone(200, 0.25, { slide: -150 }); },
  heal: () => { tone(523, 0.08, { type: 'triangle' }); tone(659, 0.08, { type: 'triangle', at: 0.07 }); tone(784, 0.14, { type: 'triangle', at: 0.14 }); },
  right: () => { tone(784, 0.07); tone(1175, 0.12, { at: 0.07 }); },
  wrong: () => { tone(220, 0.14); tone(165, 0.2, { at: 0.12 }); },
  alarm: () => { for (let i = 0; i < 3; i++) { tone(880, 0.1, { at: i * 0.2 }); tone(660, 0.1, { at: i * 0.2 + 0.1 }); } },
  win: () => { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.12, { at: i * 0.1 })); },
  lose: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.22, { at: i * 0.18, slide: -20 })); },
  turn: () => tone(520, 0.05, { type: 'triangle', vol: 0.5 }),
  meow: () => {
    const f = 620 + Math.random() * 160;
    tone(f, 0.12, { type: 'triangle', slide: f * 0.5, vol: 0.45 });
    tone(f * 1.5, 0.22, { type: 'sine', slide: -f * 0.6, vol: 0.4, at: 0.1 });
  },
};

export function soundOn() { return !!store.get()?.settings?.sound; }
