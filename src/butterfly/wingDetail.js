import * as THREE from 'three';
import { shapeBounds, WING_COLORS, WING_DEFAULTS } from './geometry.js';
import { insetPolygon, dedupe } from './shapeUtils.js';

/*
 * ZENGİN KANAT DESENİ
 *
 * İlk desen bilinçli olarak sadeydi: gradyan, koyu kenar bandı, kökten
 * kenara giden düz damarlar, yuvarlak benekler. Kelebek ekranın %11'i
 * kadarken yetiyordu ama yakından bakıldığında kanat düz duruyordu.
 *
 * Buradaki katmanlar `lab.html` içinde tek tek denenip seçildi. Her biri
 * bağımsız açılıp kapanabiliyor.
 *
 * Gerçek kelebek kanadında olup ilk desende olmayanlar:
 *   - dallanan damar yapısı ve diskal hücre (en belirgin eksikti)
 *   - pul dokusu (o pudramsı, dokulu yüzey)
 *   - submarjinal bant + hilal şeklinde kenar işaretleri
 *   - saçak (kenardaki açık/koyu almaşık tarak)
 *   - göz lekesi (ocellus)
 *   - damarların ışığı yakalaması → kabartma (normal map)
 */

export const DETAIL_DEFAULTS = {
  venation: true, // dallanan damarlar
  discalCell: true, // gövdeye yakın kapalı hücre
  cellShading: true, // damar aralarında ton farkı
  scales: true, // pul dokusu
  basalDust: true, // köke doğru koyulaşma
  submarginal: true, // ikinci bant
  lunules: true, // hilal kenar işaretleri
  fringe: true, // en dış saçak
  ocelli: 3, // göz lekesi sayısı
  relief: true, // damarlardan normal map

  veinStrength: 0.55,
  scaleDensity: 1.0,
  reliefStrength: 2.2,
  seed: 7,
};

const SINGLE_TILE = 1024;

/**
 * Tek kanat için bağımsız texture üretir (laboratuvar bunu kullanıyor).
 * Sürü, atlas'a çizmek için aşağıdaki `drawDetailedWing`'i doğrudan çağırıyor.
 *
 * @returns {{map: THREE.Texture, normalMap: THREE.Texture|null}}
 */
export function createDetailedWing(shape, options = {}) {
  const o = { ...DETAIL_DEFAULTS, ...options };
  const b = shapeBounds(shape);
  const aspect = b.width / b.height;
  const W = Math.round(aspect >= 1 ? SINGLE_TILE : SINGLE_TILE * aspect);
  const H = Math.round(aspect >= 1 ? SINGLE_TILE / aspect : SINGLE_TILE);
  const rect = { x: 0, y: 0, w: W, h: H };

  const canvas = makeCanvas(W, H);
  drawDetailedWing(canvas.getContext('2d'), shape, rect, o);
  const map = makeTexture(canvas, THREE.SRGBColorSpace);

  let normalMap = null;
  if (o.relief) {
    const height = makeCanvas(W, H);
    const hctx = height.getContext('2d');
    fillNeutralHeight(hctx, W, H);
    drawWingHeight(hctx, shape, rect, o);
    normalMap = makeTexture(heightToNormal(height, o.reliefStrength), null);
  }

  return { map, normalMap };
}

/** Yükseklik haritasının nötr zemini — gri = düz yüzey. */
export function fillNeutralHeight(ctx, w, h) {
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, w, h);
}

