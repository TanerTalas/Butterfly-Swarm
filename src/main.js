import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Swarm, SWARM_DEFAULTS } from './swarm/Swarm.js';
import { WING_DEFAULTS } from './butterfly/geometry.js';
import { FLAP_DEFAULTS } from './butterfly/flap.js';
import { FLIGHT_DEFAULTS } from './flight/steering.js';
import { Pointer } from './input/pointer.js';
import { createPanel } from './ui/panel.js';

// ── Renderer ───────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// ── Sahne ──────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1017);

// RoomEnvironment: dosya bağımlılığı olmadan PBR için yumuşak bir IBL.
// MeshPhysicalMaterial'in sheen/iridescence'ı ancak environment ile anlam kazanıyor.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.05,
  100,
);
camera.position.set(0, 2.2, 9.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.8;
controls.maxDistance = 30;
controls.update();

// ── Işık ───────────────────────────────────────────────────────────────────
// Not: kanat materyali sheen + iridescence taşıyor, bunlar ışığı hızla
// doyuruyor. Işık şiddetleri bilinçli olarak düşük — vertex renkleri
// yıkanmadan görünsün diye.
const hemi = new THREE.HemisphereLight(0xbcd6ff, 0x2b2418, 0.3);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xfff2dd, 1.35);
key.position.set(2.5, 3.5, 2.0);
scene.add(key);

// Rim: kanatları arkadan yalayıp konturu ayıran ışık
const rim = new THREE.DirectionalLight(0x88b4ff, 0.55);
rim.position.set(-2.0, 1.2, -2.5);
scene.add(rim);

const axes = new THREE.AxesHelper(1.2);
axes.visible = false;
scene.add(axes);

// ── Sürü ───────────────────────────────────────────────────────────────────
const flight = { ...FLIGHT_DEFAULTS };
const butterflyParams = {
  ...WING_DEFAULTS,
  ...FLAP_DEFAULTS,
  ...SWARM_DEFAULTS,
};

const swarm = new Swarm({ capacity: 800, params: butterflyParams, flight });
scene.add(swarm.group);

// Uçuş hacmi kameranın görünür alanı; odak mesafesi her karede güncelleniyor
// ki zoom ve pan hacmi kendiliğinden takip etsin.
let focusDistance = camera.position.distanceTo(controls.target);

const pointer = new Pointer(renderer.domElement, camera);

// Mouse hedefini görmek için küçük bir işaretçi
const targetMarker = new THREE.Mesh(
  new THREE.SphereGeometry(0.09, 12, 8),
  new THREE.MeshBasicMaterial({ color: 0x66d9ff, transparent: true, opacity: 0.55 }),
);
targetMarker.visible = false;
scene.add(targetMarker);

// ── Panel ──────────────────────────────────────────────────────────────────
const sceneCtl = {
  autoRotate: false,
  showAxes: false,
  wireframe: false,
  showTarget: false,
  exposure: renderer.toneMappingExposure,
  background: '#0d1017',
  onTarget: (v) => (targetMarker.visible = v),
  onAxes: (v) => (axes.visible = v),
  onWireframe: (v) => {
    swarm.wingMaterial.wireframe = v;
    swarm.bodyMaterial.wireframe = v;
  },
  onExposure: (v) => (renderer.toneMappingExposure = v),
  onBackground: (v) => scene.background.set(v),
};

createPanel({ swarm, flight, scene: sceneCtl });

// ── Döngü ──────────────────────────────────────────────────────────────────
// THREE.Clock deprecated. connect() Page Visibility API'sini bağlıyor:
// arka plandan dönüldüğünde devasa bir dt üretmiyor, yani kelebek
// ışınlanmıyor (ROADMAP Aşama 3 kabul kriteri).
const timer = new THREE.Timer();
timer.connect(document);

const statsEl = document.getElementById('stats');
let statsTimer = 0;
let frames = 0;

function animate() {
  timer.update();
  // Görünürlük dışındaki takılmalara (uzun GC, ağır rebuild) karşı üst sınır
  const dt = Math.min(timer.getDelta(), 0.1);

  controls.autoRotate = sceneCtl.autoRotate;
  controls.update();

  // Sınır kuvveti kamera tabanını okuyor; matris güncel olmalı
  camera.updateMatrixWorld();
  focusDistance = camera.position.distanceTo(controls.target);

  pointer.update(dt, focusDistance);
  targetMarker.position.copy(pointer.world);

  swarm.update(dt, {
    camera,
    focusDistance,
    target: pointer.active ? pointer.world : null,
  });
  renderer.render(scene, camera);

  frames++;
  statsTimer += dt;
  if (statsTimer >= 0.5) {
    const fps = Math.round(frames / statsTimer);
    statsEl.textContent =
      `${butterflyParams.count} kelebek · ` +
      `${renderer.info.render.triangles.toLocaleString('tr')} üçgen · ` +
      `${renderer.info.render.calls} draw call · ${fps} fps · ` +
      `mod ${flight.mode}${pointer.active ? '' : ' (mouse bekleniyor)'}`;
    statsTimer = 0;
    frames = 0;
  }
}
renderer.setAnimationLoop(animate);

// Geliştirme kolaylığı: konsoldan sahneye erişim
window.__app = {
  scene,
  camera,
  controls,
  renderer,
  swarm,
  flight,
  params: butterflyParams,
  pointer,
  sceneCtl,
};

// ── Resize ─────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
