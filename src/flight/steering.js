import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

/*
 * Uçuş kuvvetleri — durumsuz fonksiyonlar.
 *
 * Her fonksiyon sonucu `out` vektörüne yazar ve onu döndürür; hiçbiri
 * yeni Vector3 ayırmaz. Sürüde bunlar kare başına YÜZLERCE kez çağrılıyor —
 * çöp üretmemeleri gerekiyor.
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

  boundsMargin: 0.22, // geri itmenin başladığı iç pay (sınırın oranı olarak)
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

/**
 * DÜNYAYA sabitlenmiş sınır: dikey bir silindir.
 *
 * Bir zamanlar ikinci bir sınır kipi vardı ve hacmi kameranın frustum'undan
 * türetiyordu — kelebekler ne olursa olsun ekranda kalıyordu. Kamerayı
 * çevirince uçuş hacmi de dönüyor, yani sürü sahneye değil EKRANA ait
 * görünüyordu; çayırın üstünde kayan ayrı bir katman gibi duruyorlardı.
 * Kelebekler avlunun içinde yaşıyor ve kamera onlara BAKIYOR: sınır dünyada.
 *
 * Geri itme sert clamp değil, kenara yaklaştıkça kareli artan kuvvet —
 * kelebek duvara çarpıp durmak yerine içeri doğru kavis çiziyor.
 *
 * @param {{radius: number, minY: number, maxY: number}} bounds
 */
export function worldBoundsForce(out, position, bounds, params) {
  out.set(0, 0, 0);

  const strength = params.boundsForce;
  const marginFrac = params.boundsMargin;

  // Yatay: merkeze doğru
  const r = Math.hypot(position.x, position.z);
  const margin = Math.max(bounds.radius * marginFrac, 1e-3);
  const over = r - (bounds.radius - margin);
  if (over > 0 && r > 1e-4) {
    const t = Math.min(over / margin, 1.5);
    const push = (t * t * strength) / r;
    out.x -= position.x * push;
    out.z -= position.z * push;
  }

  /*
   * Dikey: taban ile tavan arası. Taban çimin biraz üstünde — kelebekler
   * çimin içine girerse hem kayboluyorlar hem de yaprakların arasından
   * titreşerek görünüyorlar. Tavan ağaç taçlarının altında.
   */
  const height = bounds.maxY - bounds.minY;
  const vMargin = Math.max(height * marginFrac, 1e-3);
  const mid = (bounds.minY + bounds.maxY) * 0.5;
  pushAxis(out, UP, position.y - mid, height * 0.5, vMargin, strength);

  return out;
}

const UP = new THREE.Vector3(0, 1, 0);

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