/** Renk katmanını verilen canvas dikdörtgenine çizer. */
export function drawDetailedWing(ctx, shape, rect, options = {}) {
  const o = { ...DETAIL_DEFAULTS, ...options };
  const colors = { ...WING_COLORS, ...(o.colors || {}) };
  const edgeWidth = o.edgeWidth ?? WING_DEFAULTS.edgeWidth;

  const b = shapeBounds(shape);
  const px = (x) => rect.x + ((x - b.minX) / b.width) * rect.w;
  const py = (y) => rect.y + (1 - (y - b.minY) / b.height) * rect.h;
  const toPx = (u) => (u / b.width) * rect.w;
  const W = rect.w;
  const H = rect.h;

  const outline = dedupe(shape.getPoints(64));
  const inner = insetPolygon(outline, edgeWidth);
  const veins = buildVeins(outline, b, edgeWidth, o);
  const rng = mulberry32(o.seed);

  const path = (pts) => {
    ctx.beginPath();
    ctx.moveTo(px(pts[0].x), py(pts[0].y));
    for (let i = 1; i < pts.length; i++) ctx.lineTo(px(pts[i].x), py(pts[i].y));
    ctx.closePath();
  };

  // ── Renk katmanı ────────────────────────────────────────────────────────
  ctx.save();
  path(outline);
  ctx.clip();

  // Kenar bandı: tüm siluet koyu, sonra içi boyanıyor
  ctx.fillStyle = hex(colors.edge);
  ctx.fillRect(rect.x, rect.y, W, H);

  ctx.save();
  path(inner);
  ctx.clip();

  const grad = ctx.createLinearGradient(px(b.minX), 0, px(b.maxX), 0);
  grad.addColorStop(0.0, hex(colors.root));
  grad.addColorStop(0.42, hex(colors.mid));
  grad.addColorStop(1.0, hex(colors.tip));
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, W, H);

  if (o.cellShading) drawCellShading(ctx, veins, b, px, py, rng);
  if (o.basalDust) drawBasalDust(ctx, b, px, py, colors);
  if (o.scales) drawScales(ctx, veins.base, b, px, py, toPx, o, rng);
  if (o.submarginal) drawSubmarginalBand(ctx, outline, edgeWidth, px, py, colors);
  if (o.venation) drawVeins(ctx, veins, px, py, toPx, colors, o);
  if (o.ocelli > 0) drawOcelli(ctx, veins, b, px, py, toPx, colors, o, rng);

  ctx.restore(); // inner clip

  if (o.lunules) drawLunules(ctx, outline, b, edgeWidth, px, py, toPx, colors);
  ctx.restore(); // outline clip

  if (o.fringe) drawFringe(ctx, outline, edgeWidth, px, py, toPx, colors);
}

/**
 * Yükseklik katmanı: damarlar yüzeyden kabarık olduğu için açık çiziliyor.
 * Renk katmanıyla aynı geometriyi kullanıyor ki kabartma desene tam otursun.
 */
export function drawWingHeight(ctx, shape, rect, options = {}) {
  const o = { ...DETAIL_DEFAULTS, ...options };
  if (!o.venation) return;

  const edgeWidth = o.edgeWidth ?? WING_DEFAULTS.edgeWidth;
  const b = shapeBounds(shape);
  const px = (x) => rect.x + ((x - b.minX) / b.width) * rect.w;
  const py = (y) => rect.y + (1 - (y - b.minY) / b.height) * rect.h;
  const toPx = (u) => (u / b.width) * rect.w;

  const outline = dedupe(shape.getPoints(64));
  const veins = buildVeins(outline, b, edgeWidth, o);

  drawVeins(ctx, veins, px, py, toPx, HEIGHT_COLORS, { ...o, veinStrength: 1 });
}

// ── Damar yapısı ───────────────────────────────────────────────────────────

/**
 * Damarları veri olarak kurar.
 *
 * Sürüdeki sade desende damarlar kökten kenara giden düz ışınlardı ve kanat
 * palmiye yaprağına benziyordu. Gerçek kanatta damarlar önce bir DİSKAL
 * HÜCRE oluşturuyor, dallanma o hücrenin dış ucundan başlıyor. Siluete
 * kelebek hissini veren şey büyük ölçüde bu.
 */
