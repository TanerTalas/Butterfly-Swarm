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
    /*
     * 1'de sabit, cihazın oranını takip ETMİYOR.
     *
     * Doldurma maliyeti piksel sayısıyla doğrusal: 1.25 oran, %56 daha fazla
     * piksel demek. Bu sahnede çim ve yaprak kartları alfa kesmeli, yani
     * üst üste binen katmanlar defalarca boyanıyor — tümleşik grafik
     * kartında darboğaz burası. Arka planda duran bir manzarada 1 ile 1.25
     * arasındaki fark gözle seçilmiyor.
     */
    pixelRatio: 1,
    shadows: true,
    shadowMapSize: 1024,
    grassCount: 34000,
    grassRadius: 32,
    treeCount: 64,
    flowerCount: 1100,
    /*
     * Sahne 30 kare/saniyede çiziliyor, 60'ta değil.
     *
     * Bunun tek sebebi arayüz. Çayır ekranın tamamını kaplıyor ve her kare
     * tarayıcının çizim bütçesinden yiyor; 60'ta çizildiğinde hover ve
     * tıklama gibi tepkiler sahnenin arkasında kuyruğa giriyordu. 30'a
     * inince yarı bütçe arayüze kalıyor.
     *
     * Görsel bedeli düşük: kelebekler yavaş, çim rüzgârda salınıyor, kamera
     * duruyor. Hızlı hareket eden hiçbir şey yok.
     */
    fps: 30,
  },
  low: {
    pixelRatio: 1,
    shadows: false,
    shadowMapSize: 1024,
    grassCount: 12000,
    grassRadius: 20,
    treeCount: 40,
    flowerCount: 500,
    fps: 30,
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

  const world = await createWorld(renderer, scene, {
    shadows: quality.shadows,
    shadowMapSize: quality.shadowMapSize,
  });

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

  /*
   * Kare sınırı.
   *
   * Tarayıcı 60 kez/saniye çağırıyor; biz yalnızca hedef aralığa ulaşınca
   * çalışıyoruz. Atlanan karelerde HİÇBİR ŞEY yapılmıyor — ne fizik ne
   * çizim — yani hem GPU hem CPU boşta kalıyor ve arayüzün tepkilerine
   * yer açılıyor.
   */
  const stepMs = 1000 / (quality.fps ?? 60);
  let lastRender = 0;

  renderer.setAnimationLoop((time) => {
    /*
     * Kapı DUVAR SAATİNE bakıyor, `THREE.Timer`a değil.
     *
     * Timer, Page Visibility API'sine bağlı ve sekme gizlenince duruyor;
     * ona bakan bir kare sınırı, biriken süre hiç artmadığı için sahneyi
     * tamamen durduruyordu. rAF'ın kendi zaman damgası bu bağımlılığı
     * ortadan kaldırıyor.
     */
    if (time - lastRender < stepMs) return;
    lastRender = time;

    /*
     * `timer.update()` yalnızca ÇİZİLEN karelerde çağrılıyor, dolayısıyla
     * `getDelta()` iki çizim arasındaki gerçek süreyi veriyor — atlanan
     * kareler dahil. Hareket hızı bu yüzden kare sınırından etkilenmiyor:
     * 30'da da 60'ta da kelebek aynı hızda uçuyor.
     */
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

  /*
   * Teşhis kancası. Sahne performansını tarayıcı konsolundan ölçebilmek
   * için; `renderer.info` üçgen ve draw call sayısını, elle bir render
   * çağrısı da kare maliyetini veriyor.
   *
   * Sekme arka plandayken `requestAnimationFrame` boğulduğu için normal
   * fps ölçümü yanıltıcı oluyor — bu kanca senkron ölçüme izin veriyor.
   */
  if (process.env.NODE_ENV !== 'production') {
    window.__meadow = {
      scene,
      camera,
      renderer,
      swarm,
      /** Bir kareyi elle çizip süresini döndürür (ms). */
      timeFrame(samples = 20) {
        const times = [];
        for (let i = 0; i < samples; i++) {
          const t0 = performance.now();
          renderer.render(scene, camera);
          times.push(performance.now() - t0);
        }
        times.sort((a, b) => a - b);
        return {
          medyan: +times[Math.floor(times.length / 2)].toFixed(2),
          enIyi: +times[0].toFixed(2),
          enKotu: +times[times.length - 1].toFixed(2),
          ucgen: renderer.info.render.triangles,
          drawCall: renderer.info.render.calls,
        };
      },
      /**
       * Döngünün GERÇEKTEN kaç kare çizdiğini sayar.
       *
       * `timeFrame` tek bir karenin maliyetini veriyor; bu ise kare
       * sınırının işleyip işlemediğini gösteriyor. Sekme ÖNDE olmalı —
       * arka planda tarayıcı `requestAnimationFrame`i tamamen durduruyor
       * ve sonuç 0 çıkıyor.
       */
      async measureFps(seconds = 3) {
        if (document.hidden) {
          return { hata: 'sekme arka planda, ölçüm anlamsız' };
        }
        const before = renderer.info.render.frame;
        const t0 = performance.now();
        await new Promise((r) => setTimeout(r, seconds * 1000));
        const gecen = (performance.now() - t0) / 1000;
        return {
          fps: +((renderer.info.render.frame - before) / gecen).toFixed(1),
          hedef: quality.fps ?? 60,
        };
      },
    };
  }

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
