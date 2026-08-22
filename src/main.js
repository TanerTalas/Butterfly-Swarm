import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Swarm, SWARM_DEFAULTS } from './swarm/Swarm.js';
import { WING_DEFAULTS } from './butterfly/geometry.js';
import { DETAIL_DEFAULTS } from './butterfly/wingDetail.js';
import { FLAP_DEFAULTS } from './butterfly/flap.js';
import { FLIGHT_DEFAULTS } from './flight/steering.js';
import { Pointer } from './input/pointer.js';
import { loadSettings } from './ui/storage.js';
import { createPanel } from './ui/panel.js';

/*
 * Erişilebilirlik: işletim sistemi "hareketi azalt" diyorsa varsayılanlar
 * sakinleştiriliyor. VARSAYILANLARA uygulanıyor, kayıtlı ayarlara değil —
 * kullanıcı panelden bilinçli bir değer seçtiyse o kazanır.
 */
const reducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)',
).matches;

/**
 * Küçük ekranlarda kelebek sayısı otomatik düşüyor: telefonda yüzlerce
 * kelebek ne ekranı dolduruyor ne de pile değiyor.
 *
 * Genişlik parametre — varsayılanı pencereden geliyor ama test edilebilsin diye.
 */
export function fitCountToScreen(count, width = window.innerWidth) {
  if (width < 560) return Math.round(count * 0.3);
  if (width < 900) return Math.round(count * 0.55);
  return count;
}

// ── Renderer ───────────────────────────────────────────────────────────────
// alpha: arka plan CSS gradyanından geliyor; renderer'ın kendi zemini yok
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setClearAlpha(0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// ── Sahne ──────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();

/*
 * Sis derinlik veriyor: uzaktaki kelebekler soluklaşıp zemine karışıyor,
 * sürü düz bir katman yerine hacim gibi okunuyor.
 *
 * Menzil her karede odak mesafesinden türetiliyor (aşağıda), çünkü uçuş
 * hacmi de kameraya göreli — zoom yapınca sis kendiliğinden uyum sağlamalı.
 */
// Sis rengi CSS gradyanının orta tonuyla eşleşmeli; yoksa uzaktaki
// kelebekler siyaha giderken zemin maviye gidiyor ve derinlik yerine
// "kararma" hissi oluşuyor.
scene.fog = new THREE.Fog(0x151f31, 1, 100);

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

/*
 * Arkadan ışık. Kanat ince bir levha; arkadan aydınlatıldığında kenarları
 * parlıyor ve kelebek zeminden ayrışıyor. Kameranın arkasına DEĞİL, sahnenin
 * arkasına konumlanması gerektiği için her karede kamera yönüne göre
 * güncelleniyor (aşağıda) — yoksa kamerayı çevirince etki kayboluyor.
 */
const rim = new THREE.DirectionalLight(0x9ec4ff, 1.6);
scene.add(rim);
scene.add(rim.target);
const rimOffset = new THREE.Vector3();

const axes = new THREE.AxesHelper(1.2);
axes.visible = false;
scene.add(axes);

// ── Sürü ───────────────────────────────────────────────────────────────────
// Kayıtlı ayarlar varsayılanların üstüne biniyor (yalnızca hâlâ var olan
// anahtarlar — bkz. ui/storage.js)
/**
 * Hareketi sakinleştirir: yavaş uçuş, yumuşak çırpma, daha az kelebek.
 *
 * Ayrı bir fonksiyon olmasının sebebi hem açılışta `prefers-reduced-motion`
 * ile hem de panelden elle çağrılabilmesi — sistem ayarını değiştirmeden
 * sonucu görebilmek ve test edebilmek için.
 */
export function calmMotion(flightObj, paramsObj) {
  flightObj.maxSpeed = FLIGHT_DEFAULTS.maxSpeed * 0.5;
  flightObj.minSpeed = FLIGHT_DEFAULTS.minSpeed * 0.5;
  flightObj.wander = FLIGHT_DEFAULTS.wander * 0.5;
  flightObj.gust = 0;
  paramsObj.flapSpeed = FLAP_DEFAULTS.flapSpeed * 0.45;
  paramsObj.count = Math.max(1, Math.round(paramsObj.count * 0.5));
}

const flightDefaults = { ...FLIGHT_DEFAULTS };
const swarmDefaults = { ...SWARM_DEFAULTS };
swarmDefaults.count = fitCountToScreen(swarmDefaults.count);

const flight = loadSettings(flightDefaults);
const butterflyParams = loadSettings({
  ...WING_DEFAULTS,
  ...DETAIL_DEFAULTS,
  ...FLAP_DEFAULTS,
  ...swarmDefaults,
});

// İşletim sistemi hareketi azaltmak istiyorsa varsayılan olarak sakin başla
if (reducedMotion) calmMotion(flight, butterflyParams);

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
  fog: 0.55, // 0 = sissiz, 1 = yoğun
  fogColor: '#151f31',
  rimLight: rim.intensity,
  onTarget: (v) => (targetMarker.visible = v),
  onFogColor: (v) => scene.fog.color.set(v),
  onRim: (v) => (rim.intensity = v),
  onAxes: (v) => (axes.visible = v),
  onWireframe: (v) => {
    swarm.wingMaterial.wireframe = v;
    swarm.bodyMaterial.wireframe = v;
  },
  onExposure: (v) => (renderer.toneMappingExposure = v),
};

createPanel({
  swarm,
  flight,
  scene: sceneCtl,
  onCalm: () => {
    calmMotion(flight, butterflyParams);
    swarm.setCount(butterflyParams.count);
    swarm.applyVariation();
  },
});

// ── Döngü ──────────────────────────────────────────────────────────────────
// THREE.Clock deprecated. connect() Page Visibility API'sini bağlıyor:
// arka plandan dönüldüğünde devasa bir dt üretmiyor, yani kelebek
// ışınlanmıyor.
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

  // Sis menzili odak mesafesiyle ölçekleniyor; sissiz uçta çok uzağa itilip
  // etkisiz kalıyor, sisli uçta hacmin içine giriyor
  scene.fog.near = focusDistance * (1 - flight.depthSpread * 0.35);
  scene.fog.far =
    focusDistance * (1 + flight.depthSpread * (3.2 - sceneCtl.fog * 2.5));

  // Arka ışık kameranın karşısında dursun ki kanatlar hep kenardan parlasın
  rimOffset.subVectors(controls.target, camera.position).setLength(focusDistance);
  rim.position.copy(controls.target).add(rimOffset);
  rim.position.y += focusDistance * 0.25;
  rim.target.position.copy(controls.target);
  rim.target.updateMatrixWorld();

  pointer.update(dt, focusDistance);
  targetMarker.position.copy(pointer.world);

  swarm.update(dt, {
    camera,
    focusDistance,
    target: pointer.active ? pointer.world : null,
    pointerSpeed: pointer.active ? pointer.speed : 0,
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
  reducedMotion,
  fitCountToScreen,
  calmMotion,
};

// ── Resize ─────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
