import * as THREE from 'three';
import { buildSwarmGeometry } from './geometry.js';
import { HINGES } from '../butterfly/geometry.js';
import { injectFlapShader, syncFlapUniforms } from './wingShader.js';
import { fadeScale, injectFadeShader } from './fadeShader.js';
import { createWingMaterial, createBodyMaterial } from '../butterfly/material.js';
import {
  wanderForce,
  worldBoundsForce,
  limitLength,
  ensureMinLength,
  limitClimb,
} from '../flight/steering.js';
import { flapWave } from '../butterfly/flap.js';

/*
 * Sürü: N kelebek, 2 draw call.
 *
 * Ajan verisi nesnelerde değil düz `Float32Array`'lerde tutuluyor. 500 ajan
 * × kare başına birkaç Vector3 = saniyede on binlerce geçici nesne demekti;
 * diziler ve modül düzeyinde yeniden kullanılan geçiciler bunu sıfıra
 * indiriyor.
 *
 * Kapasite bir kez ayrılıyor, `count` yalnızca `instanceMesh.count`'u
 * değiştiriyor — sayıyı oynatmak yeniden ayırma yapmıyor.
 */

export const SWARM_DEFAULTS = {
  count: 120,

  // Kelebeğin dünya ölçeği. Geometri ~3.4 birim kanat açıklığıyla modellendi;
  // uçuş hacmi ise kamera frustum'undan türüyor ve varsayılan kamerada ~7.3
  // birim yüksekliğinde. Kamerayı geri çekmek görsel olarak eşdeğerdi ama
  // hacim de büyüyeceği için tüm dünya birimli uçuş parametrelerini yeniden
  // ayarlamak gerekirdi; ölçek burada durunca o ayarlar geçerli kalıyor.
  scale: 0.25,

  sizeVariation: 0.35, // ±%17 boyut çeşitliliği

  // Ton kaydırma aralığı. 0 = hepsi desenin kendi turuncusu,
  // 1 = tüm renk çarkı (mavi, mor, kırmızı, yeşil…) rastgele dağılmış.
  hueSpread: 1.0,
  saturation: 1.0, // < 1 pastel, > 1 canlı
};

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const FALLBACK_UP = new THREE.Vector3(0, 0, 1);
const FORWARD = new THREE.Vector3(0, 0, 1);

// Modül düzeyi geçiciler — kare başına ayırma yok
const _pos = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _acc = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _f = new THREE.Vector3();
const _r = new THREE.Vector3();
const _u = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _target = new THREE.Quaternion();
const _roll = new THREE.Quaternion();
const _matrix = new THREE.Matrix4();
const _scale = new THREE.Vector3();

export class Swarm {
  constructor({ capacity = 800, params, flight }) {
    this.capacity = capacity;
    this.params = params; // kelebek/çırpma parametreleri
    this.flight = flight; // uçuş/davranış parametreleri
    this.time = 0;

    this.group = new THREE.Group();

    this.bodyMaterial = createBodyMaterial();
    this.bodyMaterial.vertexColors = true;
    this.wingMaterial = createWingMaterial();

    // Shader YALNIZCA BİR KEZ enjekte edilir.
    //
    // three, aynı `customProgramCacheKey` için programı materyal başına
    // önbelleğe alıyor ve önbellekte bulunca `onBeforeCompile`'ı bir daha
    // ÇAĞIRMIYOR. Yeniden enjekte etmek yeni bir uniforms nesnesi üretir ama
    // o nesne hiçbir zaman programa bağlanmaz: `uTime` donar, kanatlar
    // çırpmayı bırakır, gövdenin dikey salınımı ise CPU tarafında olduğu
    // için sürdüğünden kelebekler "sadece vücuduyla inip kalkıyor" görünür.
    // Menteşeler sabit olduğu için yeniden enjeksiyona zaten gerek yok.
    this.flapUniforms = injectFlapShader(this.wingMaterial, HINGES);

    /*
     * Solma İKİ materyali birden ilgilendiriyor: kanatlar dağılırken gövde
     * yerinde kalırsa ekranda uçan bir leke kalıyor.
     *
     * Kanadınki `injectFlapShader`ın İÇİNDE, çünkü o materyalin tek bir
     * `onBeforeCompile`'ı olabilir (yukarıdaki not). Gövde materyalinin
     * başka enjeksiyonu yok, o yüzden kendi çağrısını alıyor — ve bu da
     * materyal ömrü boyunca yalnızca burada, bir kez.
     */
    injectFadeShader(this.bodyMaterial);

    this._allocate();
    this.build();
  }

