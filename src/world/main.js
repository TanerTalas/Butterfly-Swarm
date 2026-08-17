import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';
import { createWorld, WORLD, groundHeight } from './index.js';

/*
 * Sakura çayırı — Aşama A geliştirme sayfası.
 *
 * Burada kelebek YOK. Sahne tek başına güzel olmalı; sürü Aşama B'de
 * bağlanacak (bkz. projefikri.md §13). `index.html`'deki sürü demosuna
 * dokunulmadı, ikisi bağımsız çalışıyor.
 */

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.72;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const cam = WORLD.camera;
const camera = new THREE.PerspectiveCamera(
  cam.fov,
  window.innerWidth / window.innerHeight,
  cam.near,
  cam.far,
);
camera.position.set(cam.start.x, cam.start.y, cam.start.z);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, cam.targetY, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = cam.minDistance;
controls.maxDistance = cam.maxDistance;
controls.maxPolarAngle = cam.maxPolarAngle;
controls.enablePan = true;
controls.update();

const world = await createWorld(renderer, scene);

// ── Kamera kilidi ──────────────────────────────────────────────────────────
/*
 * Kullanıcı çayırdan çıkamamalı (projefikri.md §7). İki ayrı sınır var:
 *
 *  - hedef `targetRadius` içinde kalır → pan ile boş zemine kaçılamıyor
 *  - kamera zeminin altına inemez → tepenin içinden bakılamıyor
 *
 * Hedefi zeminin yüksekliğine oturtmak da önemli: çayır engebeli, sabit
 * y=0 hedefi tepelerde toprağın içinde kalıyor.
 */
const flatTarget = new THREE.Vector2();

function clampCamera() {
  flatTarget.set(controls.target.x, controls.target.z);
  if (flatTarget.length() > cam.targetRadius) {
    flatTarget.setLength(cam.targetRadius);
    controls.target.x = flatTarget.x;
    controls.target.y = groundHeight(flatTarget.x, flatTarget.y) + cam.targetY;
    controls.target.z = flatTarget.y;
  }

  const floor = groundHeight(camera.position.x, camera.position.z) + 0.8;
  if (camera.position.y < floor) camera.position.y = floor;
}

// ── Panel ──────────────────────────────────────────────────────────────────
/*
 * Sayıları kodda tahmin etmeye çalışma, panelden bak — projenin geri
 * kalanındaki kural burada da geçerli.
 *
 * Güneş denetleyicileri `onFinishChange` kullanıyor: her değişimde gökyüzü
 * cube map'e ve PMREM'e yeniden bake ediliyor, bu slider sürüklenirken
 * yapılacak bir iş değil.
 */
const gui = new GUI({ title: 'Sakura Çayırı' });

const sunFolder = gui.addFolder('Güneş');
sunFolder
  .add(world.sky.params, 'elevation', 0.5, 45, 0.1)
  .name('yükseklik')
  .onFinishChange(() => world.refreshSun());
sunFolder
  .add(world.sky.params, 'azimuth', 0, 360, 1)
  .name('azimut')
  .onFinishChange(() => world.refreshSun());
sunFolder
  .add(world.sky.params, 'turbidity', 1, 20, 0.1)
  .name('bulanıklık')
  .onFinishChange(() => world.refreshSun());
sunFolder
  .add(world.sky.params, 'rayleigh', 0, 5, 0.05)
  .name('rayleigh')
  .onFinishChange(() => world.refreshSun());

const atmo = { fogColor: '#e9d3c9', fogDensity: WORLD.fog.density };
const fogFolder = gui.addFolder('Atmosfer');
fogFolder
  .add(renderer, 'toneMappingExposure', 0.2, 2, 0.01)
  .name('pozlama');
fogFolder
  .addColor(atmo, 'fogColor')
  .name('sis rengi')
  .onChange((v) => world.setFog(v, atmo.fogDensity));
fogFolder
  .add(atmo, 'fogDensity', 0, 0.02, 0.0001)
  .name('sis yoğunluğu')
  .onChange((v) => world.setFog(atmo.fogColor, v));

const dbg = { showShadowCamera: false };
const helper = new THREE.CameraHelper(world.lights.sun.shadow.camera);
helper.visible = false;
scene.add(helper);
gui
  .add(dbg, 'showShadowCamera')
  .name('gölge kamerası')
  .onChange((v) => (helper.visible = v));

// ── Döngü ──────────────────────────────────────────────────────────────────
const statsEl = document.getElementById('stats');
let acc = 0;
let frames = 0;

const timer = new THREE.Timer();
timer.connect(document);

renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);

  controls.update();
  clampCamera();
  world.update(timer.getElapsed());

  renderer.render(scene, camera);

  frames++;
  acc += dt;
  if (acc >= 0.5) {
    const cs = world.coverStats;
    statsEl.textContent =
      `${renderer.info.render.triangles.toLocaleString('tr')} üçgen · ` +
      `${renderer.info.render.calls} draw call · ` +
      `${Math.round(frames / acc)} fps · ` +
      `${cs.grass.toLocaleString('tr')} çim · ${cs.instances} çiçek · ${cs.trees} ağaç` +
      (world.usingPlaceholderTrees ? ' · ⚠ yer tutucu ağaçlar' : '') +
      (cs.missing.length ? ` · ⚠ eksik: ${cs.missing.join(', ')}` : '');
    acc = 0;
    frames = 0;
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.__world = { scene, camera, controls, renderer, world, WORLD };