function buildVeins(outline, b, edgeWidth, o) {
  const midY = (b.minY + b.maxY) * 0.5;
  const base = { x: b.minX + 0.03 * b.width, y: midY };
  const node = { x: b.minX + 0.42 * b.width, y: midY - 0.04 * b.height };

  // Damarlar bandın içinde bitiyor
  const rim = insetPolygon(outline, edgeWidth * 1.7);

  // Kökten uzaktaki kenar noktalarını açıya göre sıralayıp eşit aralıkla seç
  const outer = rim
    .filter((p) => p.x > b.minX + 0.42 * b.width)
    .map((p) => ({ ...p, a: Math.atan2(p.y - node.y, p.x - node.x) }))
    .sort((p, q) => p.a - q.a);

  const branches = [];
  const N = 7;
  for (let i = 0; i < N; i++) {
    const p = outer[Math.floor(((i + 0.5) / N) * outer.length)];
    if (p) branches.push(p);
  }

  // İç kenara (kuyruk tarafı) giden anal damarlar — kökten doğrudan çıkıyor
  const anal = rim
    .filter((p) => p.x < b.minX + 0.55 * b.width && p.y > midY + 0.1 * b.height)
    .sort((p, q) => q.y - p.y)
    .slice(0, 2);

  // Costa: ön kenar boyunca (shape uzayında -y tarafı)
  const costa = rim
    .filter((p) => p.y < midY - 0.15 * b.height)
    .sort((p, q) => q.x - p.x)[0];

  return {
    base,
    node,
    branches,
    anal,
    costa,
    cellWidth: 0.085 * b.height,
    hasCell: o.discalCell,
  };
}

function drawVeins(ctx, v, px, py, toPx, colors, o) {
  ctx.save();
  ctx.strokeStyle = hex(colors.vein);
  ctx.globalAlpha = o.veinStrength;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const w = (units) => Math.max(1, toPx(units));

  // Ana gövde: kök → düğüm (en kalın damar)
  ctx.lineWidth = w(0.017);
  line(ctx, px, py, v.base, v.node);

  // Diskal hücre: kök ile düğüm arasında kapalı, mercek biçimli alan
  if (v.hasCell) {
    const dx = v.node.x - v.base.x;
    const dy = v.node.y - v.base.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * v.cellWidth;
    const ny = (dx / len) * v.cellWidth;

    ctx.lineWidth = w(0.011);
    for (const s of [1, -1]) {
      ctx.beginPath();
      ctx.moveTo(px(v.base.x), py(v.base.y));
      ctx.quadraticCurveTo(
        px(v.base.x + dx * 0.5 + nx * s),
        py(v.base.y + dy * 0.5 + ny * s),
        px(v.node.x),
        py(v.node.y),
      );
      ctx.stroke();
    }
  }

  // Düğümden kenara dallar — uca doğru inceliyor
  for (const p of v.branches) {
    ctx.lineWidth = w(0.011);
    ctx.beginPath();
    ctx.moveTo(px(v.node.x), py(v.node.y));
    const mx = (v.node.x + p.x) * 0.5;
    const my = (v.node.y + p.y) * 0.5 + (p.y - v.node.y) * 0.1;
    ctx.quadraticCurveTo(px(mx), py(my), px(p.x), py(p.y));
    ctx.stroke();
  }

  // Anal damarlar ve costa doğrudan kökten
  ctx.lineWidth = w(0.012);
  for (const p of v.anal) line(ctx, px, py, v.base, p, 0.12);
  if (v.costa) {
    ctx.lineWidth = w(0.014);
    line(ctx, px, py, v.base, v.costa, -0.18);
  }

  ctx.restore();
}

function line(ctx, px, py, a, c, bow = 0) {
  ctx.beginPath();
  ctx.moveTo(px(a.x), py(a.y));
  const mx = (a.x + c.x) * 0.5;
  const my = (a.y + c.y) * 0.5 + (c.y - a.y) * bow;
  ctx.quadraticCurveTo(px(mx), py(my), px(c.x), py(c.y));
  ctx.stroke();
}

// ── Detay katmanları ───────────────────────────────────────────────────────

