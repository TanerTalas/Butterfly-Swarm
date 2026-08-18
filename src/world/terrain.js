import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WORLD } from './config.js';

/*
 * Zemin ve dağ duvarı.
 *
 * Zemin DÜZ. Tepe, sırt, iniş çıkış yok — kelebeklerin uçtuğu alan düz bir
 * avlu ve etrafı dik dağlarla çevrili. Tek kırılma, çıplak gözle fark
 * edilmeyecek kadar küçük bir yüzey kırışığı: tam düzlem, ışık altında
 * plastik bir levha gibi duruyor ve gölgeler yanlış okunuyor.
 */

// Deterministik: her açılışta aynı zemin.
const noise = new SimplexNoise({ random: mulberry32(0x5a4b17) });

/*
 * Yüzey kırışığının genliği. Bunu büyütme — 0.25'in üstünde zemin
 * "inişli çıkışlı" olmaya başlıyor ve uçuş alanının düz olması gerekiyor.
 */
const RIPPLE = 0.09;

/**
 * Bir noktadaki zemin yüksekliği.
 *
 * Dışa açık, çünkü çim, ağaç ve kamera kilidi hepsi zemine oturmak zorunda.
 * Tek kaynak: geometri de bu fonksiyondan üretiliyor.
 */
export function groundHeight(x, z) {
  return noise.noise(x * 0.09, z * 0.09) * RIPPLE;
}

export function createGround() {
  const size = WORLD.groundRadius * 2;
  /*
   * Zemin düz olduğu için bölüm sayısı düşük: 64×64 = ~8k üçgen.
   * Eski engebeli zemin 97.000 üçgen harcıyordu; o bütçe artık çime gidiyor.
   */
  const geo = new THREE.PlaneGeometry(size, size, 64, 64);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  /*
   * Vertex renkleri neredeyse BEYAZ. Zemin artık Inkwell'in çim dokusunu
   * taşıyor ve vertex rengi onunla çarpılıyor; yeşil bir vertex rengi
   * bırakılırsa renk iki kez koyulaşıp zemin bataklık yeşiline dönüyor.
   *
   * Tamamen beyaz da yapmıyoruz: hafif bir fark, dokunun tekrarını kıran
   * geniş ölçekli bir yama varyasyonu bırakıyor.
   */
  const grass = new THREE.Color(0xffffff);
  const dry = new THREE.Color(0xdfe0c6);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, groundHeight(x, z));

    /*
     * Renk varyasyonu: çimin arasından görünen toprak/kuru ot. Çim bunun
     * üstünü kaplıyor ama seyrek yerlerde araya bu giriyor — tek renk
     * bırakılırsa boşluklar düz yeşil lekeler olarak okunuyor.
     */
    const patch = noise.noise(x * 0.05 + 100, z * 0.05 - 40) * 0.5 + 0.5;
    tmp.copy(grass).lerp(dry, patch * 0.55);

    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}

/*
 * Dağ duvarı.
 *
 * Manzara değil, SINIR. Yüksek, dik ve yakın; ötesini kapattığı için
 * ötesini modellemeye gerek kalmıyor. Alçak tepe yok — hepsi tek boy
 * sınıfında, yalnızca yükseklikleri değişiyor.
 *
 * Tabanlar halka üzerinde üst üste biniyor. Aralarında boşluk kalırsa
 * arkadaki boş zemin ve ufuk çizgisi görünüyor; duvar hissi anında
 * dağılıyor.
 */
export function createMountains() {
  const cfg = WORLD.mountains;

  /*
   * Ayrı ayrı koniler yerine KESİNTİSİZ SIRT halkaları.
   *
   * Koni yaklaşımı iki sorunu birden üretiyordu:
   *
   *   1. Her koni sivri bir üçgen. Yan yana dizilince manzara değil
   *      testere dişi çıkıyor — hiçbir gerçek dağ öyle görünmüyor.
   *   2. Halkada kaçınılmaz boşluklar kalıyor. Konileri büyütüp üst üste
   *      bindirmek gökyüzünü yiyor, küçültmek aralarından dış dünyayı
   *      gösteriyor. Arada güvenli bir ayar yok.
   *
   * Bunun yerine her halka, tepe çizgisi gürültüyle belirlenen tek parça
   * kapalı bir yüzey. Boşluk GEOMETRİK OLARAK imkânsız: yüzey 360° boyunca
   * kesintisiz. Silüet de sivri değil, çünkü yükseklik komşu noktalar
   * arasında yumuşak değişiyor — tepeler yuvarlak, aralar geniş omuz.
   */
  const rings = cfg.rings.map((ring, i) => createRidgeRing(ring, 0x51d3 + i * 7919));

  const merged = mergeGeometries(rings, false);
  rings.forEach((g) => g.dispose());

  /*
   * Düz renk (MeshBasicMaterial): dağlar sahnenin arka duvarı, üzerlerinde
   * ışık hesabı yapmanın görsel karşılığı yok. Derinlik, halka başına
   * değişen vertex renginden geliyor — uzaktaki halka daha açık, yani
   * daha puslu okunuyor.
   */
  // DoubleSide: halkaya İÇERİDEN bakıyoruz. Sarım yönüne güvenmek yerine
  // iki yüzü de çizmek bir satırda kesin çözüm; maliyeti ~3.000 üçgende yok.
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    fog: true,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(merged, mat);
  mesh.name = 'mountains';
  return mesh;
}

