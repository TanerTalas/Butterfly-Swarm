import * as THREE from 'three';
import { WORLD } from './config.js';
import { groundHeight, mulberry32 } from './terrain.js';

/*
 * Çim yaprakları — zeminin üstünde rüzgârda salınan 3B katman.
 *
 * Temeli klasik instanced çim yaklaşımı: tek bir yaprak geometrisi,
 * binlerce kopya, rüzgâr vertex shader'da faz/genlik attribute'larıyla.
 * Bu sahne için iki noktada ayrışıyor ve ikisi de zorunluydu:
 *
 * 1. `ShaderMaterial` YERİNE `MeshStandardMaterial` + shader enjeksiyonu.
 *
 *    Ham ShaderMaterial ışık, gölge ve SİS almıyor. Bu sahnede sis
 *    mesafenin tek okunma yolu; sis almayan bir çim, uzaktaki her şey
 *    puslanırken kendisi net kalıyor ve zemin ekrandan "kopuyor".
 *    Enjeksiyon yöntemi projede kelebek kanadında da kullanılıyor
 *    (`injectFlapShader`, bkz. CLAUDE.md).
 *
 * 2. Yaprak başına 16 üçgen yerine 8.
 *
 *    Özgün geometri `PlaneGeometry(0.08, 1.5, 1, 8)` — dikeyde 8 bölüm,
 *    yani 16 üçgen. Bükülme için 4 bölüm yeterli ve maliyet yarıya iniyor.
 *    45.000 yaprakta bu 360.000 üçgen ile 720.000 üçgen arasındaki fark.
 *
 * Zemin dokusu ALTTA duruyor (Inkwell çim karosu). Kaplamayı doku yapıyor,
 * yapraklar siluet ve hareket veriyor — ikisi birlikte çalışıyor. Yalnızca
 * yaprakla kaplamak için gereken yoğunluk üçgen bütçesini katlıyor.
 */

/** Bükülme animasyonunun zaman uniform'u — materyal ömrü boyunca tek nesne. */
const uniforms = {
  uTime: { value: 0 },
  uWind: { value: 1 },
};

