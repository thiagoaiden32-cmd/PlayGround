import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeSignTexture, makeGlowTexture } from './assets.js';

export const PORTAL_W = 2.2;
export const PORTAL_H = 3.0;
const UP = new THREE.Vector3(0, 1, 0);

function aabbFor(x, y, z, w, h, d) {
  return {
    minX: x - w / 2,
    maxX: x + w / 2,
    minY: y - h / 2,
    maxY: y + h / 2,
    minZ: z - d / 2,
    maxZ: z + d / 2,
  };
}

function addBox(root, boxes, mats, {
  x, y, z, w, h, d, mat = 'wall', collide = true, cast = true, receive = true, rounded = 0, ry = 0,
}) {
  const geometry = rounded > 0
    ? new RoundedBoxGeometry(w, h, d, 2, Math.min(rounded, w / 2, h / 2, d / 2))
    : new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geometry, mats[mat]);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  root.add(mesh);
  if (collide) boxes.push(aabbFor(x, y, z, w, h, d));
  return mesh;
}

function addStrip(root, mats, x, y, z, w, h, d, mat = 'cyan', ry = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats[mat]);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  root.add(mesh);
  return mesh;
}

function addSign(root, texture, x, y, z, w, h, ry = 0, opacity = 0.88) {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.renderOrder = 2;
  root.add(mesh);
  return mesh;
}

function addLightCone(root, x, y, z, radius = 3, height = 8, color = 0x87d9ef, opacity = 0.035) {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 32, 1, true), material);
  cone.position.set(x, y, z);
  cone.rotation.x = Math.PI;
  root.add(cone);
  return cone;
}

function addPortalPanel(root, panels, mats, {
  x, y, z, w = 5.2, h = 4.6, ry = 0, enabled = true,
}) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = ry;
  root.add(group);

  const frameMat = mats.black;
  const backing = new THREE.Mesh(new THREE.BoxGeometry(w + 0.42, h + 0.42, 0.22), frameMat);
  backing.position.z = -0.14;
  backing.castShadow = true;
  backing.receiveShadow = true;
  group.add(backing);

  const outerTrim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.28, h + 0.28, 0.3), mats.metalDark);
  outerTrim.position.z = -0.2;
  outerTrim.castShadow = true;
  group.add(outerTrim);

  const surface = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats.ceramic);
  surface.position.z = 0.015;
  surface.receiveShadow = true;
  group.add(surface);

  // Corner rails and small cyan alignment pips.
  const railMat = mats.ceramicEdge;
  const railDepth = 0.06;
  for (const sx of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.09, h + 0.04, railDepth), railMat);
    rail.position.set(sx * (w / 2 + 0.12), 0, 0.025);
    group.add(rail);
  }
  for (const sy of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.09, railDepth), railMat);
    rail.position.set(0, sy * (h / 2 + 0.12), 0.025);
    group.add(rail);
  }
  const pips = [];
  for (const sx of [-1, 1]) {
    const pip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.06), enabled ? mats.cyan : mats.red);
    pip.position.set(sx * (w / 2 + 0.24), 0, 0.03);
    group.add(pip);
    pips.push(pip);
  }
  const topPip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.06), enabled ? mats.cyan : mats.red);
  topPip.position.set(0, h / 2 + 0.24, 0.03);
  group.add(topPip);
  pips.push(topPip);

  const normal = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
  const panel = {
    mesh: surface,
    group,
    x, y, z, w, h, ry, normal,
    enabled,
    pips,
    mode: 'ready',
  };
  panels.push(panel);
  return panel;
}

function makeAnchorMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uActive: { value: 0 },
      uColor: { value: new THREE.Color(0x48e9ff) },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform float uActive;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv - 0.5;
        float r = length(p) * 2.0;
        if (r > 1.0) discard;
        float edge = smoothstep(0.62, 1.0, r);
        float scan = 0.5 + 0.5 * sin(r * 34.0 - uTime * 4.0);
        float spokes = 0.5 + 0.5 * sin(atan(p.y, p.x) * 11.0 + uTime * 1.3);
        float core = 1.0 - smoothstep(0.0, 0.85, r);
        vec3 dark = vec3(0.006, 0.045, 0.06);
        vec3 col = dark + uColor * (0.20 + 0.36 * scan * edge + 0.14 * spokes * edge);
        col += uColor * core * (0.34 + 0.45 * uActive);
        col *= 0.35 + uActive * 1.05;
        float alpha = (0.52 + 0.42 * edge + 0.16 * core) * (0.35 + 0.65 * uActive);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