  // ── Veri ────────────────────────────────────────────────────────────────

  _allocate() {
    const n = this.capacity;
    this.position = new Float32Array(n * 3);
    this.velocity = new Float32Array(n * 3);
    this.quaternion = new Float32Array(n * 4);
    this.scale = new Float32Array(n);
    this.phase = new Float32Array(n);
    this.flapSpeed = new Float32Array(n);
    this.noiseOffset = new Float32Array(n);

    /*
     * KALAN ÖMÜR oranı: 1 = yeni salınmış, 0 = yedi günü dolmuş
     * (bkz. fadeShader.js).
     *
     * Hepsi 1'de başlıyor ve yerleşik kelebekler orada kalıyor — onların
     * ömrü yok, hiç solmuyorlar. Yalnızca ziyaretçilerinki yazılıyor
     * (`visitors.js`).
     */
    this.fade = new Float32Array(n).fill(1);

    // Ham rastgele çekilişler AYRI tutuluyor.
    //
    // `scale[i]` gibi türetilmiş değerler parametre değişince yeniden
    // hesaplanmalı; ama rastgeleliği o anda yeniden çekersek sürü sıçrar
    // (bir kelebek büyükken aniden küçük olur). Çekilişler bir kez yapılıp
    // saklanıyor, türetme her seferinde aynı çekilişten yapılıyor.
    this._sizeRand = new Float32Array(n);
    this._speedRand = new Float32Array(n);
    this._hueRand = new Float32Array(n);
    /*
     * Shader'a giden instance attribute'u — KANAT BAŞINA iki bileşen:
     * [0] ön kanat tonu, [1] arka kanat tonu.
     *
     * İkisi eşitse kelebek tek renk. Ayrı renk yalnızca kayıtlı
     * kullanıcıların kelebeklerinde kullanılıyor (projefikri.md §2);
     * yerleşik ve misafir kelebekler her zaman tek renk geziyor.
     */
    this.hueShift = new Float32Array(n * 2);

    /*
     * Doygunluk ve parlaklık ÇARPANLARI, yine kanat başına.
     *
     * 1 = deseni olduğu gibi bırak; hepsi böyle başlıyor. Yalnızca gerçek
     * bir hex renk seçildiğinde 1'den ayrılıyorlar — beyaz kanat için
     * doygunluk 0'a, siyah için parlaklık 0'a gidiyor. Ton tek başına bu
     * iki rengi üretemiyor (bkz. wingShader.js).
     */
    this.wingSat = new Float32Array(n * 2).fill(1);
    this.wingVal = new Float32Array(n * 2).fill(1);

    for (let i = 0; i < n; i++) this._seed(i);
    this.applyVariation();
  }

  /** Bir ajanı rastgele bir başlangıç durumuna kurar. */
  _seed(i) {
    const spread = 4;

    this.position[i * 3] = (Math.random() - 0.5) * spread * 2;
    this.position[i * 3 + 1] = (Math.random() - 0.5) * spread;
    this.position[i * 3 + 2] = (Math.random() - 0.5) * spread;

    this.velocity[i * 3] = (Math.random() - 0.5) * 0.6;
    this.velocity[i * 3 + 1] = (Math.random() - 0.5) * 0.2;
    this.velocity[i * 3 + 2] = (Math.random() - 0.5) * 0.6;

    this.quaternion[i * 4 + 3] = 1; // birim quaternion

    this.phase[i] = Math.random();
    this.noiseOffset[i] = Math.random() * 1000;

    this._sizeRand[i] = Math.random() - 0.5;
    this._speedRand[i] = Math.random() - 0.5;
    this._hueRand[i] = Math.random(); // [0,1) — tam renk çarkı için
  }

