import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createWorld, WORLD, groundHeight } from './index.js';
import {
  createWorldSwarm,
  enableSwarmFog,
  butterflyPosition,
  SWARM_BOUNDS,
} from './swarm.js';
import { createVisitors } from './visitors.js';
import { createFollowCam } from './follow.js';

/*
 * Sahnenin TEK giriş noktası.
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

  /*
   * Kullanıcının kelebekleri. Yerleşiklerin bittiği yerden başlayan
   * havuzu yönetiyor ve `id → instance` eşlemesini tutuyor.
   */
  const visitors = createVisitors(swarm);

  /*
   * İMLEÇ TAKİBİ YOK — bilerek, ve kodu da yok.
   *
   * Çayırdaki kelebekler fareyi ne takip ediyor ne de ondan kaçıyor; her
   * zaman kendi hâllerinde uçuyorlar.
   *
   * Sebep sahnenin rolü. Burası oynanacak bir demo değil, arayüzün arkasında
   * duran bir manzara; kullanıcı imleci kart okumak veya düğmeye basmak için
   * gezdiriyor ve sürünün her fare hareketinde toplanıp dağılması sahneyi
   * huzurlu bir bahçeden imlece tepki veren bir oyuncağa çeviriyordu.
   *
   * Bir zamanlar bağlantı yalnızca buradan sökülmüş, `Pointer` sınıfı ve
   * takip/kaçış kuvvetleri laboratuvar sayfaları için durmuştu; o sayfalar
   * da gidince kod tamamen silindi. Yan fayda: her karedeki ışın izleme ve
   * canvas dinleyicileri de gitti (dispose'da zaten temizlenmiyorlardı).
   */

  // ── Takip kamerası ───────────────────────────────────────────────────────
  const _followPos = new THREE.Vector3();
  const follow = createFollowCam({
    camera,
    controls,
    minDistance: cam.minDistance,
    /*
     * Konum her karede İNDEKSTEN DEĞİL KİMLİKTEN soruluyor: bir kelebek
     * çayırdan ayrıldığında sondaki onun yuvasına taşınıyor ve saklanmış bir
     * indeks sessizce başka bir kelebeği göstermeye başlardı.
     */
    positionOf(id) {
      const i = visitors.at(id);
      return i < 0 ? null : butterflyPosition(swarm, i, _followPos);
    },
  });

  // ── Kamera kilidi ────────────────────────────────────────────────────────

  /*
   * Ağaç gövdeleri — kameranın içine giremeyeceği daireler.
   *
   * `createTrees` bu daireleri zaten üretiyor (çim ve çiçekler gövdelerin
   * içine ekilmesin diye); kamera aynı listeyi okuyor, yani ağaç yerleşimi
   * değişince kaçınma kendiliğinden uyuyor.
   *
   * Neden gerekiyor: kamera koruda BAŞLIYOR (yarıçap 15.5) ve `cameraClearance`
   * yalnızca o TEK noktanın çevresini boşaltıyor. Kullanıcı sahneyi
   * döndürdüğünde ya da takip kamerası kelebeğin peşinden avlunun kenarına
   * gittiğinde aynı yarıçapta ağaç dolu — kare gövdenin içinden çekiliyordu.
   */
  const trunks = world.trees.userData.exclusions ?? [];

  /*
   * Yalnızca GÖVDE yüksekliğinde uygulanıyor.
   *
   * Ağaç 7 birim ve dalların kadraja girmesi İSTENEN bir şey (bkz.
   * `trees.framing`). Kaçınma bütün ağaç boyuna uygulansaydı kamera koruya
   * hiç giremez, açılış görüntüsünün çerçevesi kaybolurdu. Bu yükseklik
   * gövdenin bittiği, tacın başladığı yer.
   */
  const TRUNK_TOP = 3.2;

  /*
   * Yarıçap payı. Kaçınma dairesi kabuğun kendisi; kamera tam yüzeye
   * oturursa near düzlemi (0.1) gövdenin içinde kalıyor ve kabuk yine
   * ekranı kaplıyor.
   */
  const TRUNK_MARGIN = 0.4;

  const flat = new THREE.Vector2();
  /**
   * @param {boolean} following Takip sürerken hedef sınırı UYGULANMIYOR —
   *   kelebek avlunun kenarına kadar gidiyor, `targetRadius` ise 5 birimlik
   *   bir disk; ikisi birden çalışınca kamera sınırda titriyor. Zemin
   *   sınırı her hâlükârda geçerli.
   */
  function clampCamera(following) {
    if (!following) {
      flat.set(controls.target.x, controls.target.z);
      if (flat.length() > cam.targetRadius) {
        flat.setLength(cam.targetRadius);
        controls.target.x = flat.x;
        controls.target.y = groundHeight(flat.x, flat.y) + cam.targetY;
        controls.target.z = flat.y;
      }
    }
    const floor = groundHeight(camera.position.x, camera.position.z) + 0.8;
    if (camera.position.y < floor) camera.position.y = floor;

    pushOutOfTrunks();
  }

  /**
   * Kamerayı girdiği gövdenin dışına iter.
   *
   * Hedef DEĞİL yalnızca kamera taşınıyor — `OrbitControls` ofseti her karede
   * kamera konumundan yeniden türettiği için bu, yörüngeyi biraz kaydırmak
   * demek; zemin kilidi de aynı şeyi yapıyor. Hedefi de taşımak kullanıcının
   * baktığı yeri kaydırırdı ve baktığı yerin ağaçla ilgisi yok.
   *
   * İki geçiş: bir gövdeden itilen kamera komşusunun içine düşebiliyor.
   * Üçüncü bir geçişin ölçülebilir bir karşılığı olmadı — halkada üç gövdenin
   * birden örtüştüğü bir yer yok.
   */
  function pushOutOfTrunks() {
    const p = camera.position;
    if (p.y > groundHeight(p.x, p.z) + TRUNK_TOP) return;

    for (let pass = 0; pass < 2; pass++) {
      let moved = false;

      for (const t of trunks) {
        const limit = t.r + TRUNK_MARGIN;
        let dx = p.x - t.x;
        let dz = p.z - t.z;
        const d2 = dx * dx + dz * dz;
        if (d2 >= limit * limit) continue;

        /*
         * Tam merkezde bir yön yok. Böyle bir karede kamerayı hedeften
         * UZAĞA itiyoruz: hedefe doğru itmek onu bakılan şeyin içinden
         * geçirirdi.
         */
        let d = Math.sqrt(d2);
        if (d < 1e-4) {
          dx = t.x - controls.target.x;
          dz = t.z - controls.target.z;
          d = Math.hypot(dx, dz) || 1;
        }

        p.x = t.x + (dx / d) * limit;
        p.z = t.z + (dz / d) * limit;
        moved = true;
      }

      if (!moved) break;
    }
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

    /*
     * Takip, `controls.update()`ten ÖNCE: kamerayı ve hedefi aynı vektörle
     * kaydırıyor, `OrbitControls` de ofseti o yeni konumdan türetiyor.
     * Sonra çalıştırılsaydı yörünge kaydırmayı bir sonraki karede geri alırdı.
     */
    const following = follow.update(dt);

    controls.update();
    clampCamera(following);
    world.update(timer.getElapsed());

    /*
     * Ziyaretçilerin kalan ömrü — solmayı besleyen tek yer.
     *
     * `swarm.update()`ten ÖNCE: boy çarpanı instance matrisi kurulurken
     * okunuyor, sonra yazılsaydı ekrandaki her kare bir kare geriden
     * gelirdi.
     */
    visitors.update();

    camera.updateMatrixWorld();

    // target/pointerSpeed verilmiyor: `Swarm.update` ikisini de opsiyonel
    // okuyor, yoksa takip/kaçış kuvvetleri hiç devreye girmiyor
    swarm.update(dt, { camera, bounds: SWARM_BOUNDS });

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
      controls,
      renderer,
      swarm,
      // Ziyaretçi havuzu ve takip kamerası — konsoldan salıp izleyebilmek için
      visitors,
      follow,
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
    /*
     * ── Arayüzün gördüğü yüz ────────────────────────────────────────────
     *
     * React tarafı YALNIZCA bunları çağırıyor; `swarm`a hiç dokunmuyor.
     * Sahne motorunun React'ten habersiz kalması bilinçli bir karar ve tek
     * koruması bu dar yüzey — bileşenler instance indeksleriyle uğraşmaya
     * başlarsa motorun içi bir daha değiştirilemez.
     */

    /** Kelebeği çayıra salar. Havuz doluysa -1. */
    release: visitors.release,
    /** Kelebeği çayırdan kaldırır. */
    remove: visitors.remove,
    /** Bütün ziyaretçileri kaldırır — çıkış, hesap silme. */
    clearVisitors: visitors.clear,
    /** Kelebeğin şu anki instance indeksi. */
    indexOf: visitors.at,

    /** Kamerayı bu kelebeğe taşır. Kelebek çayırda değilse `false`. */
    watch: follow.watch,
    /** İzlemeyi bırakır; kamera kullanıcının bıraktığı görüşe dönüyor. */
    stopWatching: follow.stop,

    // ── Teşhisin kullandığı iç parçalar (`window.__meadow`) ──────────────
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