/** Damar aralarındaki hücrelere hafif ton farkı — yüzey tek düze kalmasın. */
function drawCellShading(ctx, v, b, px, py, rng) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';

  for (let i = 0; i < v.branches.length - 1; i++) {
    const a = v.branches[i];
    const c = v.branches[i + 1];
    const shade = 0.86 + rng() * 0.2;

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = grey(shade);
    ctx.beginPath();
    ctx.moveTo(px(v.node.x), py(v.node.y));
    ctx.lineTo(px(a.x), py(a.y));
    ctx.lineTo(px(c.x), py(c.y));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Gövdeye yakın bölge her kelebekte daha koyu ve dumanlıdır. */
function drawBasalDust(ctx, b, px, py, colors) {
  const g = ctx.createRadialGradient(
    px(b.minX),
    py((b.minY + b.maxY) * 0.5),
    0,
    px(b.minX),
    py((b.minY + b.maxY) * 0.5),
    Math.abs(px(b.minX + b.width * 0.55) - px(b.minX)),
  );
  g.addColorStop(0, hexA(colors.edge, 0.6));
  g.addColorStop(0.55, hexA(colors.edge, 0.15));
  g.addColorStop(1, hexA(colors.edge, 0));

  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

/**
 * Pul dokusu.
 *
 * Rastgele piksel gürültüsü TV karıncası gibi duruyor; kelebek pulları ise
 * kökten uca doğru YÖNLÜ diziliyor. Bu yüzden her tanecik kökten dışa bakan
 * küçük bir elips olarak çiziliyor.
 */
function drawScales(ctx, base, b, px, py, toPx, o, rng) {
  const count = Math.round(5200 * o.scaleDensity);
  const rx = Math.max(1.2, toPx(0.011));
  const ry = Math.max(0.6, toPx(0.0045));

  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = b.minX + rng() * b.width;
    const y = b.minY + rng() * b.height;
    const angle = Math.atan2(py(y) - py(base.y), px(x) - px(base.x));

    // Yarısı açık yarısı koyu → pudramsı kırılma
    const light = rng() > 0.5;
    ctx.globalAlpha = 0.05 + rng() * 0.06;
    ctx.fillStyle = light ? '#ffffff' : '#000000';

    ctx.beginPath();
    ctx.ellipse(px(x), py(y), rx, ry, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Kenar bandının hemen içinde ikinci, daha açık bir bant. */
function drawSubmarginalBand(ctx, outline, edgeWidth, px, py, colors) {
  const outer = insetPolygon(outline, edgeWidth * 1.05);
  const inner = insetPolygon(outline, edgeWidth * 2.3);

  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = hex(colors.edge);
  ctx.beginPath();
  trace(ctx, outer, px, py);
  trace(ctx, inner, px, py, true);
  ctx.fill('evenodd');
  ctx.restore();
}

/** Kenar boyunca hilaller — yuvarlak benekten çok daha kelebek gibi duruyor. */
function drawLunules(ctx, outline, b, edgeWidth, px, py, toPx, colors) {
  const ring = insetPolygon(outline, edgeWidth * 0.55).filter(
    (p) => p.x > b.minX + b.width * 0.45,
  );
  if (ring.length < 3) return;

  ctx.save();
  ctx.strokeStyle = hex(colors.spot);
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, toPx(edgeWidth * 0.34));
  ctx.globalAlpha = 0.72;

  // Aralarında BOŞLUK olmalı. Bitişik çizilince hilaller birleşip kalın
  // beyaz bir banda dönüşüyor ve kenar "çıkartma konturu" gibi duruyor.
  const N = 7;
  const slot = ring.length / N;
  const arc = Math.max(2, Math.floor(slot * 0.5));

  for (let k = 0; k < N; k++) {
    const start = Math.floor(k * slot + slot * 0.25);
    if (start + arc >= ring.length) break;

    ctx.beginPath();
    ctx.moveTo(px(ring[start].x), py(ring[start].y));
    for (let j = 1; j <= arc; j++) {
      ctx.lineTo(px(ring[start + j].x), py(ring[start + j].y));
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * En dış kenardaki açık/koyu almaşık tarak.
 *
 * İlk deneme her kontur segmentini almaşık renklendiriyordu; sonuç kanadın
 * etrafında beyaz noktalı bir "çıkartma konturu" oldu ve hilalleri de boğdu.
 * Şimdi birkaç segment bir "diş" oluşturuyor ve opaklık çok daha düşük —
 * saçak yakından fark ediliyor, uzaktan siluete karışıyor.
 */
function drawFringe(ctx, outline, edgeWidth, px, py, toPx, colors) {
  const TOOTH = 3; // bir dişi oluşturan segment sayısı

  ctx.save();
  ctx.lineWidth = Math.max(1, toPx(edgeWidth * 0.16));
  ctx.lineCap = 'butt';

  for (let i = 0; i < outline.length; i += TOOTH) {
    const light = Math.floor(i / TOOTH) % 2 === 0;
    ctx.strokeStyle = light ? hex(colors.spot) : hex(colors.edge);
    ctx.globalAlpha = light ? 0.3 : 0.45;

    ctx.beginPath();
    ctx.moveTo(px(outline[i].x), py(outline[i].y));
    for (let k = 1; k <= TOOTH; k++) {
      const p = outline[(i + k) % outline.length];
      ctx.lineTo(px(p.x), py(p.y));
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Göz lekesi: iç içe halkalar + parlama noktası. */
function drawOcelli(ctx, v, b, px, py, toPx, colors, o, rng) {
  const spots = v.branches.slice(1, 1 + o.ocelli);

  for (const p of spots) {
    // Kenardan biraz içeri çek
    const cx = p.x + (v.node.x - p.x) * 0.22;
    const cy = p.y + (v.node.y - p.y) * 0.22;
    const r = toPx(b.height * (0.055 + rng() * 0.02));

    ctx.save();
    ctx.globalAlpha = 0.9;

    ctx.fillStyle = hexA(colors.spot, 0.55);
    circle(ctx, px(cx), py(cy), r * 1.35);

    ctx.fillStyle = hex(colors.edge);
    circle(ctx, px(cx), py(cy), r);

    ctx.fillStyle = hexA(colors.tip, 0.9);
    circle(ctx, px(cx), py(cy), r * 0.52);

    ctx.fillStyle = '#ffffff';
    circle(ctx, px(cx) - r * 0.2, py(cy) - r * 0.2, r * 0.2);

    ctx.restore();
  }
}

// ── Kabartma ───────────────────────────────────────────────────────────────

const HEIGHT_COLORS = { vein: 0xe8e8e8 };

/**
 * Yükseklik haritasından normal map. Sobel benzeri merkezi fark; damarlar
 * yüzeyden kabarık olduğu için ışığı yakalıyor ve kanat düz levha olmaktan
 * çıkıyor.
 */
export function heightToNormal(heightCanvas, strength) {
  const W = heightCanvas.width;
  const H = heightCanvas.height;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, W, H).data;

  const out = makeCanvas(W, H);
  const octx = out.getContext('2d');
  const img = octx.createImageData(W, H);
  const d = img.data;

  const at = (x, y) => {
    const cx = x < 0 ? 0 : x >= W ? W - 1 : x;
    const cy = y < 0 ? 0 : y >= H ? H - 1 : y;
    return src[(cy * W + cx) * 4] / 255;
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = at(x + 1, y) - at(x - 1, y);
      const dy = at(x, y + 1) - at(x, y - 1);

      // Canvas y aşağı, tangent space y yukarı → dy'nin işareti ters
      let nx = -dx * strength;
      let ny = dy * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;

      const i = (y * W + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255;
      d[i + 1] = (ny * 0.5 + 0.5) * 255;
      d[i + 2] = (nz / len) * 0.5 * 255 + 127.5;
      d[i + 3] = 255;
    }
  }

  octx.putImageData(img, 0, 0);
  return out;
}

// ── Yardımcılar ────────────────────────────────────────────────────────────

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function makeTexture(canvas, colorSpace) {
  const t = new THREE.CanvasTexture(canvas);
  if (colorSpace) t.colorSpace = colorSpace;
  t.anisotropy = 8;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

function trace(ctx, pts, px, py, reverse = false) {
  const list = reverse ? [...pts].reverse() : pts;
  ctx.moveTo(px(list[0].x), py(list[0].y));
  for (let i = 1; i < list.length; i++) ctx.lineTo(px(list[i].x), py(list[i].y));
  ctx.closePath();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function hex(n) {
  return `#${n.toString(16).padStart(6, '0')}`;
}

function hexA(n, a) {
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

function grey(v) {
  const c = Math.round(THREE.MathUtils.clamp(v, 0, 1) * 255);
  return `rgb(${c},${c},${c})`;
}

/** Deterministik RNG — aynı seed aynı deseni versin. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
