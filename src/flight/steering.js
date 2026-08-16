import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

/*
 * Uçuş kuvvetleri — durumsuz fonksiyonlar.
 *
 * Her fonksiyon sonucu `out` vektörüne yazar ve onu döndürür; hiçbiri
 * yeni Vector3 ayırmaz. Aşama 5'te bunlar kare başına yüzlerce kez
 * çağrılacak, çöp üretmemeleri gerekiyor.
 *
 * Takip / kaçış kuvvetleri Aşama 4'te buraya eklenecek.
 */

export const FLIGHT_DEFAULTS = {
  flying: true,

  maxSpeed: 1.8,
  // Asgari seyir hızı. Wander kuvveti hızı ara sıra sıfıra yaklaştırıyor;
  // o anda hız yönü tanımsızlaşıp yönelim savruluyor ve kelebek yan yan
  // uçuyormuş gibi görünüyor. Alt sınır hem bunu engelliyor hem de gerçek
  // kelebeğe uygun: süzülürken bile ileri gidiyor.
  minSpeed: 0.7,
  maxForce: 5.0,

  wander: 4.0, // dolanma kuvvetinin şiddeti
  scatter: 0.5, // 0 = sakin ve geniş yaylar, 1 = dağınık ve sinirli
  verticalBias: 0.55, // dikey dolanma yataydan az olsun; kelebek yalpalıyor, zıplamıyor

  // Azami tırmanma/dalış açısı. Kelebek dik yukarı uçmaz; ayrıca hız yönü
  // dünya-yukarı ile çakışınca `cross(worldUp, forward)` tabanı dejenere
  // oluyor ve yatış açısı kontrolden çıkıyordu. Bu sınır ikisini birden
  // çözüyor: 45° altında taban her zaman iyi tanımlı.
  maxClimbDeg: 42,

  turnRate: 8.0, // yönelme yumuşatması (1/s)
  bank: 0.5, // yanal ivme → yatış açısı çarpanı
  maxBankDeg: 55,
  bob: 0.045, // çırpmayla senkron dikey salınım

  // Uçuş hacmi sabit bir dünya kutusu değil, kameranın GÖRÜNÜR alanı.
  // Ekranın ne kadarını doldursunlar; 1.0 tam kenara kadar demek.
  screenFill: 0.94,
  // Yakın/uzak sınır, odak mesafesinin oranı olarak. Zoom'da kendiliğinden
  // ölçekleniyor.
  depthSpread: 0.35,
  boundsMargin: 0.22, // geri itmenin başladığı iç pay (yarı-genişliğin oranı)
  boundsForce: 14.0,
};

// Tek bir noise örneği yeterli; ajanlar farklı offset'lerden okuyor.
const noise = new SimplexNoise();

/**
 * Dolanma (wander) kuvveti.
 *
 * Rastgele sayı DEĞİL — `Math.random()` her karede bağımsız bir değer verir
 * ve kelebek titrer. Simplex noise zamanla yumuşak değişen bir yön üretiyor,
 * yani yön değişimi kendi içinde sürekli.
 *
 * Her ajan noise alanından farklı bir offset'ten okuyor; böylece tek bir
 * noise örneğiyle sürüdeki herkes bağımsız hareket ediyor.
 */
export function wanderForce(out, id, time, params) {
  // Dağınıklık arttıkça yön daha sık değişiyor
  const frequency = 0.22 + params.scatter * 0.85;
  const t = time * frequency;
  const o = id * 137.13; // ajanlar arası ayrım

  out.set(
    noise.noise3d(t + o, 0, 0),
    noise.noise3d(0, t + o + 41.7, 0) * params.verticalBias,
    noise.noise3d(0, 0, t + o + 83.4),
  );

  return out.multiplyScalar(params.wander * (0.4 + params.scatter));
}

// Kamera tabanı için geçiciler
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _rel = new THREE.Vector3();

