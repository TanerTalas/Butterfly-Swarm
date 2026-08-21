import * as THREE from 'three';
import { FLAP_DEFAULTS } from '../butterfly/flap.js';
import {
  FADE_VERTEX_COMMON,
  FADE_VERTEX_MAIN,
  FADE_FRAGMENT_COMMON,
  FADE_FRAGMENT_MAIN,
} from './fadeShader.js';

/*
 * Kanat çırpmasının GPU tarafı.
 *
 * `InstancedMesh` tüm kelebekler için tek bir geometri paylaşıyor; instance
 * matrisi yalnızca konum/yönelim/ölçek taşıyabiliyor, kanat açısını değil.
 * Bu yüzden çırpma vertex shader'ında yapılıyor: her vertex hangi kanada ait
 * olduğunu (`aWingId`) biliyor, her instance kendi fazını (`aPhase`) ve
 * hızını (`aFlapSpeed`) taşıyor.
 *
 * Buradaki `bfWave` / `bfVelocity`, `butterfly/flap.js` içindeki
 * `flapWave` / `flapVelocity` fonksiyonlarının GLSL karşılığı. O matematik
 * tam da bu çeviri mümkün olsun diye saf ve durumsuz yazıldı.
 * İKİSİ BİRLİKTE DEĞİŞMELİ.
 *
 * ⚠ SOLMA DA BURADAN GİRİYOR. Kanat materyalinin tek bir
 * `onBeforeCompile`'ı olabilir (aşağıdaki nota bakın), o yüzden solmanın
 * GLSL parçaları `fadeShader.js`ten alınıp bu enjeksiyonun İÇİNE
 * ekleniyor. Ayrı bir `injectFadeShader(wingMaterial)` çağrısı bunu ezer
 * ve kanatlar çırpmayı bırakırdı.
 *
 * ⚠ Aşağıdaki GLSL bloklarının içine BACKTICK yazma — kod bir JavaScript
 * şablon literali içinde duruyor ve backtick literali erkenden kapatıp
 * bütün dosyayı sözdizimi hatasına düşürüyor. Aynı sebeple ${...} da
 * yazılamaz; oradaki tek geçerli kullanım bilinçli enterpolasyon.
 */

const WING_FORE = 0.5; // aWingId eşiği: < 0.5 ön kanat, > 0.5 arka kanat

