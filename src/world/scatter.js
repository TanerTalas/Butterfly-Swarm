import * as THREE from 'three';
import { WORLD } from './config.js';
import { groundHeight, mulberry32 } from './terrain.js';

/*
 * Çimen ve çiçekleri çayıra dağıtan sistem.
 *
 * TEK KURAL: her şey `InstancedMesh`. Bu paketlerdeki mesh'ler tek tek
 * sahneye eklenirse hem draw call hem üçgen sayısı anında kontrolden çıkıyor
 * — GrassLawnAutumn parçalarından biri tek başına 32.000 üçgen.
 *
 * Yerleşim `seed`'den deterministik: her açılışta aynı çayır. Kelebeklerin
 * konumu da ileride aynı fikirle üretilecek (projefikri.md §5).
 */

/**
 * Bir parçayı (geometri + malzeme) çayıra serper.
 *
 * @param {{geometry: THREE.BufferGeometry, material: THREE.Material}} part
 * @param {object} opts
 * @param {number} opts.count       kaç kopya
 * @param {number} opts.radius      dağılım yarıçapı
 * @param {number} opts.innerRadius bu yarıçapın içine koyma (0 = merkeze de koy)
 * @param {[number, number]} opts.scale  rastgele ölçek aralığı
 * @param {number} opts.seed
 * @param {Array<{x: number, z: number, r: number}>} opts.avoid  kaçınılacak daireler
 * @param {number} opts.clumping    0 = tekdüze, 1 = merkeze yığılmış
 */
export function scatter(part, opts) {
  const {
    count,
    radius,
    innerRadius = 0,
    scale = [0.9, 1.2],
    seed = 1,
    avoid = [],
    clumping = 0,
    tiltJitter = 0.08,
    castShadow = false,
  } = opts;

  // `part.material` bir dizi olabilir (geometri gruplu parçalar için)
  const mesh = new THREE.InstancedMesh(part.geometry, part.material, count);
  /*
   * Çimen ve çiçekler varsayılan olarak GÖLGE DÜŞÜRMÜYOR. Gölge geçişi
   * geometriyi ikinci kez çiziyor; yüzlerce instance'ta bu ikiye katlanan
   * bir maliyet. Karşılığında görünen şey ise çimenin kendi üstündeki
   * birkaç piksellik karartma — değmiyor. Gölge ALMAYA devam ediyorlar,
   * ağacın gölgesi çimenin üstünden geçiyor.
   */
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  // Konumlar bir kez yazılıyor, her karede değil
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

  const rand = mulberry32(seed);
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scl = new THREE.Vector3();

  let placed = 0;
  let attempts = 0;
  const maxAttempts = count * 12;

  while (placed < count && attempts < maxAttempts) {
    attempts++;

    /*
     * sqrt(u) dağılımı diskte tekdüze sonuç veriyor; doğrudan u kullanılırsa
     * her şey merkeze yığılıyor. `clumping` bunu bilerek geri getiriyor —
     * çimenin ortada sık, kenarda seyrek olması isteniyor.
     */
    const u = rand();
    const t = clumping > 0 ? Math.pow(u, 0.5 + clumping * 0.9) : Math.sqrt(u);
    const r = innerRadius + t * (radius - innerRadius);
    const angle = rand() * Math.PI * 2;

    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;

    // Ağaç gövdelerinin ve kameranın başlangıç noktasının içine ekme
    let blocked = false;
    for (const a of avoid) {
      if ((x - a.x) ** 2 + (z - a.z) ** 2 < a.r * a.r) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    pos.set(x, groundHeight(x, z), z);

    /*
     * Hafif eğim: her tutam tam dik durursa dizilmiş gibi görünüyor.
     * Y ekseninde tam serbest dönüş, X/Z'de küçük sapma.
     */
    euler.set(
      (rand() - 0.5) * tiltJitter,
      rand() * Math.PI * 2,
      (rand() - 0.5) * tiltJitter,
    );
    quat.setFromEuler(euler);

    const s = scale[0] + rand() * (scale[1] - scale[0]);
    scl.set(s, s * (0.85 + rand() * 0.3), s);

    m.compose(pos, quat, scl);
    mesh.setMatrixAt(placed, m);
    placed++;
  }

  // İstenen sayı yerleştirilemediyse kalan slotları gizle (sıfır ölçek),
  // yoksa origin'de üst üste duran kopyalar kalıyor
  if (placed < count) {
    m.compose(new THREE.Vector3(0, -9999, 0), quat, new THREE.Vector3(0, 0, 0));
    for (let i = placed; i < count; i++) mesh.setMatrixAt(i, m);
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.userData.triangles = part.triangles * placed;
  mesh.userData.placed = placed;
  return mesh;
}

/**
 * Ağaç gövdelerinin etrafında çimen/çiçek istemediğimiz daireler.
 *
 * Yarıçap `createTrees()` sırasında `userData.trunkRadius`'a yazılıyor ve
 * dünya biriminde. `tree.scale`'den TÜRETİLMEMELİ — bkz. trees.js'teki not.
 */
export function treeExclusions(treeGroup) {
  /*
   * Ağaçlar artık InstancedMesh; sahne grafiğinde ağaç başına bir çocuk YOK,
   * dolayısıyla konumlar `children`'dan okunamıyor. `createTrees()` yerleşimi
   * hesaplarken kaçınma dairelerini `userData.exclusions`'a yazıyor.
   */
  return treeGroup.userData.exclusions ?? [];
}

/*
 * KALDIRILDI: kameranın başlangıç noktasında bir dışlama dairesi vardı.
 *
 * Yer örtüsü hazır GLB yamalarıyken mantıklıydı — kamera bir çim yamasının
 * ortasında doğuyordu. Şimdi çim tek tek yapraklardan oluşuyor ve kamera
 * onların 2 birim üstünde; dışlama yalnızca zeminde 2.5 yarıçaplı çıplak
 * bir daire bırakıyordu ve tam da bakılan yerdeydi.
 */
