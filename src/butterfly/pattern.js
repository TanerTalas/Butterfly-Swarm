import * as THREE from 'three';
import { shapeBounds, WING_COLORS, WING_DEFAULTS } from './geometry.js';

/*
 * Kanat deseni canvas'ta, kanadın kendi shape uzayında çizilir. Aynı silueti
 * hem geometri hem texture kullandığı için desen konturla birebir hizalı
 * kalıyor — koyu kenar bandı tam kenarın üstüne oturuyor.
 *
 * ROADMAP 1.4'te bu "seçenek 2". Vertex renginden buraya geçildi çünkü:
 *   - keskin kenar bandı vertex yoğunluğuna bağımlı olmaktan çıktı
 *   - desen detayı ile üçgen sayısı ayrıştı (Aşama 5'te kelebek başına
 *     üçgen bütçesi kritik olacak)
 *
 * Bandın kendisi kalın bir stroke ile DEĞİL, konturun içe kaydırılmış
 * (offset) kopyasıyla çiziliyor: kalın stroke konveks eğrilerin iç tarafında
 * kendi üstüne binip tırtıklı bir hat bırakıyor.
 */

const TEXTURE_LONG_EDGE = 768;

export function createWingTexture(shape, options = {}) {
  const colors = { ...WING_COLORS, ...(options.colors || {}) };
  const edgeWidth = options.edgeWidth ?? WING_DEFAULTS.edgeWidth;

  const b = shapeBounds(shape);
  const aspect = b.width / b.height;
  const W = Math.round(aspect >= 1 ? TEXTURE_LONG_EDGE : TEXTURE_LONG_EDGE * aspect);
  const H = Math.round(aspect >= 1 ? TEXTURE_LONG_EDGE / aspect : TEXTURE_LONG_EDGE);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // shape uzayı → canvas pikseli.
  // Canvas'ın y'si aşağı doğru, texture'ın v'si yukarı: flipY (three'de
  // CanvasTexture için varsayılan açık) bunu geri çeviriyor, bu yüzden
  // burada y'yi ters çevirmek zorundayız ki iki ters birbirini götürsün.
  const px = (x) => ((x - b.minX) / b.width) * W;
  const py = (y) => (1 - (y - b.minY) / b.height) * H;
  const toPixels = (units) => (units / b.width) * W;

  const outline = dedupe(shape.getPoints(48));
  const inner = insetPolygon(outline, edgeWidth);

  const path = (points) => {
    ctx.beginPath();
    ctx.moveTo(px(points[0].x), py(points[0].y));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(px(points[i].x), py(points[i].y));
    }
    ctx.closePath();
  };

  ctx.save();

  // 1) Tüm siluet koyu kenar rengiyle dolduruluyor — geriye kalan kısım band olacak
  path(outline);
  ctx.clip();
  ctx.fillStyle = hex(colors.edge);
  ctx.fillRect(0, 0, W, H);

  // 2) İçe kaydırılmış kontura kırpıp asıl kanat rengini basıyoruz
  ctx.save();
  path(inner);
  ctx.clip();

  const grad = ctx.createLinearGradient(px(b.minX), 0, px(b.maxX), 0);
  grad.addColorStop(0.0, hex(colors.root));
  grad.addColorStop(0.42, hex(colors.mid));
  grad.addColorStop(1.0, hex(colors.tip));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  drawVeins(ctx, outline, b, edgeWidth, px, py, toPixels, colors);
  ctx.restore();

  // 3) Benekler bandın üstüne biniyor — klasik monark işareti
  drawMarginSpots(ctx, outline, b, edgeWidth, px, py, toPixels, colors);

  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Menteşeden uca ışınsal damarlar. Az ve soluk tutuluyor — sık ve koyu
 * damar kanadı palmiye yaprağına çeviriyor.
 */
function drawVeins(ctx, outline, b, edgeWidth, px, py, toPixels, colors) {
  const rootX = b.minX;
  const rootY = (b.minY + b.maxY) * 0.5;

  // Damarlar bandın biraz içinde bitiyor
  const targets = outerMargin(insetPolygon(outline, edgeWidth * 2.2), b);
  if (targets.length === 0) return;

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = hex(colors.vein);
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.5, toPixels(0.008));

  const step = Math.max(1, Math.floor(targets.length / 6));
  for (let i = 0; i < targets.length; i += step) {
    const t = targets[i];
    const midX = (rootX + t.x) * 0.5;
    const midY = (rootY + t.y) * 0.5 + (t.y - rootY) * 0.12;

    ctx.beginPath();
    ctx.moveTo(px(rootX), py(rootY));
    ctx.quadraticCurveTo(px(midX), py(midY), px(t.x), py(t.y));
    ctx.stroke();
  }
  ctx.restore();
}