/**
 * Tek bir sırt halkası: tepe çizgisi gürültüyle belirlenen kapalı yüzey.
 */
function createRidgeRing(ring, seed) {
  const { radius, width, minHeight, maxHeight, roughness, color, topColor } = ring;

  const segments = 240; // 1.5° çözünürlük — silüet yumuşak görünsün
  const rows = 4; // taban → tepe arası ara satırlar, yamaç kavisi için

  const rand = mulberry32(seed);
  const phase = rand() * 100;

  const positions = new Float32Array(segments * rows * 3);
  const colors = new Float32Array(segments * rows * 3);
  const indices = [];

  const base = new THREE.Color(color);
  const top = new THREE.Color(topColor);
  const tmp = new THREE.Color();

  /*
   * Yükseklik profili. Gürültü bir DAİRE üzerinde örnekleniyor (açıdan
   * değil), böylece 360°'de kendiliğinden kapanıyor — dikiş yerinde
   * kırılma olmuyor.
   *
   * Üç oktav: geniş kütle + orta sırtlar + ince kırık. Üstel yok, çünkü
   * üs almak tepeleri sivrilteyip aynı testere dişine geri götürüyor.
   */
  function heightAt(angle) {
    const cx = Math.cos(angle);
    const cz = Math.sin(angle);
    let n = 0;
    n += noise.noise(cx * 1.7 + phase, cz * 1.7 + phase) * 0.62;
    n += noise.noise(cx * 4.1 - phase, cz * 4.1 - phase) * 0.26;
    n += noise.noise(cx * 9.3 + 31, cz * 9.3 + 31) * 0.12;
    n = THREE.MathUtils.clamp(n * 0.5 + 0.5, 0, 1);
    return minHeight + n * (maxHeight - minHeight);
  }

  for (let s = 0; s < segments; s++) {
    const angle = (s / segments) * Math.PI * 2;
    const h = heightAt(angle);

    for (let r = 0; r < rows; r++) {
      const t = r / (rows - 1); // 0 = etek, 1 = tepe

      /*
       * Yamaç profili. Doğrusal bir rampa koni gibi duruyor; hafif içbükey
       * bir eğri (t^1.35) etekleri genişletip tepeyi daraltıyor — dağların
       * gerçek siluetine bu daha yakın.
       */
      const y = h * Math.pow(t, 1.35);

      // Etek içeride, tepe dışarıda: içeriden bakınca yamaç yukarı ve
      // geriye doğru gidiyor
      let rad = radius - width * (1 - t);

      // Yüzey kırığı: tam pürüzsüz bir yamaç plastik duruyor
      rad += (noise.noise(Math.cos(angle) * 7.4 + t * 3, Math.sin(angle) * 7.4) )
        * roughness * (0.35 + t * 0.65);

      const i = (s * rows + r) * 3;
      positions[i] = Math.cos(angle) * rad;
      positions[i + 1] = y - 0.6; // eteği toprağa gömerek keskin kenarı sakla
      positions[i + 2] = Math.sin(angle) * rad;

      tmp.copy(base).lerp(top, t);
      colors[i] = tmp.r;
      colors[i + 1] = tmp.g;
      colors[i + 2] = tmp.b;
    }
  }

  // Dizinler: son segment ilkine bağlanıyor (% segments) — halka kapanıyor
  for (let s = 0; s < segments; s++) {
    const next = (s + 1) % segments;
    for (let r = 0; r < rows - 1; r++) {
      const a = s * rows + r;
      const b = s * rows + r + 1;
      const c = next * rows + r;
      const d = next * rows + r + 1;
      indices.push(a, b, d, a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  return geo;
}

/** Küçük, tohumlanabilir PRNG — aynı sahne her açılışta aynı olsun diye. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export { mulberry32 };
