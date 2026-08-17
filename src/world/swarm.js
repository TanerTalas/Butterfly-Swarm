import * as THREE from 'three';
import { Swarm, SWARM_DEFAULTS } from '../swarm/Swarm.js';
import { WING_DEFAULTS } from '../butterfly/geometry.js';
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
 * Böylece `index.html`'deki tek başına sürü demosu aynen çalışmaya devam
 * ediyor; iki sahne aynı motoru farklı kiplerde kullanıyor.
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
  // Avlu geniş; takip halkası da geniş olmalı, yoksa sürü imlecin üstünde
  // tek bir topak oluyor
  followRadius: 2.8,
  fleeRadius: 4.0,
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
 * Desenin kendi taban rengi (`WING_COLORS.mid`, turuncu 0xe8781c) — ton
 * çarkında ~0.075'te duruyor.
 *
 * Shader'a giden değer mutlak renk değil KAYDIRMA olduğu için hedef rengin
 * tonundan bunun çıkarılması gerekiyor. Sabit olarak yazılı çünkü desenin
 * taban rengi bir tasarım kararı; değişirse burası da değişmeli.
 */
const PATTERN_BASE_HUE = 0.0752;

const _color = new THREE.Color();

/**
 * Hex renkten ton kaydırmasına çevirir.
 *
 * Kayıp bir dönüşüm ve olması gereken de bu: kullanıcı düz bir boya değil
 * RENK AİLESİ seçiyor. Desenin kendi gradyanı (koyu kök → açık uç), koyu
 * kenar bandı ve damarları korunuyor; yalnızca renk çarkında dönüyorlar.
 *
 * Doygunluk ve parlaklık yok sayılıyor — bu yüzden palet doygun renklerden
 * kuruldu (bkz. config.js).
 */
export function hueShiftFromColor(hex) {
  const hsl = { h: 0, s: 0, l: 0 };
  /*
   * HSL'i sRGB uzayında istiyoruz.
   *
   * `getHSL()` varsayılan olarak three'nin ÇALIŞMA uzayında (linear-sRGB)
   * hesaplıyor. Shader'daki ton döndürmesi ise doku örneklendikten sonra,
   * yani sRGB algısına yakın değerlerle çalışıyor. İkisi karışınca seçilen
   * renkle ekrandaki renk tutmuyor — palet turkuaz diyor, kelebek yeşil
   * çıkıyor.
   */
  _color.setHex(hex, THREE.SRGBColorSpace).getHSL(hsl, THREE.SRGBColorSpace);
  return hsl.h - PATTERN_BASE_HUE;
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
  const shifts = WORLD.palette.map((c) => hueShiftFromColor(c.hex));

  for (let i = 0; i < swarm.capacity; i++) {
    const shift = shifts[Math.floor(rand() * shifts.length) % shifts.length];
    swarm.setWingHues(i, shift);
  }
}

/**
 * Başlangıç konumlarını tohumdan üretir.
 *
 * `Swarm._seed()` her ajanı ±4 birimlik bir kutuya `Math.random()` ile
 * atıyor. Bu, tek başına demo için doğru ama burada iki sorun çıkarıyor:
 * kelebekler avlunun ortasında bir küme olarak doğuyor ve her açılışta
 * farklı yerde beliriyorlar.
 *
 * Deterministik yerleşim projefikri.md §5'in de temeli: kelebeğin konumu
 * veritabanında saklanmıyor, `seed`'den türetiliyor. Aşama C'de gerçek
 * kelebek kayıtları geldiğinde aynı fonksiyon onların `seed`'iyle
 * çağrılacak.
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
  swarm.setWingHues(
    index,
    hueShiftFromColor(foreHex),
    hueShiftFromColor(hindHex),
  );
}

/** Kelebeklerin dünya konumlarını okumak için — Aşama D'deki takip modu. */
export function butterflyPosition(swarm, index, out = new THREE.Vector3()) {
  return out.fromArray(swarm.position, index * 3);
}
