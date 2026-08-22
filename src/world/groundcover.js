import * as THREE from 'three';
import { WORLD } from './config.js';
import { scatter } from './scatter.js';
import {
  loadTexture,
  cropTile,
  mapToCell,
  GRASS_ATLAS_URL,
  PETAL_ATLAS_URL,
} from './atlas.js';

/*
 * Zemin çimi ve çiçekler — Inkwell atlaslarından (MIT, bkz. atlas.js).
 *
 * ── Neden bu yaklaşım ──────────────────────────────────────────────────────
 *
 * Önceki sürüm çimi hazır GLB modellerinden kuruyordu ve bir çim yaması
 * 5.922 üçgendi; zemini kaplamak tek başına ~1.4 milyon üçgen tutuyordu.
 * Şimdi iki iş ayrıştı:
 *
 *   ZEMİN ÇİMİ  → doku. Tepeden bakış çim karosu zemine döşeniyor.
 *                 Maliyet: SIFIR üçgen.
 *
 *   ÇİÇEKLER    → taçyaprak quad'larından kurulu instanced çiçekler.
 *                 Çiçek başına 5 taçyaprak × 2 üçgen = 10 üçgen.
 *                 Eski GLB çiçekleri 198–2.524 üçgendi.
 *
 * Toplam yer örtüsü maliyeti ~1.4M üçgenden ~7k üçgene indi.
 *
 * ── Bunun bedeli ───────────────────────────────────────────────────────────
 *
 * Zemin çimi artık GEOMETRİ DEĞİL, doku. Yani kameranın dibinde çim
 * yapraklarının silueti yok, yatay bir yüzeyde boyanmış çim var. Uzaktan ve
 * yatık açıdan ayırt edilmiyor; burnunu zemine sokarsan belli oluyor.
 * Kamera zeminden 2.2 birim yukarıda ve çoğunlukla dışa bakıyor, o yüzden
 * bu takas bilinçli.
 */

/*
 * Çiçek varyantları: atlasın (kolon, satır) hücreleri.
 *
 * Renkler bilinçli olarak PEMBE DIŞI. Sahne baştan aşağı sakura pembesi;
 * pembe çiçek zeminde kayboluyor ve daha önemlisi kelebeklerin paletiyle
 * yarışıyor (bkz. projefikri.md §4 — sakura tuzağı).
 *
 * Atlasın kolonları renk aileleri: 0 krem, 1 turuncu, 2 açık mavi,
 * 3 pembe, 4 sarı, 5 mavi, 6 turkuaz, 7 kırmızı.
 */
/*
 * `size` taçyaprak UZUNLUĞU (dünya birimi), çiçek çapı bunun ~1.6 katı.
 * İlk denemede 0.22–0.30 verilmişti ve çiçekler nilüfer boyunda çıktı;
 * kelebek 0.5 birim, çayır çiçeği ondan belirgin şekilde küçük olmalı.
 *
 * `tilt` dikeyden sapma (radyan). 1.0'ın üstü taçyaprağı yere yatırıyor ve
 * çiçek açılmış değil ezilmiş görünüyor; 0.5–0.8 kâse formu veriyor.
 */
const FLOWER_VARIANTS = [
  { col: 0, row: 0, petals: 6, tilt: 0.72, size: 0.13, stem: 1.72 }, // krem
  { col: 2, row: 2, petals: 6, tilt: 0.66, size: 0.12, stem: 2.05 }, // açık mavi
  { col: 4, row: 4, petals: 5, tilt: 0.58, size: 0.14, stem: 1.5 }, // sarı
  { col: 5, row: 1, petals: 7, tilt: 0.75, size: 0.11, stem: 2.18 }, // mavi
  { col: 6, row: 2, petals: 6, tilt: 0.7, size: 0.12, stem: 1.84 }, // turkuaz
  { col: 0, row: 4, petals: 5, tilt: 0.62, size: 0.15, stem: 1.38 }, // krem, iri
];

