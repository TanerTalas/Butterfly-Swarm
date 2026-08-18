import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createWorld, WORLD, groundHeight } from './index.js';
import { createWorldSwarm, enableSwarmFog, SWARM_BOUNDS } from './swarm.js';
import { Pointer } from '../input/pointer.js';

/*
 * Sahnenin GÖMÜLEBİLİR giriş noktası.
 *
 * `main.js` geliştirme sayfası olarak kalıyor: lil-gui paneli, HUD, sayaçlar.
 * Site o sayfayı kullanamaz — panel bir geliştirici aracı ve DOM'a kendi
 * elemanlarını ekliyor. Burası aynı sahneyi kurar ama arayüzü React'e bırakır.
 *
 * Sözleşme dar tutuldu: bir canvas al, bir `dispose` döndür. React tarafı
 * three.js hakkında hiçbir şey bilmiyor.
 */

/*
 * Kalite profilleri.
 *
 * Mobil hedefte (projefikri.md §14) ve sahne masaüstü için ayarlı: ~960k
 * üçgen, 28 draw call. Telefonda bu ağır. Kısılan şeyler görsel yoğunluk;
 * `residentCount` KISILMIYOR çünkü o bir nüfus kuralı, süs değil — mobilde
 * daha az kelebek göstermek dünyayı farklı bir yer yapar.
 */
export const QUALITY = {
  high: {
    pixelRatio: 2,
    shadows: true,
    shadowMapSize: 2048,
    grassCount: 46000,
    grassRadius: 34,
    treeCount: 84,
    flowerCount: 1400,
  },
  low: {
    pixelRatio: 1.5,
    shadows: false,
    shadowMapSize: 1024,
    grassCount: 12000,
    grassRadius: 20,
    treeCount: 40,
    flowerCount: 500,
  },
};

/** Ekran genişliğinden kalite profili seçer. */
export function pickQuality(width = window.innerWidth) {
  return width < 900 ? 'low' : 'high';
}

/**
 * Sahneyi kurar ve döngüyü başlatır.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {{quality?: 'high'|'low', onReady?: Function}} options
 */
export async function createMeadow(canvas, options = {}) {
  const quality = QUALITY[options.quality ?? pickQuality()];

  /*
   * Kalite ayarları `WORLD` üzerinde uygulanıyor. Sahne modülleri config'i
   * kurulum anında okuyor, o yüzden createWorld'den ÖNCE yazılmalı.
   */
  applyQuality(quality);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.pixelRatio));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.72;

  const scene = new THREE.Scene();

  const cam = WORLD.camera;
  const camera = new THREE.PerspectiveCamera(
    cam.fov,
    canvas.clientWidth / canvas.clientHeight,
    cam.near,
    cam.far,
  );
  camera.position.set(cam.start.x, cam.start.y, cam.start.z);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, cam.targetY, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = cam.minDistance;
  controls.maxDistance = cam.maxDistance;
  controls.maxPolarAngle = cam.maxPolarAngle;
  controls.update();

  const world = await createWorld(renderer, scene);

  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  const { swarm, params: swarmParams, flight } = createWorldSwarm({
    reducedMotion,
  });
  enableSwarmFog(swarm);
  scene.add(swarm.group);

  const pointer = new Pointer(canvas, camera);

  // ── Kamera kilidi ────────────────────────────────────────────────────────
  const flat = new THREE.Vector2();
  function clampCamera() {
    flat.set(controls.target.x, controls.target.z);
    if (flat.length() > cam.targetRadius) {
      flat.setLength(cam.targetRadius);
      controls.target.x = flat.x;
      controls.target.y = groundHeight(flat.x, flat.y) + cam.targetY;
      controls.target.z = flat.y;
    }
    const floor = groundHeight(camera.position.x, camera.position.z) + 0.8;
    if (camera.position.y < floor) camera.position.y = floor;
  }

  // ── Döngü ────────────────────────────────────────────────────────────────
  const timer = new THREE.Timer();
  timer.connect(document);

  renderer.setAnimationLoop(() => {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);

    controls.update();
    clampCamera();
    world.update(timer.getElapsed());

    camera.updateMatrixWorld();
    pointer.update(dt, camera.position.distanceTo(controls.target));

    swarm.update(dt, {
      camera,
      bounds: SWARM_BOUNDS,
      target: pointer.active ? pointer.world : null,
      pointerSpeed: pointer.active ? pointer.speed : 0,
    });

    renderer.render(scene, camera);
  });

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  window.addEventListener('resize', resize);
  resize();

  options.onReady?.();

  return {
    scene,
    camera,
    controls,
    renderer,
    swarm,
    swarmParams,
    flight,
    world,
    dispose() {
      renderer.setAnimationLoop(null);
      window.removeEventListener('resize', resize);
      controls.dispose();
      swarm.dispose();
      renderer.dispose();
    },
  };
}

function applyQuality(q) {
  WORLD.grassField.count = q.grassCount;
  WORLD.grassField.radius = q.grassRadius;
  WORLD.trees.count = q.treeCount;
  WORLD.flowers.count = q.flowerCount;
}
