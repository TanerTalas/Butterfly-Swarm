import GUI from 'lil-gui';
import { WING_DEFAULTS } from '../butterfly/geometry.js';
import { DETAIL_DEFAULTS } from '../butterfly/wingDetail.js';
import { FLAP_DEFAULTS } from '../butterfly/flap.js';
import { SWARM_DEFAULTS } from '../swarm/Swarm.js';
import { FLIGHT_DEFAULTS } from '../flight/steering.js';
import { PRESETS, applyPreset } from './presets.js';
import { saveSettings, clearSettings, debounce } from './storage.js';

/*
 * Tasarım + animasyon paneli: kanat siluetini, duruşunu, çırpmasını ve
 * sürünün davranışını (takip/kaçış hızı, dağınıklık, sayı) canlı ayarlar.
 *
 * Yalnızca laboratuvar sayfalarında; uygulama bu paneli hiç kurmuyor.
 */
export function createPanel({ swarm, flight, scene: sceneCtl, onCalm }) {
  const gui = new GUI({ title: 'Butterfly Swarm' });

  const p = swarm.params;
  const rebuild = () => swarm.rebuild();

  const persist = debounce(() => saveSettings(p, flight));
  const refresh = () => gui.controllersRecursive().forEach((c) => c.updateDisplay());

  // Her denetleyici değişiminde kaydet — lil-gui'nin genel onChange'i
  gui.onChange(persist);

  const presets = gui.addFolder('Hazır Ayarlar');
  presets
    .add(
      {
        calm: () => {
          onCalm?.();
          refresh();
          persist();
        },
      },
      'calm',
    )
    .name('Sakin (hareketi azalt)');
  for (const name of Object.keys(PRESETS)) {
    presets
      .add(
        {
          [name]: () => {
            applyPreset(flight, name);
            refresh();
            persist();
          },
        },
        name,
      )
      .name(name);
  }

  // Bu ayarlar geometriyi değiştirmiyor; per-instance dizileri yeniden
  // türetmek yetiyor. Geometri yeniden inşası yalnızca "Kanat Formu" için.
  const variation = () => swarm.applyVariation();
  const hue = () => swarm.applyHue();

  const flock = gui.addFolder('Sürü');
  flock
    .add(p, 'count', 1, swarm.capacity, 1)
    .name('kelebek sayısı')
    .onChange((v) => swarm.setCount(v));
  flock.add(p, 'scale', 0.03, 1.0, 0.005).name('kelebek boyu').onChange(variation);
  flock.add(p, 'sizeVariation', 0, 1, 0.01).name('boy çeşitliliği').onChange(variation);
  flock.add(p, 'hueSpread', 0, 1, 0.01).name('renk çeşitliliği').onChange(hue);
  flock.add(p, 'saturation', 0, 1.6, 0.01).name('renk canlılığı');

  const mouse = gui.addFolder('Mouse Davranışı');
  mouse
    .add(flight, 'mode', { 'takip et': 'follow', 'kaç': 'flee', 'aldırma': 'ignore' })
    .name('mod');
  mouse.add(flight, 'followSpeed', 0, 20, 0.1).name('takip hızı');
  mouse.add(flight, 'followRadius', 0.1, 8, 0.05).name('takip halkası');
  mouse.add(flight, 'followSpread', 0, 1, 0.01).name('halka saçılması');
  mouse.add(flight, 'orbitSpeed', 0, 15, 0.1).name('dolanma hızı');
  mouse.add(flight, 'fleeSpeed', 0, 30, 0.1).name('kaçış hızı');
  mouse.add(flight, 'fleeRadius', 0.2, 10, 0.1).name('kaçış yarıçapı');
  mouse.add(flight, 'modeBlend', 0.2, 10, 0.1).name('mod geçiş hızı');
  mouse.add(flight, 'gust', 0, 1.5, 0.01).name('hava akımı');
  mouse.add(sceneCtl, 'showTarget').name('hedefi göster').onChange(sceneCtl.onTarget);

  const fly = gui.addFolder('Uçuş');
  fly.add(flight, 'flying').name('uçsun');
  fly.add(flight, 'maxSpeed', 0.2, 8, 0.05).name('azami hız');
  fly.add(flight, 'minSpeed', 0, 3, 0.05).name('asgari hız');
  fly.add(flight, 'maxForce', 0.5, 20, 0.1).name('azami kuvvet');
  fly.add(flight, 'wander', 0, 12, 0.1).name('dolanma');
  fly.add(flight, 'scatter', 0, 1, 0.01).name('dağınıklık');
  fly.add(flight, 'verticalBias', 0, 1.5, 0.01).name('dikey dolanma');
  fly.add(flight, 'maxClimbDeg', 5, 75, 1).name('azami tırmanma°');
  fly.add(flight, 'turnRate', 0.5, 20, 0.1).name('dönüş çevikliği');
  fly.add(flight, 'bank', 0, 2, 0.01).name('yatış');
  fly.add(flight, 'maxBankDeg', 0, 85, 1).name('azami yatış°');
  fly.add(flight, 'bob', 0, 0.25, 0.005).name('dikey salınım');

  // Uçuş hacmi kameranın görünür alanı — sabit bir dünya kutusu değil
  const limits = gui.addFolder('Uçuş Hacmi (ekran)');
  limits.add(flight, 'screenFill', 0.3, 1.2, 0.01).name('ekranı doldurma');
  limits.add(flight, 'depthSpread', 0.05, 0.9, 0.01).name('derinlik payı');
  limits.add(flight, 'boundsMargin', 0.05, 0.6, 0.01).name('geri itme payı');
  // Alt sınır bilinçli olarak 0 değil: 0'da hiçbir şey kelebekleri geri
  // çağırmıyor ve sürü ekrandan çıkıp bir daha dönmüyor.
  limits.add(flight, 'boundsForce', 2, 40, 0.5).name('geri itme gücü');
  limits.close();

  // Bu ayarlar geometriyi + atlası yeniden üretiyor; normal map için bir
  // Sobel geçişi de var. Slider SÜRÜKLENİRKEN değil BIRAKILINCA tetiklensin.
  const design = gui.addFolder('Kanat Deseni');
  design.add(p, 'venation').name('damarlar').onFinishChange(rebuild);
  design.add(p, 'discalCell').name('diskal hücre').onFinishChange(rebuild);
  design.add(p, 'cellShading').name('hücre gölgeleme').onFinishChange(rebuild);
  design.add(p, 'scales').name('pul dokusu').onFinishChange(rebuild);
  design.add(p, 'basalDust').name('kök koyulaşması').onFinishChange(rebuild);
  design.add(p, 'submarginal').name('submarjinal bant').onFinishChange(rebuild);
  design.add(p, 'lunules').name('hilaller').onFinishChange(rebuild);
  design.add(p, 'fringe').name('saçak').onFinishChange(rebuild);
  design.add(p, 'ocelli', 0, 6, 1).name('göz lekesi').onFinishChange(rebuild);
  design.add(p, 'relief').name('kabartma').onFinishChange(rebuild);
  design.add(p, 'veinStrength', 0, 1, 0.01).name('damar koyuluğu').onFinishChange(rebuild);
  design.add(p, 'scaleDensity', 0, 2.5, 0.05).name('pul yoğunluğu').onFinishChange(rebuild);
  design.add(p, 'reliefStrength', 0, 8, 0.1).name('kabartma şiddeti').onFinishChange(rebuild);
  design.add(p, 'seed', 1, 60, 1).name('desen tohumu').onFinishChange(rebuild);
  design.close();

  const form = gui.addFolder('Kanat Formu');
  form.add(p, 'foreSpan', 0.6, 2.2, 0.01).name('ön kanat açıklık').onFinishChange(rebuild);
  form.add(p, 'foreChord', 0.6, 2.0, 0.01).name('ön kanat en').onFinishChange(rebuild);
  form.add(p, 'hindSpan', 0.4, 1.8, 0.01).name('arka kanat açıklık').onFinishChange(rebuild);
  form.add(p, 'hindChord', 0.6, 2.0, 0.01).name('arka kanat en').onFinishChange(rebuild);
  form.add(p, 'camber', 0, 0.3, 0.005).name('bombe').onFinishChange(rebuild);
  form.add(p, 'droop', 0, 0.4, 0.005).name('uç sarkması').onFinishChange(rebuild);
  form.add(p, 'edgeWidth', 0, 0.2, 0.005).name('kenar bandı').onFinishChange(rebuild);
  form.add(p, 'tessellation', 0.05, 0.4, 0.01).name('üçgen yoğunluğu').onFinishChange(rebuild);
  form.close();

  const flap = gui.addFolder('Çırpma');
  flap.add(p, 'flapping').name('çırpsın');
  // Hız instance attribute'una yazılı (kelebek başına ±%17 sapmayla)
  flap.add(p, 'flapSpeed', 0.2, 16, 0.1).name('hız (vuruş/sn)').onChange(variation);
  flap.add(p, 'flapAmplitude', 0, 1.4, 0.01).name('genlik');
  flap.add(p, 'flapUpDeg', 10, 100, 1).name('tepe açı°');
  flap.add(p, 'flapDownDeg', -60, 30, 1).name('dip açı°');
  // 0.5 = simetrik (mekanik), <0.5 = hızlı aşağı vuruş
  flap.add(p, 'downstrokeFraction', 0.2, 0.8, 0.01).name('aşağı hamle payı');
  flap.add(p, 'twistDeg', 0, 45, 1).name('burulma°');
  flap.add(p, 'hindLag', -0.4, 0.4, 0.01).name('arka kanat gecikme');
  flap.add(p, 'hindAmplitude', 0.2, 1.2, 0.01).name('arka kanat genlik');
  flap.close();

  const view = gui.addFolder('Sahne');
  view.add(sceneCtl, 'autoRotate').name('otomatik döndür');
  view.add(sceneCtl, 'showAxes').name('eksenleri göster').onChange(sceneCtl.onAxes);
  view.add(sceneCtl, 'wireframe').name('tel kafes').onChange(sceneCtl.onWireframe);
  view.add(sceneCtl, 'exposure', 0.3, 2.5, 0.01).name('pozlama').onChange(sceneCtl.onExposure);
  view.add(sceneCtl, 'fog', 0, 1, 0.01).name('sis');
  view.addColor(sceneCtl, 'fogColor').name('sis rengi').onChange(sceneCtl.onFogColor);
  view.add(sceneCtl, 'rimLight', 0, 5, 0.05).name('arka ışık').onChange(sceneCtl.onRim);
  view.close();

  gui
    .add(
      {
        reset: () => {
          Object.assign(
            p,
            WING_DEFAULTS,
            DETAIL_DEFAULTS,
            FLAP_DEFAULTS,
            SWARM_DEFAULTS,
          );
          Object.assign(flight, FLIGHT_DEFAULTS);
          clearSettings();
          rebuild();
          swarm.setCount(p.count);
          refresh();
        },
      },
      'reset',
    )
    .name('↺ varsayılanlara dön');

  return gui;
}
