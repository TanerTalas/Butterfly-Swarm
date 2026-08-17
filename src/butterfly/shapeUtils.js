/*
 * Kanat siluetleri üzerinde çalışan geometri yardımcıları.
 *
 * Hem atlas birleştirici (`pattern.js`) hem desen üretici (`wingDetail.js`)
 * bunlara ihtiyaç duyuyor; ayrı bir modülde durmalarının sebebi ikisi
 * arasında dairesel import oluşmaması.
 */

/**
 * Kapalı bir konturu içe doğru `dist` kadar kaydırır.
 *
 * Her köşe, komşu iki KENARIN iç normallerinin açıortayı yönünde, miter
 * uzunluğu kadar ötelenir. Basitçe `prev→next` kirişinin normalini kullanmak
 * cazip ama apex gibi sivri köşelerde kiriş mahmuz eksenine dikleşiyor ve
 * "iç normal" dışarıyı göstermeye başlıyor — kanadın ucundan dışarı fırlayan
 * çıkıntılar bundan oluşuyor. Miter uzunluğu ayrıca sınırlanıyor: sivri köşe
 * içeride pahlanır, dışarı taşmaz.
 */
export function insetPolygon(points, dist) {
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

/** Üst üste binen ardışık noktaları atar (eğri birleşim yerlerinde oluşuyor). */
export function dedupe(points, eps = 1e-5) {
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

function edgeNormal(a, b, sign) {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const len = Math.hypot(ex, ey);
  if (len < 1e-9) return null;
  return { x: (sign * -ey) / len, y: (sign * ex) / len };
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
