import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import GUI from 'lil-gui';
import { WING_DEFAULTS } from '../butterfly/geometry.js';
import { createStaticButterfly } from './staticButterfly.js';
import { DETAIL_DEFAULTS } from '../butterfly/wingDetail.js';

/*
 * Kanat detay laboratuvarı.
 *
 * Altı varyant yan yana, hepsi hareketsiz ve üstten. Amaç hangi detayın
 * gerçekten fark yarattığını gözle karşılaştırmak; beğenilenler sürünün
 * desenine (butterfly/pattern.js) geri taşınır.
 */

// ── Varyantlar ─────────────────────────────────────────────────────────────
// Her biri bir öncekinin üstüne tek bir fikir ekliyor ki katkı izole görülsün.
const VARIANTS = [
  {
    name: 'Sade',
    note: 'temel: yalnızca gradyan + kenar bandı',
    detail: {
      venation: false,
      discalCell: false,
      cellShading: false,
      scales: false,
      basalDust: false,
      submarginal: false,
      lunules: false,
      fringe: false,
      ocelli: 0,
      relief: false,
    },
  },
  {
    name: 'Damar yapısı',
    note: 'diskal hücre + dallanan damarlar',
    detail: {
      venation: true,
      discalCell: true,
      cellShading: false,
      scales: false,
      basalDust: false,
      submarginal: false,
      lunules: false,
      fringe: false,
      ocelli: 0,
      relief: false,
    },
  },
  {
    name: 'Pul dokusu',
    note: 'yönlü pul taneleri + köke doğru koyulaşma',
    detail: {
      venation: true,
      discalCell: true,
      cellShading: true,
      scales: true,
      basalDust: true,
      submarginal: false,
      lunules: false,
      fringe: false,
      ocelli: 0,
      relief: false,
    },
  },
  {
    name: 'Kenar işleri',
    note: 'submarjinal bant + hilaller + saçak',
    detail: {
      venation: true,
      discalCell: true,
      cellShading: true,
      scales: true,
      basalDust: true,
      submarginal: true,
      lunules: true,
      fringe: true,
      ocelli: 0,
      relief: false,
    },
  },
  {
    name: 'Göz lekesi',
    note: 'ocellus — iç içe halkalar',
    detail: {
      venation: true,
      discalCell: true,
      cellShading: true,
      scales: true,
      basalDust: true,
      submarginal: true,
      lunules: true,
      fringe: true,
      ocelli: 3,
      relief: false,
    },
  },
  {
    name: 'Kabartma',
    note: 'hepsi + damarlardan normal map',
    detail: {
      venation: true,
      discalCell: true,
      cellShading: true,
      scales: true,
      basalDust: true,
      submarginal: true,
      lunules: true,
      fringe: true,
      ocelli: 3,
      relief: true,
    },
  },
];

// ── Sahne ──────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x11151d);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

const camera = new THREE.PerspectiveCamera(
  40,
  window.innerWidth / window.innerHeight,
  0.05,
  200,
);
camera.position.set(0, 15, 0.01);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

scene.add(new THREE.HemisphereLight(0xbcd6ff, 0x2b2418, 0.3));

const key = new THREE.DirectionalLight(0xfff2dd, 1.35);
key.position.set(2.5, 3.5, 2.0);
scene.add(key);

const rim = new THREE.DirectionalLight(0x88b4ff, 0.55);
rim.position.set(-2.0, 1.2, -2.5);
scene.add(rim);

// ── Izgara ─────────────────────────────────────────────────────────────────
const COLS = 3;
const SPACING_X = 4.6;
const SPACING_Z = 4.4;

const wingParams = { ...WING_DEFAULTS };
const shared = {
  ...DETAIL_DEFAULTS,
  lightAngle: 35,
  spin: 0,
};

let built = [];
const labelHost = document.getElementById('labels');

function layoutPosition(i) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return new THREE.Vector3(
    (col - (COLS - 1) / 2) * SPACING_X,
    0,
    (row - (VARIANTS.length / COLS - 1) / 2) * SPACING_Z,
  );
}