function addAnchor(root, mats, { x, y, z, ry = 0, name = 'ANCHOR 01' }) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = ry;
  root.add(group);

  const back = new THREE.Mesh(new THREE.BoxGeometry(2.95, 3.72, 0.2), mats.black);
  back.position.z = -0.12;
  back.castShadow = true;
  group.add(back);

  const trim = new THREE.Mesh(new RoundedBoxGeometry(3.22, 3.98, 0.18, 2, 0.12), mats.metalDark);
  trim.position.z = -0.18;
  group.add(trim);

  const ringDark = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.11, 8, 64), mats.metalDark);
  ringDark.scale.set(1.0, 1.35, 1.0);
  ringDark.position.z = 0.06;
  ringDark.castShadow = true;
  group.add(ringDark);

  const ringMetal = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.045, 8, 64), mats.metal);
  ringMetal.scale.set(1.0, 1.35, 1.0);
  ringMetal.position.z = 0.16;
  group.add(ringMetal);

  const ringGlow = new THREE.Mesh(new THREE.TorusGeometry(1.065, 0.022, 6, 72), mats.cyan);
  ringGlow.scale.set(1.0, 1.35, 1.0);
  ringGlow.position.z = 0.2;
  group.add(ringGlow);

  const discMaterial = makeAnchorMaterial();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.045, 72), discMaterial);
  disc.scale.set(1.0, 1.35, 1.0);
  disc.position.z = 0.18;
  group.add(disc);

  const arcs = [];
  for (let i = 0; i < 2; i++) {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(1.27 + i * 0.07, 0.013, 5, 48, Math.PI * (0.55 + i * 0.18)),
      i === 0 ? mats.cyanSoft : mats.orangeSoft,
    );
    arc.scale.set(1.0, 1.35, 1.0);
    arc.position.z = 0.19 + i * 0.012;
    arc.rotation.z = i * 2.15;
    group.add(arc);
    arcs.push(arc);
  }

  const clamps = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, 0.2), mats.metal);
    clamp.position.set(Math.cos(a) * 1.43, Math.sin(a) * 1.94, 0.09);
    clamp.rotation.z = a - Math.PI / 2;
    group.add(clamp);
    clamps.push(clamp);
  }

  const light = new THREE.PointLight(0x4beaff, 7.5, 12, 2);
  light.position.set(0, 0, 1.2);
  group.add(light);

  const label = makeSignTexture({ eyebrow: 'RECEIVER LINK', title: name, sub: 'SINGLE EMITTER RELAY', color: '#53eaff' });
  const labelMesh = addSign(root, label, 0, 0, 0, 1.55, 0.58, 0, 0.88);
  // Parent the label to the anchor and position it above the ring.
  root.remove(labelMesh);
  labelMesh.position.set(0, 2.36, 0.06);
  labelMesh.scale.setScalar(1.12);
  group.add(labelMesh);

  const normal = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
  return {
    group, position: new THREE.Vector3(x, y, z), normal,
    discMaterial, ringGlow, arcs, light, active: false,
    setActive(value) {
      this.active = value;
      this.discMaterial.uniforms.uActive.value = value ? 1 : 0;
      this.light.intensity = value ? 7.5 : 1.3;
      this.ringGlow.material = value ? mats.cyan : mats.metalDark;
    },
  };
}

function addCore(root, mats, { x, y, z }, glowTexture) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  root.add(group);

  const inner = new THREE.Mesh(new THREE.OctahedronGeometry(0.31, 0), mats.core);
  inner.castShadow = true;
  group.add(inner);

  const shell = new THREE.Mesh(new THREE.OctahedronGeometry(0.48, 0), mats.coreShell);
  shell.rotation.set(0.4, 0.2, 0.1);
  group.add(shell);

  const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.63, 0.014, 5, 60), mats.cyanSoft);
  ringA.rotation.x = Math.PI / 2;
  group.add(ringA);
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.009, 5, 60), mats.orangeSoft);
  ringB.rotation.set(Math.PI / 2.8, 0.2, 0.5);
  group.add(ringB);

  const spriteMat = new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0x59eaff,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const glow = new THREE.Sprite(spriteMat);
  glow.scale.set(2.3, 2.3, 1);
  group.add(glow);

  const light = new THREE.PointLight(0x42dcff, 4.2, 8, 2);
  light.position.y = 0.2;
  group.add(light);

  return {
    group, position: new THREE.Vector3(x, y, z), baseY: y,
    collected: false, inner, shell, ringA, ringB, glow, light, spin: 0.7 + Math.random() * 0.5,
  };
}

function addDoor(root, mats, { x, y, z, ry = 0, label = 'EXTRACTION GATE' }) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = ry;
  root.add(group);

  const frame = new THREE.Mesh(new RoundedBoxGeometry(4.0, 4.1, 0.42, 2, 0.12), mats.metalDark);
  frame.position.set(0, 2.05, -0.16);
  frame.castShadow = true;
  group.add(frame);

  const door = new THREE.Mesh(new THREE.BoxGeometry(3.25, 3.15, 0.28), mats.black);
  door.position.set(0, 1.7, 0.04);
  door.castShadow = true;
  group.add(door);

  for (let i = 0; i < 3; i++) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.045, 0.02), mats.red);
    seam.position.set(0, 1.15 + i * 0.55, 0.19);
    group.add(seam);
    door.userData.seams = door.userData.seams || [];
    door.userData.seams.push(seam);
  }

  const signTexture = makeSignTexture({ eyebrow: 'HORIZON // SECURE', title: label, sub: 'AUTHORIZED EXIT', color: '#ff7a31' });
  const sign = addSign(root, signTexture, 0, 0, 0, 3.5, 1.3, 0, 0.94);
  root.remove(sign);
  sign.position.set(0, 4.35, 0.02);
  group.add(sign);

  const light = new THREE.PointLight(0xff4b28, 5, 8, 2);
  light.position.set(0, 2.1, 0.9);
  group.add(light);

  const normal = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
  return {
    group, door, light, position: new THREE.Vector3(x, y + 1.7, z), normal,
    trigger: new THREE.Vector3(x + normal.x * 1.2, y, z + normal.z * 1.2),
    locked: true, open: false, doorOpen: 0,
    seams: door.userData.seams,
  };
}

