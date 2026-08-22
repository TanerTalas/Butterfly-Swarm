import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { WORLD, sunDirection } from './config.js';

/*
 * Gökyüzü — Sky.js (Preetham atmosfer modeli), ama sahneye DOĞRUDAN eklenmiyor.
 *
 * Neden bake ediyoruz:
 *
 * Sky bir dev küp olarak çiziliyor; three'nin kendi örneğinde `scale 450000`
 * ve kamera `far = 2000000`. Bizim dünyamızın en uzak nesnesi 310 birimde
 * (dağlar). Kamerayı gökyüzü uğruna 2 milyona çıkarmak derinlik tamponunun
 * hassasiyetini boşa harcamak olurdu.
 *
 * Güneş sabit olduğu için gökyüzünü bir kez cube map'e çizip:
 *   - `scene.background`  ← keskin cube map
 *   - `scene.environment` ← aynı sahnenin PMREM'i (IBL)
 * olarak kullanmak hem daha ucuz hem de kamerayı serbest bırakıyor.
 *
 * Güneş açısı panelden değişirse `update()` yeniden bake ediyor. Bu ~5 ms
 * sürüyor, yani slider sürüklenirken değil bırakılınca çağrılmalı
 * (`onFinishChange` — projenin geri kalanındaki kural).
 */
export function createSky(renderer, scene) {
  const skyScene = new THREE.Scene();

  const sky = new Sky();
  // Cube kameranın far'ından küçük kalmalı, gerisi önemsiz
  sky.scale.setScalar(10000);
  skyScene.add(sky);

  const cubeRT = new THREE.WebGLCubeRenderTarget(512, {
    type: THREE.HalfFloatType,
  });
  const cubeCamera = new THREE.CubeCamera(1, 20000, cubeRT);

  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;

  /** Işığın geldiği yön (güneşten sahneye doğru değil, sahneden güneşe). */
  const direction = new THREE.Vector3();

  const params = {
    elevation: WORLD.sun.elevation,
    azimuth: WORLD.sun.azimuth,
    ...WORLD.sky,
  };

  function update() {
    sunDirection(params.elevation, params.azimuth, direction);

    const u = sky.material.uniforms;
    u.turbidity.value = params.turbidity;
    u.rayleigh.value = params.rayleigh;
    u.mieCoefficient.value = params.mieCoefficient;
    u.mieDirectionalG.value = params.mieDirectionalG;
    u.sunPosition.value.copy(direction);

    cubeCamera.update(renderer, skyScene);
    scene.background = cubeRT.texture;

    // Eski PMREM'i bırakmazsak her güncellemede bir render target sızdırıyoruz
    envRT?.dispose();
    envRT = pmrem.fromScene(skyScene);
    scene.environment = envRT.texture;
  }

  update();

  return {
    params,
    direction,
    update,
    dispose() {
      envRT?.dispose();
      cubeRT.dispose();
      pmrem.dispose();
      sky.geometry.dispose();
      sky.material.dispose();
    },
  };
}

/*
 * Işıklar.
 *
 * Ortam ışığının neredeyse tamamı gökyüzünün IBL'inden geliyor; buradaki
 * yönlü ışık asıl olarak GÖLGE için var. Bu yüzden şiddeti tek başına
 * bakıldığında düşük görünüyor — environment'ın üstüne biniyor.
 */
export function createLights(scene, skyCtl, shadowMapSize = 1024) {
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.6);
  sun.castShadow = true;

  /*
   * Gölge kamerası çayırı kapsıyor, zeminin tamamını değil. Zemin 420 birim;
   * gölge haritasını 420 birime yaysaydık çayırdaki gölgeler birkaç piksele
   * düşerdi. Uzaktaki zeminin gölgeye ihtiyacı yok — zaten sis içinde.
   */
  const r = WORLD.meadowRadius;
  sun.shadow.camera.left = -r;
  sun.shadow.camera.right = r;
  sun.shadow.camera.top = r;
  sun.shadow.camera.bottom = -r;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = r * 4;
  /*
   * Gölge haritası 2048'den 1024'e indi. Gölgeler alçak güneşte zaten uzun
   * ve yumuşak; çözünürlüğün yarıya inmesi gözle seçilmiyor ama gölge
   * geçişinin maliyeti dörtte bire düşüyor.
   */
  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  // Alçak güneş = çok yatık gölge ışınları = shadow acne. Normal bias yüzeyin
  // normali boyunca kaydırıyor, sabit bias'a göre bu açıda çok daha temiz.
  sun.shadow.normalBias = 0.04;
  sun.shadow.bias = -0.0004;

  scene.add(sun);
  scene.add(sun.target);

  /*
   * Gökyüzü mavisi yukarıdan, çimen yeşili aşağıdan. IBL zaten benzer bir iş
   * yapıyor ama hemisphere ışık gölgede kalan yüzeylerin tamamen ölmesini
   * engelliyor — özellikle ağaç gövdesinin kuzey tarafı.
   */
  const bounce = new THREE.HemisphereLight(0xdfe9ff, 0x4a5a32, 0.45);
  scene.add(bounce);

  function update() {
    // Yön vektörü birim; gölge kamerasının içinde kalacak bir mesafeye taşı
    sun.position.copy(skyCtl.direction).multiplyScalar(WORLD.meadowRadius * 2);
    sun.target.position.set(0, 0, 0);
    sun.target.updateMatrixWorld();
  }

  update();

  return { sun, bounce, update };
}
