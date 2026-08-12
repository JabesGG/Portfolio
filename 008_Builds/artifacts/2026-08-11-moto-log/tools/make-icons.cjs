/* Generates the PWA icons as PNGs with no image dependencies.
   The mark is a seven-segment odometer readout — the instrument-cluster motif
   the rest of the app is built on. */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const METAL = [0x15, 0x18, 0x1b];
const FACE  = [0xf2, 0xef, 0xe8];
const DIM   = [0x2a, 0x2f, 0x33];

/* ---------- tiny PNG encoder ---------- */
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- canvas ---------- */
function canvas(size) {
  const px = Buffer.alloc(size * size * 4);
  const put = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const na = a / 255, ia = 1 - na;
    px[i]     = Math.round(r * na + px[i] * ia);
    px[i + 1] = Math.round(g * na + px[i + 1] * ia);
    px[i + 2] = Math.round(b * na + px[i + 2] * ia);
    px[i + 3] = Math.max(px[i + 3], a);
  };
  return {
    px, put,
    fill(col) { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) put(x, y, col); },
    /** Rounded rect with 2x2 supersampled edges, so corners don't look chewed. */
    roundRect(x0, y0, w, h, r, col) {
      const x1 = x0 + w, y1 = y0 + h;
      for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
        for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
          let hits = 0;
          for (const sy of [0.25, 0.75]) for (const sx of [0.25, 0.75]) {
            const px_ = x + sx, py = y + sy;
            if (px_ < x0 || px_ > x1 || py < y0 || py > y1) continue;
            const cx = Math.min(Math.max(px_, x0 + r), x1 - r);
            const cy = Math.min(Math.max(py, y0 + r), y1 - r);
            if ((px_ - cx) ** 2 + (py - cy) ** 2 <= r * r + 0.001) hits++;
          }
          if (hits) put(x, y, col, Math.round((hits / 4) * 255));
        }
      }
    },
  };
}

/* ---------- seven-segment digits ---------- */
//        a
//      f   b
//        g
//      e   c
//        d
const SEGS = {
  0: "abcdef", 1: "bc", 2: "abged", 3: "abgcd", 4: "fgbc",
  5: "afgcd", 6: "afgecd", 7: "abc", 8: "abcdefg", 9: "abcdfg",
};

/** Draws one digit in the box (x,y,w,h). t = segment thickness.
 *  Where the middle segment is off (0), the side strokes are drawn as one
 *  continuous bar — at icon size a split there just reads as a broken glyph. */
function digit(cv, n, x, y, w, h, t, col) {
  const on = SEGS[n];
  const r = t / 2;
  const midY = y + h / 2;
  const pad = t * 0.55;
  const hbar = (yy) => cv.roundRect(x + pad, yy - r, w - pad * 2, t, r, col);
  const vbar = (xx, y0, y1) => cv.roundRect(xx - r, y0 + pad, t, y1 - y0 - pad * 2, r, col);

  if (on.includes("a")) hbar(y + r);
  if (on.includes("g")) hbar(midY);
  if (on.includes("d")) hbar(y + h - r);

  const side = (top, bot, xx) => {
    if (top && bot && !on.includes("g")) vbar(xx, y, y + h);     // continuous
    else { if (top) vbar(xx, y, midY); if (bot) vbar(xx, midY, y + h); }
  };
  side(on.includes("f"), on.includes("e"), x + r);
  side(on.includes("b"), on.includes("c"), x + w - r);
}

/** @param inset fraction of the canvas kept clear — maskable icons need 20%. */
function makeIcon(size, { maskable = false, radius = 0.22 } = {}) {
  const cv = canvas(size);
  if (maskable) {
    cv.fill(METAL); // full bleed: Android crops this to whatever shape it likes
  } else {
    cv.roundRect(0, 0, size, size, size * radius, METAL);
  }

  // content box: the maskable safe zone is the central 80%
  const safe = maskable ? 0.62 : 0.78;
  const boxW = size * safe;
  const boxH = boxW * 0.46;
  const bx = (size - boxW) / 2;
  const by = (size - boxH) / 2;

  // the odometer window the digits sit in
  cv.roundRect(bx - boxW * 0.06, by - boxH * 0.22, boxW * 1.12, boxH * 1.44,
               size * 0.035, DIM);

  const gap = boxW * 0.09;
  const dw = (boxW - gap * 2) / 3;
  const t = Math.max(2, boxH * 0.155);
  [0, 2, 8].forEach((n, i) => digit(cv, n, bx + i * (dw + gap), by, dw, boxH, t, FACE));

  return encodePNG(size, size, cv.px);
}

const out = path.join(__dirname, "..", "icons");
fs.mkdirSync(out, { recursive: true });

const files = [
  ["icon-192.png", makeIcon(192)],
  ["icon-512.png", makeIcon(512)],
  ["icon-maskable-512.png", makeIcon(512, { maskable: true })],
  ["apple-touch-icon.png", makeIcon(180, { radius: 0 })], // iOS applies its own mask
  ["favicon-64.png", makeIcon(64)],
];
for (const [name, buf] of files) {
  fs.writeFileSync(path.join(out, name), buf);
  console.log(`  ${name.padEnd(24)} ${(buf.length / 1024).toFixed(1)} kB`);
}
console.log("icons written to public/icons/");
