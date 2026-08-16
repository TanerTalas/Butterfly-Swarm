import GUI from 'lil-gui';
import { WING_DEFAULTS } from '../butterfly/geometry.js';
import { REST_DEFAULTS } from '../butterfly/Butterfly.js';
import { FLAP_DEFAULTS } from '../butterfly/flap.js';
import { FLIGHT_DEFAULTS } from '../flight/steering.js';

/*
 * Tasarım + animasyon paneli. Amacı kanat siluetini, duruşunu ve çırpmasını
 * canlı ayarlamak. Aşama 6'da davranış parametreleriyle (takip/kaçış hızı,
 * dağınıklık, sayı) genişleyecek.
 */
export function createPanel({ butterfly, flight, scene: sceneCtl }) {
  const gui = new GUI({ title: 'Butterfly Swarm — Aşama 4' });

  const p = butterfly.params;
  const rebuild = () => butterfly.rebuild();
  const repose = () => butterfly.applyRestPose();

  const mouse = gui.addFolder('Mouse Davranışı');
  mouse
    .add(flight, 'mode', { 'takip et': 'follow', 'kaç': 'flee', 'aldırma': 'ignore' })
    .name('mod');
  mouse.add(flight, 'followSpeed', 0, 20, 0.1).name('takip hızı');
  mouse.add(flight, 'followRadius', 0.1, 6, 0.05).name('takip halkası');
  mouse.add(flight, 'orbitSpeed', 0, 15, 0.1).name('dolanma hızı');
  mouse.add(flight, 'fleeSpeed', 0, 30, 0.1).name('kaçış hızı');
  mouse.add(flight, 'fleeRadius', 0.2, 10, 0.1).name('kaçış yarıçapı');
  mouse.add(flight, 'modeBlend', 0.2, 10, 0.1).name('mod geçiş hızı');
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
  limits.add(flight, 'boundsForce', 0, 40, 0.5).name('geri itme gücü');
  limits.close();

  const form = gui.addFolder('Kanat Formu');
  form.add(p, 'foreSpan', 0.6, 2.2, 0.01).name('ön kanat açıklık').onChange(rebuild);
  form.add(p, 'foreChord', 0.6, 2.0, 0.01).name('ön kanat en').onChange(rebuild);
  form.add(p, 'hindSpan', 0.4, 1.8, 0.01).name('arka kanat açıklık').onChange(rebuild);
  form.add(p, 'hindChord', 0.6, 2.0, 0.01).name('arka kanat en').onChange(rebuild);
  form.add(p, 'camber', 0, 0.3, 0.005).name('bombe').onChange(rebuild);
  form.add(p, 'droop', 0, 0.4, 0.005).name('uç sarkması').onChange(rebuild);
  form.add(p, 'edgeWidth', 0, 0.2, 0.005).name('kenar bandı').onChange(rebuild);
  form.add(p, 'tessellation', 0.05, 0.4, 0.01).name('üçgen yoğunluğu').onChange(rebuild);
  form.close();

  const flap = gui.addFolder('Çırpma');
  flap.add(p, 'flapping').name('çırpsın').onChange(repose);
  flap.add(p, 'flapSpeed', 0.5, 16, 0.1).name('hız (vuruş/sn)');
  flap.add(p, 'flapAmplitude', 0, 1.4, 0.01).name('genlik');
  flap.add(p, 'flapUpDeg', 10, 100, 1).name('tepe açı°');
  flap.add(p, 'flapDownDeg', -60, 30, 1).name('dip açı°');
  flap
    .add(p, 'downstrokeFraction', 0.2, 0.8, 0.01)
    .name('aşağı hamle payı')
    .onChange(() => {}); // 0.5 = simetrik (mekanik), <0.5 = hızlı aşağı vuruş
  flap.add(p, 'twistDeg', 0, 45, 1).name('burulma°');
  flap.add(p, 'hindLag', -0.4, 0.4, 0.01).name('arka kanat gecikme');
  flap.add(p, 'hindAmplitude', 0.2, 1.2, 0.01).name('arka kanat genlik');
  flap.add(p, 'bodyBobDeg', 0, 15, 0.5).name('gövde salınımı°');

  const pose = gui.addFolder('Duruş (çırpma kapalıyken)');
  pose.add(p, 'foreRestDeg', -20, 80, 1).name('ön kanat açı°').onChange(repose);
  pose.add(p, 'hindRestDeg', -20, 80, 1).name('arka kanat açı°').onChange(repose);
  pose.close();

  const view = gui.addFolder('Sahne');
  view.add(sceneCtl, 'autoRotate').name('otomatik döndür');
  view.add(sceneCtl, 'showAxes').name('eksenleri göster').onChange(sceneCtl.onAxes);
  view.add(sceneCtl, 'wireframe').name('tel kafes').onChange(sceneCtl.onWireframe);
  view.add(sceneCtl, 'exposure', 0.3, 2.5, 0.01).name('pozlama').onChange(sceneCtl.onExposure);
  view.addColor(sceneCtl, 'background').name('arka plan').onChange(sceneCtl.onBackground);
  view.close();

  gui
    .add(
      {
        reset: () => {
          Object.assign(p, WING_DEFAULTS, REST_DEFAULTS, FLAP_DEFAULTS);
          Object.assign(flight, FLIGHT_DEFAULTS);
          rebuild();
          gui.controllersRecursive().forEach((c) => c.updateDisplay());
        },
      },
      'reset',
    )
    .name('↺ varsayılanlara dön');

  return gui;
}
