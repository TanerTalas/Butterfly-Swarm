import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/*
 * Hazır GLB'leri sahneye sokulabilir hale getiren ara katman.
 *
 * Sketchfab'den inen modeller sahneye doğrudan konulamıyor; üç sorunları var
 * ve üçü de bu dosyada çözülüyor:
 *
 *  1. ÖLÇEK. Aynı paketteki iki sakura arasında 100 kat fark var:
 *     sakura-a ~48 birim, sakura-b ~0.4 birim geliyor. Kaynak dosyaya
 *     bakarak elle katsayı yazmak kırılgan — modeli değiştirince bozuluyor.
 *     Çözüm: sınır kutusundan ölçüp hedef boya normalize etmek.
 *
 *  2. SAYDAMLIK. Yaprak ve çimen malzemeleri `alphaMode: BLEND` ile geliyor.
 *     Blend, doğru sonuç için arkadan öne sıralama ister; instancing'de
 *     bu imkânsız ve derinlik yazımı da kapalı olduğu için çimenler
 *     birbirinin içinden görünüyor. Hepsi `alphaTest`'e (MASK) çevriliyor —
 *     opak boru hattında kalıyorlar, sıralama derdi bitiyor.
 *     (Aynı gerekçe kelebeklerin solma efektinde de geçerli: projefikri.md §11.2)
 *
 *  3. MALZEME UYUMSUZLUĞU. Sketchfab modelleri sık sık three'nin artık
 *     desteklemediği (`KHR_materials_pbrSpecularGlossiness`) veya sahnenin
 *     ışığından kopuk (`KHR_materials_unlit`) eklentilerle geliyor.
 *     İkisi de dokuları korunarak `MeshStandardMaterial`'e çevriliyor.
 *     Bu kod artık kullanılmayan çim/çiçek paketleri için yazıldı ama
 *     savunma olarak duruyor — yeni bir model aynı tuzağa düşebilir.
 */

const loader = new GLTFLoader();

/** GLB yükler; bulunamazsa `null` döner (çağıran taraf yedeğe düşer). */
export async function loadGLB(url) {
  try {
    const gltf = await loader.loadAsync(url);
    await applySpecGloss(gltf);
    return gltf.scene;
  } catch (err) {
    console.warn(`[world] model yüklenemedi: ${url}`, err);
    return null;
  }
}

/**
 * `KHR_materials_pbrSpecularGlossiness` kurtarma.
 *
 * three bu eklentinin desteğini kaldırdı. Eklentiyi kullanan bir model
 * yüklendiğinde loader hata vermiyor — sessizce boş bir malzeme üretiyor,
 * çünkü taban rengi ve DOKU eklentinin içinde duruyor, standart alanlarda
 * değil. Belirtisi: model bembeyaz çıkıyor.
 *
 * Burada ham glTF JSON'undan eklentiyi okuyup dokuyu ve rengi malzemeye
 * geri bağlıyoruz. Eşleştirme malzeme adı üzerinden — three glTF malzeme
 * adını koruyor.
 */
async function applySpecGloss(gltf) {
  const materials = gltf.parser?.json?.materials;
  if (!materials) return;

  const specGloss = new Map();
  for (const m of materials) {
    const sg = m.extensions?.KHR_materials_pbrSpecularGlossiness;
    if (sg) specGloss.set(sanitizeName(m.name ?? ''), sg);
  }
  if (specGloss.size === 0) return;

  const jobs = [];
  const seen = new Set();

  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];

    for (const mat of mats) {
      if (seen.has(mat.uuid)) continue;
      seen.add(mat.uuid);

      const sg = specGloss.get(sanitizeName(mat.name ?? ''));
      if (!sg) continue;

      if (Array.isArray(sg.diffuseFactor)) {
        mat.color.fromArray(sg.diffuseFactor);
        // Alfa da diffuseFactor'ün 4. bileşeninde; yaprak kartları için önemli
        if (sg.diffuseFactor[3] != null) mat.opacity = sg.diffuseFactor[3];
      }

      if (sg.diffuseTexture) {
        jobs.push(
          gltf.parser.getDependency('texture', sg.diffuseTexture.index).then((tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            mat.map = tex;
            mat.needsUpdate = true;
          }),
        );
      }
    }
  });

  await Promise.all(jobs);
}

/**
 * Modeli hedef boya ölçekler ve tabanını y=0'a oturtur.
 *
 * Sonuç yeni bir Group: ölçek/kaydırma dışarıdan gelen dönüşümlerle
 * çakışmasın diye modelin kendisine değil sarmalayıcıya uygulanıyor.
 */
export function normalize(object, targetHeight) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const scale = targetHeight / Math.max(size.y, 1e-6);

  // Modeli önce kendi merkezine (yatayda) ve tabanına (dikeyde) taşı
  object.position.set(
    -center.x,
    -box.min.y,
    -center.z,
  );

  const wrapper = new THREE.Group();
  wrapper.add(object);
  wrapper.scale.setScalar(scale);
  return wrapper;
}

/**
 * Malzemeleri sahneye uygun hale getirir.
 *
 * @param {THREE.Object3D} root
 * @param {object} opts
 * @param {number} opts.alphaTest  0 = dokunma. Yaprak/çimen için 0.4–0.5.
 * @param {boolean} opts.doubleSide  Tek yüzlü yaprak kartları için gerekli.
 */
