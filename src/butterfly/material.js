import * as THREE from 'three';

/*
 * Materyaller TEK YERDEN üretiliyor.
 *
 * Sebebi enjeksiyon: sürü, buradan aldığı kanat materyaline `onBeforeCompile`
 * ile shader ekliyor (çırpma + instance başına renk + solma). Materyal
 * dağınık üretilseydi hangi kopyanın enjekte edildiğini izlemek imkânsız
 * olurdu — ve o enjeksiyon materyal ömrü boyunca YALNIZCA BİR KEZ yapılabilir
 * (bkz. `swarm/wingShader.js`).
 */

export function createWingMaterial(map = null) {
  return new THREE.MeshPhysicalMaterial({
    map,
    side: THREE.DoubleSide,
    roughness: 0.6,
    metalness: 0.0,

    // KRİTİK: speküler şiddeti düşük tutulmalı.
    //
    // Varsayılan specularIntensity = 1 ile Fresnel, yüzeye profilden
    // bakıldığında yansımayı %100'e çıkarıyor. Kanat ince bir levha olduğu
    // için uçuş sırasında sürekli profile yaklaşıyor ve o anlarda çevreyi
    // yansıtan beyaz bir aynaya dönüşüyordu: koyu kenar bandı bile açık
    // griye kalkıp kanat "yarı saydam" görünüyordu. Fiziksel olarak doğru
    // ama kelebek kanadı pullu ve mat — bu kadar yansıtıcı değil.
    specularIntensity: 0.22,

    // Kanat pulları: yumuşak, tozlu bir parlaklık.
    sheen: 0.15,
    sheenRoughness: 0.85,
    sheenColor: new THREE.Color(0xffd7a0),

    // Hafif yanardönerlik — açıya göre renk oynaması
    iridescence: 0.07,
    iridescenceIOR: 1.25,
    iridescenceThicknessRange: [120, 420],

    // clearcoat KULLANILMIYOR: ikinci bir Fresnel katmanı ve yukarıdaki
    // yıkanma sorununu aynen geri getiriyor.
    clearcoat: 0,

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