  /**
   * Bir kelebeğin çekilişlerini DIŞARIDAN verilen bir üreteçten yeniden
   * kurar — yani görünüşünü yuvasından koparır.
   *
   * Havuz yuvaları geri dönüşümlü: ayrılan kelebeğin yerine sondaki
   * taşınıyor, boşalan yuvaya bir sonraki kelebek düşüyor. Çekilişler
   * yalnızca kurulumda yapıldığı sürece kelebek hangi yuvaya denk geldiyse
   * onun boyunu ve çırpma hızını alıyor; aynı kelebek yeniden salındığında
   * (yenileme, yeniden bağlanma) başka bir kelebek gibi görünüyor.
   *
   * `rand` kelebeğin kendi tohumundan geliyor (bkz. `visitors.js`), yani
   * aynı kelebek her seferinde aynı boyda ve aynı hızda çırpıyor.
   *
   * Renk çekilişi (`_hueRand`) BİLEREK dışarıda: ziyaretçinin rengi
   * çekilmiyor, seçiliyor ve `setWingTint` ile ayrıca yazılıyor.
   */
  reseedInstance(i, rand) {
    this.phase[i] = rand();
    this.noiseOffset[i] = rand() * 1000;
    this._sizeRand[i] = rand() - 0.5;
    this._speedRand[i] = rand() - 0.5;

    // `applyVariation()` ile aynı türetme, yalnızca tek kelebek için
    const p = this.params;
    this.scale[i] = p.scale * (1 + this._sizeRand[i] * p.sizeVariation);
    this.flapSpeed[i] = p.flapSpeed * (1 + this._speedRand[i] * 0.35);

    const geometry = this.wingMesh?.geometry;
    for (const name of ['aPhase', 'aFlapSpeed']) {
      const attr = geometry?.getAttribute(name);
      if (attr) attr.needsUpdate = true;
    }
  }

  /**
   * Boy ve çırpma hızı çeşitliliğini parametrelerden yeniden türetir.
   * Geometri değişmediği için yeniden inşa GEREKMİYOR.
   */
  applyVariation() {
    const p = this.params;
    for (let i = 0; i < this.capacity; i++) {
      this.scale[i] = p.scale * (1 + this._sizeRand[i] * p.sizeVariation);
      this.flapSpeed[i] = p.flapSpeed * (1 + this._speedRand[i] * 0.35);
    }
    // aFlapSpeed instance attribute'u aynı diziyi paylaşıyor; GPU'ya bildir
    const attr = this.wingMesh?.geometry.getAttribute('aFlapSpeed');
    if (attr) attr.needsUpdate = true;
  }

  // ── Geometri / mesh ─────────────────────────────────────────────────────