const VERTEX_COMMON = /* glsl */ `
attribute float aWingId;
attribute float aPhase;
attribute float aFlapSpeed;
/*
 * Ton kaydırması KANAT BAŞINA: x = ön kanat, y = arka kanat.
 *
 * İkisi eşitse kelebek tek renk (yerleşik ve misafir kelebekler böyle);
 * farklıysa ön ve arka kanat ayrı renkte olur — kayıtlı kullanıcıların
 * kelebekleri (projefikri.md §2). Ayrımı veri yapıyor, kod değil: tek yol
 * var, tek shader var.
 */
attribute vec2 aHue;

/*
 * Doygunluk ve parlaklık ÇARPANI, yine kanat başına (x = ön, y = arka).
 *
 * Ton tek başına yetmiyordu: ton döndürmesi doygunluğu ve parlaklığı aynen
 * bırakıyor, dolayısıyla desenden beyaz, siyah veya pastel bir kanat
 * ÜRETİLEMİYORDU. Beyaz seçen kullanıcı kırmızı kanat alıyordu, çünkü
 * doygunluğu sıfır bir rengin tonu tanımsız (0 = kırmızı) ve kod yalnızca
 * o tona bakıyordu.
 *
 * Çarpan olarak taşınıyorlar, mutlak değer olarak değil: desenin kendi
 * gradyanı (koyu kök → açık uç), koyu kenar bandı ve damarları korunuyor.
 * 1.0 = deseni olduğu gibi bırak.
 */
attribute vec2 aSat;
attribute vec2 aVal;

varying float vHueShift;
varying float vSat;
varying float vVal;

uniform float uTime;
/*
 * TEK PİVOT — ön ve arka kanat aynı nokta etrafında dönüyor.
 *
 * Önce her kanadın kendi menteşesi vardı (uForeHinge / uHindHinge) ve
 * ikisi aynı açıyla dönse bile aralarındaki mesafe KORUNMUYORDU: farklı
 * merkezler etrafındaki dönüş, iki yüzeyi birbirine göre kaydırıyor ve arka
 * kanat ön kanadın içinden geçiyordu.
 *
 * Ölçüm: duruşta iki kanat arasındaki en dar boşluk +0.031 birim, yani
 * kesişme yok. Çırpma açıldığında ayrı menteşelerle 385 hücrenin 81'i
 * ihlalliydi. Tek pivotta dönüşüm iki kanat için BİREBİR aynı afin dönüşüm
 * oluyor; dönme bir izometri olduğu için tüm noktalar arası mesafeler
 * aynen korunuyor ve duruşta kesişmeyen iki yüzey hiçbir fazda kesişemiyor.
 *
 * Bedeli: arka kanat artık kendi kökü etrafında değil, ön kanadın menteşesi
 * etrafında dönüyor. Çırpma Z ekseni etrafında olduğu için menteşenin z
 * farkı bu dönüşü hiç etkilemiyor; yalnızca burulmada (X ekseni) 0.2
 * birimlik kaldıraç farkı oluşuyor ve 16°'lik burulmada bu ~0.055 birim.
 * Görünmeyecek kadar küçük, karşılığında geçiş tamamen imkânsız.
 *
 * ⚠ HINGES yine iki ayrı değer taşıyor ve taşımalı: kanat GEOMETRİLERİ
 * o noktalara göre kuruluyor. Değişen yalnızca dönüş pivotu.
 */
uniform vec3  uWingPivot;
uniform float uFlapUp;        // radyan
uniform float uFlapDown;      // radyan
uniform float uDownstroke;
uniform float uAmplitude;
uniform float uTwist;         // radyan
uniform float uHindLag;
uniform float uHindAmp;

// flap.js flapWave() ile birebir: aşağı hamle döngünün uDownstroke kadarını
// kaplıyor, iki uçta da kosinüs olduğu için hız dönüş noktalarında sıfır.
float bfWave(float cycle, float d) {
  float p = fract(cycle);
  if (p < d) return cos(PI * (p / d));
  return -cos(PI * ((p - d) / (1.0 - d)));
}

// flap.js flapVelocity() ile birebir — burulmanın işareti bunu kullanıyor
float bfVelocity(float cycle, float d) {
  float p = fract(cycle);
  float peak = PI / min(d, 1.0 - d);
  if (p < d) return (-(PI / d) * sin(PI * (p / d))) / peak;
  return ((PI / (1.0 - d)) * sin(PI * ((p - d) / (1.0 - d)))) / peak;
}

vec3 bfRotateZ(vec3 v, float a) {
  float s = sin(a), c = cos(a);
  return vec3(v.x * c - v.y * s, v.x * s + v.y * c, v.z);
}

vec3 bfRotateX(vec3 v, float a) {
  float s = sin(a), c = cos(a);
  return vec3(v.x, v.y * c - v.z * s, v.y * s + v.z * c);
}

// Vertex başına bir kez hesaplanıp hem konum hem normal için kullanılıyor
vec3  bfHinge;
float bfAngle;
float bfTwist;
float bfSide;
float bfIsHind;

void bfSetup() {
  float isHind = step(${WING_FORE.toFixed(1)}, aWingId);
  bfIsHind = isHind;

  bfHinge = uWingPivot;
  float cycle = uTime * aFlapSpeed + aPhase - isHind * uHindLag;
  float amp = uAmplitude * mix(1.0, uHindAmp, isHind);

  float wave = bfWave(cycle, uDownstroke) * amp;
  bfAngle = mix(uFlapDown, uFlapUp, (wave + 1.0) * 0.5);
  bfTwist = bfVelocity(cycle, uDownstroke) * uTwist;

  // Sol kanat geometride zaten aynalı; ters yönde dönmeli ki ikisi de
  // yukarı kalksın. Menteşe x = 0 olduğu için işaret doğrudan x'ten geliyor.
  bfSide = sign(position.x);
}

// Konum: menteşeye göre döndür, sonra menteşeyi geri ekle
vec3 bfTransform(vec3 p) {
  vec3 local = p - bfHinge;
  local = bfRotateX(local, bfTwist);
  local = bfRotateZ(local, bfAngle * bfSide);
  return local + bfHinge;
}

// Normal: aynı dönüşler, öteleme yok.
// Bu ATLANIRSA kanatlar doğru kıpırdar ama ışığı hep açık haldeki
// normallere göre alır ve çırpma düz/plastik görünür.
vec3 bfTransformNormal(vec3 n) {
  n = bfRotateX(n, bfTwist);
  return bfRotateZ(n, bfAngle * bfSide);
}
`;

/*
 * Renk çeşitliliği fragment shader'da, ton DÖNDÜRMESİ olarak yapılıyor.
 *
 * Kolay yol `InstancedMesh.setColorAt()` olurdu ama instance rengi diffuse'u
 * ÇARPIYOR: turuncu bir deseni mavi ile çarpınca mavi değil koyu çamur çıkar,
 * çünkü desenin mavi kanalı zaten sıfıra yakın. Ton döndürme ise kanadın
 * kendi iç gradyanını (koyu kök → açık uç) ve koyu kenar bandını koruyup
 * yalnızca rengi kaydırıyor, yani tüm renk çarkı kullanılabiliyor.
 */
