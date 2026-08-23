import * as THREE from 'three';
import { Swarm, SWARM_DEFAULTS } from '../swarm/Swarm.js';
import { WING_COLORS, WING_DEFAULTS } from '../butterfly/geometry.js';
import { DETAIL_DEFAULTS } from '../butterfly/wingDetail.js';
import { FLAP_DEFAULTS } from '../butterfly/flap.js';
import { FLIGHT_DEFAULTS } from '../flight/steering.js';
import { WORLD } from './config.js';
import { groundHeight, mulberry32 } from './terrain.js';

/*
 * Sürüyü sakura avlusuna bağlayan katman — projefikri.md Aşama B.
 *
 * `Swarm` sınıfına DOKUNULMUYOR. Dünya yalnızca üç şeyi değiştiriyor:
 *
 *   1. Uçuş hacmi kameranın frustum'u değil, avlunun silindiri
 *      (`ctx.bounds` — bkz. steering.js `worldBoundsForce`).
 *   2. Başlangıç konumları rastgele değil, tohumdan deterministik.
 *   3. Uçuş parametreleri avlunun ölçeğine göre yeniden ayarlı.
 *
 * Üçü de dışarıdan veriliyor; `Swarm` avludan haberdar değil.
 */

/*
 * Uçuş hacmi.
 *
 * Taban çimin (0.44 birim) belirgin şekilde üstünde: kelebekler çimin içine
 * girince hem kayboluyorlar hem de yaprakların arasından titreşerek
 * görünüyorlar. Tavan ağaç taçlarının altında (ağaç 7 birim) — kelebekler
 * dalların arasına girmiyor.
 */
export const SWARM_BOUNDS = {
  radius: WORLD.meadowRadius,
  minY: 0.9,
  maxY: 4.6,
};

/*
 * Avluya göre yeniden ayarlanan uçuş parametreleri.
 *
 * Varsayılanlar kameraya göre ölçeklenen bir hacim için yazılmıştı; sabit
 * 12 birimlik bir avluda aynı değerler sürüyü fazla hareketli gösteriyor.
 * Kelebekler artık bir yere AİT, o yüzden daha sakin.
 */
const WORLD_FLIGHT = {
  maxSpeed: 1.35,
  minSpeed: 0.5,
  wander: 3.2,
  scatter: 0.42,
  // Sınır kuvveti dünya ölçeğinde: pay yarıçapın oranı olarak hesaplanıyor
  boundsMargin: 0.3,
  boundsForce: 10.0,
};

/**
 * Avlunun sürüsünü kurar.
 *
 * @returns {{swarm: Swarm, params: object, flight: object, bounds: object}}
 */
export function createWorldSwarm({ reducedMotion = false } = {}) {
  const flight = { ...FLIGHT_DEFAULTS, ...WORLD_FLIGHT };

  const params = {
    ...WING_DEFAULTS,
    ...DETAIL_DEFAULTS,
    ...FLAP_DEFAULTS,
    ...SWARM_DEFAULTS,
    // Yerleşik kelebekler — kimseye ait değil, hiç solmuyor
    // (projefikri.md §4)
    count: WORLD.residentCount,

    /*
     * ÖLÇEK. Varsayılan 0.25, geometrinin ~3.4 birimlik kanat açıklığıyla
     * birlikte ~0.85 birimlik kelebek veriyor. Tek başına demoda doğruydu
     * (hacim kameradan türüyordu) ama bu avluda çim 0.44, çiçek 0.3 birim —
     * 0.85'lik kelebek uçurtma gibi duruyor ve ölçek hissini bozuyor.
     *
     * 0.11 denendi ve fazla kaçtı: kamera koruda, avlunun kelebekleri
     * 15–25 birim uzakta ve o boyda birkaç piksellik lekeye dönüyorlardı.
     * 0.17 (~0.58 birim kanat açıklığı) çimin biraz üstünde kalıyor —
     * çayırda uçtukları belli oluyor ama ölçeği ezmiyorlar.
     */
    scale: 0.17,

    /*
     * `hueSpread` artık kullanılmıyor: renk rastgele bir ton yayılımından
     * değil, 5 renklik paletten geliyor (`applyPalette` aşağıda).
     * Sıfır, `applyHue()` bir yerden çağrılırsa paleti bozmasın diye.
     */
    hueSpread: 0,
  };

  if (reducedMotion) {
    flight.maxSpeed *= 0.5;
    flight.minSpeed *= 0.5;
    flight.wander *= 0.5;
    flight.gust = 0;
    params.flapSpeed = FLAP_DEFAULTS.flapSpeed * 0.45;
  }

  /*
   * Kapasite `count`'un üstünde: ziyaretçi kelebekleri (misafir + kullanıcı)
   * Aşama C'de bu havuzdan gelecek. `setCount()` yalnızca instance sayısını
   * değiştiriyor, yeniden ayırma yapmıyor.
   */
  const swarm = new Swarm({ capacity: 200, params, flight });

  seedPositions(swarm);
  applyPalette(swarm);

  return { swarm, params, flight, bounds: SWARM_BOUNDS };
}

