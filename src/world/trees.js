import * as THREE from 'three';
import { WORLD } from './config.js';
import { groundHeight, mulberry32 } from './terrain.js';
import { loadGLB, normalize, fixMaterials, extractParts } from './assets.js';

/*
 * Sakura korusu — uçuş alanını çevreleyen ağaç halkası.
 *
 * ── Neden InstancedMesh ────────────────────────────────────────────────────
 *
 * Ağaçlar hareketsiz ve aynı iki geometrinin kopyaları. Her ağacı ayrı bir
 * `Group` olarak sahneye eklemek ağaç başına 2 draw call demek: 18 ağaçta
 * 36, 40 ağaçta 80 — üstüne gölge geçişi bir kez daha. Sayıyı artırmak
 * istediğimiz anda duvara çarpıyor.
 *
 * Instancing ile ağaç SAYISI draw call'u etkilemiyor: model başına 2
 * (gövde + çiçek), toplam 4. Ağaç sayısını 200'e çıkarsan da 4 kalıyor.
 *
 * ── Ölçek notu ─────────────────────────────────────────────────────────────
 *
 * İki model arasında ~120 kat ölçek farkı var (sakura-a ~48 birim, sakura-b
 * ~0.4 birim geliyor). `normalize()` ikisini de hedef boya oturtuyor ve
 * dönüşüm `extractParts` ile geometriye pişiriliyor — instance matrisine
 * yalnızca yerleşim kalıyor.
 */

const MODELS = ['/models/sakura-a.glb', '/models/sakura-b.glb'];

// Ağaç boyu. Kelebek ~0.5 birim; 7 birimlik ağaç insan ölçeğinde bir sakura.
const TREE_HEIGHT = 7.0;

/**
 * Modelleri yükler ve instancing'e hazır parçalara ayırır.
 *
 * Dönen yapı: her model için `{ parts: [{geometry, material}, ...] }`.
 * Hiçbiri yüklenemezse boş dizi döner ve çağıran taraf yer tutucuya düşer.
 */
export async function loadSakuraModels() {
  const loaded = await Promise.all(MODELS.map(loadGLB));

  return loaded.filter(Boolean).map((model) => {
    /*
     * Yaprak kartları `alphaMode: BLEND` ile geliyor; alphaTest'e
     * çevrilmezse ağacın arkasındaki dallar kayboluyor ve gölge
     * dikdörtgen çıkıyor. Eşik 0.5: daha düşükte yaprak kenarları
     * tüylenip hayalet piksel bırakıyor.
     */
    fixMaterials(model, { alphaTest: 0.5, doubleSide: true });
    const wrapped = normalize(model, TREE_HEIGHT);

    /*
     * `align: false` şart. Hizalama açık kalırsa gövde ve çiçek ayrı ayrı
     * ortalanıyor, ağaç iki parçaya bölünüyor.
     */
    return { parts: extractParts(wrapped, () => true, { align: false }) };
  });
}

/**
 * Ağaç halkasını kurar.
 *
 * @param {Array<{parts: Array}>} models  instancing'e hazır sakuralar
 * @returns {THREE.Group} `userData.exclusions` gövde kaçınma dairelerini taşır
 */
