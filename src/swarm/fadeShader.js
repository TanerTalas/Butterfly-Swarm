/*
 * Solma — kelebeğin yedi günlük ömrünün görsel karşılığı.
 *
 * İki hareket birden, çünkü tek başına ikisi de yanlış okunuyor:
 *
 *   KÜÇÜLME    yalnız başına "uzaklaşıyor" gibi duruyor, gidiyor gibi değil.
 *   ÇÖZÜLME    yalnız başına ani: kelebek bir gün tam, ertesi gün yok.
 *
 * Birlikte ise kelebek önce siliniyor, sonra dağılıyor.
 *
 * ── Neden dithered kesme, neden saydamlık değil ──────────────────────────
 *
 * Saydam bir kelebek `transparent = true` ister; bu da sürüyü sıralamalı
 * çizime sokar. `InstancedMesh` instance'ları derinliğe göre sıralamıyor,
 * dolayısıyla saydam kanatlar birbirini ve arkalarındaki çiçekleri rastgele
 * siliyor. Üstelik iki materyal (gövde + kanat) ayrı ayrı sıralanıyor ve
 * kelebek kendi gövdesinin önüne geçiyor.
 *
 * Dithered kesme bunların hiçbirini istemiyor: fragment ya çiziliyor ya
 * `discard` ediliyor, derinlik tamponu bozulmuyor, sıralama gerekmiyor.
 * Bedeli yakın plandaki noktalı doku — kelebek 0.58 birim ve ekranda birkaç
 * on piksel; o ölçekte desen "tozlanma" gibi okunuyor, kusur gibi değil.
 *
 * ── Ömür değeri ──────────────────────────────────────────────────────────
 *
 * `life` KALAN ömür oranı: 1 = yeni salınmış, 0 = yedi günü dolmuş.
 * Yerleşik kelebeklerin ömrü yok, hepsi 1'de duruyor ve hiç solmuyorlar.
 *
 * ⚠ Sahne ömrü biten kelebeği KALDIRMIYOR, yalnızca görünmez oluyor.
 * Listeden düşürme kararı listenin sahibinde (sunucu); sahne yalnızca
 * gördüğünü çiziyor.
 */

/** Solma eğrisinin dönüm noktaları — CPU ve GPU aynı sayılara bakıyor. */
export const FADE = {
  /** Kalan ömür bunun altına inince küçülme başlıyor. */
  shrinkFrom: 0.34,
  /** Ömrün sonunda kalan boy oranı. */
  minScale: 0.55,
  /** Kalan ömür bunun altına inince çözülme başlıyor. */
  dissolveFrom: 0.14,
};

/** `smoothstep(0, edge, x)` — GLSL'deki ile birebir. */
function smoothstep(edge, x) {
  const t = Math.min(1, Math.max(0, x / edge));
  return t * t * (3 - 2 * t);
}

/**
 * Ömre göre boy çarpanı — 1 = tam boy.
 *
 * Küçülme CPU'da, instance matrisinde yapılıyor: iki mesh de (gövde ve
 * kanat) aynı matrisi alıyor, yani tek bir çarpan ikisini birden küçültüyor.
 * Vertex shader'da yapılsaydı gövde için ayrı bir enjeksiyon daha gerekirdi
 * ve iki kopyanın birlikte değişmesi şartı doğardı.
 */
export function fadeScale(life) {
  if (life >= FADE.shrinkFrom) return 1;
  return FADE.minScale + (1 - FADE.minScale) * smoothstep(FADE.shrinkFrom, life);
}

/*
 * ⚠ Aşağıdaki GLSL blokları JavaScript şablon literali içinde — BACKTICK
 * yazma. `${...}` yalnızca aşağıdaki bilinçli sabit gömmeleri için.
 */

/** Vertex tarafı: instance başına ömrü fragment'a taşıyor. */
export const FADE_VERTEX_COMMON = /* glsl */ `
attribute float aFade;
varying float vFade;
`;

export const FADE_VERTEX_MAIN = /* glsl */ `
vFade = aFade;
`;

export const FADE_FRAGMENT_COMMON = /* glsl */ `
varying float vFade;

/*
 * Interleaved gradient noise (Jimenez 2014).
 *
 * Bayer matrisi yerine bu seçildi çünkü GLSL ES 1.0'da sabit olmayan
 * indeksle dizi okunamıyor; matris ya bir dizi arama ya da 16 dallı bir
 * zincir isterdi. Bu tek satır ekran uzayında ince ve düzgün dağılmış bir
 * eşik veriyor — 4x4 Bayer'in gözle görülür ızgarası yok.
 */
float bfDitherThreshold(vec2 co) {
  return fract(52.9829189 * fract(dot(co, vec2(0.06711056, 0.00583715))));
}

/** Kalan ömürden çizilme oranı. 1 = tamamı, 0 = hiçbiri. */
float bfFadeAlpha(float life) {
  return smoothstep(0.0, ${FADE.dissolveFrom.toFixed(2)}, life);
}
`;

/*
 * Kesme main'in BAŞINDA: `clipping_planes_fragment` three'nin fragment
 * main'indeki ilk blok. Atılacak fragment için ışıklandırma, doku örneklemesi
 * ve ton dönüşümü hiç çalıştırılmıyor.
 */
export const FADE_FRAGMENT_MAIN = /* glsl */ `
if (vFade < 1.0 && bfDitherThreshold(gl_FragCoord.xy) >= bfFadeAlpha(vFade)) {
  discard;
}
`;

/**
 * Solmayı KENDİ enjeksiyonu olmayan bir materyale ekler — gövde materyali.
 *
 * Kanat materyali bunu çağırmaz: onun tek bir `onBeforeCompile`'ı var
 * (`injectFlapShader`) ve solma parçaları oraya, aynı enjeksiyonun içine
 * konuyor. İkinci bir enjeksiyon birincisini ezerdi ve kanatlar çırpmayı
 * bırakırdı (bkz. wingShader.js).
 */
export function injectFadeShader(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${FADE_VERTEX_COMMON}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n${FADE_VERTEX_MAIN}`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\n${FADE_FRAGMENT_COMMON}`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>\n${FADE_FRAGMENT_MAIN}`,
      );
  };

  material.customProgramCacheKey = () => 'butterfly-fade';
}