  build() {
    const built = buildSwarmGeometry(this.params);
    this._geometries = [built.body, built.wings];
    this.hinges = built.hinges;

    this.wingMaterial.map?.dispose();
    this.wingMaterial.normalMap?.dispose();
    this.wingMaterial.map = built.atlas;
    this.wingMaterial.normalMap = built.atlasNormal;
    // Damarlar ışığı yakalasın ama kanat buruşuk görünmesin
    this.wingMaterial.normalScale.set(0.55, 0.55);
    this.wingMaterial.needsUpdate = true;

    // Instance başına çırpma verisi — yalnızca kanat geometrisinde gerekli
    built.wings.setAttribute(
      'aPhase',
      new THREE.InstancedBufferAttribute(this.phase, 1),
    );
    built.wings.setAttribute(
      'aFlapSpeed',
      new THREE.InstancedBufferAttribute(this.flapSpeed, 1),
    );
    built.wings.setAttribute(
      'aHue',
      new THREE.InstancedBufferAttribute(this.hueShift, 2),
    );
    built.wings.setAttribute(
      'aSat',
      new THREE.InstancedBufferAttribute(this.wingSat, 2),
    );
    built.wings.setAttribute(
      'aVal',
      new THREE.InstancedBufferAttribute(this.wingVal, 2),
    );

    /*
     * Ömür İKİ geometriye birden takılıyor: gövde ve kanat ayrı materyaller,
     * ayrı programlar, ama aynı diziyi okuyorlar. İki `InstancedBufferAttribute`,
     * tek `Float32Array` — değer bir kez yazılıyor, `needsUpdate` iki kez
     * işaretleniyor (`fadeNeedsUpdate`).
     */
    built.body.setAttribute(
      'aFade',
      new THREE.InstancedBufferAttribute(this.fade, 1),
    );
    built.wings.setAttribute(
      'aFade',
      new THREE.InstancedBufferAttribute(this.fade, 1),
    );

    this.bodyMesh = new THREE.InstancedMesh(
      built.body,
      this.bodyMaterial,
      this.capacity,
    );
    this.wingMesh = new THREE.InstancedMesh(
      built.wings,
      this.wingMaterial,
      this.capacity,
    );

    for (const mesh of [this.bodyMesh, this.wingMesh]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      // Kelebekler sahnenin her yerinde; kutu testine güvenip elemeyelim
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }

    this.applyHue();
    this.setCount(this.params.count);
  }

  /**
   * Kelebek başına ton kaydırmasını yeniden türetir.
   *
   * Boy çeşitliliğinde olduğu gibi ham çekiliş `_hueRand`'da saklı —
   * `hueSpread`i değiştirmek renkleri yeniden karmıyor, aynı çekilişi
   * yeniden ölçekliyor. Yoksa her dokunuşta bütün sürü renk değiştirirdi.
   */
  applyHue() {
    const spread = this.params.hueSpread;
    for (let i = 0; i < this.capacity; i++) {
      // Tek renk: iki kanat da aynı tonu alıyor
      const h = (this._hueRand[i] - 0.5) * spread;
      this.hueShift[i * 2] = h;
      this.hueShift[i * 2 + 1] = h;
    }
    this._hueNeedsUpdate();
  }

  /**
   * Tek bir kelebeğin kanat tonlarını ayarlar.
   *
   * `hind` verilmezse arka kanat ön kanatla aynı olur — yani tek renk
   * kelebek. İki farklı değer vermek yalnızca kayıtlı kullanıcıların
   * kelebekleri için (projefikri.md §2).
   *
   * Değerler ton KAYDIRMASI, mutlak renk değil: desenin kendi gradyanı ve
   * koyu kenar bandı korunuyor, yalnızca renk çarkında dönüyor. Hex renkten
   * kaydırmaya çevirmek için `hueShiftFromColor()`.
   */
  setWingHues(i, fore, hind = fore) {
    this.hueShift[i * 2] = fore;
    this.hueShift[i * 2 + 1] = hind;
    this._hueNeedsUpdate();
  }

  /**
   * Bir kelebeğin kanat rengini TAM olarak ayarlar: ton + doygunluk +
   * parlaklık. `wingTintFromColor()` bir hex'i bu üçlüye çeviriyor.
   *
   * `setWingHues` yalnızca tonu değiştirip doygunluk/parlaklığı olduğu gibi
   * bırakıyor; gerçek bir renk uygulamak için BU kullanılmalı, yoksa beyaz
   * ve siyah gibi doygunluğu olmayan renkler kırmızıya düşüyor.
   */
  setWingTint(i, fore, hind = fore) {
    this.hueShift[i * 2] = fore.hue;
    this.hueShift[i * 2 + 1] = hind.hue;
    this.wingSat[i * 2] = fore.sat;
    this.wingSat[i * 2 + 1] = hind.sat;
    this.wingVal[i * 2] = fore.val;
    this.wingVal[i * 2 + 1] = hind.val;
    this._hueNeedsUpdate();
  }

