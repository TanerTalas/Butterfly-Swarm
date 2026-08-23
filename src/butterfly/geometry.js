import * as THREE from 'three';
import {
  mergeGeometries,
  mergeVertices,
} from 'three/addons/utils/BufferGeometryUtils.js';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';

/*
 * ── KONVANSİYON — DEĞİŞTİRME (bkz. CLAUDE.md) ──────────────────────────────
 *
 * Dünya uzayı:   +Z = burun (kelebeğin baktığı yön)
 *                +Y = yukarı
 *                ±X = kanat açılma yönü
 *                kanat çırpma = Z ekseni etrafında dönüş
 *                menteşe (pivot) = x == 0
 *
 * Kanatlar 2B `THREE.Shape` olarak çizilir. Shape uzayı:
 *                +x = menteşeden dışa doğru (span)
 *                +y = KUYRUĞA doğru (aft)   ← dikkat, ileri değil
 *                +z = yukarı (bombe bu yönde uygulanır)
 *
 * Neden +y kuyruk? `rotateX(-PI/2)` shape'i dünyaya taşırken
 *   shape.x → +X,  shape.y → −Z,  shape.z → +Y
 * eşlemesini yapıyor. Normalleri yukarı bakan tek rotasyon bu; bunun bedeli
 * de shape'in y ekseninin geriye bakması. Tek seferlik bir kural, buna
 * uyduğumuz sürece her şey tutarlı kalıyor.
 *
 * Her kanat SAĞ taraf için modellenir; sol kanat mesh'i `scale.x = -1` aynası.
 */

// ── Ayarlanabilir tasarım parametreleri ────────────────────────────────────
export const WING_DEFAULTS = {
  // span x'i, chord y'yi ölçekliyor. Kanadı büyütürken ikisini BİRLİKTE
  // ölçekle, yoksa siluet gerilmiş görünür.
  foreSpan: 1.6, // ön kanat açıklığı (menteşeden uca)
  foreChord: 1.6, // ön kanat en/boy oranı çarpanı
  hindSpan: 1.16, // arka kanat açıklığı
  hindChord: 1.26,
  camber: 0.045, // orta açıklıkta yukarı bombe (fazlası kanadı yastığa çeviriyor)
  droop: 0.055, // uca doğru aşağı sarkma
  edgeWidth: 0.076, // koyu kenar bandının kalınlığı (shape birimi)
  tessellation: 0.4, // hedef maksimum üçgen kenar uzunluğu
};

export const WING_COLORS = {
  root: 0xa8390f, // menteşe dibi — koyu kiremit
  mid: 0xe8781c, // gövde — turuncu
  tip: 0xf5ab3a, // uca doğru açılan sarı
  edge: 0x120e08, // dış kontur — neredeyse siyah
  vein: 0x2a1a0c, // damarlar
  spot: 0xfdf1dc, // kenar boyunca açık benekler
};

// Gövde üzerindeki menteşe konumları
export const HINGES = {
  fore: new THREE.Vector3(0, 0.1, 0.1),
  hind: new THREE.Vector3(0, 0.06, -0.1),
};

// ── Kanat siluetleri ───────────────────────────────────────────────────────
// Kontrol noktaları birim kanat için; span/chord ile ölçekleniyor.

function foreWingShape({ foreSpan: span, foreChord: chord }) {
  const s = new THREE.Shape();
  const X = (v) => v * span;
  const Y = (v) => v * chord;

  // Kök, ön kenarın dibinde
  s.moveTo(X(0.0), Y(-0.1));
  // Costa (ön kenar): neredeyse düz, hafif öne süpürülmüş
  s.bezierCurveTo(X(0.35), Y(-0.3), X(0.7), Y(-0.42), X(0.98), Y(-0.44));
  // Apex: kelebeği kelebek yapan sivri dış-ön köşe. Bilinçli olarak
  // bezier değil düz çizgi — yumuşatınca lob'a dönüşüyor.
  s.lineTo(X(1.06), Y(-0.34));
  // Termen (dış kenar): hafif içbükey
  s.bezierCurveTo(X(0.96), Y(-0.1), X(0.8), Y(0.14), X(0.55), Y(0.29));
  // Tornus (arka dış köşe): yuvarlak
  s.bezierCurveTo(X(0.44), Y(0.36), X(0.3), Y(0.38), X(0.18), Y(0.35));
  // İç kenar → köke dönüş
  s.bezierCurveTo(X(0.09), Y(0.32), X(0.02), Y(0.2), X(0.0), Y(-0.1));
  return s;
}