function addExtraction(root, mats, { x, y, z, ry = 0 }) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = ry;
  root.add(group);

  const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.35, 0.34, 48), mats.black);
  pad.position.y = 0.12;
  pad.receiveShadow = true;
  group.add(pad);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.08, 8, 72), mats.red);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.32;
  group.add(ring);

  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.025, 6, 72), mats.red);
  ring2.rotation.x = Math.PI / 2;
  ring2.position.y = 0.35;
  group.add(ring2);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.25, 1.65, 5.6, 36, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xff5230,
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  beam.position.y = 3.1;
  group.add(beam);

  const signTexture = makeSignTexture({ eyebrow: 'FINAL LIFT', title: 'EXTRACTION', sub: 'CORE ARRAY REQUIRED', color: '#ff9252' });
  const sign = addSign(root, signTexture, 0, 0, 0, 4.2, 1.55, 0, 0.94);
  root.remove(sign);
  sign.position.set(0, 5.9, 0);
  group.add(sign);

  const light = new THREE.PointLight(0xff4b28, 8, 15, 2);
  light.position.y = 2.4;
  group.add(light);

  return {
    group, ring, ring2, beam, light, sign,
    position: new THREE.Vector3(x, y + 0.3, z),
    trigger: new THREE.Vector3(x, y, z),
    locked: true, open: false, door: null, seams: [],
  };
}

function addRoomShell(root, boxes, mats, bounds, { ceiling = true, ribs = true, zRibs = 5 } = {}) {
  const { minX, maxX, minZ, maxZ, height } = bounds;
  addBox(root, boxes, mats, { x: (minX + maxX) / 2, y: -0.55, z: minZ - 0.45, w: maxX - minX + 1.8, h: 1, d: 0.9, mat: 'metalDark' });
  addBox(root, boxes, mats, { x: (minX + maxX) / 2, y: -0.55, z: maxZ + 0.45, w: maxX - minX + 1.8, h: 1, d: 0.9, mat: 'metalDark' });
  addBox(root, boxes, mats, { x: minX - 0.45, y: height / 2, z: (minZ + maxZ) / 2, w: 0.9, h: height, d: maxZ - minZ + 1.8, mat: 'wall' });
  addBox(root, boxes, mats, { x: maxX + 0.45, y: height / 2, z: (minZ + maxZ) / 2, w: 0.9, h: height, d: maxZ - minZ + 1.8, mat: 'wall' });
  addBox(root, boxes, mats, { x: (minX + maxX) / 2, y: height + 0.35, z: (minZ + maxZ) / 2, w: maxX - minX + 1.8, h: 0.7, d: maxZ - minZ + 1.8, mat: 'wallDark', cast: false });
  addBox(root, boxes, mats, { x: (minX + maxX) / 2, y: -13.5, z: (minZ + maxZ) / 2, w: maxX - minX - 0.5, h: 0.8, d: maxZ - minZ - 0.5, mat: 'black', collide: false, cast: false });

  if (ribs) {
    for (let z = minZ + 2; z < maxZ; z += zRibs) {
      addBox(root, boxes, mats, { x: minX + 0.14, y: height / 2, z, w: 0.22, h: height - 0.2, d: 0.28, mat: 'metalDark', collide: false });
      addBox(root, boxes, mats, { x: maxX - 0.14, y: height / 2, z, w: 0.22, h: height - 0.2, d: 0.28, mat: 'metalDark', collide: false });
      addBox(root, boxes, mats, { x: (minX + maxX) / 2, y: height - 0.7, z, w: maxX - minX - 1.0, h: 0.22, d: 0.22, mat: 'metalDark', collide: false });
    }
  }
  if (ceiling) {
    // Suspended light bars.
    const z0 = minZ + 4;
    const z1 = maxZ - 4;
    for (const z of [z0, (z0 + z1) / 2, z1]) {
      addStrip(root, mats, minX + 3.0, height - 1.15, z, Math.min(7, maxX - minX - 8), 0.08, 0.34, 'cyanSoft');
      addStrip(root, mats, maxX - 3.0, height - 1.15, z, Math.min(7, maxX - minX - 8), 0.08, 0.34, 'cyanSoft');
    }
  }
}

