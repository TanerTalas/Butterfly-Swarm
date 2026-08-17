import * as THREE from 'three';
import {
  drawDetailedWing,
  drawWingHeight,
  fillNeutralHeight,
  heightToNormal,
} from './wingDetail.js';

/*
 * Kanat deseni atlası.
 *
 * Sürüde tüm kelebekler tek `InstancedMesh` olduğu için tek materyal,
 * dolayısıyla tek texture gerekiyor. Ön ve arka kanat desenleri yan yana
 * çiziliyor, her kanadın UV'si kendi bölgesine yeniden eşleniyor.
 *
 * Desenin kendisi `wingDetail.js`'te; buradaki iş yalnızca yerleşim.
 */

const TILE = 768;

/**
 * @returns {{
 *   texture: THREE.Texture,
 *   normalMap: THREE.Texture|null,
 *   regions: {fore: object, hind: object}
 * }} Bölgeler UV uzayında `{uMin, uMax, vMin, vMax}`.
 */
export function createWingAtlas(shapes, options = {}) {
  const W = TILE * 2;
  const H = TILE;

  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const rects = {
    fore: { x: 0, y: 0, w: TILE, h: TILE },
    hind: { x: TILE, y: 0, w: TILE, h: TILE },
  };

  drawDetailedWing(ctx, shapes.fore, rects.fore, options);
  drawDetailedWing(ctx, shapes.hind, rects.hind, options);

  // Kabartma: iki kanadın damarları TEK yükseklik haritasına çizilip normal
  // map'e bir kerede çevriliyor — Sobel geçişi atlas başına bir kez koşuyor.
  //
  // Yarı çözünürlük bilinçli: normaller düşük frekanslı olduğu için görsel
  // fark yok ama Sobel geçişi dörtte bir piksele iniyor. Tam çözünürlükte
  // atlas üretimi gözle görülür şekilde takılıyordu.
  let normalMap = null;
  if (options.relief) {
    const nw = W >> 1;
    const nh = H >> 1;
    const height = makeCanvas(nw, nh);
    const hctx = height.getContext('2d');
    fillNeutralHeight(hctx, nw, nh);
    drawWingHeight(hctx, shapes.fore, halfRect(rects.fore), options);
    drawWingHeight(hctx, shapes.hind, halfRect(rects.hind), options);
    normalMap = makeTexture(
      heightToNormal(height, options.reliefStrength),
      null,
    );
  }

  return {
    texture: makeTexture(canvas, THREE.SRGBColorSpace),
    normalMap,
    regions: {
      fore: toUvRegion(rects.fore, W, H),
      hind: toUvRegion(rects.hind, W, H),
    },
  };
}

/**
 * Canvas dikdörtgeni → UV bölgesi.
 *
 * Canvas'ın y'si aşağı, texture'ın v'si yukarı doğru; CanvasTexture'da
 * varsayılan olarak açık olan flipY bunu çeviriyor, yani canvas'ın ÜST kenarı
 * v = 1'e denk geliyor. Aşağıdaki ters çevirme bu yüzden.
 */
function toUvRegion(rect, W, H) {
  return {
    uMin: rect.x / W,
    uMax: (rect.x + rect.w) / W,
    vMin: 1 - (rect.y + rect.h) / H,
    vMax: 1 - rect.y / H,
  };
}

function halfRect(r) {
  return { x: r.x >> 1, y: r.y >> 1, w: r.w >> 1, h: r.h >> 1 };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function makeTexture(canvas, colorSpace) {
  const texture = new THREE.CanvasTexture(canvas);
  if (colorSpace) texture.colorSpace = colorSpace;
  texture.anisotropy = 8;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}