export function createTrees(models = []) {
  const group = new THREE.Group();
  group.name = 'trees';

  const { count, minRadius, maxRadius } = WORLD.trees;
  const rand = mulberry32(0x7c1a93);

  /*
   * Yerleşim önce hesaplanıyor, sonra modellere paylaştırılıyor. Böylece
   * hangi ağacın hangi modele düştüğü yerleşimi değiştirmiyor — model
   * sayısı değişse bile koru aynı yerde duruyor.
   */
  const placements = [];
  const exclusions = [];

  /*
   * KATMANLI ÖRNEKLEME (stratified sampling).
   *
   * Halka, açı × yarıçap ızgarasına bölünüyor ve her hücreye tam bir ağaç
   * düşüyor; rastgelelik yalnızca hücrenin İÇİNDE oynuyor.
   *
   * Önceki yöntem açıyı eşit bölüp üstüne gürültü ekliyordu ama yarıçapı
   * serbest bırakıyordu. Sonuç: bazı yönlerde bütün ağaçlar dış kenara
   * düşüyor ve o yönde halka delik gibi görünüyor. Ağaç sayısını artırmak
   * bunu çözmüyor, çünkü sorun sayı değil DAĞILIM.
   *
   * Izgara ile her açı diliminde her yarıçap bandından bir ağaç olması
   * garanti — boşluk kalamıyor.
   */
  const rings = WORLD.trees.rows;
  const sectors = Math.max(1, Math.round(count / rings));

  for (let s = 0; s < sectors; s++) {
    for (let ring = 0; ring < rings; ring++) {
      /*
       * Komşu bantları açıca kaydırıyoruz. Kaydırma olmazsa ağaçlar
       * radyal sıralar hâlinde diziliyor ve koru "dikilmiş bahçe"
       * görünümüne kayıyor.
       */
      const stagger = (ring / rings) * (Math.PI * 2) / sectors;
      const cell = (Math.PI * 2) / sectors;
      const angle = s * cell + stagger + (rand() - 0.4) * cell * 0.8;

      const band = (maxRadius - minRadius) / rings;
      const radius = minRadius + ring * band + rand() * band;

      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      /*
       * Kameranın başlangıç noktasının çevresinde küçük bir açıklık.
       * Kamera artık koruda başlıyor; boşluk bırakılmazsa açılışta gövdenin
       * içinde kalıp ekranı kabuk dokusuyla kapatabiliyor.
       */
      const cam = WORLD.camera.start;
      if (Math.hypot(x - cam.x, z - cam.z) < WORLD.trees.cameraClearance) {
        continue;
      }

      // Halkada "baskın ağaç" mantığı yok; hepsi birbirine yakın boyda
      // olmalı ki duvar gibi değil koru gibi dursun.
      const scale = 0.82 + rand() * 0.36;

      placements.push({
        x,
        y: groundHeight(x, z),
        z,
        rotation: rand() * Math.PI * 2,
        scale,
      });

      /*
       * Gövde yarıçapı DÜNYA biriminde. `scale`'den türetmek tuzak olurdu:
       * normalize katsayıları modele göre 0.14 ile 17.5 arasında değişiyor
       * ve ölçekten türeyen bir yarıçap 22 birim çıkıp çayırın yarısını
       * siliyor.
       */
      exclusions.push({ x, z, r: 0.75 * scale });
    }
  }

  /*
   * Kadrajı çerçeveleyen ağaçlar en SONA ekleniyor.
   *
   * Katmanlı örneklemenin dışında duruyorlar çünkü işleri farklı: halkayı
   * doldurmak değil, açılış görüntüsünde dalların kadraja girmesini garanti
   * etmek. Şansa bırakılırsa oraya ağaç düşüp düşmemesi tohuma kalıyor.
   */
  for (const f of WORLD.trees.framing ?? []) {
    placements.push({
      x: f.x,
      y: groundHeight(f.x, f.z),
      z: f.z,
      rotation: rand() * Math.PI * 2,
      scale: f.scale,
    });
    exclusions.push({ x: f.x, z: f.z, r: 0.75 * f.scale });
  }

  if (models.length === 0) {
    // Yedek yol: modeller yüklenemedi. Instancing yok, yer tutucu var.
    placements.forEach((p) => {
      const tree = createPlaceholderTree(rand);
      tree.position.set(p.x, p.y, p.z);
      tree.rotation.y = p.rotation;
      tree.scale.setScalar(p.scale);
      group.add(tree);
    });
    group.userData.exclusions = exclusions;
    return group;
  }

  /*
   * ── LOD: yakın ve uzak ağaçlar ────────────────────────────────────────
   *
   * İki modelin maliyeti çok farklı: sakura-a 2.899 üçgen, sakura-b 7.007.
   * Bu farkı MESAFEYE göre kullanıyoruz.
   *
   *   yakın (< lodRadius) — iki model dönüşümlü, gölge DÜŞÜRÜR
   *   uzak  (≥ lodRadius) — yalnızca ucuz model, gölge DÜŞÜRMEZ
   *
   * Gölge tarafı ölçüldüğünde şaşırtıcı çıktı: ağaçlar sahnenin en pahalı
   * kalemiydi (476k üçgen) ve bunun YARISI gölge geçişiydi. Uzaktaki
   * ağaçların gölgeleri avlunun dışına düşüyor, yani ekranda hiçbir
   * karşılığı olmayan bir maliyetti.
   *
   * Uzak ağaçlarda ucuz modelin kullanılması gözle fark edilmiyor: o
   * mesafede zaten sisin altındalar ve silüetten ibaretler.
   */
  const lodRadius = WORLD.trees.lodRadius;
  const near = [];
  const far = [];
  placements.forEach((p) => {
    (Math.hypot(p.x, p.z) < lodRadius ? near : far).push(p);
  });

  // Yakın ağaçlar iki model arasında dönüşümlü — tek modelin tekrarı
  // göze çarpıyor
  const buckets = models.map(() => []);
  near.forEach((p, i) => buckets[i % models.length].push(p));

  // Uzak ağaçların hepsi en ucuz modele gidiyor
  const cheapest = models.reduce((best, m, i) => {
    const cost = m.parts.reduce((n, part) => n + part.triangles, 0);
    return cost < best.cost ? { index: i, cost } : best;
  }, { index: 0, cost: Infinity });

  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();

  /** Bir yerleşim listesini tek bir modelin parçalarıyla instance'lar. */
  function build(model, list, { castShadow, label }) {
    if (list.length === 0) return;

    model.parts.forEach((part, p) => {
      const mesh = new THREE.InstancedMesh(
        part.geometry,
        part.material,
        list.length,
      );
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      mesh.name = `${label}-part-${p}`;

      list.forEach((t, i) => {
        pos.set(t.x, t.y, t.z);
        euler.set(0, t.rotation, 0);
        quat.setFromEuler(euler);
        scl.setScalar(t.scale);
        matrix.compose(pos, quat, scl);
        mesh.setMatrixAt(i, matrix);
      });

      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    });
  }

  models.forEach((model, m) => {
    build(model, buckets[m], { castShadow: true, label: `sakura-near-${m}` });
  });

  build(models[cheapest.index], far, {
    castShadow: false,
    label: 'sakura-far',
  });

  group.userData.exclusions = exclusions;
  group.userData.treeCount = placements.length;
  group.userData.nearCount = near.length;
  group.userData.farCount = far.length;
  return group;
}

