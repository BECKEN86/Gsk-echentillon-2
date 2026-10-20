/**
 * Génère l'icône GeStock (build/icon.png 512×512 + build/icon.ico).
 * Dessin pixel : carré arrondi navy #001F3F + cube (paquet) blanc en iso,
 * liseré « ruban » — encodage PNG maison (zlib) puis conteneur ICO.
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const S = 512;
const px = new Float64Array(S * S * 4); // accumulé en float puis clampé

const NAVY = [0x00, 0x1f, 0x3f];
const NAVY_EDGE = [0x00, 0x12, 0x26];
const TOP = [0xf3, 0xf8, 0xff];
const LEFT = [0xb9, 0xcc, 0xe4];
const RIGHT = [0xff, 0xff, 0xff];
const TAPE = [0x2e, 0x6f, 0xae];

function blend(x, y, c, a) {
  if (x < 0 || y < 0 || x >= S || y >= S || a <= 0) return;
  const i = (y * S + x) * 4;
  const ia = 1 - a;
  px[i] = px[i] * ia + c[0] * a;
  px[i + 1] = px[i + 1] * ia + c[1] * a;
  px[i + 2] = px[i + 2] * ia + c[2] * a;
  px[i + 3] = Math.max(px[i + 3], a);
}

/** Distance signée vers un rectangle arrondi (pour l'antialiasing du fond). */
function roundedRectSDF(x, y, cx, cy, hw, hh, r) {
  const qx = Math.abs(x - cx) - (hw - r);
  const qy = Math.abs(y - cy) - (hh - r);
  const ax = Math.max(qx, 0), ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

/** Point dans un polygone convexe → couverture ~1/0 avec liseré AA de 1px. */
function polyCoverage(x, y, pts) {
  let minD = Infinity;
  let pos = true, neg = true;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    // distance point-segment
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((x - x1) * dx + (y - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
    // côté du segment (produit vectoriel)
    const cross = (x - x1) * dy - (y - y1) * dx;
    if (cross > 0) neg = false;
    if (cross < 0) pos = false;
    if (d < minD) minD = d;
  }
  const inside = pos || neg; // tous les crosses du même signe → dedans (convexe)
  const dist = inside ? -minD : minD;
  return Math.max(0, Math.min(1, 0.5 - dist));
}

function fillPoly(pts, color) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.floor(Math.min(...xs)) - 1, x1 = Math.ceil(Math.max(...xs)) + 1;
  const y0 = Math.floor(Math.min(...ys)) - 1, y1 = Math.ceil(Math.max(...ys)) + 1;
  for (let y = Math.max(0, y0); y <= Math.min(S - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(S - 1, x1); x++) {
      const cov = polyCoverage(x + 0.5, y + 0.5, pts);
      if (cov > 0) blend(x, y, color, cov);
    }
}

function line(a, b, w, color) {
  // segment épais = quad le long de la normale
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (w / 2), ny = (dx / len) * (w / 2);
  fillPoly([
    [a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny],
    [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]
  ], color);
}

/* ----------------------------- Dessin ------------------------------ */

const M = 40; // marge du carré
for (let y = 0; y < S; y++)
  for (let x = 0; x < S; x++) {
    const d = roundedRectSDF(x + 0.5, y + 0.5, S / 2, S / 2, (S - M * 2) / 2, (S - M * 2) / 2, 110);
    const cov = Math.max(0, Math.min(1, 0.5 - d));
    if (cov > 0) blend(x, y, NAVY, cov);
  }

// Cube iso centré
const cx = 256, ty = 118, hw = 158, th = 88, side = 168;
const T = [cx, ty];
const R = [cx + hw, ty + th];
const B = [cx, ty + th * 2];
const L = [cx - hw, ty + th];
const Bv = [cx, ty + th * 2 + side];
const Rv = [cx + hw, ty + th + side];
const Lv = [cx - hw, ty + th + side];

// faces
fillPoly([T, R, B, L], TOP);                 // dessus
fillPoly([L, B, Bv, Lv], LEFT);              // gauche (plus sombre)
fillPoly([B, R, Rv, Bv], RIGHT);             // droite (claire)

// ruban adhésif sur le dessus (bande le long de T→B)
const tw = 30;
const tapeTop = [
  [cx - tw / 2, ty + (tw / 2) * (th / hw)],
  [cx + tw / 2, ty + (tw / 2) * (th / hw)],
  [cx + tw / 2, B[1] - (tw / 2) * (th / hw)],
  [cx - tw / 2, B[1] - (tw / 2) * (th / hw)]
];
// clippe au losange : on intersecte grossièrement en ne gardant que la zone T-B
fillPoly(tapeTop, TAPE);
// retombe du ruban sur la face droite
fillPoly(
  [[cx + tw / 2, B[1] - (tw / 2) * (th / hw)], [cx + tw / 2 + 0, B[1]],
   [cx + tw / 2 + 0, Bv[1]], [cx + tw / 2 - 0, Bv[1] - (tw / 2) * (th / hw)]],
  TAPE
);

// contours
const OL = NAVY_EDGE, W = 9;
for (const [a, b] of [[T, R], [R, B], [B, L], [L, T],
                      [L, Lv], [R, Rv], [B, Bv],
                      [Lv, Bv], [Bv, Rv]]) line(a, b, W, OL);

/* --------------------------- Encodage PNG --------------------------- */

const raw = Buffer.alloc(S * (S * 4 + 1));
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0; // filtre None
  for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4, o = y * (S * 4 + 1) + 1 + x * 4;
    raw[o] = Math.round(Math.max(0, Math.min(255, px[i])));
    raw[o + 1] = Math.round(Math.max(0, Math.min(255, px[i + 1])));
    raw[o + 2] = Math.round(Math.max(0, Math.min(255, px[i + 2])));
    raw[o + 3] = Math.round(Math.max(0, Math.min(255, px[i + 3] * 255)));
  }
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = b => {
  let c = 0xffffffff;
  for (const x of b) c = CRC_TABLE[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8 bits, RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
]);

// ICO : en-tête + 1 entrée (256=0) + PNG embarqué
const ico = Buffer.alloc(6 + 16);
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico[6] = 0; ico[7] = 0; // 256×256
ico[8] = 0; ico[9] = 0;
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png.length, 14); ico.writeUInt32LE(22, 18);
const icoFile = Buffer.concat([ico, png]);

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'build');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'icon.png'), png);
writeFileSync(join(out, 'icon.ico'), icoFile);
console.log(`Icône générée → build/icon.png (${(png.length / 1024).toFixed(1)} Ko) + build/icon.ico`);
