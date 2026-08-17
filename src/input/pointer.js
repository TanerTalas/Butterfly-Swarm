import * as THREE from 'three';

/*
 * Mouse'u 3B'ye taşıma.
 *
 * ROADMAP 4.1'de iki seçenek vardı; seçilen B: hedef, mouse ışını üzerinde
 * kameradan `focusDistance` kadar uzakta bir nokta. Sabit bir düzleme
 * (seçenek A) ışın atmaktan daha 3B hissi veriyor ve uçuş hacmi de zaten
 * kamera göreli olduğu için ikisi doğal biçimde örtüşüyor.
 *
 * Hedef ayrıca yumuşatılıyor: mouse ani sıçradığında sürü zıplamasın.
 */
export class Pointer {
  constructor(domElement, camera, { smoothing = 12 } = {}) {
    this.camera = camera;
    this.smoothing = smoothing;

    /** Yumuşatılmış dünya hedefi — davranış kuvvetleri bunu okuyor. */
    this.world = new THREE.Vector3();
    /** Mouse hiç hareket etmediyse false; o ana kadar hedef sahne merkezi. */
    this.active = false;
    /** Yumuşatılmış hız (dünya birimi/sn) — hızlı hareket sürüyü dalgalandırıyor. */
    this.speed = 0;

    this._ndc = new THREE.Vector2();
    this._raw = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._prev = new THREE.Vector3();
    this._hasNdc = false;

    this._onMove = (event) => {
      const rect = domElement.getBoundingClientRect();
      this._ndc.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      this._hasNdc = true;
      this.active = true;
    };

    // pointermove hem mouse'u hem dokunmayı kapsıyor
    domElement.addEventListener('pointermove', this._onMove, { passive: true });
    this._domElement = domElement;
  }

  update(dt, focusDistance) {
    if (!this._hasNdc) return;

    // NDC → ışın → kameradan focusDistance kadar uzaktaki nokta
    this._raw.set(this._ndc.x, this._ndc.y, 0.5).unproject(this.camera);
    this._dir.subVectors(this._raw, this.camera.position).normalize();
    this._raw
      .copy(this.camera.position)
      .addScaledVector(this._dir, focusDistance);

    // Kare hızından bağımsız yumuşatma
    this._prev.copy(this.world);
    this.world.lerp(this._raw, 1 - Math.exp(-this.smoothing * dt));

    // Anlık hız gürültülü; yumuşatılmış hâli kullanılıyor
    const instant = dt > 1e-5 ? this._prev.distanceTo(this.world) / dt : 0;
    this.speed += (instant - this.speed) * (1 - Math.exp(-6 * dt));
  }

  dispose() {
    this._domElement.removeEventListener('pointermove', this._onMove);
  }
}
