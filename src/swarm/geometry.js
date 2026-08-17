import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createButterflyGeometry } from '../butterfly/geometry.js';
import { createWingAtlas } from '../butterfly/pattern.js';

/*
 * Sürü geometrisi.
 *
 * Aşama 1-4'te kelebek 6 ayrı mesh'ti (gövde, gözler, 4 kanat) ve kanatlar
 * Object3D pivotlarıyla döndürülüyordu. Yüzlerce kelebekte bu ne draw call
 * ne de matris güncellemesi olarak sürdürülebilir.
 *
 * Burada her şey İKİ geometriye iniyor:
 *   1) gövde + gözler  → vertex renkleriyle tek materyal
 *   2) 4 kanat         → atlas texture'ıyla tek materyal, çırpma shader'da
 *
 * Yani tüm sürü 2 draw call. ROADMAP "tek draw call" diyordu; gövdeyi de
 * kanat atlas'ına katıp 1'e indirmek mümkündü ama o zaman gövde de kanadın
 * sheen/iridescence'ını alacaktı. 2 draw call'un maliyeti yok denecek kadar
 * az, malzeme ayrımının görsel kazancı ise gerçek.
 *
 * Kanatlar menteşelerine ÖTELENMİŞ olarak birleşiyor; shader döndürmeden
 * önce menteşeyi çıkarıp sonra geri ekliyor.
 */

/** Kanat kimliği — vertex attribute `aWingId` olarak yazılıyor. */
export const WING_FORE = 0;
export const WING_HIND = 1;

export function buildSwarmGeometry(params = {}) {
  const parts = createButterflyGeometry(params);
  const atlas = createWingAtlas(parts.shapes, params);

  const body = buildBody(parts);
  const wings = buildWings(parts, atlas.regions);

  // Ara geometriler merge sonrası gereksiz
  parts.body.dispose();
  parts.eyes.dispose();
  parts.foreWing.dispose();
  parts.hindWing.dispose();

  return {
    body,
    wings,
    atlas: atlas.texture,
    atlasNormal: atlas.normalMap,
    hinges: parts.hinges,
  };
}

// ── Gövde ──────────────────────────────────────────────────────────────────

function buildBody({ body, eyes }) {
  // Gövde ve gözlerin rengi farklı ama tek materyal istiyoruz → vertex rengi
  const b = withVertexColor(body.clone(), 0x2b2118);
  const e = withVertexColor(eyes.clone(), 0x0b0906);

  // mergeGeometries attribute kümelerinin birebir eşleşmesini istiyor
  stripAttributes(b, ['position', 'normal', 'color']);
  stripAttributes(e, ['position', 'normal', 'color']);

  return mergeGeometries([b, e], false);
}

function withVertexColor(geometry, hex) {
  const c = new THREE.Color(hex);
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

// ── Kanatlar ───────────────────────────────────────────────────────────────

function buildWings({ foreWing, hindWing, hinges }, regions) {
  const pieces = [];

  for (const [geo, hinge, id, region] of [
    [foreWing, hinges.fore, WING_FORE, regions.fore],
    [hindWing, hinges.hind, WING_HIND, regions.hind],
  ]) {
    for (const side of [1, -1]) {
      const g = side === 1 ? geo.clone() : mirrorX(geo);
      remapUv(g, region);
      setWingId(g, id);
      // Menteşesine ötele: shader döndürürken menteşeyi çıkarıp geri ekliyor
      g.translate(hinge.x, hinge.y, hinge.z);
      stripAttributes(g, ['position', 'normal', 'uv', 'aWingId']);
      pieces.push(g);
    }
  }

  return mergeGeometries(pieces, false);
}

/**
 * X ekseninde ayna. `scale(-1,1,1)` üçgen sarımını da çeviriyor; index
 * sırasını geri almazsak ön yüzler arka yüz oluyor ve three, DoubleSide'da
 * `gl_FrontFacing` ile normali ters çevirdiği için aydınlatma bozuluyor.
 */
function mirrorX(geometry) {
  const g = geometry.clone();
  g.scale(-1, 1, 1);

  const index = g.getIndex();
  if (index) {
    const a = index.array;
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i];
      a[i] = a[i + 2];
      a[i + 2] = t;
    }
    index.needsUpdate = true;
  }
  return g;
}

/** Kanadın 0-1 UV'lerini atlas içindeki kendi bölgesine sıkıştırır. */
function remapUv(geometry, region) {
  const uv = geometry.attributes.uv;
  const du = region.uMax - region.uMin;
  const dv = region.vMax - region.vMin;

  for (let i = 0; i < uv.count; i++) {
    uv.setXY(
      i,
      region.uMin + uv.getX(i) * du,
      region.vMin + uv.getY(i) * dv,
    );
  }
  uv.needsUpdate = true;
}

function setWingId(geometry, id) {
  const count = geometry.attributes.position.count;
  const arr = new Float32Array(count);
  arr.fill(id);
  geometry.setAttribute('aWingId', new THREE.BufferAttribute(arr, 1));
}

/** mergeGeometries tüm parçaların aynı attribute kümesine sahip olmasını ister. */
function stripAttributes(geometry, keep) {
  for (const name of Object.keys(geometry.attributes)) {
    if (!keep.includes(name)) geometry.deleteAttribute(name);
  }
}
