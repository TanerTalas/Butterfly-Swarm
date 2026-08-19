import * as THREE from 'three';
import { Swarm, SWARM_DEFAULTS } from '../swarm/Swarm.js';
import { WING_DEFAULTS } from '../butterfly/geometry.js';
import { DETAIL_DEFAULTS } from '../butterfly/wingDetail.js';
import { FLAP_DEFAULTS } from '../butterfly/flap.js';
import { FLIGHT_DEFAULTS } from '../flight/steering.js';
import { hueShiftFromColor } from './swarm.js';

/*
 * Tek kelebek önizlemesi — salınmadan önceki hâli.
 *
 * Bu bir illüstrasyon DEĞİL. Çayırdaki sürüyle aynı geometriyi, aynı desen
 * atlasını, aynı materyali ve aynı çırpma shader'ını kullanıyor. Kullanıcı
 * "Preview" dediğinde gerçekten salacağı nesneyi görüyor; SVG ile çizilmiş
 * bir yaklaşımı değil.
 *
 * Bunun için yeni bir boru hattı yazmaya gerek yoktu: `Swarm` sınıfı
 * kapasite 1 ile kurulup uçuş kapatılıyor.
 *
 * `flight.flying = false` olduğunda `Swarm.update()` yalnızca çırpma
 * uniform'larını güncelleyip çıkıyor — instance matrisine hiç dokunmuyor.
 * Yani kelebek orijinde duruyor ve sadece kanat çırpıyor. Tam istenen şey;
 * uçuş mantığını devre dışı bırakmak için ayrıca bir bayrak eklemek
 * gerekmedi.
 */