/** Dış kenar boyunca açık benekler. */
function drawMarginSpots(ctx, outline, b, edgeWidth, px, py, toPixels, colors) {
  ctx.save();
  ctx.fillStyle = hex(colors.spot);

  const rows = [
    { depth: 0.45, radius: 0.13, alpha: 0.95, count: 7, offset: 0 }, // bandın ortasında
    { depth: 1.5, radius: 0.07, alpha: 0.5, count: 7, offset: 0.5 }, // bandın hemen içinde
  ];

  for (const row of rows) {
    const ring = outerMargin(insetPolygon(outline, edgeWidth * row.depth), b);
    if (ring.length === 0) continue;

    ctx.globalAlpha = row.alpha;
    const r = Math.max(1.2, toPixels(edgeWidth * row.radius));
    const step = Math.max(1, Math.floor(ring.length / row.count));

    for (let i = Math.round(step * row.offset); i < ring.length; i += step) {
      ctx.beginPath();
      ctx.arc(px(ring[i].x), py(ring[i].y), r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Kapalı bir konturu içe doğru `dist` kadar kaydırır.
 *
 * Her köşe, komşu iki KENARIN iç normallerinin açıortayı yönünde,
 * miter uzunluğu kadar ötelenir. Basitçe `prev→next` kirişinin normalini
 * kullanmak cazip ama apex gibi sivri köşelerde kiriş mahmuz eksenine
 * dikleşiyor ve "iç normal" dışarıyı göstermeye başlıyor — kanadın ucundan
 * dışarı fırlayan çıkıntılar bundan oluşuyor. Miter uzunluğu ayrıca
 * sınırlanıyor: sivri köşe içeride pahlanır, dışarı taşmaz.
 */
function insetPolygon(points, dist) {
  const n = points.length;
  // CCW poligonda iç taraf, ilerleme yönünün solu: normal = (-ey, ex)
  const sign = signedArea(points) > 0 ? 1 : -1;
  const maxMiter = dist * 2.5;
  const out = [];

  for (let i = 0; i < n; i++) {
    const cur = points[i];
    const nIn = edgeNormal(points[(i - 1 + n) % n], cur, sign);
    const nOut = edgeNormal(cur, points[(i + 1) % n], sign);

    const a = nIn || nOut;
    const c = nOut || nIn;
    if (!a) {
      out.push({ x: cur.x, y: cur.y });
      continue;
    }

    let bx = a.x + c.x;
    let by = a.y + c.y;
    const bl = Math.hypot(bx, by);
    if (bl < 1e-6) {
      // Kenarlar tam ters yönlü (iğne gibi katlanma) — köşeyi yerinde bırak
      out.push({ x: cur.x, y: cur.y });
      continue;
    }
    bx /= bl;
    by /= bl;

    const cosHalf = bx * a.x + by * a.y;
    const miter = Math.min(dist / Math.max(cosHalf, 1e-3), maxMiter);
    out.push({ x: cur.x + bx * miter, y: cur.y + by * miter });
  }
  return out;
}

function edgeNormal(a, b, sign) {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const len = Math.hypot(ex, ey);
  if (len < 1e-9) return null;
  return { x: (sign * -ey) / len, y: (sign * ex) / len };
}

/** Üst üste binen ardışık noktaları atar (eğri birleşim yerlerinde oluşuyor). */
function dedupe(points, eps = 1e-5) {
  const out = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > eps) out.push(p);
  }
  // kapanış noktası başlangıçla çakışıyorsa at
  if (out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) <= eps) out.pop();
  }
  return out;
}

function signedArea(points) {
  let a = 0;
  for (let i = 0, n = points.length; i < n; i++) {
    const p = points[i];
    const q = points[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a * 0.5;
}

/**
 * Konturun yalnızca DIŞ kenarı (menteşeden uzak yarısı). Damarlar ve
 * benekler gövdeye bakan iç kenarda görünmemeli.
 */
function outerMargin(points, b) {
  const threshold = b.minX + b.width * 0.5;
  return points.filter((p) => p.x > threshold);
}

function hex(n) {
  return `#${n.toString(16).padStart(6, '0')}`;
}
