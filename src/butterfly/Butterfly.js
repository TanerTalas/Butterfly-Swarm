import * as THREE from 'three';
import { createButterflyGeometry, WING_DEFAULTS } from './geometry.js';
import { createWingTexture } from './pattern.js';
import {
  createWingMaterial,
  createBodyMaterial,
  createEyeMaterial,
} from './material.js';

/*
 * Tek kelebek — ROADMAP'teki "A yaklaşımı" (ayrı mesh'ler, JS tarafında pivot).
 * Aşama 1-3 boyunca hızlı iterasyon için bu yapı kullanılıyor; Aşama 5'te
 * InstancedMesh + shader'a geçilecek. Geometri konvansiyonu ikisinde de aynı.
 *
 * Kanat hiyerarşisi:
 *   group
 *     └─ pivot (menteşede konumlanır, Z etrafında döner = çırpma)
 *          └─ mesh (geometri menteşesi origin'de; sol tarafta scale.x = -1)
 *
 * Sol kanat aynası: pivot.scale.x = -1 ve pivot.rotation.z = -angle.
 * (Object3D matrisi T·R·S sırasıyla kurulduğu için önce aynalanır sonra
 * döner; işareti çevirmezsek sol kanat aşağı iner.)
 */

export const REST_DEFAULTS = {
  foreRestDeg: 12, // duruş halinde ön kanat yükselmesi
  hindRestDeg: 4, // arka kanat biraz daha düz
  hindLag: 0.0, // Aşama 2'de faz gecikmesi olacak
};

export class Butterfly {
  constructor(options = {}) {
    this.group = new THREE.Group();
    this.params = { ...WING_DEFAULTS, ...REST_DEFAULTS, ...options };

    // Ön ve arka kanadın deseni farklı (siluetleri farklı), o yüzden iki
    // ayrı materyal + iki ayrı texture.
    this.foreMaterial = createWingMaterial();
    this.hindMaterial = createWingMaterial();
    this.bodyMaterial = createBodyMaterial();
    this.eyeMaterial = createEyeMaterial();

    this._disposables = [];
    this._textures = [];
    this.wings = [];
    this.vertexCount = 0;

    this.build();
  }

  build() {
    const g = createButterflyGeometry(this.params);
    this._disposables.push(g.body, g.eyes, g.foreWing, g.hindWing);

    this._setWingTexture(this.foreMaterial, g.shapes.fore);
    this._setWingTexture(this.hindMaterial, g.shapes.hind);

    this.bodyMesh = new THREE.Mesh(g.body, this.bodyMaterial);
    this.eyeMesh = new THREE.Mesh(g.eyes, this.eyeMaterial);
    this.group.add(this.bodyMesh, this.eyeMesh);

    for (const side of [1, -1]) {
      this.wings.push(this._addWing(g.foreWing, g.hinges.fore, side, 'fore'));
      this.wings.push(this._addWing(g.hindWing, g.hinges.hind, side, 'hind'));
    }

    this.vertexCount =
      g.body.attributes.position.count +
      g.eyes.attributes.position.count +
      2 * g.foreWing.attributes.position.count +
      2 * g.hindWing.attributes.position.count;

    this.applyRestPose();
  }

  _setWingTexture(material, shape) {
    if (material.map) material.map.dispose();
    const tex = createWingTexture(shape, { edgeWidth: this.params.edgeWidth });
    material.map = tex;
    material.needsUpdate = true;
    this._textures.push(tex);
  }

  _addWing(geometry, hinge, side, kind) {
    const pivot = new THREE.Object3D();
    pivot.position.set(hinge.x, hinge.y, hinge.z);
    pivot.scale.x = side; // sol taraf ayna

    const material = kind === 'fore' ? this.foreMaterial : this.hindMaterial;
    const mesh = new THREE.Mesh(geometry, material);
    pivot.add(mesh);
    this.group.add(pivot);

    return { pivot, mesh, side, kind };
  }

  /** Kanatları duruş (çırpmayan) pozisyonuna alır. */
  applyRestPose() {
    const fore = THREE.MathUtils.degToRad(this.params.foreRestDeg);
    const hind = THREE.MathUtils.degToRad(this.params.hindRestDeg);
    for (const w of this.wings) {
      const angle = w.kind === 'fore' ? fore : hind;
      w.pivot.rotation.z = w.side * angle;
    }
  }

  /**
   * Aşama 1'de kelebek hareketsiz; bu metod yalnızca duruşu güncel tutuyor.
   * Aşama 2'de flapAngle() buraya bağlanacak.
   */
  update(/* dt, time */) {
    this.applyRestPose();
  }

  setWireframe(on) {
    this.foreMaterial.wireframe = on;
    this.hindMaterial.wireframe = on;
    this.bodyMaterial.wireframe = on;
  }

  /** GUI'den tasarım parametresi değişince geometriyi baştan üretir. */
  rebuild(overrides = {}) {
    Object.assign(this.params, overrides);

    this.group.clear();
    for (const geo of this._disposables) geo.dispose();
    this._disposables.length = 0;
    this._textures.length = 0; // _setWingTexture eskisini zaten dispose ediyor
    this.wings.length = 0;

    this.build();
  }

  dispose() {
    for (const geo of this._disposables) geo.dispose();
    for (const tex of this._textures) tex.dispose();
    this.foreMaterial.dispose();
    this.hindMaterial.dispose();
    this.bodyMaterial.dispose();
    this.eyeMaterial.dispose();
  }
}
