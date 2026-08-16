import GUI from 'lil-gui';
import { WING_DEFAULTS } from '../butterfly/geometry.js';
import { REST_DEFAULTS } from '../butterfly/Butterfly.js';

/*
 * Aşama 1 paneli = "wing sculpt" paneli. Amacı kanat siluetini ve duruşunu
 * canlı ayarlayıp tasarımı onaylamak. Aşama 6'da bu panel davranış
 * parametreleriyle (takip/kaçış hızı, dağınıklık, sayı) genişleyecek.
 */
export function createPanel({ butterfly, scene: sceneCtl }) {
  const gui = new GUI({ title: 'Butterfly Swarm — Aşama 1' });

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

  const pose = gui.addFolder('Duruş');
  pose.add(p, 'foreRestDeg', -20, 80, 1).name('ön kanat açı°').onChange(repose);
  pose.add(p, 'hindRestDeg', -20, 80, 1).name('arka kanat açı°').onChange(repose);

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
          Object.assign(p, WING_DEFAULTS, REST_DEFAULTS);
          rebuild();
          gui.controllersRecursive().forEach((c) => c.updateDisplay());
        },
      },
      'reset',
    )
    .name('↺ varsayılanlara dön');

  return gui;
}