function buildFloorModules(root, boxes, mats, y, zStart, zEnd, xMin, xMax, module = 4) {
  const width = xMax - xMin;
  const count = Math.ceil(Math.abs(zEnd - zStart) / module);
  for (let i = 0; i < count; i++) {
    const z = zStart + Math.sign(zEnd - zStart) * (i + 0.5) * module;
    addBox(root, boxes, mats, { x: (xMin + xMax) / 2, y: y - 0.5, z, w: width, h: 1, d: module - 0.055, mat: 'floor' });
  }
}

function addHazardGlow(root, mats, x, z, y = -12.6, w = 8, d = 8) {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff3e18,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(x, y, z);
  root.add(plane);
  return plane;
}

function addDebrisRing(root, mats, radius, y, count = 18) {
  const group = new THREE.Group();
  group.position.y = y;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const r = radius + (Math.random() - 0.5) * 1.6;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.12 + Math.random() * 0.35, 0.05, 0.08 + Math.random() * 0.2),
      i % 5 === 0 ? mats.orange : mats.metalDark,
    );
    mesh.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 0.5, Math.sin(a) * r);
    mesh.rotation.set(Math.random(), Math.random(), Math.random());
    group.add(mesh);
  }
  root.add(group);
  return group;
}

function buildChamberOne(ctx) {
  const { mats, textures } = ctx;
  const root = new THREE.Group();
  const boxes = [];
  const panels = [];
  const bounds = { minX: -12, maxX: 12, minZ: -20, maxZ: 12, height: 9.2 };

  addRoomShell(root, boxes, mats, bounds, { zRibs: 4.2 });

  // Start deck and extraction deck, separated by a fatal gulf.
  buildFloorModules(root, boxes, mats, 0, 12, 2, -12, 12, 2.5);
  buildFloorModules(root, boxes, mats, 0, -7.5, -20, -12, 12, 2.5);

  // Edge trims frame the gap.
  addStrip(root, mats, 0, 0.035, 1.94, 23.7, 0.045, 0.16, 'orange');
  addStrip(root, mats, 0, 0.035, -7.44, 23.7, 0.045, 0.16, 'cyan');
  addHazardGlow(root, mats, 0, -2.75, -12.55, 22, 8.4);

  // The hero portal surface: a free-standing ceramic test panel at the ledge.
  addPortalPanel(root, panels, mats, { x: -5.1, y: 2.35, z: 1.7, w: 4.4, h: 4.7, ry: 0 });
  addBox(root, boxes, mats, { x: -5.1, y: 0.33, z: 1.92, w: 3.7, h: 0.66, d: 0.8, mat: 'metalDark' });
  addBox(root, boxes, mats, { x: -5.1, y: 1.25, z: 1.86, w: 0.32, h: 2.2, d: 0.5, mat: 'metal', collide: false });
  addStrip(root, mats, -7.0, 5.25, 1.92, 0.18, 0.1, 0.1, 'orange');
  addStrip(root, mats, -3.2, 5.25, 1.92, 0.18, 0.1, 0.1, 'cyan');

  // Alternate wall surface.
  addPortalPanel(root, panels, mats, { x: -11.78, y: 2.32, z: 6.5, w: 5.0, h: 4.6, ry: Math.PI / 2 });

  // The fixed receiver on the far wall.
  const anchor = addAnchor(root, mats, { x: 0, y: 1.8, z: -19.72, ry: 0, name: 'ANCHOR 01' });

  // Destination door.
  const exit = addDoor(root, mats, { x: 11.74, y: 0, z: -14.2, ry: -Math.PI / 2, label: 'EXTRACTION GATE' });

  // Core near the spawn point.
  const cores = [addCore(root, mats, { x: 4.6, y: 1.25, z: 8.5 }, textures.glowTexture)];

  // Floating test signage over the chasm.
  const chamberSign = makeSignTexture({
    eyebrow: 'HORIZON // SPATIAL SYSTEMS',
    title: 'CALIBRATION',
    sub: 'ONE EMITTER  /  ONE RECEIVER  /  NO SECOND CHANCE',
    color: '#72e9ff',
  });
  addSign(root, chamberSign, 0, 6.65, -2.2, 8.4, 3.15, 0, 0.94);
  addStrip(root, mats, -4.6, 5.0, -2.2, 0.04, 2.8, 0.04, 'cyan');
  addStrip(root, mats, 4.6, 5.0, -2.2, 0.04, 2.8, 0.04, 'cyan');

  const sideSign = makeSignTexture({
    eyebrow: 'CAUTION // VOID BELOW',
    title: 'NO BRIDGE',
    sub: 'RECALIBRATE YOUR POSITION',
    color: '#ff8a45',
  });
  addSign(root, sideSign, 11.76, 5.1, 3.2, 5.2, 1.95, -Math.PI / 2, 0.8);

  // Ceiling sculptures.
  addBox(root, boxes, mats, { x: -8.5, y: 8.22, z: 5.8, w: 0.26, h: 0.26, d: 9.4, mat: 'metalDark', collide: false });
  addBox(root, boxes, mats, { x: 8.5, y: 8.22, z: 5.8, w: 0.26, h: 0.26, d: 9.4, mat: 'metalDark', collide: false });
  addBox(root, boxes, mats, { x: 0, y: 8.34, z: -4.0, w: 18.0, h: 0.28, d: 0.32, mat: 'metalDark', collide: false });
  for (let i = -3; i <= 3; i++) {
    addBox(root, boxes, mats, { x: i * 2.4, y: 7.65, z: -4.0, w: 0.12, h: 1.2, d: 0.12, mat: 'metal', collide: false });
  }
  addLightCone(root, -5.1, 4.8, 1.3, 3.8, 7.2, 0x66dfff, 0.038);
  addLightCone(root, 0, 4.6, -19.0, 3.0, 8.0, 0x4ce9ff, 0.034);
  addLightCone(root, 8.2, 4.8, -13.8, 3.0, 8.0, 0xff6e30, 0.024);

  const debris = addDebrisRing(root, mats, 8.8, 0.2, 22);

  const ambient = new THREE.PointLight(0x63dff8, 4, 14, 2);
  ambient.position.set(0, 6.4, 0);
  root.add(ambient);
  const exitLight = new THREE.PointLight(0xff6a2e, 3.2, 10, 2);
  exitLight.position.set(9.8, 2.4, -14.2);
  root.add(exitLight);

  const level = {
    index: 0,
    name: 'CALIBRATION',
    tag: 'TEST CHAMBER 01',
    brand: 'HORIZON INITIATIVE',
    brief: 'Recover the flux core. Cross the void. Find the extraction gate.',
    hint: 'Aim at a white ceramic panel and click. Your portal links to the cyan anchor. Walk into either opening.',
    spawn: { x: 0, y: 0.02, z: 8.4, yaw: 0.08, pitch: 0.015 },
    boxes, panels, cores, anchor, exit, root,
    required: 1,
    bounds,
    extras: { signs: [chamberSign, sideSign] },
    animate(t, dt) {
      anchor.discMaterial.uniforms.uTime.value = t;
      anchor.arcs[0].rotation.z += dt * 0.32;
      anchor.arcs[1].rotation.z -= dt * 0.2;
      for (const core of cores) {
        if (core.collected) continue;
        core.group.position.y = core.baseY + Math.sin(t * 1.9 + core.position.x) * 0.09;
        core.inner.rotation.y += dt * core.spin;
        core.inner.rotation.x += dt * 0.35;
        core.shell.rotation.y -= dt * 0.48;
        core.shell.rotation.z += dt * 0.18;
        core.ringA.rotation.z += dt * 0.5;
        core.ringB.rotation.y += dt * 0.35;
      }
      debris.rotation.y += dt * 0.012;
      if (exit.open) {
        exit.doorOpen = Math.min(1, exit.doorOpen + dt * 0.9);
        exit.door.position.y = 1.7 + exit.doorOpen * 3.35;
      }
    },
  };
  return level;
}

