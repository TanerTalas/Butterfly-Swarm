import * as THREE from 'three';

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
 * `flapWave` / `flapVelocity` fonksiyonlarının GLSL karşılığı. Aşama 2'de o
 * matematik bilerek saf ve durumsuz yazılmıştı; burada birebir çevrildi.
 * İKİSİ BİRLİKTE DEĞİŞMELİ.
 */

const WING_FORE = 0.5; // aWingId eşiği: < 0.5 ön kanat, > 0.5 arka kanat

const COMMON = /* glsl */ `
attribute float aWingId;
attribute float aPhase;
attribute float aFlapSpeed;

uniform float uTime;
uniform vec3  uForeHinge;
uniform vec3  uHindHinge;
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

void bfSetup() {
  float isHind = step(${WING_FORE.toFixed(1)}, aWingId);

  bfHinge = mix(uForeHinge, uHindHinge, isHind);
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

/**
 * Kanat materyaline çırpma shader'ını enjekte eder ve uniform'ları döndürür.
 *
 * Enjeksiyon noktalarının sırası önemli: three'nin vertex shader'ında
 * `beginnormal_vertex` (objectNormal) `begin_vertex`ten (transformed) ÖNCE
 * geliyor ve aradaki `defaultnormal_vertex` normali dünya uzayına taşıyor.
 * Bu yüzden kurulum normal bloğunda yapılıp konum bloğunda tekrar kullanılıyor.
 */
export function injectFlapShader(material, hinges) {
  const uniforms = {
    uTime: { value: 0 },
    uForeHinge: { value: hinges.fore.clone() },
    uHindHinge: { value: hinges.hind.clone() },
    uFlapUp: { value: 0 },
    uFlapDown: { value: 0 },
    uDownstroke: { value: 0.42 },
    uAmplitude: { value: 1 },
    uTwist: { value: 0 },
    uHindLag: { value: 0.12 },
    uHindAmp: { value: 0.85 },
  };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${COMMON}`)
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
         bfSetup();
         objectNormal = bfTransformNormal(objectNormal);`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         transformed = bfTransform(transformed);`,
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
}