/*
 * Desenin taban rengi — `WING_COLORS.mid` (turuncu 0xe8781c).
 *
 * Shader'a giden değerler MUTLAK renk değil, desenin üstüne uygulanan
 * dönüşümler: ton için kaydırma, doygunluk ve parlaklık için çarpan. Bu
 * yüzden hedef rengi tabanla kıyaslamak gerekiyor.
 *
 * Elle yazılmıyor, desenden TÜRETİLİYOR: taban renk bir tasarım kararı ve
 * `wingDetail.js` içinden değiştirilebiliyor. Sabit yazılsaydı desen
 * değiştiği an sessizce yanlış renk üretmeye başlardı.
 */
const PATTERN_BASE = rgbToHsv(WING_COLORS.mid);

/**
 * Hex renkten kanat tintine çevirir: `{ hue, sat, val }`.
 *
 * Hâlâ kayıplı bir dönüşüm ve olması gereken de bu: kullanıcı düz bir boya
 * değil RENK AİLESİ seçiyor. Desenin kendi gradyanı (koyu kök → açık uç),
 * koyu kenar bandı ve damarları korunuyor.
 *
 * ⚠ Eskiden yalnızca TON taşınıyordu ve doygunluk/parlaklık atılıyordu.
 * Bunun iki sonucu vardı:
 *
 *   - Beyaz (#FFFFFF) ve siyah (#000000) KIRMIZI çıkıyordu. Doygunluğu
 *     sıfır bir rengin tonu tanımsızdır ve 0 döner; 0 da kırmızıdır.
 *     Kullanıcının seçtiği şeyle hiç ilgisi olmayan bir renk.
 *   - Pastel ve koyu tonların hepsi aynı doygun renge düşüyordu, yani
 *     seçici "çalışmıyor" gibi görünüyordu.
 *
 * Doygunluk ve parlaklık artık ÇARPAN olarak taşınıyor: hedefin değeri
 * tabana bölünüyor. Beyazda doygunluk çarpanı 0'a, siyahta parlaklık
 * çarpanı 0'a gidiyor ve desen buna göre soluyor ya da kararıyor.
 */
export function wingTintFromColor(hex) {
  /*
   * HSV doğrudan sRGB baytlarından hesaplanıyor, three'nin renk nesnesinden
   * geçirilmeden.
   *
   * Bu şart: `THREE.Color` değeri ÇALIŞMA uzayında (linear-sRGB) tutuyor ve
   * oradan alınan doygunluk/ton, shader'ın gördüğü değerlerle uyuşmuyor —
   * shader dönüşümü doku örneklendikten SONRA, sRGB'ye yakın değerlerle
   * yapıyor. Karıştırıldığında palet turkuaz diyor, kelebek yeşil çıkıyor.
   */
  const hsv = rgbToHsv(hex);

  return {
    hue: hsv.h - PATTERN_BASE.h,
    sat: hsv.s / PATTERN_BASE.s,
    val: hsv.v / PATTERN_BASE.v,
  };
}

/**
 * 0xRRGGBB → `{ h, s, v }`, üçü de 0–1.
 *
 * Shader'daki `bfRgb2Hsv` ile aynı uzayda çalışıyor. three'nin `getHSL`'i
 * kullanılmıyor çünkü o HSL veriyor; shader HSV ile çalışıyor ve ikisinin
 * doygunluk tanımı farklı (HSL'de açık renklerin doygunluğu yüksek kalır).
 */
