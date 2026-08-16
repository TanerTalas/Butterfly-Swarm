import * as THREE from 'three';
import { buildSwarmGeometry } from './geometry.js';
import { injectFlapShader, syncFlapUniforms } from './wingShader.js';
import { createWingMaterial, createBodyMaterial } from '../butterfly/material.js';
import {
  wanderForce,
  viewBoundsForce,
  followForce,
  orbitForce,
  fleeForce,
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
 * değiştiriyor — panelden sayıyı oynatmak yeniden ayırma yapmıyor.
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
  hueSpread: 0.1, // ton kaydırma aralığı
  hueStrength: 0.5, // 0 = hepsi aynı renk, 1 = tam ton kaydırma
};

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const FALLBACK_UP = new THREE.Vector3(0, 0, 1);
const FORWARD = new THREE.Vector3(0, 0, 1);
const WHITE = new THREE.Color(1, 1, 1);

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
const _color = new THREE.Color();

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

    this._allocate();
    this.build();
  }

  // ── Veri ────────────────────────────────────────────────────────────────

  _allocate() {
    const n = this.capacity;
    this.position = new Float32Array(n * 3);
    this.velocity = new Float32Array(n * 3);
    this.quaternion = new Float32Array(n * 4);
    this.followMix = new Float32Array(n);
    this.fleeMix = new Float32Array(n);
    this.scale = new Float32Array(n);
    this.phase = new Float32Array(n);
    this.flapSpeed = new Float32Array(n);
    this.noiseOffset = new Float32Array(n);
    // Kelebek başına tercih edilen takip yarıçapı oranı — sürünün ince bir
    // kabuk yerine bulut oluşturmasını sağlayan şey bu
    this.radiusBias = new Float32Array(n);

    for (let i = 0; i < n; i++) this._seed(i);
  }

  /** Bir ajanı rastgele bir başlangıç durumuna kurar. */
  _seed(i) {
    const p = this.params;
    const spread = 4;

    this.position[i * 3] = (Math.random() - 0.5) * spread * 2;
    this.position[i * 3 + 1] = (Math.random() - 0.5) * spread;
    this.position[i * 3 + 2] = (Math.random() - 0.5) * spread;

    this.velocity[i * 3] = (Math.random() - 0.5) * 0.6;
    this.velocity[i * 3 + 1] = (Math.random() - 0.5) * 0.2;
    this.velocity[i * 3 + 2] = (Math.random() - 0.5) * 0.6;

    this.quaternion[i * 4 + 3] = 1; // birim quaternion

    // Bireysel varyasyon: sürü tek bir organizma gibi görünmesin
    this.scale[i] = p.scale * (1 + (Math.random() - 0.5) * p.sizeVariation);
    this.phase[i] = Math.random();
    this.flapSpeed[i] = p.flapSpeed * (1 + (Math.random() - 0.5) * 0.35);
    this.noiseOffset[i] = Math.random() * 1000;
    // Küpü alınmış rastgelelik: yakın yarıçapları seyreltip yoğunluğu
    // hacme eşit dağıtıyor, yoksa herkes merkeze toplanıyor
    this.radiusBias[i] = Math.cbrt(Math.random());
  }

  // ── Geometri / mesh ─────────────────────────────────────────────────────

  build() {
    const built = buildSwarmGeometry(this.params);
    this._geometries = [built.body, built.wings];
    this.hinges = built.hinges;

    if (this.wingMaterial.map) this.wingMaterial.map.dispose();
    this.wingMaterial.map = built.atlas;
    this.wingMaterial.needsUpdate = true;

    this.flapUniforms = injectFlapShader(this.wingMaterial, built.hinges);

    // Instance başına çırpma verisi — yalnızca kanat geometrisinde gerekli
    built.wings.setAttribute(
      'aPhase',
      new THREE.InstancedBufferAttribute(this.phase, 1),
    );
    built.wings.setAttribute(
      'aFlapSpeed',
      new THREE.InstancedBufferAttribute(this.flapSpeed, 1),
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

    this._applyHueVariation();
    this.setCount(this.params.count);
  }

  /**
   * Instance rengi diffuse'u ÇARPIYOR. Doygun bir renk deseni boğardı, o
   * yüzden ton kaydırması en parlak kanalı 1'de tutacak şekilde normalize
   * ediliyor: renk kayıyor ama parlaklık düşmüyor.
   */
  _applyHueVariation() {
    const p = this.params;
    for (let i = 0; i < this.capacity; i++) {
      const hue = 0.08 + (Math.random() - 0.5) * p.hueSpread;
      _color.setHSL(hue, 0.55, 0.5);
      const max = Math.max(_color.r, _color.g, _color.b) || 1;
      _color.multiplyScalar(1 / max);
      // Doygunluğu kısıp beyaza yaklaştır — desen baskın kalsın
      _color.lerp(WHITE, 1 - p.hueStrength);
      this.wingMesh.setColorAt(i, _color);
    }
    if (this.wingMesh.instanceColor) {
      this.wingMesh.instanceColor.needsUpdate = true;
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
    if (this.wingMaterial.map) this.wingMaterial.map.dispose();
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
    const blend = 1 - Math.exp(-fl.modeBlend * dt);
    const followTarget = fl.mode === 'follow' ? 1 : 0;
    const fleeTarget = fl.mode === 'flee' ? 1 : 0;
    const climbSin = Math.sin(fl.maxClimbDeg * THREE.MathUtils.DEG2RAD);
    const turn = 1 - Math.exp(-fl.turnRate * dt);

    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      _pos.fromArray(this.position, i3);
      _vel.fromArray(this.velocity, i3);

      this.followMix[i] += (followTarget - this.followMix[i]) * blend;
      this.fleeMix[i] += (fleeTarget - this.fleeMix[i]) * blend;

      // ── Kuvvetler ──
      _acc.set(0, 0, 0);
      _acc.add(wanderForce(_tmp, this.noiseOffset[i], this.time, fl));

      if (ctx.target) {
        const fm = this.followMix[i];
        if (fm > 1e-3) {
          // Yarıçap kelebek başına saçılmış: sürü kabuk değil bulut olsun
          const radius =
            fl.followRadius *
            (1 - fl.followSpread + 2 * fl.followSpread * this.radiusBias[i]);

          _acc.addScaledVector(
            followForce(_tmp, _pos, ctx.target, radius, fl),
            fm,
          );
          const spin = i % 2 === 0 ? 1 : -1;
          _acc.addScaledVector(
            orbitForce(_tmp, _pos, ctx.target, spin, radius, fl),
            fm,
          );
        }
        const xm = this.fleeMix[i];
        if (xm > 1e-3) {
          _acc.addScaledVector(fleeForce(_tmp, _pos, ctx.target, fl), xm);
        }
      }

      _acc.add(
        viewBoundsForce(_tmp, _pos, ctx.camera, ctx.focusDistance, fl),
      );
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
      _scale.setScalar(this.scale[i]);
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
