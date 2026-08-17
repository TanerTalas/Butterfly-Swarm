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
     * Ton yayılımı kısıldı. 1.0 tüm renk çarkını veriyor: sahnede parlak
     * magenta, camgöbeği ve neon yeşil kelebekler dolaşıyor ve sakura
     * paletiyle kavga ediyorlar.
     *
     * Bu GEÇİCİ bir çözüm. Kalıcısı projefikri.md §4'teki 5 renklik palet
     * ve §11.1'deki iki renkli kanat — o iş yapılınca renk buradan değil
     * kelebek kaydından gelecek.
     */
    hueSpread: 0.42,
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

  return { swarm, params, flight, bounds: SWARM_BOUNDS };
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

/** Kelebeklerin dünya konumlarını okumak için — Aşama D'deki takip modu. */
export function butterflyPosition(swarm, index, out = new THREE.Vector3()) {
  return out.fromArray(swarm.position, index * 3);
}