function rgbToHsv(hex) {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  return { h, s: max === 0 ? 0 : d / max, v: max };
}

/**
 * Yerleşik kelebeklere paletten renk dağıtır.
 *
 * Hepsi TEK RENK: ön ve arka kanat aynı tonu alıyor. İki renkli kanat
 * yalnızca kayıtlı kullanıcıların kelebeklerine özel (projefikri.md §2),
 * yerleşik ve misafir kelebekler tek renk geziyor.
 *
 * Dağıtım tohumdan deterministik — her açılışta aynı kelebek aynı renkte.
 */
export function applyPalette(swarm, seed = 0x9a17c) {
  const rand = mulberry32(seed);
  const tints = WORLD.palette.map((c) => wingTintFromColor(c.hex));

  for (let i = 0; i < swarm.capacity; i++) {
    const tint = tints[Math.floor(rand() * tints.length) % tints.length];
    swarm.setWingTint(i, tint);
  }
}

/**
 * Başlangıç konumlarını tohumdan üretir.
 *
 * `Swarm._seed()` her ajanı ±4 birimlik bir kutuya `Math.random()` ile
 * atıyor; avluda bu iki sorun çıkarıyor: kelebekler ortada bir küme olarak
 * doğuyor ve her açılışta farklı yerde beliriyorlar.
 *
 * Deterministik yerleşim aynı zamanda kelebeğin konumunun veritabanında
 * saklanmamasının sebebi: konum `seed`'den türetiliyor, o yüzden aynı
 * kelebek yenilemeden sonra da aynı yerden giriyor.
 */
function seedPositions(swarm, seed = 0xb17e5) {
  const rand = mulberry32(seed);
  const b = SWARM_BOUNDS;

  for (let i = 0; i < swarm.capacity; i++) {
    // sqrt: diskte tekdüze dağılım, yoksa herkes merkeze yığılıyor
    const r = Math.sqrt(rand()) * b.radius * 0.85;
    const angle = rand() * Math.PI * 2;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;

    swarm.position[i * 3] = x;
    swarm.position[i * 3 + 1] =
      groundHeight(x, z) + b.minY + rand() * (b.maxY - b.minY);
    swarm.position[i * 3 + 2] = z;

    // Yatay bir başlangıç hızı: dikey doğan kelebek ilk saniyede yalpalıyor
    const dir = rand() * Math.PI * 2;
    swarm.velocity[i * 3] = Math.cos(dir) * 0.5;
    swarm.velocity[i * 3 + 1] = (rand() - 0.5) * 0.15;
    swarm.velocity[i * 3 + 2] = Math.sin(dir) * 0.5;
  }
}

/**
 * Sisi sürü malzemelerine bağlar.
 *
 * Kelebek malzemeleri `MeshPhysicalMaterial`; sis desteği var ama malzeme
 * sahneye eklenmeden önce derlenmişse `fog` uniform'u bağlanmıyor ve
 * kelebekler sisin içinde net kalıp sahneden kopuyor.
 */
export function enableSwarmFog(swarm) {
  for (const mat of [swarm.wingMaterial, swarm.bodyMaterial]) {
    mat.fog = true;
    mat.needsUpdate = true;
  }
}

/**
 * Kayıtlı kullanıcı kelebeği: ön ve arka kanat AYRI renkte.
 *
 * Aşama C'de veritabanındaki `fore_color` / `hind_color` alanları doğrudan
 * buraya bağlanacak. Misafir ve yerleşik kelebekler için ÇAĞRILMAMALI —
 * onlar tek renk (`applyPalette`).
 */
export function setUserButterflyColors(swarm, index, foreHex, hindHex) {
  swarm.setWingTint(
    index,
    wingTintFromColor(foreHex),
    wingTintFromColor(hindHex),
  );
}

/** Kelebeklerin dünya konumlarını okumak için — Aşama D'deki takip modu. */
export function butterflyPosition(swarm, index, out = new THREE.Vector3()) {
  return out.fromArray(swarm.position, index * 3);
}