function hindWingShape({ hindSpan: span, hindChord: chord }) {
  const s = new THREE.Shape();
  const X = (v) => v * span;
  const Y = (v) => v * chord;

  // Arka kanat: kısa, geniş, belirgin yuvarlak. Ön kenarı ön kanadın altına girer.
  s.moveTo(X(0.0), Y(-0.14));
  s.bezierCurveTo(X(0.3), Y(-0.2), X(0.58), Y(-0.16), X(0.76), Y(-0.02));
  // Dış kenar: geniş yay
  s.bezierCurveTo(X(0.92), Y(0.12), X(0.94), Y(0.36), X(0.8), Y(0.54));
  // Arka (anal) köşe
  s.bezierCurveTo(X(0.66), Y(0.72), X(0.42), Y(0.8), X(0.24), Y(0.72));
  // İç kenar → köke dönüş
  s.bezierCurveTo(X(0.1), Y(0.65), X(0.02), Y(0.42), X(0.0), Y(-0.14));
  return s;
}

/** Kanat siluetlerini dışa açar — desen texture'ı bunları çizerek üretiyor. */
export function createWingShapes(overrides = {}) {
  const params = { ...WING_DEFAULTS, ...overrides };
  return { fore: foreWingShape(params), hind: hindWingShape(params) };
}

// ── Kanat geometrisi ───────────────────────────────────────────────────────

/**
 * Bir kanat siluetini üçgenleyip, tessellate edip, bombe ve vertex rengi
 * uygulayarak dünya konvansiyonuna döndürülmüş bir geometriye çevirir.
 * Menteşe daima origin'de kalır — pivot Object3D'si konumlandırmayı üstlenir.
 */
