import * as THREE from 'three';

/*
 * Aşama 1'de materyaller düz PBR. Aşama 5'te kanat materyaline
 * `onBeforeCompile` ile vertex shader inject edilecek (kanat çırpma +
 * per-instance hue). O yüzden materyaller tek yerden üretiliyor.
 */

export function createWingMaterial(map = null) {
  return new THREE.MeshPhysicalMaterial({
    map,
    side: THREE.DoubleSide,
    roughness: 0.45,
    metalness: 0.0,
    // Kanat pulları: yumuşak, tozlu bir parlaklık.
    // Düşük tutuluyor — yüksek sheen vertex renklerini beyaza doğru yıkıyor.
    sheen: 0.3,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(0xffd7a0),
    // Hafif yanardönerlik — açıya göre renk oynaması
    iridescence: 0.18,
    iridescenceIOR: 1.25,
    iridescenceThicknessRange: [120, 420],
    clearcoat: 0.12,
    clearcoatRoughness: 0.55,
    flatShading: false,
  });
}

export function createBodyMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x2b2118,
    roughness: 0.72,
    metalness: 0.0,
  });
}

export function createEyeMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x0b0906,
    roughness: 0.25,
    metalness: 0.0,
  });
}