export async function createButterflyPreview(canvas, options = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true, // arka plan React tarafındaki bulanık çayır olsun
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearAlpha(0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  const scene = new THREE.Scene();

  /*
   * Işık düzeni çayırdan bağımsız ve bilinçli olarak daha nötr: burada amaç
   * kelebeği TANITMAK, bir atmosfer kurmak değil. Alçak sıcak güneş
   * altındaki hâli çayırda görülecek.
   */
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a5a52, 0.85));
  const key = new THREE.DirectionalLight(0xfff4e6, 1.6);
  key.position.set(2, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbcd6ff, 1.1);
  rim.position.set(-3, 1, -3);
  scene.add(rim);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 100);

  const params = {
    ...WING_DEFAULTS,
    ...DETAIL_DEFAULTS,
    ...FLAP_DEFAULTS,
    ...SWARM_DEFAULTS,
    count: 1,
    scale: 1,
    sizeVariation: 0,
    hueSpread: 0,
    /*
     * Çırpma yavaş: önizlemede kanadın formu okunmalı. Çayırdaki hız
     * uzaktan doğru görünüyor ama yakın planda bulanık bir titremeye
     * dönüşüyor.
     */
    flapSpeed: FLAP_DEFAULTS.flapSpeed * 0.45,
  };

  const flight = { ...FLIGHT_DEFAULTS, flying: false };

  const swarm = new Swarm({ capacity: 1, params, flight });
  swarm.setCount(1);

  /*
   * DURUŞ. İki katmanlı, çünkü iki farklı dönüşe ihtiyaç var.
   *
   * Kelebek konvansiyonu: +Z burun, +Y yukarı, ±X kanat açıklığı. Kamera
   * +Z'de durduğu için ilk hâlinde kelebeğe ÖNDEN, burnundan bakılıyordu ve
   * açık kanatlar görünmüyordu.
   *
   * ⚠ Tek başına `rotation.x = +PI/2` YETMİYOR, çünkü aynı anda iki şey
   * istiyoruz: sırt kameraya dönsün VE baş yukarı baksın. X ekseni etrafında
   * +90° sırtı kameraya çeviriyor (+Y → +Z) ama burnu AŞAĞI indiriyor
   * (+Z → −Y) — kelebek baş aşağı duruyordu.
   *
   * İkisini birden veren dönüş: önce Z ekseninde 180°, sonra X ekseninde
   * −90°. Sonuç +Z (burun) → +Y (yukarı), +Y (sırt) → +Z (kameraya).
   * three Euler'i 'XYZ' sırasında RX·RY·RZ olarak kuruyor, yani vektöre
   * önce RZ uygulanıyor — istediğimiz sıra bu.
   *
   * Yan etki: ±X kanat ekseni de aynalanıyor. Kelebek iki yana simetrik
   * olduğu için görsel bir karşılığı yok.
   *
   * 0.3'lük pay kelebeği tam düz bir armadan kurtarıp hacim veriyor; başı
   * hafifçe izleyiciye doğru yatırıyor.
   *
   * Salınım DIŞ grupta: iç grup zaten yatırılmış olduğu için onun kendi
   * ekseninde döndürmek kelebeği yalpalatıyordu.
   */
  const tilt = new THREE.Group();
  tilt.rotation.set(-Math.PI / 2 + 0.3, 0, Math.PI);
  tilt.add(swarm.group);

  const sway = new THREE.Group();
  sway.add(tilt);
  scene.add(sway);

  setColours(swarm, options.fore, options.hind);

  /*
   * Kameranın uzaklığı geometrinin gerçek sınır kutusundan hesaplanıyor.
   * Elle bir mesafe yazmak kırılgan: kanat formu panelden değiştirilebiliyor
   * ve açıklık değişince kelebek kadraja sığmıyor ya da küçük kalıyor.
   */
  frameSubject(swarm, camera);

  const timer = new THREE.Timer();
  timer.connect(document);

  renderer.setAnimationLoop(() => {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);

    /*
     * Tam tur DÖNMÜYOR, salınıyor.
     *
     * Sürekli dönüş denendi ve kötüydü: kelebek her turda bir kez tam yandan
     * görünüyor, o anda ince bir dilime iniyor ve önizleme "bozuk" gibi
     * duruyor. ±25 derecelik salınım hacmi gösteriyor ama siluet hiç
     * kaybolmuyor.
     */
    sway.rotation.y = Math.sin(timer.getElapsed() * 0.55) * 0.44;

    swarm.update(dt, { camera });
    renderer.render(scene, camera);
  });

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  window.addEventListener('resize', resize);
  resize();

  return {
    /** Renkleri canlı değiştirir — kullanıcı seçerken önizleme takip ediyor. */
    setColours(fore, hind) {
      setColours(swarm, fore, hind);
    },
    dispose() {
      renderer.setAnimationLoop(null);
      window.removeEventListener('resize', resize);
      swarm.dispose();
      renderer.dispose();
    },
  };
}

function setColours(swarm, fore, hind) {
  swarm.setWingHues(
    0,
    hueShiftFromColor(hexToInt(fore)),
    hueShiftFromColor(hexToInt(hind ?? fore)),
  );
}

/** '#17B3A3' -> 0x17b3a3 */
function hexToInt(hex) {
  return parseInt(String(hex).replace('#', ''), 16);
}

/**
 * Kelebeği kadraja oturtur.
 *
 * Sınır kutusu kanat AÇIK haldeki geometriden alınıyor; çırpma sırasında
 * kanatlar kapanıp açıldığı için en geniş hâl referans olmalı, yoksa kelebek
 * her kanat vuruşunda kadrajı taşıyor.
 */
function frameSubject(swarm, camera) {
  const box = new THREE.Box3();
  for (const geometry of swarm._geometries) {
    geometry.computeBoundingBox();
    box.union(geometry.boundingBox);
  }

  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.5;
  const fov = camera.fov * THREE.MathUtils.DEG2RAD;
  const distance = (radius / Math.sin(fov * 0.5)) * 1.05;

  camera.position.set(0, 0, distance);
  camera.lookAt(0, 0, 0);
}