export function fixMaterials(root, { alphaTest = 0.45, doubleSide = true } = {}) {
  root.traverse((o) => {
    if (!o.isMesh) return;

    o.castShadow = true;
    o.receiveShadow = true;

    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const converted = mats.map((m) => convert(m, alphaTest, doubleSide));
    o.material = converted.length === 1 ? converted[0] : converted;
  });
  return root;
}

function convert(src, alphaTest, doubleSide) {
  /*
   * Unlit (MeshBasicMaterial) malzemeler ışık almıyor. Alçak güneşli bir
   * sahnede bu çok belli oluyor: çiçekler gölgede bile parlak kalıyor ve
   * sahnenin içinden değil üstünden yapıştırılmış gibi duruyorlar.
   */
  const needsConvert = src.isMeshBasicMaterial || !src.isMeshStandardMaterial;

  const mat = needsConvert
    ? new THREE.MeshStandardMaterial({
        map: src.map ?? null,
        color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
        roughness: 0.85,
        metalness: 0,
      })
    : src;

  if (!needsConvert) {
    // Spec-gloss'tan gelen malzemeler metalik görünüyor; çayırda metal yok
    mat.metalness = 0;
    mat.roughness = Math.max(mat.roughness, 0.7);
  }

  /*
   * BLEND → MASK. `transparent` kapatılıyor ki malzeme opak sıraya girsin;
   * kesme işini `alphaTest` yapıyor. `depthWrite` da böylece geri geliyor.
   */
  if (src.transparent || src.alphaTest > 0) {
    mat.transparent = false;
    mat.alphaTest = alphaTest;
    mat.depthWrite = true;
    if (doubleSide) mat.side = THREE.DoubleSide;
    // Gölge de aynı kesmeyi görmeli, yoksa yaprak kartı dikdörtgen gölge atıyor
    mat.shadowSide = THREE.DoubleSide;
  }

  mat.needsUpdate = true;
  return mat;
}

/**
 * İsimleri karşılaştırılabilir hale getirir.
 *
 * GLTFLoader düğüm adlarını `PropertyBinding.sanitizeNodeName` ile geçiriyor
 * ve `.` `[` `]` `:` `/` karakterlerini SİLİYOR. Yani dosyada
 * `Cylinder.002_lowPoly_flor130_0` olan mesh sahneye
 * `Cylinder002_lowPoly_flor130_0` olarak geliyor. Model dosyasına bakıp
 * yazdığın isim eşleşmiyor ve parça sessizce atlanıyor — belirtisi
 * "çiçeklerin çoğu sahnede yok".
 */
export function sanitizeName(name) {
  return name.replace(/[[\].:/]/g, '').replace(/\s+/g, '_');
}

/**
 * Bir modelin içindeki mesh'leri (geometri + malzeme) düz bir listeye çıkarır.
 *
 * Instancing için gerekli: `InstancedMesh` bir Group alamaz, tek bir
 * geometri + tek bir malzeme ister. Geometriler mesh'in dünya matrisiyle
 * pişiriliyor ki paketin içindeki yerel dönüşümler kaybolmasın.
 *
 * @param {(name: string, tris: number) => boolean} filter
 */
export function extractParts(root, filter = () => true, { align = true } = {}) {
  root.updateWorldMatrix(true, true);

  const parts = [];
  root.traverse((o) => {
    if (!o.isMesh) return;

    const tris = (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    if (!filter(o.name, tris)) return;

    const geo = o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld);

    const part = {
      name: o.name,
      geometry: geo,
      material: Array.isArray(o.material) ? o.material[0] : o.material,
      triangles: Math.floor(tris),
    };

    /*
     * `align` çok parçalı modellerde KAPATILMALI. Hizalama her parçayı
     * kendi sınır kutusuna göre ortalıyor; bir ağacın gövdesi ile çiçeği
     * ayrı ayrı ortalanınca birbirinden kopuyor ve ağaç dağılıyor.
     * Tek başına serpilen parçalarda (çim tutamı, çiçek) ise gerekli.
     */
    parts.push(align ? groundAlign(part) : part);
  });

  return parts;
}

/**
 * Parçayı zemine oturtur: yatayda ortalanır, tabanı y=0'a iner.
 *
 * Gerekli, çünkü paketlerin içindeki nesneler kendi sahnelerinde rastgele
 * yerlerde duruyor. Hizalanmazsa serpilen çimen havada asılı kalıyor ya da
 * toprağa gömülüyor. Ayrıca gerçek boyu ölçülüyor — ölçek katsayılarını
 * elle tahmin etmemek için (`heightScale`).
 */
export function groundAlign(part) {
  part.geometry.computeBoundingBox();
  const b = part.geometry.boundingBox;

  part.geometry.translate(
    -(b.min.x + b.max.x) / 2,
    -b.min.y,
    -(b.min.z + b.max.z) / 2,
  );

  part.height = b.max.y - b.min.y;
  part.footprint = Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
  return part;
}

/** Parçayı hedef boya getirecek ölçek katsayısı. */
export function heightScale(part, targetHeight) {
  return targetHeight / Math.max(part.height, 1e-6);
}
