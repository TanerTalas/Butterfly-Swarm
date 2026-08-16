import * as THREE from 'three';
import {
  wanderForce,
  viewBoundsForce,
  limitLength,
  ensureMinLength,
  limitClimb,
} from './steering.js';

/*
 * Uçan tek ajan: konum, hız, yönelim ve yatış.
 *
 * Görselden tamamen bağımsız — bir Object3D'ye bağlı değil, `applyTo()` ile
 * istediğine yazıyor. Aşama 5'te sürü bu sınıfı kullanmayacak (orada veri
 * düz Float32Array'lerde tutulacak) ama aynı matematiği taşıyacak.
 *
 * Yönelim konvansiyonu: +Z burun. Yani yönelim matrisinin Z sütunu hız
 * yönüne bakıyor (bkz. CLAUDE.md).
 */

const WORLD_UP = new THREE.Vector3(0, 1, 0);
// Hız neredeyse dik olduğunda WORLD_UP ile taban çöküyor; o an bunu kullan
const FALLBACK_UP = new THREE.Vector3(0, 0, 1);
const FORWARD = new THREE.Vector3(0, 0, 1);

export class Flier {
  constructor({ id = 0, params, position } = {}) {
    this.id = id;
    this.params = params;
    this.time = 0;

    this.position = position ? position.clone() : new THREE.Vector3();
    this.velocity = new THREE.Vector3(0, 0, 0.4);
    this.acceleration = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();

    // Kare başına ayırma yapmamak için yeniden kullanılan geçiciler
    this._acc = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._f = new THREE.Vector3();
    this._r = new THREE.Vector3();
    this._u = new THREE.Vector3();
    this._basis = new THREE.Matrix4();
    this._target = new THREE.Quaternion();
    this._roll = new THREE.Quaternion();
  }

  /**
   * @param {THREE.Camera} camera Uçuş hacmi kameranın görünür alanı; sınır
   *   kuvveti bunu okuyor.
   * @param {number} focusDistance Kameradan yörünge merkezine uzaklık.
   */
  update(dt, camera, focusDistance) {
    if (!this.params.flying) return;

    this.time += dt;
    const p = this.params;

    const acc = this._acc.set(0, 0, 0);
    acc.add(wanderForce(this._tmp, this.id, this.time, p));
    acc.add(
      viewBoundsForce(this._tmp, this.position, camera, focusDistance, p),
    );
    limitLength(acc, p.maxForce);

    this.velocity.addScaledVector(acc, dt);
    limitLength(this.velocity, p.maxSpeed);
    ensureMinLength(this.velocity, p.minSpeed, FORWARD);
    limitClimb(this.velocity, Math.sin(p.maxClimbDeg * THREE.MathUtils.DEG2RAD));
    this.position.addScaledVector(this.velocity, dt);

    this._updateOrientation(acc, dt);
    this.acceleration.copy(acc);
  }

  _updateOrientation(acc, dt) {
    const speed = this.velocity.length();
    if (speed < 1e-4) return;

    const p = this.params;
    const f = this._f.copy(this.velocity).divideScalar(speed);

    // Dik uçuşta yukarı vektörü hız yönüyle çakışıyor, çapraz çarpım sıfırlanıyor
    const up = Math.abs(f.y) > 0.985 ? FALLBACK_UP : WORLD_UP;

    const r = this._r.crossVectors(up, f).normalize();
    const u = this._u.crossVectors(f, r);
    this._basis.makeBasis(r, u, f);
    this._target.setFromRotationMatrix(this._basis);

    // Bank (yatış): dönüşte içeriye yat. Yanal ivme ne kadar büyükse o kadar.
    // Bu olmadan uçuş "sinek" gibi görünüyor — kelebek yapan detay bu.
    const lateral = acc.dot(r);
    const maxBank = p.maxBankDeg * THREE.MathUtils.DEG2RAD;
    const bank = THREE.MathUtils.clamp(-lateral * p.bank, -maxBank, maxBank);
    this._roll.setFromAxisAngle(FORWARD, bank);
    this._target.multiply(this._roll);

    // Kare hızından bağımsız yumuşatma: dt ne olursa olsun aynı yarı ömür.
    // Düz `slerp(target, k)` yüksek FPS'te daha hızlı dönerdi.
    this.quaternion.slerp(this._target, 1 - Math.exp(-p.turnRate * dt));
  }

  /** Durumu bir Object3D'ye yazar. `bob` dünya Y'sinde küçük bir kaydırma. */
  applyTo(object3d, bob = 0) {
    object3d.position.copy(this.position);
    object3d.position.y += bob;
    object3d.quaternion.copy(this.quaternion);
  }
}