  /**
   * Bir kelebeğin kalan ömrünü ayarlar — 1 yeni salınmış, 0 yedi günü dolmuş.
   *
   * Görünüşü iki yerden değiştiriyor: boy `update()` içinde instance
   * matrisine giriyor, çözülme shader'da (bkz. fadeShader.js).
   *
   * ⚠ Kelebeği KALDIRMIYOR. 0'a inen kelebek görünmez oluyor ama hâlâ uçuyor
   * ve hâlâ bir yuva tutuyor; listeden düşürme kararı listenin sahibinde.
   */
  setFade(i, life) {
    this.fade[i] = life < 0 ? 0 : life > 1 ? 1 : life;
  }

  /** `setFade` toplu yazıldıktan sonra bir kez — kare başına bir kez yeter. */
  fadeNeedsUpdate() {
    for (const mesh of [this.bodyMesh, this.wingMesh]) {
      const attr = mesh?.geometry.getAttribute('aFade');
      if (attr) attr.needsUpdate = true;
    }
  }

  _hueNeedsUpdate() {
    const geometry = this.wingMesh?.geometry;
    if (!geometry) return;
    for (const name of ['aHue', 'aSat', 'aVal']) {
      const attr = geometry.getAttribute(name);
      if (attr) attr.needsUpdate = true;
    }
  }

  /**
   * Bir kelebeğin BÜTÜN durumunu başka bir yuvaya taşır.
   *
   * `update()` yalnızca `[0, count)` aralığını işliyor, yani canlı
   * kelebekler dizinin başında bitişik durmak zorunda. Aradan biri
   * ayrıldığında (ömrü doldu, hesap silindi) boşluk bırakılamaz: sondaki
   * kelebek boşalan yuvaya taşınıp sayı bir azaltılıyor.
   *
   * Taşınan şey görünüşü değil DURUMU: konum, hız, yönelim, ölçü, çırpma
   * fazı ve rengi. Yalnızca renk kopyalansaydı o kelebek bir sonraki karede
   * bambaşka bir yere ışınlanırdı.
   *
   * Ham rastgele çekilişler (`_sizeRand` vb.) de geliyor; kalsalardı bir
   * sonraki `applyVariation()` çağrısı kelebeğin boyunu değiştirirdi.
   */
  copyInstance(from, to) {
    if (from === to) return;

    for (const [arr, stride] of [
      [this.position, 3],
      [this.velocity, 3],
      [this.quaternion, 4],
      [this.hueShift, 2],
      [this.wingSat, 2],
      [this.wingVal, 2],
      [this.fade, 1],
      [this.scale, 1],
      [this.phase, 1],
      [this.flapSpeed, 1],
      [this.noiseOffset, 1],
      [this._sizeRand, 1],
      [this._speedRand, 1],
      [this._hueRand, 1],
    ]) {
      for (let k = 0; k < stride; k++) {
        arr[to * stride + k] = arr[from * stride + k];
      }
    }

    this._hueNeedsUpdate();
    this.fadeNeedsUpdate();
    const geometry = this.wingMesh?.geometry;
    for (const name of ['aPhase', 'aFlapSpeed']) {
      const attr = geometry?.getAttribute(name);
      if (attr) attr.needsUpdate = true;
    }
  }

  setCount(n) {
    const count = Math.max(1, Math.min(Math.round(n), this.capacity));
    this.params.count = count;
    this.bodyMesh.count = count;
    this.wingMesh.count = count;
  }

  /** Tasarım parametresi değişince geometriyi ve atlası yeniden üretir. */
  rebuild() {
    this.group.clear();
    for (const g of this._geometries) g.dispose();
    this.bodyMesh.dispose();
    this.wingMesh.dispose();
    this.build();
  }

