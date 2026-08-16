import * as THREE from 'three';
import { createButterflyGeometry } from '../butterfly/geometry.js';
import {
  createWingMaterial,
  createBodyMaterial,
  createEyeMaterial,
} from '../butterfly/material.js';
import { createDetailedWing } from './wingDetail.js';

/*
 * Laboratuvar için hareketsiz kelebek.
 *
 * Sürüdeki kelebek instanced ve çırpması shader'da; burada amaç deseni
 * yakından incelemek olduğu için basit mesh hiyerarşisi kullanılıyor:
 * kanatlar sabit bir duruş açısında, animasyon yok.
 */

export function createStaticButterfly(params, detail) {
  const group = new THREE.Group();
  const g = createButterflyGeometry(params);

  const fore = createDetailedWing(g.shapes.fore, {
    ...detail,
    edgeWidth: params.edgeWidth,
  });
  const hind = createDetailedWing(g.shapes.hind, {
    ...detail,
    edgeWidth: params.edgeWidth,
  });

  const foreMat = wingMaterial(fore);
  const hindMat = wingMaterial(hind);
  const bodyMat = createBodyMaterial();
  const eyeMat = createEyeMaterial();

  group.add(new THREE.Mesh(g.body, bodyMat));
  group.add(new THREE.Mesh(g.eyes, eyeMat));

  const wings = [];
  for (const side of [1, -1]) {
    wings.push(addWing(group, g.foreWing, foreMat, g.hinges.fore, side, params.foreRestDeg ?? 14));
    wings.push(addWing(group, g.hindWing, hindMat, g.hinges.hind, side, params.hindRestDeg ?? 5));
  }

  const dispose = () => {
    g.body.dispose();
    g.eyes.dispose();
    g.foreWing.dispose();
    g.hindWing.dispose();
    for (const m of [foreMat, hindMat, bodyMat, eyeMat]) {
      m.map?.dispose();
      m.normalMap?.dispose();
      m.dispose();
    }
  };

  return { group, wings, dispose };
}

function wingMaterial({ map, normalMap }) {
  const m = createWingMaterial(map);
  if (normalMap) {
    m.normalMap = normalMap;
    // Kabartma damarları belli etsin ama kanadı buruşuk göstermesin
    m.normalScale = new THREE.Vector2(0.55, 0.55);
  }
  return m;
}

function addWing(group, geometry, material, hinge, side, restDeg) {
  const pivot = new THREE.Object3D();
  pivot.position.copy(hinge);
  pivot.scale.x = side;
  pivot.rotation.z = side * THREE.MathUtils.degToRad(restDeg);

  const mesh = new THREE.Mesh(geometry, material);
  pivot.add(mesh);
  group.add(pivot);
  return { pivot, mesh };
}