/*
 * Yer tutucu ağaç — yalnızca modeller yüklenemezse devreye giriyor.
 * Amaç sahnenin ölçeğini ve gölgesini doğru vermek, güzel olmak değil.
 */
const barkMat = new THREE.MeshStandardMaterial({
  color: 0x8a7368,
  roughness: 0.9,
  flatShading: true,
});

const blossomMats = [0xf6d8e0, 0xefc4d2, 0xfae6ea].map(
  (color) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true }),
);

function createPlaceholderTree(rand) {
  const tree = new THREE.Group();
  tree.userData.placeholder = true;

  const trunkHeight = 3.4;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.42, trunkHeight, 7, 1),
    barkMat,
  );
  trunk.position.y = trunkHeight / 2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  tree.add(trunk);

  for (let i = 0; i < 9; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 0.5 + rand() * 2.3;
    const r = 0.85 + rand() * 0.75;

    const blob = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r, 1),
      blossomMats[i % blossomMats.length],
    );
    blob.position.set(
      Math.cos(angle) * dist,
      trunkHeight + 0.7 + rand() * 1.0 - dist * 0.18,
      Math.sin(angle) * dist,
    );
    blob.scale.y = 0.72;
    blob.castShadow = true;
    blob.receiveShadow = true;
    tree.add(blob);
  }

  return tree;
}