function buildAll() {
  for (const b of built) {
    scene.remove(b.butterfly.group);
    b.butterfly.dispose();
    b.label.remove();
  }
  built = [];

  VARIANTS.forEach((variant, i) => {
    const butterfly = createStaticButterfly(wingParams, {
      ...variant.detail,
      // Paylaşılan ayarlar varyantın kendi bayraklarını EZMEZ; yalnızca
      // şiddet/yoğunluk gibi ortak değerler paylaşılıyor
      veinStrength: shared.veinStrength,
      scaleDensity: shared.scaleDensity,
      reliefStrength: shared.reliefStrength,
      seed: shared.seed,
    });

    butterfly.group.position.copy(layoutPosition(i));
    scene.add(butterfly.group);

    const label = document.createElement('div');
    label.className = 'label';
    label.innerHTML = `<b>${i + 1}. ${variant.name}</b><span>${variant.note}</span>`;
    labelHost.appendChild(label);

    built.push({ butterfly, label, variant });
  });
}

buildAll();

// ── Panel ──────────────────────────────────────────────────────────────────
const gui = new GUI({ title: 'Kanat Detay Laboratuvarı' });

const detail = gui.addFolder('Detay şiddeti');
detail.add(shared, 'veinStrength', 0, 1, 0.01).name('damar koyuluğu').onFinishChange(buildAll);
detail.add(shared, 'scaleDensity', 0, 2.5, 0.05).name('pul yoğunluğu').onFinishChange(buildAll);
detail.add(shared, 'reliefStrength', 0, 8, 0.1).name('kabartma').onFinishChange(buildAll);
detail.add(shared, 'seed', 1, 60, 1).name('desen tohumu').onFinishChange(buildAll);

const form = gui.addFolder('Kanat formu');
form.add(wingParams, 'foreSpan', 0.6, 2.2, 0.01).name('ön açıklık').onFinishChange(buildAll);
form.add(wingParams, 'foreChord', 0.6, 2.0, 0.01).name('ön en').onFinishChange(buildAll);
form.add(wingParams, 'edgeWidth', 0.01, 0.2, 0.005).name('kenar bandı').onFinishChange(buildAll);
form.add(wingParams, 'tessellation', 0.04, 0.4, 0.01).name('üçgen yoğunluğu').onFinishChange(buildAll);
form.close();

const view = gui.addFolder('Görünüm');
view.add(shared, 'spin', 0, 1, 0.01).name('yavaş döndür');
view.add(shared, 'lightAngle', 0, 360, 1).name('ışık açısı°');
view.add({ topView: () => { camera.position.set(0, 15, 0.01); controls.target.set(0,0,0); } }, 'topView').name('üstten bak');
view.add({ side: () => { camera.position.set(0, 4.5, 11); controls.target.set(0,0,0); } }, 'side').name('eğik bak');

// ── Döngü ──────────────────────────────────────────────────────────────────
const timer = new THREE.Timer();
timer.connect(document);
const projected = new THREE.Vector3();

function animate() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);

  const a = THREE.MathUtils.degToRad(shared.lightAngle);
  key.position.set(Math.cos(a) * 3.5, 3.5, Math.sin(a) * 3.5);

  if (shared.spin > 0) {
    for (const b of built) b.butterfly.group.rotation.y += dt * shared.spin;
  }

  controls.update();
  renderer.render(scene, camera);

  // Etiketleri kelebeklerin altına yerleştir
  for (const b of built) {
    projected.copy(b.butterfly.group.position);
    projected.z += SPACING_Z * 0.36;
    projected.project(camera);
    const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;
    b.label.style.transform = `translate(-50%, 0) translate(${x}px, ${y}px)`;
    b.label.style.opacity = projected.z < 1 ? '1' : '0';
  }
}
renderer.setAnimationLoop(animate);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.__lab = { scene, camera, controls, renderer, built, shared, wingParams, buildAll };