const FRAGMENT_COMMON = /* glsl */ `
varying float vHueShift;
varying float vSat;
varying float vVal;
uniform float uSaturation;

vec3 bfRgb2Hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 bfHsv2Rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 bfTint(vec3 rgb) {
  vec3 hsv = bfRgb2Hsv(rgb);
  hsv.x = fract(hsv.x + vHueShift);
  // uSaturation genel panel ayarı, vSat ise bu kanadın seçilen rengi
  hsv.y = clamp(hsv.y * uSaturation * vSat, 0.0, 1.0);
  hsv.z = clamp(hsv.z * vVal, 0.0, 1.0);
  return bfHsv2Rgb(hsv);
}
`;

/**
 * Kanat materyaline çırpma shader'ını enjekte eder ve uniform'ları döndürür.
 *
 * Enjeksiyon noktalarının sırası önemli: three'nin vertex shader'ında
 * `beginnormal_vertex` (objectNormal) `begin_vertex`ten (transformed) ÖNCE
 * geliyor ve aradaki `defaultnormal_vertex` normali dünya uzayına taşıyor.
 * Bu yüzden kurulum normal bloğunda yapılıp konum bloğunda tekrar kullanılıyor.
 */
export function injectFlapShader(material, hinges) {
  /*
   * Başlangıç değerleri `FLAP_DEFAULTS`tan okunuyor, elle YAZILMIYOR.
   *
   * Önce burada 0.42 / 0.12 / 0.85 gibi sayılar sabit duruyordu ve aynı
   * değerlerin ikinci bir kopyasıydı. Varsayılanlar değiştiğinde (arka kanat
   * gecikmesi 0'a çekildiğinde) bu kopya sessizce eskidi: ilk `syncFlapUniforms`
   * çağrısına kadar kanatlar hâlâ eski gecikmeyle çırpıyordu.
   *
   * İlk kare çizilmeden önce senkron çalıştığı için görünür bir hata
   * değildi, ama iki doğruluk kaynağı olması sorunun kendisi.
   */
  const uniforms = {
    uTime: { value: 0 },
    /*
     * Pivot ÖN kanadın menteşesi. Ortalama ya da arka menteşe de olurdu —
     * geçiş açısından üçü de eşdeğer, çünkü belirleyici olan tek pivot
     * olması. Ön menteşe seçildi çünkü bugünkü görüntüye en yakın olan o:
     * ön kanadın hareketi hiç değişmiyor, arka kanat ona uyuyor.
     */
    uWingPivot: { value: hinges.fore.clone() },
    uFlapUp: { value: 0 },
    uFlapDown: { value: 0 },
    uDownstroke: { value: FLAP_DEFAULTS.downstrokeFraction },
    uAmplitude: { value: FLAP_DEFAULTS.flapAmplitude },
    uTwist: { value: 0 },
    uHindLag: { value: FLAP_DEFAULTS.hindLag },
    uHindAmp: { value: FLAP_DEFAULTS.hindAmplitude },
    uSaturation: { value: 1 },
  };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\n${VERTEX_COMMON}\n${FADE_VERTEX_COMMON}`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
         bfSetup();
         vHueShift = mix(aHue.x, aHue.y, bfIsHind);
         vSat = mix(aSat.x, aSat.y, bfIsHind);
         vVal = mix(aVal.x, aVal.y, bfIsHind);
         objectNormal = bfTransformNormal(objectNormal);`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         transformed = bfTransform(transformed);
         ${FADE_VERTEX_MAIN}`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\n${FRAGMENT_COMMON}\n${FADE_FRAGMENT_COMMON}`,
      )
      /*
       * Solma kesmesi main'in BAŞINDA — atılacak fragment için doku
       * örneklemesi ve ışıklandırma hiç çalışmıyor.
       */
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>\n${FADE_FRAGMENT_MAIN}`,
      )
      // map_fragment texture'ı örnekleyip diffuseColor'a çarpıyor; tonu
      // hemen sonrasında kaydırıyoruz
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         diffuseColor.rgb = bfTint(diffuseColor.rgb);`,
      );
  };

  // Materyal önbelleği: enjeksiyonu yapan materyalin ayrı derlenmesi için
  material.customProgramCacheKey = () => 'butterfly-flap';

  return uniforms;
}

/** Panel parametrelerini uniform'lara aktarır. */
export function syncFlapUniforms(uniforms, params, time) {
  uniforms.uTime.value = time;
  uniforms.uFlapUp.value = params.flapUpDeg * THREE.MathUtils.DEG2RAD;
  uniforms.uFlapDown.value = params.flapDownDeg * THREE.MathUtils.DEG2RAD;
  uniforms.uDownstroke.value = THREE.MathUtils.clamp(
    params.downstrokeFraction,
    0.05,
    0.95,
  );
  uniforms.uAmplitude.value = params.flapping ? params.flapAmplitude : 0;
  uniforms.uTwist.value = params.twistDeg * THREE.MathUtils.DEG2RAD;
  uniforms.uHindLag.value = params.hindLag;
  uniforms.uHindAmp.value = params.hindAmplitude;
  uniforms.uSaturation.value = params.saturation;
}