export function createGrassField({ avoid = [] } = {}) {
  const cfg = WORLD.grassField;

  const geometry = createBladeGeometry(cfg.segments);
  const material = createBladeMaterial();

  const mesh = new THREE.InstancedMesh(geometry, material, cfg.count);
  /*
   * Çim gölge DÜŞÜRMÜYOR: 45.000 instance'ı gölge geçişinde ikinci kez
   * çizmek maliyeti ikiye katlar, karşılığı birkaç piksellik karartma.
   * Gölge ALIYOR — ağaçların gölgesi çimin üstünden geçiyor.
   */
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  mesh.name = 'grass-field';

  const rand = mulberry32(cfg.seed);
  const matrix = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scl = new THREE.Vector3();
  const color = new THREE.Color();

  const base = new THREE.Color(cfg.colorBase);
  const alt = new THREE.Color(cfg.colorAlt);

  // Rüzgâr faz/genlik verisi instance başına; yapraklar aynı anda
  // salınırsa tarla nefes alan tek bir kütle gibi görünüyor
  const phase = new Float32Array(cfg.count);
  const amplitude = new Float32Array(cfg.count);

  let placed = 0;
  for (let i = 0; i < cfg.count; i++) {
    // sqrt: diskte tekdüze yoğunluk
    const r = Math.sqrt(rand()) * cfg.radius;
    const angle = rand() * Math.PI * 2;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;

    let blocked = false;
    for (const a of avoid) {
      if ((x - a.x) ** 2 + (z - a.z) ** 2 < a.r * a.r) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    // Biraz gömüyoruz: tabanı tam zeminde olan yaprak, zemin dokusunun
    // üstünde yüzüyormuş gibi duruyor
    pos.set(x, groundHeight(x, z) - 0.03, z);

    euler.set((rand() - 0.5) * 0.3, rand() * Math.PI * 2, (rand() - 0.5) * 0.3);
    quat.setFromEuler(euler);

    const h = cfg.height * (0.6 + rand() * 0.8);
    scl.set(0.7 + rand() * 0.6, h, 1);
    matrix.compose(pos, quat, scl);
    mesh.setMatrixAt(placed, matrix);

    color.copy(base).lerp(alt, rand());
    mesh.setColorAt(placed, color);

    phase[placed] = rand() * Math.PI * 2;
    amplitude[placed] = cfg.sway * (0.5 + rand() * 0.9);

    placed++;
  }

  geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  geometry.setAttribute(
    'aAmp',
    new THREE.InstancedBufferAttribute(amplitude, 1),
  );

  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();

  mesh.userData.placed = placed;
  mesh.userData.triangles = placed * cfg.segments * 2;
  return mesh;
}

/** Rüzgârı ilerletir. Sahne döngüsünden her karede çağrılıyor. */
export function updateGrassField(elapsed) {
  uniforms.uTime.value = elapsed;
}

/**
 * Tek çim yaprağı: dikeyde bölünmüş ince bir şerit.
 *
 * Bölüm sayısı bükülmenin yumuşaklığını belirliyor — tek bölümde yaprak
 * kırılarak eğiliyor. 4 bölüm gözle yeterli.
 *
 * Uç açık, dip koyu vertex rengi taşıyor: gerçek çimde ışık uca doğru
 * saçılıyor ve bu tek başına derinlik veriyor. Instance rengi bununla
 * çarpılıyor.
 */
function createBladeGeometry(segments) {
  /*
   * Genişlik/boy oranı önemli: 0.09 genişlik 0.34 boyla birlikte 1:4
   * veriyor ve yapraklar çim değil kalın yaprak gibi duruyor. Gerçek çimde
   * oran 1:15 civarı.
   */
  const geo = new THREE.PlaneGeometry(0.055, 1, 1, segments);
  // Tabanı orijine indir: instance ölçeği boyu, zemin konumu tabanı verir
  geo.translate(0, 0.5, 0);

  const pos = geo.attributes.position;

  /*
   * Uçları sivrilt.
   *
   * PlaneGeometry düz kesilmiş bir şerit veriyor; yukarıdan bakınca
   * yaprakların tepesi düz bir çizgi olarak okunuyor ve çim "kesilmiş
   * plastik şerit" gibi duruyor.
   *
   * Genişlik uca doğru daraltılıyor: `pow(1 - y, 0.5)` dipte tam genişlik
   * bırakıp daralmayı son çeyreğe yığıyor. Doğrusal daraltma (1 - y) yaprağı
   * üçgene çeviriyor ve fazla ince görünüyor.
   *
   * Ucun tam sıfıra inmemesi için küçük bir taban payı var; sıfırda
   * tepe vertex'leri üst üste binip normalleri bozuluyor.
   */
  for (let i = 0; i < pos.count; i++) {
    const taper = Math.pow(1 - pos.getY(i), 0.5) * 0.94 + 0.06;
    pos.setX(i, pos.getX(i) * taper);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const colors = new Float32Array(pos.count * 3);
  const root = new THREE.Color(0x5c7a33);
  const tip = new THREE.Color(0xd6e59a);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    tmp.copy(root).lerp(tip, pos.getY(i));
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function createBladeMaterial() {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 0.9,
    metalness: 0,
    /*
     * Yaprak ince ve dik; normali yanlara bakıyor, alçak güneşte yarısı
     * tamamen kararıyor. Yumuşak bir taban ışıması bunu düzeltiyor —
     * gerçekte de yapraklar arasında ışık saçılıyor.
     */
    emissive: new THREE.Color(0x22301a),
    emissiveIntensity: 0.35,
  });

  /*
   * Rüzgâr enjeksiyonu.
   *
   * `onBeforeCompile` materyal ömrü boyunca YALNIZCA BİR KEZ çağrılıyor;
   * three programı `customProgramCacheKey`'e göre önbelleğe alıyor.
   * Yeniden enjekte etmek yeni bir uniforms nesnesi üretir ama o nesne
   * programa bağlanmaz — `uTime` donar ve çim salınmayı bırakır.
   * (Aynı tuzak kelebek kanadında da var, bkz. CLAUDE.md.)
   */
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWind = uniforms.uWind;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aPhase;
        attribute float aAmp;
        uniform float uTime;
        uniform float uWind;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        /*
         * Geometri 0–1 aralığında; yükseklik oranı doğrudan position.y.
         * Karesi alınıyor çünkü yaprak dipten değil UÇTAN eğiliyor —
         * doğrusal bükülmede yaprak tabandan kopmuş gibi kayıyor.
         */
        float heightRatio = position.y;
        float bend = heightRatio * heightRatio * aAmp * uWind;
        transformed.x += bend * sin(uTime * 1.5 + aPhase);
        transformed.z += bend * 0.35 * cos(uTime * 1.1 + aPhase * 1.7);`,
      );
  };
  material.customProgramCacheKey = () => 'grass-blade-wind';

  return material;
}
