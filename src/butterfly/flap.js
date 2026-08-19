/*
 * Kanat çırpma matematiği — SAF FONKSİYONLAR.
 *
 * Burada Three.js yok, sınıf yok, durum yok. Sebebi ROADMAP Aşama 5:
 * aynı matematik GLSL'e taşınacak ve vertex shader'da çalışacak. Buradaki
 * her şeyin GLSL'e birebir çevrilebilir kalması gerekiyor.
 */

export const FLAP_DEFAULTS = {
  flapping: true,
  flapSpeed: 1.6, // saniyedeki tam vuruş sayısı
  flapAmplitude: 1.0,
  flapUpDeg: 72, // vuruşun tepesi
  flapDownDeg: -14, // vuruşun dibi
  downstrokeFraction: 0.42, // vuruşun ne kadarı aşağı hamlesi
  /*
   * ÖN VE ARKA KANAT SENKRON ÇIRPIYOR — gecikme 0, genlik eşit.
   *
   * Önce 0.12 gecikme ve 0.85 genlik vardı; gerçek bir kelebekte arka kanat
   * ön kanadı hafifçe takip ettiği için doğru görünüyordu. Ama iki kanat
   * plan görünüşünde ÜST ÜSTE biniyor: farklı açılardayken arka kanat ön
   * kanadın düzleminden geçip içinden çıkıyordu.
   *
   * Aynı açı + aynı burulma verildiğinde geçiş matematiksel olarak imkânsız.
   * İki kanat kendi menteşesi etrafında dönüyor ve menteşeler farklı
   * (fore y=0.10 z=+0.10, hind y=0.06 z=−0.10), ama aynı R dönüşü altında
   * aralarındaki ayrım R·d + (I−R)·e ile veriliyor; çırpma aralığında
   * (−14°…+72°) bu hep pozitif kalıyor. Yani menteşe farkı sorun değildi,
   * FAZ farkıydı.
   *
   * Denetleyiciler panelde duruyor (laboratuvarda denenebilsin diye);
   * değişen yalnızca varsayılan.
   */
  hindLag: 0, // arka kanadın faz gecikmesi (vuruş kesri)
  hindAmplitude: 1,
  twistDeg: 16, // kanadın açıklık ekseni etrafında burulması
};

/*
 * Not: Aşama 2'de gövde, çırpmanın tersine hafifçe salınıyordu (bodyBobDeg).
 * Sürüde gövde ve kanatlar aynı instance matrisini paylaştığı için gövdeyi
 * ayrıca döndürmek mümkün değil; ancak kelebekler ekran yüksekliğinin ~%11'i
 * kadar olduğundan bu detay zaten görünmüyor. Uçuş yolundaki dikey salınım
 * (FLIGHT_DEFAULTS.bob) korundu.
 */

/**
 * Vuruş dalgası: [0,1) döngü konumu → [-1, 1]. +1 tepe, -1 dip.
 *
 * Sinüs DEĞİL — kasıtlı olarak asimetrik. Gerçek kanat aşağı hamlesini
 * (güç vuruşu) hızlı, yukarı hamlesini (toparlanma) yavaş yapar. Saf sinüs
 * bunu simetrik yapıp animasyona o mekanik, "silecek kolu" hissini veriyor.
 *
 * İki uçta da kosinüs kullanıldığı için hız dönüş noktalarında sıfıra
 * iniyor; kanat tepede ve dipte yumuşakça duraklıyor.
 */
export function flapWave(cycle, downstrokeFraction = FLAP_DEFAULTS.downstrokeFraction) {
  const d = clamp(downstrokeFraction, 0.05, 0.95);
  const p = cycle - Math.floor(cycle);

  if (p < d) return Math.cos(Math.PI * (p / d)); // tepe → dip (hızlı)
  return -Math.cos(Math.PI * ((p - d) / (1 - d))); // dip → tepe (yavaş)
}

/**
 * Vuruş dalgasının [-1,1] aralığına normalize edilmiş türevi.
 * İşareti kanadın hangi yöne gittiğini söylüyor — burulma (twist) bunu
 * kullanıyor: aşağı hamlede kanadın ön kenarı aşağı bakmalı.
 */
export function flapVelocity(cycle, downstrokeFraction = FLAP_DEFAULTS.downstrokeFraction) {
  const d = clamp(downstrokeFraction, 0.05, 0.95);
  const p = cycle - Math.floor(cycle);
  // En dik hamlenin tepe hızı — normalizasyon için
  const peak = Math.PI / Math.min(d, 1 - d);

  if (p < d) return (-(Math.PI / d) * Math.sin(Math.PI * (p / d))) / peak;
  return ((Math.PI / (1 - d)) * Math.sin(Math.PI * ((p - d) / (1 - d)))) / peak;
}

/** Zaman + bireysel faz → döngü konumu. */
export function flapCycle(time, speed, phase = 0) {
  return time * speed + phase;
}

/**
 * Kanat çırpma açısı (radyan). Menteşe etrafındaki dönüş — SAĞ kanat için.
 * Sol kanat aynı değeri ters işaretle kullanır (bkz. CLAUDE.md).
 */
export function flapAngle(cycle, params) {
  const {
    flapUpDeg,
    flapDownDeg,
    flapAmplitude,
    downstrokeFraction,
  } = { ...FLAP_DEFAULTS, ...params };

  const wave = flapWave(cycle, downstrokeFraction) * flapAmplitude;
  // wave ∈ [-1,1] → [dip, tepe]. Genlik 0'da kanat vuruşun ortasında durur.
  const deg = flapDownDeg + ((wave + 1) / 2) * (flapUpDeg - flapDownDeg);
  return deg * DEG2RAD;
}

/**
 * Kanadın açıklık ekseni etrafındaki burulması (radyan).
 *
 * Aşama 2'de bu tüm kanada uygulanan tek bir pitch: kanat düz bir levha gibi
 * değil, ön kenarı hamle yönüne göre eğik hareket ediyor. Menteşeden uca
 * doğru artan GERÇEK burulma Aşama 5'te vertex shader'da gelecek — burada
 * bütün kanadı çevirmek makul ve ucuz yaklaşım.
 */
export function twistAngle(cycle, params) {
  const { twistDeg, downstrokeFraction } = { ...FLAP_DEFAULTS, ...params };
  // Hız negatifken (aşağı hamle) ön kenar aşağı bakmalı → negatif pitch
  return flapVelocity(cycle, downstrokeFraction) * twistDeg * DEG2RAD;
}

const DEG2RAD = Math.PI / 180;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
