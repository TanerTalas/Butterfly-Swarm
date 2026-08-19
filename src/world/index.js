import * as THREE from 'three';
import { WORLD } from './config.js';
import { createSky, createLights } from './sky.js';
import { createGround, createMountains, groundHeight } from './terrain.js';
import { createTrees, loadSakuraModels } from './trees.js';
import { createGroundCover } from './groundcover.js';
import { createGrassField, updateGrassField } from './grassField.js';
import { treeExclusions } from './scatter.js';

export { WORLD, groundHeight };

/*
 * Dünyanın tek giriş noktası.
 *
 * `createWorld(renderer, scene)` çağrılır, gerisi içeride. Sürü tarafı
 * dünyanın nasıl kurulduğunu bilmiyor; yalnızca `groundHeight()` ve
 * `WORLD.meadowRadius` gibi birkaç değeri okuyor. Aşama B'de sürü buraya
 * bağlanırken bu sınır korunmalı.
 */
export async function createWorld(renderer, scene, options = {}) {
  const shadows = options.shadows ?? true;

  renderer.shadowMap.enabled = shadows;
  /*
   * PCFSoftShadowMap three tarafından kullanımdan kaldırıldı ve zaten
   * PCFShadowMap'e düşüyordu; doğrudan onu istiyoruz.
   */
  renderer.shadowMap.type = THREE.PCFShadowMap;

  scene.fog = new THREE.FogExp2(WORLD.fog.color, WORLD.fog.density);

  const sky = createSky(renderer, scene);
  const lights = createLights(scene, sky, options.shadowMapSize);

  const ground = createGround();
  scene.add(ground);

  const mountains = createMountains();
  scene.add(mountains);

  // Ağaçlar önce: çimen ve çiçekler gövdelerin içine ekilmesin diye
  // dışlama daireleri onlardan türetiliyor
  const models = await loadSakuraModels();
  const trees = createTrees(models);
  scene.add(trees);

  const avoid = treeExclusions(trees);

  // Çimin tamamı hazır modellerden geliyor (bkz. groundcover.js)
  const grass = createGrassField({ avoid });
  scene.add(grass);

  const cover = await createGroundCover({ ground, avoid });
  scene.add(cover);

  return {
    sky,
    lights,
    ground,
    mountains,
    trees,
    grass,
    cover,
    usingPlaceholderTrees: models.length === 0,
    coverStats: {
      ...cover.userData.stats,
      grass: grass.userData.placed,
      trees: trees.userData.treeCount ?? trees.children.length,
      nearTrees: trees.userData.nearCount ?? 0,
    },

    /** Rüzgârı ilerletir. Sahne döngüsünden her karede çağrılmalı. */
    update(elapsed) {
      updateGrassField(elapsed);
    },

    /** Güneş açısı değişince: gökyüzünü yeniden bake et, ışığı taşı. */
    refreshSun() {
      sky.update();
      lights.update();
    },

    setFog(color, density) {
      scene.fog.color.set(color);
      scene.fog.density = density;
    },
  };
}