  dispose() {
    for (const g of this._geometries) g.dispose();
    this.wingMaterial.map?.dispose();
    this.wingMaterial.normalMap?.dispose();
    this.wingMaterial.dispose();
    this.bodyMaterial.dispose();
  }

  // ── Güncelleme ──────────────────────────────────────────────────────────

  update(dt, ctx) {
    this.time += dt;
    syncFlapUniforms(this.flapUniforms, this.params, this.time);

    if (!this.flight.flying) return;

    const n = this.params.count;
    const fl = this.flight;
    const climbSin = Math.sin(fl.maxClimbDeg * THREE.MathUtils.DEG2RAD);
    const turn = 1 - Math.exp(-fl.turnRate * dt);

    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      _pos.fromArray(this.position, i3);
      _vel.fromArray(this.velocity, i3);

      // ── Kuvvetler ──
      _acc.set(0, 0, 0);
      _acc.add(wanderForce(_tmp, this.noiseOffset[i], this.time, fl));

      /*
       * Sınır, çağıran taraf verdiyse uygulanıyor. `ctx.bounds` olmadan
       * çağıran tek yer önizleme (`world/preview.js`) ve orada
       * `flight.flying` kapalı — döngüye zaten hiç girilmiyor.
       */
      if (ctx.bounds) _acc.add(worldBoundsForce(_tmp, _pos, ctx.bounds, fl));
      limitLength(_acc, fl.maxForce);

      // ── Entegrasyon ──
      _vel.addScaledVector(_acc, dt);
      limitLength(_vel, fl.maxSpeed);
      ensureMinLength(_vel, fl.minSpeed, FORWARD);
      limitClimb(_vel, climbSin);
      _pos.addScaledVector(_vel, dt);

      _pos.toArray(this.position, i3);
      _vel.toArray(this.velocity, i3);

      // ── Yönelim ──
      this._orient(i, _vel, _acc, turn, fl);

      // ── Instance matrisi ──
      _q.fromArray(this.quaternion, i * 4);
      const bob =
        -flapWave(
          this.time * this.flapSpeed[i] + this.phase[i],
          this.params.downstrokeFraction,
        ) * fl.bob;
      _tmp.copy(_pos);
      _tmp.y += bob;
      // Solma boyu da küçültüyor; yerleşiklerde çarpan 1, hiç dokunmuyor
      _scale.setScalar(this.scale[i] * fadeScale(this.fade[i]));
      _matrix.compose(_tmp, _q, _scale);

      this.bodyMesh.setMatrixAt(i, _matrix);
      this.wingMesh.setMatrixAt(i, _matrix);
    }

    this.bodyMesh.instanceMatrix.needsUpdate = true;
    this.wingMesh.instanceMatrix.needsUpdate = true;
  }

  /** Burnu (+Z) hız yönüne çevirir, dönüşte içeri yatırır. */
  _orient(i, vel, acc, turn, fl) {
    const speed = vel.length();
    if (speed < 1e-4) return;

    _f.copy(vel).divideScalar(speed);
    const up = Math.abs(_f.y) > 0.985 ? FALLBACK_UP : WORLD_UP;
    _r.crossVectors(up, _f).normalize();
    _u.crossVectors(_f, _r);
    _basis.makeBasis(_r, _u, _f);
    _target.setFromRotationMatrix(_basis);

    const maxBank = fl.maxBankDeg * THREE.MathUtils.DEG2RAD;
    const bank = THREE.MathUtils.clamp(
      -acc.dot(_r) * fl.bank,
      -maxBank,
      maxBank,
    );
    _roll.setFromAxisAngle(FORWARD, bank);
    _target.multiply(_roll);

    _q.fromArray(this.quaternion, i * 4);
    _q.slerp(_target, turn);
    _q.toArray(this.quaternion, i * 4);
  }
}