// Sap rengi. Çim yapraklarının dip tonuyla aynı aileden olmalı, yoksa
// çiçekler çimin üstüne yapıştırılmış gibi duruyor.
const STEM_COLOR = 0x5f7d38;

export async function createGroundCover({ ground, avoid = [] } = {}) {
  const group = new THREE.Group();
  group.name = 'groundcover';

  const stats = { triangles: 0, instances: 0, missing: [] };

  const [grassAtlas, petalAtlas] = await Promise.all([
    loadTexture(GRASS_ATLAS_URL),
    loadTexture(PETAL_ATLAS_URL),
  ]);

  if (grassAtlas && ground) applyGroundGrass(ground, grassAtlas);
  else if (!grassAtlas) stats.missing.push('hearth-grass-atlas.webp');

  if (petalAtlas) addFlowers(group, petalAtlas, avoid, stats);
  else stats.missing.push('inkwell-petals.webp');

  group.userData.stats = stats;
  return group;
}

/**
 * Çim karosunu zemine döşer.
 */
function applyGroundGrass(ground, atlas) {
  const cfg = WORLD.groundGrass;

  const tex = cropTile(atlas, cfg.tileCol, cfg.tileRow);
  /*
   * Tekrar sayısı dünya biriminden türetiliyor: bir karo `tileSize` birim
   * yer kaplasın. Doğrudan sabit bir sayı yazmak, `groundRadius` değişince
   * çim ölçeğini bozuyor.
   */
  const repeats = (WORLD.groundRadius * 2) / cfg.tileSize;
  tex.repeat.set(repeats, repeats);

  ground.material.map = tex;
  /*
   * Vertex renkleri artık dokuyu ÇARPIYOR. Eskiden zeminin tek rengi
   * onlardan geliyordu ve yeşildi; doku üstüne binince renk iki kez
   * koyulaşıyor. terrain.js bu yüzden neredeyse beyaz vertex rengi
   * üretiyor — geniş ölçekli hafif bir yama varyasyonu kalsın diye.
   */
  ground.material.needsUpdate = true;
}

/**
 * Çiçekleri kurar ve serper.
 */