function buildWingGeometry(shape, span, params) {
  let geo = new THREE.ShapeGeometry(shape, 28);

  // ShapeGeometry yalnızca kontur vertex'leri üretir; iç nokta yok. Bombe ve
  // (ileride) shader twist'i için yüzeyi bölmemiz gerekiyor.
  geo = new TessellateModifier(params.tessellation, 6).modify(geo);

  // Desen texture'ı shape uzayında çizildiği için UV = shape koordinatının
  // silueti saran kutuya göre normalizesi. Böylece texture ile geometri
  // birebir hizalı — koyu kenar bandı tam konturun üstüne oturuyor.
  const bounds = shapeBounds(shape);

  const pos = geo.attributes.position;
  const count = pos.count;
  const uv = new Float32Array(count * 2);

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);

    uv[i * 2] = (x - bounds.minX) / bounds.width;
    uv[i * 2 + 1] = (y - bounds.minY) / bounds.height;

    // Bombe: orta açıklıkta yukarı kabarma + uca doğru sarkma.
    // Shape uzayında +z, dünyada +y oluyor.
    const u = THREE.MathUtils.clamp(x / span, 0, 1);
    pos.setZ(i, params.camber * Math.sin(Math.PI * u) - params.droop * u * u);
  }

  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));

  // TessellateModifier indexsiz geometri döndürüyor; öyle bırakırsak
  // computeVertexNormals her üçgene kendi normalini verir ve kanat
  // flat-shaded görünür. mergeVertices hem yüzeyi yumuşatıyor hem de
  // vertex sayısını ~3 kat düşürüyor.
  geo = mergeVertices(geo, 1e-5);

  // Shape uzayı → dünya. Normaller +Y'ye bakar, shape.y kuyruğa döner.
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/** Bir siluetin sarmalayan kutusu — UV normalizesi ve texture çizimi bunu paylaşır. */
export function shapeBounds(shape) {
  const pts = shape.getPoints(128);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

// ── Gövde ──────────────────────────────────────────────────────────────────

function buildAbdomen() {
  // Uca doğru incelen profil. LatheGeometry Y ekseni etrafında döner;
  // rotateX(PI/2) ile Y → +Z olur, profili −y'de kurup kuyruğa uzatıyoruz.
  //
  // DİKKAT: LatheGeometry profil noktalarının ARTAN y sırasında olmasını
  // bekler. Ters sırada verilirse üçgen sarımı çevrilir, normaller içeri
  // döner ve FrontSide culling ile karnın dış yüzeyi atılır — karın
  // "yarı saydam" görünüp içinden göğüs seçilir.
  // Bu yüzden liste kuyruk ucundan (en negatif y) göğse doğru sıralı.
  const profile = [
    [-0.94, 0.0],
    [-0.9, 0.022],
    [-0.82, 0.048],
    [-0.7, 0.077],
    [-0.56, 0.105],
    [-0.4, 0.128],
    [-0.22, 0.142],
    [-0.06, 0.138],
    [0.0, 0.115],
  ].map(([y, r]) => new THREE.Vector2(r, y - 0.02));

  // Segment sayıları bilinçli olarak düşük.
  //
  // Ölçüm: gövde, kelebek başına 1954 üçgenin 1288'ini yiyordu —
  // %66'sı. Oysa sürüde kelebek ekranın ~%11'i kadar ve gövde birkaç piksel;
  // görünen şey kanatlar. Aşağıdaki sayılar o ölçümden sonra yarıya indi.
  const geo = new THREE.LatheGeometry(profile, 8);
  geo.rotateX(Math.PI / 2); // lathe ekseni: +Y → +Z, profil −y → −Z (kuyruk)
  return geo;
}

function buildThorax() {
  const geo = new THREE.SphereGeometry(0.16, 10, 6);
  geo.scale(1.0, 1.05, 1.45);
  geo.translate(0, 0.01, 0.06);
  return geo;
}

function buildHead() {
  const geo = new THREE.SphereGeometry(0.115, 8, 5);
  geo.scale(1.0, 1.0, 0.9);
  geo.translate(0, 0.02, 0.33);
  return geo;
}

function buildAntenna(side) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.045, 0.08, 0.33),
    new THREE.Vector3(side * 0.11, 0.24, 0.5),
    new THREE.Vector3(side * 0.19, 0.38, 0.64),
    new THREE.Vector3(side * 0.27, 0.44, 0.71),
  ]);
  const tube = new THREE.TubeGeometry(curve, 8, 0.0105, 4, false);

  const club = new THREE.SphereGeometry(0.027, 6, 4);
  const tip = curve.getPoint(1);
  club.translate(tip.x, tip.y, tip.z);

  return mergeGeometries([tube, club], false);
}

function buildEyes() {
  const parts = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.SphereGeometry(0.058, 7, 5);
    eye.translate(side * 0.082, 0.045, 0.375);
    parts.push(eye);
  }
  return mergeGeometries(parts, false);
}

function buildBodyGeometry() {
  const parts = [
    buildAbdomen(),
    buildThorax(),
    buildHead(),
    buildAntenna(1),
    buildAntenna(-1),
  ];
  // Lathe/Sphere/Tube hepsi position+normal+uv üretiyor, merge sorunsuz.
  return mergeGeometries(parts, false);
}

// ── Dışa açılan tek giriş noktası ──────────────────────────────────────────

/**
 * Kelebeğin tüm geometri parçalarını üretir.
 *
 * Geometrinin nereden geldiğini çağıran taraf BİLMEZ. Kaynak değişirse
 * yalnızca burası değişir; çırpma ve sürü aynı kalır.
 */
export function createButterflyGeometry(overrides = {}) {
  const params = { ...WING_DEFAULTS, ...overrides };
  const shapes = createWingShapes(params);

  return {
    body: buildBodyGeometry(),
    eyes: buildEyes(),
    foreWing: buildWingGeometry(shapes.fore, params.foreSpan, params),
    hindWing: buildWingGeometry(shapes.hind, params.hindSpan, params),
    shapes,
    hinges: HINGES,
  };
}
