import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Butterfly } from './butterfly/Butterfly.js';
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
camera.position.set(1.9, 1.15, 2.9);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.05, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.8;
controls.maxDistance = 12;
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

// ── Kelebek ────────────────────────────────────────────────────────────────
const butterfly = new Butterfly();
scene.add(butterfly.group);

// ── Panel ──────────────────────────────────────────────────────────────────
const sceneCtl = {
  autoRotate: true,
  showAxes: false,
  wireframe: false,
  exposure: renderer.toneMappingExposure,
  background: '#0d1017',
  onAxes: (v) => (axes.visible = v),
  onWireframe: (v) => butterfly.setWireframe(v),
  onExposure: (v) => (renderer.toneMappingExposure = v),
  onBackground: (v) => scene.background.set(v),
};

createPanel({ butterfly, scene: sceneCtl });

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

  if (sceneCtl.autoRotate) {
    butterfly.group.rotation.y += dt * 0.35;
  }

  butterfly.update(dt);
  controls.update();
  renderer.render(scene, camera);

  frames++;
  statsTimer += dt;
  if (statsTimer >= 0.5) {
    const fps = Math.round(frames / statsTimer);
    statsEl.textContent =
      `${butterfly.vertexCount} vertex · ` +
      `${renderer.info.render.calls} draw call · ${fps} fps`;
    statsTimer = 0;
    frames = 0;
  }
}
renderer.setAnimationLoop(animate);

// Geliştirme kolaylığı: konsoldan sahneye erişim
window.__app = { scene, camera, controls, renderer, butterfly, sceneCtl };

// ── Resize ─────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