function addFlowers(group, atlas, avoid, stats) {
  const cfg = WORLD.flowers;

  /*
   * Tek malzeme, tüm varyantlar. Hücre UV'si geometriye pişirildiği için
   * malzemenin varyanttan haberi olmuyor.
   *
   * alphaTest, transparent DEĞİL: instance'lar sıralanamıyor, saydam
   * malzeme yanlış çizim sırası üretiyor. Atlasın gerçek alfa kanalı
   * olduğu için kesme doğrudan çalışıyor.
   */
  const material = new THREE.MeshStandardMaterial({
    map: atlas,
    alphaTest: 0.45,
    transparent: false,
    side: THREE.DoubleSide,
    roughness: 0.7,
    metalness: 0,
    /*
     * Taçyapraklar ince ve dikey; alçak güneşte yarısı tamamen kararıyor.
     * Gerçek taçyaprak yarı geçirgen olduğu için ışık içinden geçiyor —
     * hafif bir kendinden ışıma bunu taklit ediyor.
     */
    emissive: new THREE.Color(0x2a2418),
    emissiveIntensity: 0.25,
  });

  /*
   * Sap ayrı malzeme istiyor: taçyaprak atlasında yeşil bir bölge yok.
   * Geometri gruplarıyla tek bir InstancedMesh iki malzeme taşıyabiliyor.
   */
  const stemMaterial = new THREE.MeshStandardMaterial({
    color: STEM_COLOR,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  const perVariant = Math.max(1, Math.round(cfg.count / FLOWER_VARIANTS.length));

  FLOWER_VARIANTS.forEach((v, i) => {
    const geometry = createFlowerGeometry(v);
    const part = {
      geometry,
      material: [material, stemMaterial],
      triangles: geometry.index.count / 3,
    };

    const mesh = scatter(part, {
      count: perVariant,
      radius: cfg.radius,
      scale: [v.size * 0.75, v.size * 1.3],
      seed: 0x3311 + i * 977,
      avoid,
      // Çiçekler savruk dursun; dizilmiş gibi görünmesinler
      tiltJitter: 0.22,
    });
    mesh.name = `flowers-${i}`;
    group.add(mesh);

    stats.triangles += mesh.userData.triangles;
    stats.instances += mesh.userData.placed;
  });
}

/**
 * Taçyapraklardan bir çiçek kurar.
 *
 * Atlas tam çiçek değil TAÇYAPRAK içeriyor, yani çiçeği biz kuruyoruz.
 * Her taçyaprak bir quad; tabanı merkezde, ucu yukarı-dışa bakıyor.
 *
 * Dönüşüm sırası önemli:
 *   1. translate(0, 0.5, 0)  taçyaprağın tabanını orijine indirir
 *   2. rotateX(tilt)         ucu +Z'ye doğru yatırır (0 = dik, π/2 = yatık)
 *   3. translate(0, 0, gap)  tabanı dışa iter, merkezde göbek boşluğu kalır
 *   4. rotateY(açı)          taçyaprakları çevrede dağıtır
 *
 * Sıra bozulursa taçyapraklar merkezden değil rastgele noktalardan
 * çıkıyor ve çiçek dağılıyor.
 */
function createFlowerGeometry({ col, row, petals, tilt, stem }) {
  const petalParts = [];
  const gap = 0.09;

  for (let i = 0; i < petals; i++) {
    const petal = new THREE.PlaneGeometry(0.62, 1, 1, 1);
    mapToCell(petal, col, row);

    petal.translate(0, 0.5, 0);
    // Her taçyaprağa küçük bir eğim sapması: tam simetri yapay duruyor
    petal.rotateX(tilt + (i % 2 === 0 ? 0.06 : -0.06));
    petal.translate(0, 0, gap);
    petal.rotateY((i / petals) * Math.PI * 2);
    /*
     * Çiçek başı sapın UCUNA taşınıyor. Bu olmadan taçyaprak tabanları
     * zeminde kalıyor ve çiçek "açmış" değil "zemine gömülmüş" görünüyor —
     * yukarıdan bakınca çimenin içinde yatan bir leke gibi duruyor.
     */
    petal.translate(0, stem, 0);

    petalParts.push(petal);
  }

  /*
   * Sap: çapraz iki quad (4 üçgen). Silindir 3 kenarda bile 6 üçgen ve
   * ince bir sapta iki quad'dan görsel farkı yok.
   */
  const stemParts = [];
  for (let i = 0; i < 2; i++) {
    const q = new THREE.PlaneGeometry(0.05, stem, 1, 1);
    // Sap UV'si taçyaprak atlasına bakmıyor; kendi malzemesi düz renk
    q.translate(0, stem / 2, 0);
    q.rotateY((i * Math.PI) / 2);
    stemParts.push(q);
  }

  const geo = mergeGroups([petalParts, stemParts]);
  [...petalParts, ...stemParts].forEach((p) => p.dispose());
  return geo;
}

/*
 * Parçaları GRUPLAR hâlinde birleştirir; her grup ayrı bir malzeme dizini
 * alıyor. Böylece tek geometri hem taçyaprak atlasını hem düz renkli sapı
 * taşıyabiliyor ve çiçek tek bir InstancedMesh olarak kalıyor.
 */
function mergeGroups(groups) {
  const position = [];
  const normal = [];
  const uv = [];
  const index = [];
  const geo = new THREE.BufferGeometry();

  let vertexOffset = 0;
  let indexOffset = 0;

  groups.forEach((geos, materialIndex) => {
    let groupCount = 0;
    for (const g of geos) {
      position.push(...g.attributes.position.array);
      normal.push(...g.attributes.normal.array);
      uv.push(...g.attributes.uv.array);
      for (const i of g.index.array) index.push(i + vertexOffset);
      groupCount += g.index.count;
      vertexOffset += g.attributes.position.count;
    }
    geo.addGroup(indexOffset, groupCount, materialIndex);
    indexOffset += groupCount;
  });

  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  return geo;
}