/**
 * Görünür alandan yumuşak geri itme.
 *
 * Sınır sabit bir dünya kutusu DEĞİL, kameranın frustum'u: kelebek her zaman
 * ekranda kalıyor ve zoom, döndürme, pencere yeniden boyutlandırma otomatik
 * olarak hesaba katılıyor (kamera tabanı ve `aspect` her karede okunuyor).
 *
 * Geri itme sert clamp değil: kenara yaklaştıkça kareli artan bir kuvvet.
 * Payın başında neredeyse hissedilmiyor, sınırda baskın — kelebek duvara
 * çarpıp durmak yerine içeri doğru kavis çiziyor.
 *
 * @param {number} focusDistance Kameradan yörünge merkezine uzaklık; derinlik
 *   dilimi buna göre ölçekleniyor.
 */
export function viewBoundsForce(out, position, camera, focusDistance, params) {
  out.set(0, 0, 0);

  const e = camera.matrixWorld.elements;
  _right.set(e[0], e[1], e[2]);
  _up.set(e[4], e[5], e[6]);
  _forward.set(-e[8], -e[9], -e[10]);

  _rel.subVectors(position, camera.position);
  const depth = _rel.dot(_forward);
  const x = _rel.dot(_right);
  const y = _rel.dot(_up);

  // Kameranın arkasına düşerse bile makul bir yarı-genişlik üret
  const safeDepth = Math.max(depth, 0.05);
  const halfH =
    safeDepth *
    Math.tan(camera.fov * THREE.MathUtils.DEG2RAD * 0.5) *
    params.screenFill;
  const halfW = halfH * camera.aspect;

  const strength = params.boundsForce;
  const marginFrac = params.boundsMargin;

  pushAxis(out, _right, x, halfW, halfW * marginFrac, strength);
  pushAxis(out, _up, y, halfH, halfH * marginFrac, strength);

  // Derinlik dilimi: odak mesafesi etrafında
  const halfDepth = Math.max(focusDistance * params.depthSpread, 0.1);
  pushAxis(
    out,
    _forward,
    depth - focusDistance,
    halfDepth,
    halfDepth * marginFrac,
    strength,
  );

  return out;
}

/** `axis` ekseninde sınırı aşan bileşeni içeri doğru iter. */
function pushAxis(out, axis, value, limit, margin, strength) {
  const over = Math.abs(value) - (limit - margin);
  if (over <= 0) return;

  const t = Math.min(over / margin, 1.5);
  out.addScaledVector(axis, -Math.sign(value) * t * t * strength);
}

/** Vektörü verilen uzunlukla sınırlar (yönü korur). */
export function limitLength(v, max) {
  const lenSq = v.lengthSq();
  if (lenSq > max * max) v.multiplyScalar(max / Math.sqrt(lenSq));
  return v;
}

/**
 * Hızın tırmanma/dalış açısını sınırlar. Toplam hız korunur: dikey bileşen
 * kırpılırken yatay bileşen aynı oranda büyütülüyor, yani kelebek dikleşmek
 * yerine kavis çiziyor.
 */
export function limitClimb(v, maxSinPitch) {
  const speed = v.length();
  if (speed < 1e-6) return v;

  const maxY = speed * maxSinPitch;
  if (Math.abs(v.y) <= maxY) return v;

  const y = Math.sign(v.y) * maxY;
  const horizontalTarget = Math.sqrt(Math.max(0, speed * speed - y * y));
  const horizontal = Math.hypot(v.x, v.z);

  if (horizontal < 1e-6) {
    // Tam dikey: yatay yön yok, keyfi bir yöne aç
    v.set(horizontalTarget, y, 0);
    return v;
  }

  const k = horizontalTarget / horizontal;
  v.set(v.x * k, y, v.z * k);
  return v;
}

/** Vektörü asgari uzunluğa yükseltir (yönü korur). */
export function ensureMinLength(v, min, fallback) {
  const lenSq = v.lengthSq();
  if (lenSq >= min * min) return v;

  // Tam sıfırsa yön yok; varsayılan bir yöne it
  if (lenSq < 1e-12) return v.copy(fallback).multiplyScalar(min);
  return v.multiplyScalar(min / Math.sqrt(lenSq));
}
