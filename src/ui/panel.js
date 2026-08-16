import GUI from 'lil-gui';
import { WING_DEFAULTS } from '../butterfly/geometry.js';
import { REST_DEFAULTS } from '../butterfly/Butterfly.js';
import { FLAP_DEFAULTS } from '../butterfly/flap.js';

/*
 * Tasarım + animasyon paneli. Amacı kanat siluetini, duruşunu ve çırpmasını
 * canlı ayarlamak. Aşama 6'da davranış parametreleriyle (takip/kaçış hızı,
 * dağınıklık, sayı) genişleyecek.
 */
export function createPanel({ butterfly, scene: sceneCtl }) {
  const gui = new GUI({ title: 'Butterfly Swarm — Aşama 2' });

  const p = butterfly.params;
  const rebuild = () => butterfly.rebuild();
  const repose = () => butterfly.applyRestPose();

  const form = gui.addFolder('Kanat Formu');
  form.add(p, 'foreSpan', 0.6, 1.6, 0.01).name('ön kanat açıklık').onChange(rebuild);
  form.add(p, 'foreChord', 0.6, 1.5, 0.01).name('ön kanat en').onChange(rebuild);
  form.add(p, 'hindSpan', 0.4, 1.4, 0.01).name('arka kanat açıklık').onChange(rebuild);
  form.add(p, 'hindChord', 0.6, 1.5, 0.01).name('arka kanat en').onChange(rebuild);
  form.add(p, 'camber', 0, 0.3, 0.005).name('bombe').onChange(rebuild);
  form.add(p, 'droop', 0, 0.4, 0.005).name('uç sarkması').onChange(rebuild);
  form.add(p, 'edgeWidth', 0, 0.2, 0.005).name('kenar bandı').onChange(rebuild);
  form.add(p, 'tessellation', 0.05, 0.4, 0.01).name('üçgen yoğunluğu').onChange(rebuild);

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
          rebuild();
          gui.controllersRecursive().forEach((c) => c.updateDisplay());
        },
      },
      'reset',
    )
    .name('↺ varsayılanlara dön');

  return gui;
}