function buildChamberTwo(ctx) {
  const { mats, textures } = ctx;
  const root = new THREE.Group();
  const boxes = [];
  const panels = [];
  const bounds = { minX: -22, maxX: 22, minZ: -24, maxZ: 24, height: 14.2 };

  addRoomShell(root, boxes, mats, bounds, { zRibs: 5.0 });

  // Hub platform.
  addBox(root, boxes, mats, { x: 0, y: -0.55, z: 6.4, w: 13.5, h: 1.1, d: 13.5, mat: 'floor' });
  addStrip(root, mats, 0, 0.02, -0.1, 13.2, 0.04, 0.12, 'cyan');
  addStrip(root, mats, 0, 0.02, 12.95, 13.2, 0.04, 0.12, 'orange');

  // Central reactor tower.
  addBox(root, boxes, mats, { x: 0, y: 4.8, z: 1.5, w: 4.5, h: 9.6, d: 4.5, mat: 'wallDark' });
  addBox(root, boxes, mats, { x: 0, y: 4.8, z: 1.5, w: 5.0, h: 0.42, d: 5.0, mat: 'metalDark', collide: false });
  addBox(root, boxes, mats, { x: 0, y: 9.4, z: 1.5, w: 4.9, h: 0.35, d: 4.9, mat: 'metalDark', collide: false });
  addStrip(root, mats, 0, 0.2, 3.76, 3.2, 0.05, 0.05, 'orange');
  for (const ry of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    addStrip(root, mats, Math.sin(ry) * 2.32, 6.6, 1.5 + Math.cos(ry) * 2.32, 0.08, 4.6, 0.08, 'cyan', ry);
  }

  // Rotating gyro rings.
  const gyroA = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.045, 6, 64), mats.cyanSoft);
  gyroA.rotation.x = Math.PI / 2;
  gyroA.position.set(0, 8.0, 1.5);
  root.add(gyroA);
  const gyroB = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.022, 5, 64), mats.orangeSoft);
  gyroB.rotation.x = Math.PI / 2;
  gyroB.position.set(0, 8.0, 1.5);
  root.add(gyroB);

  const anchor = addAnchor(root, mats, { x: 0, y: 1.8, z: 3.78, ry: 0, name: 'ANCHOR 02' });

  // Three satellite islands.
  const islands = [
    { x: -16.4, z: -4, w: 11.2, d: 11, top: 1.4, panel: { x: -21.74, y: 3.0, z: -4, ry: Math.PI / 2 } },
    { x: 16.4, z: -4, w: 11.2, d: 11, top: 1.4, panel: { x: 21.74, y: 3.0, z: -4, ry: -Math.PI / 2 } },
    { x: 0, z: -17.2, w: 12.4, d: 13.0, top: 2.4, panel: { x: 0, y: 4.0, z: -23.72, ry: 0 } },
  ];
  for (const [i, is] of islands.entries()) {
    addBox(root, boxes, mats, { x: is.x, y: is.top - 0.62, z: is.z, w: is.w, h: 1.24, d: is.d, mat: 'floor' });
    addBox(root, boxes, mats, { x: is.x, y: is.top - 1.9, z: is.z, w: is.w - 1.1, h: 1.4, d: is.d - 1.1, mat: 'metalDark', collide: false });
    const stripMat = i === 2 ? 'orange' : 'cyan';
    addStrip(root, mats, is.x, is.top + 0.02, is.z - is.d / 2 + 0.22, is.w - 0.8, 0.04, 0.12, stripMat);
    addStrip(root, mats, is.x, is.top + 0.02, is.z + is.d / 2 - 0.22, is.w - 0.8, 0.04, 0.12, stripMat);
    addPortalPanel(root, panels, mats, { ...is.panel, w: 5.4, h: 4.8 });
    addHazardGlow(root, mats, is.x, is.z, -11.8, is.w - 2, is.d - 2);
  }

  // Cores on the three islands.
  const cores = [
    addCore(root, mats, { x: -16.4, y: 3.0, z: -4 }, textures.glowTexture),
    addCore(root, mats, { x: 16.4, y: 3.0, z: -4 }, textures.glowTexture),
    addCore(root, mats, { x: 0, y: 4.0, z: -16.2 }, textures.glowTexture),
  ];

  const exit = addDoor(root, mats, { x: -2.27, y: 0, z: 1.65, ry: -Math.PI / 2, label: 'EXTRACTION GATE' });

  const mainSign = makeSignTexture({
    eyebrow: 'TEST CHAMBER 02 // TRIANGULATION',
    title: 'THREE SIGNALS',
    sub: 'ONE LINK  /  THREE RECOVERIES',
    color: '#72e9ff',
  });
  addSign(root, mainSign, 0, 7.3, 10.8, 8.8, 3.3, 0, 0.94);
  addStrip(root, mats, -4.8, 5.5, 10.8, 0.04, 3.1, 0.04, 'cyan');
  addStrip(root, mats, 4.8, 5.5, 10.8, 0.04, 3.1, 0.04, 'cyan');

  // Light shafts and linking filaments.
  for (const is of islands) {
    addLightCone(root, is.x, is.top + 6.5, is.z, 3.1, 11.0, is.z < -10 ? 0xff7a3b : 0x5ce8ff, 0.03);
    const from = new THREE.Vector3(0, 8.6, 1.5);
    const to = new THREE.Vector3(is.x, is.top + 2.2, is.z);
    const dir = new THREE.Vector3().subVectors(to, from);
    const filament = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, dir.length(), 5),
      is.z < -10 ? mats.orangeSoft : mats.cyanSoft,
    );
    filament.position.copy(from).addScaledVector(dir, 0.5);
    filament.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
    root.add(filament);
  }

  addDebrisRing(root, mats, 11.2, 0.4, 34);
  const light = new THREE.PointLight(0x61e9ff, 5.5, 22, 2);
  light.position.set(0, 7.4, 3.2);
  root.add(light);
  const warm = new THREE.PointLight(0xff6b2e, 4.0, 16, 2);
  warm.position.set(0, 3.0, -16.2);
  root.add(warm);

  const level = {
    index: 1,
    name: 'TRIANGULATION',
    tag: 'TEST CHAMBER 02',
    brand: 'HORIZON INITIATIVE',
    brief: 'Recover the three flux cores. The tower gate opens when the array is complete.',
    hint: 'Stand on the hub. Aim at any island panel, then step into the cyan anchor to cross. Walk back through your portal to return.',
    spawn: { x: 0, y: 0.02, z: 10.0, yaw: 0, pitch: -0.02 },
    boxes, panels, cores, anchor, exit, root,
    required: 3,
    bounds,
    extras: { gyroA, gyroB },
    animate(t, dt) {
      anchor.discMaterial.uniforms.uTime.value = t;
      anchor.arcs[0].rotation.z += dt * 0.32;
      anchor.arcs[1].rotation.z -= dt * 0.2;
      gyroA.rotation.z += dt * 0.08;
      gyroB.rotation.z -= dt * 0.13;
      for (const core of cores) {
        if (core.collected) continue;
        core.group.position.y = core.baseY + Math.sin(t * 1.8 + core.position.x * 0.3) * 0.1;
        core.inner.rotation.y += dt * core.spin;
        core.inner.rotation.x += dt * 0.3;
        core.shell.rotation.y -= dt * 0.42;
        core.ringA.rotation.z += dt * 0.42;
        core.ringB.rotation.y += dt * 0.3;
      }
      if (exit.open) {
        exit.doorOpen = Math.min(1, exit.doorOpen + dt * 0.9);
        exit.door.position.y = 1.7 + exit.doorOpen * 3.35;
      }
    },
  };
  return level;
}

