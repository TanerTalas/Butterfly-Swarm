import * as THREE from 'three';

/*
 * Inkwell atlaslarını three.js'e taşıyan katman.
 *
 * ── Kaynak ─────────────────────────────────────────────────────────────────
 *
 * github.com/siliconjungle/inkwell-webgpu-flowers (MIT)
 *
 * O projenin KODU kullanılamıyor: ham WebGPU + WGSL üzerine kurulu, compute
 * shader'larla dolaylı çizim (indirect draw) yapıyor ve Next.js/TypeScript
 * bir uygulama. Bizim sahnemiz three.js `WebGLRenderer`; arada çevrilecek
 * bir katman yok, teknik baştan yeniden yazılmalı.
 *
 * Kullanılabilen şey SANAT VARLIKLARI — ve zaten pahalı olan taraf onlar:
 *
 *   hearth-grass-atlas.webp  3072×2048, 3×2 ızgara, 1024²'lik zemin çimi
 *                            karoları (tepeden bakış). Zemin dokusu olarak
 *                            kullanılıyor: SIFIR üçgen maliyeti.
 *
 *   inkwell-petals.webp      2048×1280, 8×5 ızgara, 256²'lik TAÇYAPRAK'lar.
 *                            Tam çiçek değil — çiçek bunlardan kuruluyor
 *                            (bkz. groundcover.js). Gerçek alfa kanalı var,
 *                            yani alphaTest doğrudan çalışıyor.
 */

const loader = new THREE.TextureLoader();

/*
 * ⚠ Atlaslar WEBP. PNG'den çevrildiler ve PNG'ler depodan kalktı: çim atlası
 * 2,36 MB → 0,97 MB, taçyapraklar 2,39 MB → 0,41 MB. Kayıplı sıkıştırma ama
 * taçyaprakların ALFASI kayıpsıza yakın tutuldu (`alphaQuality: 100`), çünkü
 * alfa doğrudan `alphaTest`e giriyor ve bozulması taçyaprak kenarlarını
 * tırtıklardı.
 *
 * Bu yalnızca İNDİRME kazancı: WebP de GPU'ya ham RGBA olarak çıkıyor, yani
 * VRAM aynı (çim atlası 24 MB). Onu düşürmek KTX2 ister (CLAUDE.md → Açık işler §5).
 */
export const GRASS_ATLAS_URL = '/textures/hearth-grass-atlas.webp';
export const PETAL_ATLAS_URL = '/textures/inkwell-petals.webp';

// Çim atlasının ızgarası
export const GRASS_GRID = { cols: 3, rows: 2 };
// Taçyaprak atlasının ızgarası
export const PETAL_GRID = { cols: 8, rows: 5 };

export async function loadTexture(url, { srgb = true } = {}) {
  try {
    const tex = await loader.loadAsync(url);
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  } catch (err) {
    console.warn(`[world] doku yüklenemedi: ${url}`, err);
    return null;
  }
}

/**
 * Atlastan tek bir karo kesip tekrarlanabilir bir doku üretir.
 *
 * Neden kesiyoruz: `texture.repeat` bütün görüntüyü tekrarlıyor, alt
 * dikdörtgenini değil. Atlası olduğu gibi döşemek altı farklı karoyu yan
 * yana getirir ve aralarında görünür dikişler oluşur. Karoyu bir canvas'a
 * kopyalayınca `RepeatWrapping` tek karo üzerinde çalışıyor.
 *
 * @param {THREE.Texture} atlas
 * @param {number} col  0'dan başlayan kolon
 * @param {number} row  0'dan başlayan satır (üstten)
 */
export function cropTile(atlas, col, row, grid = GRASS_GRID) {
  const img = atlas.image;
  const tw = Math.floor(img.width / grid.cols);
  const th = Math.floor(img.height / grid.rows);

  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, col * tw, row * th, tw, th, 0, 0, tw, th);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // Zemin çok yatık bir açıyla görünüyor; anisotropy olmadan uzak alan
  // bulanık bir yeşil lekeye dönüşüyor
  tex.anisotropy = 8;
  return tex;
}

/**
 * Bir geometrinin UV'lerini atlasın tek bir hücresine hapseder.
 *
 * Geometri 0–1 aralığında UV taşıdığı varsayılıyor (PlaneGeometry öyle).
 * Hücre UV'si geometriye PİŞİRİLİYOR, uniform olarak geçilmiyor — böylece
 * farklı hücreler tek malzemeyi paylaşabiliyor ve instancing bozulmuyor.
 */
export function mapToCell(geometry, col, row, grid = PETAL_GRID) {
  const uv = geometry.attributes.uv;
  const du = 1 / grid.cols;
  const dv = 1 / grid.rows;
  // Satır 0 en ÜST sıra; UV'de v yukarı doğru arttığı için ters çevriliyor
  const u0 = col * du;
  const v0 = 1 - (row + 1) * dv;

  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, u0 + uv.getX(i) * du, v0 + uv.getY(i) * dv);
  }
  uv.needsUpdate = true;
  return geometry;
}