function buildChamberThree(ctx) {
  const { mats, textures } = ctx;
  const root = new THREE.Group();
  const boxes = [];
  const panels = [];
  const bounds = { minX: -23, maxX: 23, minZ: -23, maxZ: 23, height: 28.2 };

  addRoomShell(root, boxes, mats, bounds, { zRibs: 5.2 });

  // Spawn deck.
  addBox(root, boxes, mats, { x: 0, y: -0.55, z: 17.2, w: 14, h: 1.1, d: 10.2, mat: 'floor' });
  addStrip(root, mats, 0, 0.02, 12.18, 13.6, 0.04, 0.12, 'orange');

  // Central reactor spine.
  addBox(root, boxes, mats, { x: 0, y: 8.2, z: 2.0, w: 5.2, h: 16.4, d: 5.2, mat: 'wallDark' });
  addBox(root, boxes, mats, { x: 0, y: 16.7, z: 2.0, w: 6.2, h: 0.5, d: 6.2, mat: 'metalDark', collide: false });
  for (let i = 0; i < 5; i++) {
    addStrip(root, mats, 0, 1.2 + i * 3.0, 4.62, 4.1, 0.06, 0.06, i === 2 ? 'orange' : 'cyan');
  }
  const gyro = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.05, 6, 80), mats.cyanSoft);
  gyro.rotation.x = Math.PI / 2;
  gyro.position.set(0, 11.2, 2.0);
  root.add(gyro);
  const gyro2 = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.028, 5, 80), mats.orangeSoft);
  gyro2.rotation.x = Math.PI / 2;
  gyro2.position.set(0, 11.2, 2.0);
  root.add(gyro2);

  const anchor = addAnchor(root, mats, { x: 0, y: 1.8, z: 4.62, ry: 0, name: 'ANCHOR 03' });

  // Four vertical challenge platforms.
  const platforms = [
    { x: -17.2, z: 4.0, w: 10.2, d: 10.0, top: 5.7, panel: { x: -22.72, y: 7.3, z: 4.0, ry: Math.PI / 2 }, core: { x: -16.0, y: 7.3, z: 4.0 } },
    { x: 17.2, z: 4.0, w: 10.2, d: 10.0, top: 10.7, panel: { x: 22.72, y: 12.3, z: 4.0, ry: -Math.PI / 2 }, core: { x: 16.0, y: 12.3, z: 4.0 } },
    { x: 0, z: -17.0, w: 12.0, d: 10.4, top: 15.3, panel: { x: 0, y: 16.9, z: -22.72, ry: 0 }, core: { x: 0, y: 16.9, z: -16.5 } },
    { x: -16.8, z: 13.0, w: 10.4, d: 9.5, top: 19.7, panel: { x: -22.72, y: 21.3, z: 13.0, ry: Math.PI / 2 }, core: { x: -15.8, y: 21.3, z: 13.0 } },
  ];

  for (const [i, p] of platforms.entries()) {
    addBox(root, boxes, mats, { x: p.x, y: p.top - 0.55, z: p.z, w: p.w, h: 1.1, d: p.d, mat: 'floor' });
    addBox(root, boxes, mats, { x: p.x, y: p.top - 1.8, z: p.z, w: p.w - 1.2, h: 1.5, d: p.d - 1.2, mat: 'metalDark', collide: false });
    addStrip(root, mats, p.x, p.top + 0.02, p.z + p.d / 2 - 0.2, p.w - 1.2, 0.04, 0.11, i % 2 ? 'orange' : 'cyan');
    addStrip(root, mats, p.x, p.top + 0.02, p.z - p.d / 2 + 0.2, p.w - 1.2, 0.04, 0.11, i % 2 ? 'orange' : 'cyan');
    addPortalPanel(root, panels, mats, { ...p.panel, w: 5.4, h: 5.0 });
    addHazardGlow(root, mats, p.x, p.z, -11.9, p.w - 2, p.d - 2);
  }

  const cores = platforms.map((p) => addCore(root, mats, p.core, textures.glowTexture));

  // Extraction loft and its final portal surface.
  addBox(root, boxes, mats, { x: 0, y: 21.5, z: -17.7, w: 10.6, h: 1.1, d: 9.2, mat: 'floor' });
  addBox(root, boxes, mats, { x: 0, y: 20.2, z: -17.7, w: 9.0, h: 1.5, d: 7.6, mat: 'metalDark', collide: false });
  addStrip(root, mats, 0, 22.02, -13.2, 9.4, 0.04, 0.12, 'cyan');
  const finalPanel = addPortalPanel(root, panels, mats, { x: 0, y: 23.6, z: -22.72, w: 5.8, h: 5.2, ry: 0, enabled: false });
  const exit = addExtraction(root, mats, { x: 0, y: 22.0, z: -17.0, ry: 0 });

  // Extra portal surface on the spawn deck, for freedom.
  addPortalPanel(root, panels, mats, { x: -6.8, y: 2.3, z: 12.1, w: 3.6, h: 4.4, ry: 0 });

  const mainSign = makeSignTexture({
    eyebrow: 'TEST CHAMBER 03 // SINGULARITY',
    title: 'THE LONG WAY UP',
    sub: 'FOUR CORES  /  ONE EMITTER  /  NO FALLBACK',
    color: '#ff8a45',
  });
  addSign(root, mainSign, 0, 9.4, 17.6, 9.4, 3.5, 0, 0.94);
  addStrip(root, mats, -5.2, 7.4, 17.6, 0.04, 3.3, 0.04, 'orange');
  addStrip(root, mats, 5.2, 7.4, 17.6, 0.04, 3.3, 0.04, 'orange');

  // High catwalk silhouettes.
  for (const [x, z, w, d] of [[-20.5, -9, 4.6, 12], [20.5, -9, 4.6, 12], [0, -21.4, 15, 2.4]]) {
    addBox(root, boxes, mats, { x, y: 24.5, z, w, h: 0.5, d, mat: 'metalDark', collide: false });
    for (let i = -2; i <= 2; i++) {
      addBox(root, boxes, mats, { x: x + i * 1.2, y: 24.0, z, w: 0.06, h: 0.72, d: d - 0.2, mat: 'cyan', collide: false });
    }
  }

  for (const p of platforms) {
    addLightCone(root, p.x, p.top + 5.0, p.z, 3.0, 11, p.core.y > 15 ? 0xff6e30 : 0x5ce8ff, 0.028);
    const from = new THREE.Vector3(0, 14.5, 2.0);
    const to = new THREE.Vector3(p.x, p.top + 2.2, p.z);
    const dir = new THREE.Vector3().subVectors(to, from);
    const filament = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, dir.length(), 5), p.core.y > 15 ? mats.orangeSoft : mats.cyanSoft);
    filament.position.copy(from).addScaledVector(dir, 0.5);
    filament.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
    root.add(filament);
  }

  addDebrisRing(root, mats, 14.0, 1.2, 44);
  const beacon = new THREE.PointLight(0x68eaff, 7.0, 28, 2);
  beacon.position.set(0, 12, 3.0);
  root.add(beacon);
  const warm = new THREE.PointLight(0xff6b30, 6.0, 22, 2);
  warm.position.set(0, 23.0, -16.0);
  root.add(warm);

  const level = {
    index: 2,
    name: 'SINGULARITY',
    tag: 'TEST CHAMBER 03',
    brand: 'HORIZON INITIATIVE',
    brief: 'Recover all four flux cores. Then reach the extraction loft before containment resets the chamber.',
    hint: 'The final panel stays dark until the array is complete. After the fourth core, look up and place your portal on the loft panel.',
    spawn: { x: 0, y: 0.02, z: 18.0, yaw: 0, pitch: 0.08 },
    boxes, panels, cores, anchor, exit, root,
    required: 4,
    bounds,
    finalPanel,
    extras: { gyro, gyro2 },
    animate(t, dt) {
      anchor.discMaterial.uniforms.uTime.value = t;
      anchor.arcs[0].rotation.z += dt * 0.32;
      anchor.arcs[1].rotation.z -= dt * 0.2;
      gyro.rotation.z += dt * 0.055;
      gyro2.rotation.z -= dt * 0.09;
      for (const core of cores) {
        if (core.collected) continue;
        core.group.position.y = core.baseY + Math.sin(t * 1.7 + core.position.x * 0.21) * 0.12;
        core.inner.rotation.y += dt * core.spin;
        core.inner.rotation.x += dt * 0.32;
        core.shell.rotation.y -= dt * 0.4;
        core.ringA.rotation.z += dt * 0.4;
        core.ringB.rotation.y += dt * 0.28;
      }
      if (exit.open) {
        exit.ring.material = mats.cyan;
        exit.ring2.material = mats.cyan;
        exit.beam.material.color.setHex(0x4beaff);
        exit.beam.material.opacity = 0.14 + Math.sin(t * 2.2) * 0.035;
      }
    },
  };
  return level;
}

export function buildLevel(index, ctx) {
  if (index === 0) return buildChamberOne(ctx);
  if (index === 1) return buildChamberTwo(ctx);
  return buildChamberThree(ctx);
}

export function setPanelEnabled(panel, mats, enabled) {
  panel.enabled = enabled;
  for (const pip of panel.pips) pip.material = enabled ? mats.cyan : mats.red;
}

// Re-export a small helper used by main for the reticle glow.
export { makeGlowTexture };
