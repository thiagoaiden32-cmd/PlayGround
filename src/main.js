import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createAssets, makeGlowTexture } from './assets.js';
import { buildLevel, setPanelEnabled, PORTAL_W, PORTAL_H } from './levels.js';
import { AudioManager } from './audio.js';

const $ = (id) => document.getElementById(id);

const ui = {
  canvas: $('scene'),
  hud: $('hud'),
  menu: $('menu'),
  startBtn: $('startBtn'),
  pauseScreen: $('pauseScreen'),
  resumeBtn: $('resumeBtn'),
  restartBtn: $('restartBtn'),
  quitBtn: $('quitBtn'),
  completeScreen: $('completeScreen'),
  completeKicker: $('completeKicker'),
  completeTitle: $('completeTitle'),
  completeBody: $('completeBody'),
  completeFoot: $('completeFoot'),
  resultTime: $('resultTime'),
  resultCores: $('resultCores'),
  resultTeleports: $('resultTeleports'),
  nextBtn: $('nextBtn'),
  replayLevelBtn: $('replayLevelBtn'),
  endingScreen: $('endingScreen'),
  endTime: $('endTime'),
  endCores: $('endCores'),
  endPlacements: $('endPlacements'),
  runAgainBtn: $('runAgainBtn'),
  chamberTag: $('chamberTag'),
  chamberName: $('chamberName'),
  objectiveText: $('objectiveText'),
  coreCount: $('coreCount'),
  coreBars: $('coreBars'),
  portalStatus: $('portalStatus'),
  timer: $('timer'),
  reticle: $('reticle'),
  aimLabel: $('aimLabel'),
  toast: $('toast'),
  levelIntro: $('levelIntro'),
  introTag: $('introTag'),
  introName: $('introName'),
  introBrief: $('introBrief'),
  objectiveMarker: $('objectiveMarker'),
  markerText: $('markerText'),
  flashFx: $('flashFx'),
  warnFx: $('warnFx'),
  touchControls: $('touchControls'),
  joystick: $('joystick'),
  stick: $('stick'),
  touchPortal: $('touchPortal'),
  touchJump: $('touchJump'),
  touchRecall: $('touchRecall'),
  audioBadge: $('audioBadge'),
  pauseBtn: $('pauseBtn'),
};

const isTouch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
if (isTouch) document.body.classList.add('is-touch');

const audio = new AudioManager();

// ---------------------------------------------------------------------------
// Renderer, scene, camera, post
// ---------------------------------------------------------------------------

const renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.55));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.setClearColor(0x02050a, 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02050a);
scene.fog = new THREE.FogExp2(0x02070c, 0.0105);
scene.environmentIntensity = 0.42;

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.045, 180);
camera.rotation.order = 'YXZ';
scene.add(camera);

const pmrem = new THREE.PMREMGenerator(renderer);
const environmentScene = new RoomEnvironment();
scene.environment = pmrem.fromScene(environmentScene, 0.04).texture;
environmentScene.traverse((object) => {
  if (object.geometry) object.geometry.dispose();
  if (object.material) object.material.dispose();
});

const composerTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
  type: THREE.HalfFloatType,
  samples: 4,
});
const composer = new EffectComposer(renderer, composerTarget);
composer.setPixelRatio(renderer.getPixelRatio());
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.78, 0.56, 0.83);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const hemi = new THREE.HemisphereLight(0x8fcde2, 0x030508, 1.15);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0x6aa1b3, 0.18);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xd9fbff, 2.05);
keyLight.position.set(11, 22, 14);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -36;
keyLight.shadow.camera.right = 36;
keyLight.shadow.camera.top = 36;
keyLight.shadow.camera.bottom = -36;
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 95;
keyLight.shadow.bias = -0.0004;
scene.add(keyLight);
scene.add(keyLight.target);

const rim = new THREE.DirectionalLight(0x2d8da8, 1.0);
rim.position.set(-14, 9, -18);
scene.add(rim);

const warmRim = new THREE.DirectionalLight(0xff6f2c, 0.36);
warmRim.position.set(-18, 3, 10);
scene.add(warmRim);

// A faint volumetric-looking glow around the player keeps close geometry legible.
const cameraFill = new THREE.PointLight(0x86dff1, 1.4, 10, 2);
cameraFill.position.set(0, 0, 0);
camera.add(cameraFill);

const { mats, textures } = createAssets();

// Distant dust.
const dustGeometry = new THREE.BufferGeometry();
const dustCount = 820;
const dustPositions = new Float32Array(dustCount * 3);
for (let i = 0; i < dustCount; i++) {
  dustPositions[i * 3] = (Math.random() - 0.5) * 58;
  dustPositions[i * 3 + 1] = Math.random() * 27;
  dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 58;
}
dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
const dustMaterial = new THREE.PointsMaterial({
  color: 0xa7e7f5,
  size: 0.035,
  map: textures.glowTexture,
  transparent: true,
  opacity: 0.32,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  sizeAttenuation: true,
  toneMapped: false,
});
const dust = new THREE.Points(dustGeometry, dustMaterial);
scene.add(dust);

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

const state = {
  mode: 'boot', // boot | menu | playing | paused | complete
  levelIndex: 0,
  level: null,
  cores: 0,
  elapsed: 0,
  placements: 0,
  teleports: 0,
  portalCooldown: 0,
  portalActive: false,
  portalPanel: null,
  portalOpen: 0,
  recoil: 0,
  shakeTime: 0,
  shakePower: 0,
  aim: null,
  runStats: [],
  totalPlacements: 0,
  suppressPause: false,
  hintTimer: 0,
  toastTimer: 0,
  lockLost: false,
  mouseDX: 0,
  mouseDY: 0,
  touch: { forward: 0, strafe: 0, jump: false },
};

const player = {
  pos: new THREE.Vector3(0, 0, 8),
  vel: new THREE.Vector3(),
  radius: 0.34,
  height: 1.82,
  eye: 1.64,
  yaw: 0,
  pitch: 0,
  onGround: false,
  coyote: 0,
  jumpQueued: false,
  walkCycle: 0,
  bob: 0,
  stepClock: 0,
  respawnFlash: 0,
};

const keys = Object.create(null);
const effects = [];

// ---------------------------------------------------------------------------
// Portal visuals
// ---------------------------------------------------------------------------

const PORTAL_RT_W = 384;
const PORTAL_RT_H = 512;
const portalRT = new THREE.WebGLRenderTarget(PORTAL_RT_W, PORTAL_RT_H, {
  type: THREE.HalfFloatType,
  depthBuffer: true,
  stencilBuffer: false,
});
portalRT.texture.colorSpace = THREE.SRGBColorSpace;
portalRT.texture.minFilter = THREE.LinearFilter;
portalRT.texture.magFilter = THREE.LinearFilter;
const portalCamera = new THREE.PerspectiveCamera(74, PORTAL_RT_W / PORTAL_RT_H, 0.045, 180);
portalCamera.matrixAutoUpdate = false;

const portalRoot = new THREE.Group();
portalRoot.visible = false;
scene.add(portalRoot);
const portalVisual = new THREE.Group();
portalRoot.add(portalVisual);

const portalDiscMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uMap: { value: portalRT.texture },
    uTime: { value: 0 },
    uTint: { value: new THREE.Color(0xff6b22) },
    uOpen: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D uMap;
    uniform float uTime;
    uniform vec3 uTint;
    uniform float uOpen;
    varying vec2 vUv;

    void main() {
      vec2 p = vUv - 0.5;
      float r = length(p) * 2.0;
      if (r > 1.0) discard;

      float angle = atan(p.y, p.x);
      vec2 dir = normalize(p + vec2(0.0001));
      float ripple = sin(r * 22.0 - uTime * 2.7 + angle * 3.0) * 0.0035;
      vec2 uv = vUv + dir * ripple + vec2(
        sin(vUv.y * 17.0 + uTime * 0.7) * 0.0018,
        cos(vUv.x * 15.0 - uTime * 0.6) * 0.0018
      );
      float ca = 0.0018 + r * 0.004;
      vec3 col;
      col.r = texture2D(uMap, uv + vec2(ca, 0.0)).r;
      col.g = texture2D(uMap, uv).g;
      col.b = texture2D(uMap, uv - vec2(ca, 0.0)).b;
      col *= 0.92 + 0.08 * sin(vUv.y * 290.0 + uTime * 8.0);

      float rim = smoothstep(0.66, 1.0, r);
      float halo = smoothstep(0.94, 1.0, r);
      col += uTint * (rim * 0.42 + halo * 1.6);
      col = mix(col, vec3(1.0, 0.83, 0.68), halo * 0.55);
      gl_FragColor = vec4(col * (0.5 + uOpen * 0.5), 1.0 - smoothstep(0.985, 1.0, r));
    }
  `,
  transparent: true,
  depthWrite: true,
  side: THREE.FrontSide,
  blending: THREE.NormalBlending,
  toneMapped: false,
});

const portalDisc = new THREE.Mesh(new THREE.PlaneGeometry(PORTAL_W, PORTAL_H), portalDiscMaterial);
portalDisc.position.z = 0.018;
portalDisc.renderOrder = 4;
portalVisual.add(portalDisc);

const portalRingDark = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.085, 8, 64), mats.black);
portalRingDark.scale.set(0.88, 1.2, 1);
portalRingDark.position.z = 0.045;
portalVisual.add(portalRingDark);

const portalRingMetal = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.033, 8, 64), mats.metal);
portalRingMetal.scale.set(0.88, 1.2, 1);
portalRingMetal.position.z = 0.07;
portalVisual.add(portalRingMetal);

const portalRingGlow = new THREE.Mesh(new THREE.TorusGeometry(1.13, 0.018, 6, 72), mats.orange);
portalRingGlow.scale.set(0.88, 1.2, 1);
portalRingGlow.position.z = 0.085;
portalVisual.add(portalRingGlow);

const portalArcs = [];
for (let i = 0; i < 2; i++) {
  const arc = new THREE.Mesh(
    new THREE.TorusGeometry(1.35 + i * 0.04, 0.012, 5, 38, Math.PI * (0.45 + i * 0.2)),
    i === 0 ? mats.orangeSoft : mats.cyanSoft,
  );
  arc.scale.set(0.88, 1.2, 1);
  arc.position.z = 0.09;
  arc.rotation.z = i * 2.4;
  portalVisual.add(arc);
  portalArcs.push(arc);
}

const portalLight = new THREE.PointLight(0xff6b24, 7.2, 11, 2);
portalLight.position.z = 0.75;
portalVisual.add(portalLight);

const portalSparkGeometry = new THREE.BufferGeometry();
const sparkCount = 42;
const sparkPositions = new Float32Array(sparkCount * 3);
for (let i = 0; i < sparkCount; i++) {
  const a = (i / sparkCount) * Math.PI * 2;
  sparkPositions[i * 3] = Math.cos(a) * (1.13 + Math.random() * 0.2);
  sparkPositions[i * 3 + 1] = Math.sin(a) * (1.53 + Math.random() * 0.2);
  sparkPositions[i * 3 + 2] = 0.1 + Math.random() * 0.14;
}
portalSparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
const portalSparks = new THREE.Points(portalSparkGeometry, new THREE.PointsMaterial({
  color: 0xffb077,
  size: 0.04,
  transparent: true,
  opacity: 0.8,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
  sizeAttenuation: true,
}));
portalVisual.add(portalSparks);

// Placement ghost.
const ghost = new THREE.Group();
ghost.visible = false;
scene.add(ghost);
const ghostDiscMat = new THREE.MeshBasicMaterial({
  color: 0xff8a45,
  transparent: true,
  opacity: 0.075,
  side: THREE.DoubleSide,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
});
const ghostDisc = new THREE.Mesh(new THREE.PlaneGeometry(PORTAL_W, PORTAL_H), ghostDiscMat);
ghostDisc.position.z = 0.012;
ghost.add(ghostDisc);
const ghostRimMat = new THREE.MeshBasicMaterial({
  color: 0xffa268,
  transparent: true,
  opacity: 0.7,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
});
const ghostRim = new THREE.Mesh(new THREE.TorusGeometry(1.24, 0.022, 5, 64), ghostRimMat);
ghostRim.scale.set(0.88, 1.2, 1);
ghostRim.position.z = 0.03;
ghost.add(ghostRim);
for (let i = 0; i < 4; i++) {
  const tick = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 0.02), ghostRimMat);
  const a = Math.PI * 0.25 + i * Math.PI * 0.5;
  tick.position.set(Math.cos(a) * 1.43, Math.sin(a) * 1.91, 0.03);
  tick.rotation.z = a - Math.PI / 2;
  ghost.add(tick);
}

// ---------------------------------------------------------------------------
// Weapon
// ---------------------------------------------------------------------------

const weaponRoot = new THREE.Group();
const weaponBase = new THREE.Vector3(0.31, -0.285, -0.6);
weaponRoot.position.copy(weaponBase);
weaponRoot.rotation.set(-0.035, -0.055, 0.01);
camera.add(weaponRoot);

const gunWhite = new THREE.MeshStandardMaterial({ color: 0xd9e5e4, roughness: 0.3, metalness: 0.3, envMapIntensity: 0.9 });
const gunDark = new THREE.MeshStandardMaterial({ color: 0x12191d, roughness: 0.28, metalness: 0.88, envMapIntensity: 1.0 });
const gunOrange = new THREE.MeshStandardMaterial({ color: 0x2d0c02, emissive: 0xff6a21, emissiveIntensity: 3.7, roughness: 0.3, metalness: 0.4 });
const gunCyan = new THREE.MeshStandardMaterial({ color: 0x031b22, emissive: 0x52eaff, emissiveIntensity: 3.0, roughness: 0.3, metalness: 0.4 });

function addWeaponBox(w, h, d, x, y, z, mat, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  weaponRoot.add(mesh);
  return mesh;
}

const weaponBody = addWeaponBox(0.19, 0.19, 0.52, 0, 0.03, 0, gunDark);
addWeaponBox(0.15, 0.075, 0.43, 0, 0.13, -0.06, gunWhite);
addWeaponBox(0.21, 0.055, 0.31, 0, -0.035, -0.02, gunWhite);
addWeaponBox(0.125, 0.12, 0.24, 0, -0.17, 0.12, gunDark, 0.23, 0, 0);
addWeaponBox(0.11, 0.055, 0.17, 0, 0.085, 0.23, gunWhite);
addWeaponBox(0.135, 0.06, 0.16, 0, -0.085, 0.25, gunDark, -0.25, 0, 0);

const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.095, 0.34, 10), gunDark);
barrel.rotation.x = Math.PI / 2;
barrel.position.set(0, 0.03, -0.4);
weaponRoot.add(barrel);

const barrelInner = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.02, 14), gunOrange);
barrelInner.rotation.x = Math.PI / 2;
barrelInner.position.set(0, 0.03, -0.58);
weaponRoot.add(barrelInner);

const gunRing = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.016, 6, 32), gunOrange);
gunRing.position.set(0, 0.03, -0.31);
weaponRoot.add(gunRing);

const gunRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.083, 0.012, 6, 32), gunCyan);
gunRing2.position.set(0, 0.03, -0.46);
weaponRoot.add(gunRing2);

addWeaponBox(0.24, 0.018, 0.024, 0, 0.132, -0.17, gunOrange);
addWeaponBox(0.024, 0.24, 0.022, 0.123, 0.01, 0.04, gunCyan);
addWeaponBox(0.024, 0.24, 0.022, -0.123, 0.01, 0.04, gunOrange);

const muzzleLight = new THREE.PointLight(0xff6a21, 0, 2.4, 2);
muzzleLight.position.set(0, 0.03, -0.62);
weaponRoot.add(muzzleLight);

for (const [x, y, z] of [[0.08, 0.07, -0.08], [-0.08, 0.07, -0.08], [0.08, -0.07, -0.08], [-0.08, -0.07, -0.08]]) {
  const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 8), gunDark);
  bolt.rotation.x = Math.PI / 2;
  bolt.position.set(x, y, z);
  weaponRoot.add(bolt);
}

weaponRoot.visible = false;

// ---------------------------------------------------------------------------
// Menu camera
// ---------------------------------------------------------------------------

const menuLook = new THREE.Vector3(-1.6, 2.8, -6.0);

function updateMenuCamera(t) {
  const a = t * 0.045;
  camera.position.set(5.6 + Math.sin(a) * 2.2, 4.1 + Math.sin(a * 0.7) * 0.25, 9.7 + Math.cos(a) * 1.1);
  camera.lookAt(menuLook.x + Math.sin(a * 0.6) * 0.6, menuLook.y, menuLook.z);
  camera.fov = 66;
  camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------------------
// Level lifecycle
// ---------------------------------------------------------------------------

function clearLevel() {
  if (state.level?.root) {
    scene.remove(state.level.root);
    state.level.root.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
    });
  }
  state.level = null;
}

function clearEffects() {
  for (const effect of effects) {
    scene.remove(effect.object);
    effect.object.traverse?.((object) => {
      object.geometry?.dispose?.();
      object.material?.dispose?.();
    });
  }
  effects.length = 0;
}

function loadLevel(index, { preview = false } = {}) {
  clearTimeout(state.hintTimer);
  clearLevel();
  clearEffects();

  state.levelIndex = index;
  const level = buildLevel(index, { mats, textures });
  state.level = level;
  scene.add(level.root);
  level.root.updateMatrixWorld(true);

  state.cores = 0;
  state.elapsed = 0;
  state.placements = 0;
  state.teleports = 0;
  state.portalCooldown = 0;
  state.portalActive = false;
  state.portalPanel = null;
  state.portalOpen = 0;
  state.recoil = 0;
  state.shakeTime = 0;
  state.shakePower = 0;
  state.aim = null;
  state.mouseDX = 0;
  state.mouseDY = 0;
  state.lockLost = false;

  portalRoot.visible = false;
  portalVisual.scale.setScalar(0.01);
  ghost.visible = false;
  level.anchor.setActive(false);
  level.exit.locked = true;
  level.exit.open = false;
  level.exit.doorOpen = 0;
  if (level.exit.door) level.exit.door.position.y = 1.7;
  if (level.exit.seams) {
    for (const seam of level.exit.seams) seam.material = mats.red;
  }
  if (level.exit.light) level.exit.light.color.setHex(0xff4b28);
  if (level.exit.beam) {
    level.exit.beam.material.color.setHex(0xff5230);
    level.exit.beam.material.opacity = 0.09;
  }
  if (level.exit.ring) {
    level.exit.ring.material = mats.red;
    level.exit.ring2.material = mats.red;
  }
  if (level.finalPanel) setPanelEnabled(level.finalPanel, mats, false);

  // Spawn.
  player.pos.set(level.spawn.x, level.spawn.y, level.spawn.z);
  player.vel.set(0, 0, 0);
  player.yaw = level.spawn.yaw;
  player.pitch = level.spawn.pitch;
  player.onGround = false;
  player.coyote = 0;
  player.jumpQueued = false;
  player.walkCycle = 0;
  player.bob = 0;

  ui.chamberTag.textContent = level.tag;
  ui.chamberName.textContent = level.name;
  ui.objectiveText.textContent = level.brief;
  ui.coreCount.textContent = `0 / ${level.required}`;
  ui.coreBars.innerHTML = Array.from({ length: level.required }, () => '<i></i>').join('');
  ui.portalStatus.textContent = 'NO LINK';
  ui.portalStatus.parentElement.classList.remove('linked');
  ui.reticle.classList.remove('valid', 'edge');
  ui.aimLabel.textContent = '';
  ui.objectiveMarker.classList.add('hidden');
  ui.objectiveMarker.classList.remove('unlocked');
  ui.markerText.textContent = 'EXTRACTION';
  ui.warnFx.classList.remove('on');
  ui.toast.classList.remove('show', 'cyan');
  ui.audioBadge.classList.remove('show');

  weaponRoot.visible = !preview;
  cameraFill.intensity = 1.4;

  if (preview) {
    state.mode = 'menu';
    ui.hud.classList.add('hidden');
    ui.touchControls.classList.add('hidden');
    updateMenuCamera(0);
    return;
  }

  state.mode = 'playing';
  ui.hud.classList.remove('hidden');
  weaponRoot.visible = true;
  updateCamera(0, true);
  updateHud();
  showLevelIntro(level);
  state.hintTimer = window.setTimeout(() => {
    if (state.mode === 'playing') showToast(level.hint, 'cyan', 7200);
  }, 4300);
  state.levelStartedAt = performance.now();
}

function updateHud() {
  if (!state.level) return;
  const linked = state.portalActive && state.level.anchor.active;
  ui.portalStatus.textContent = linked ? 'LINKED · ANCHOR' : 'NO LINK';
  ui.portalStatus.parentElement.classList.toggle('linked', linked);
  ui.coreCount.textContent = `${state.cores} / ${state.level.required}`;
  [...ui.coreBars.children].forEach((bar, index) => {
    bar.classList.toggle('on', index < state.cores);
  });
}

function showLevelIntro(level) {
  ui.introTag.textContent = level.tag;
  ui.introName.textContent = level.name;
  ui.introBrief.textContent = level.brief;
  ui.levelIntro.classList.remove('show');
  void ui.levelIntro.offsetWidth;
  ui.levelIntro.classList.add('show');
}

let toastTimeout = 0;
function showToast(text, kind = '', duration = 2600) {
  clearTimeout(toastTimeout);
  ui.toast.textContent = text;
  ui.toast.classList.toggle('cyan', kind === 'cyan');
  ui.toast.classList.add('show');
  toastTimeout = window.setTimeout(() => ui.toast.classList.remove('show'), duration);
}

function flash(kind) {
  ui.flashFx.className = '';
  void ui.flashFx.offsetWidth;
  ui.flashFx.classList.add(kind);
}

// ---------------------------------------------------------------------------
// Portal placement / linking
// ---------------------------------------------------------------------------

const raycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);
raycaster.far = 72;

function updateAim() {
  if (!state.level || state.mode !== 'playing') {
    ghost.visible = false;
    state.aim = null;
    if (state.level) {
      ui.reticle.classList.remove('valid', 'edge');
      ui.aimLabel.textContent = '';
    }
    return;
  }

  state.level.root.updateMatrixWorld(true);
  raycaster.setFromCamera(screenCenter, camera);
  const meshes = state.level.panels.filter((panel) => panel.enabled).map((panel) => panel.mesh);
  const hits = raycaster.intersectObjects(meshes, false);

  if (!hits.length) {
    state.aim = null;
    ghost.visible = false;
    ui.reticle.classList.remove('valid', 'edge');
    ui.aimLabel.textContent = '';
    return;
  }

  const hit = hits[0];
  const panel = state.level.panels.find((entry) => entry.mesh === hit.object);
  if (!panel) {
    state.aim = null;
    ghost.visible = false;
    ui.reticle.classList.remove('valid', 'edge');
    ui.aimLabel.textContent = '';
    return;
  }

  panel.mesh.updateWorldMatrix(true, false);
  const local = panel.mesh.worldToLocal(hit.point.clone());
  const halfX = panel.w / 2 - PORTAL_W / 2 - 0.08;
  const halfY = panel.h / 2 - PORTAL_H / 2 - 0.08;
  const edge = Math.abs(local.x) > halfX || Math.abs(local.y) > halfY;
  const clampedX = THREE.MathUtils.clamp(local.x, -halfX, halfX);
  const clampedY = THREE.MathUtils.clamp(local.y, -halfY, halfY);
  const center = panel.mesh.localToWorld(new THREE.Vector3(clampedX, clampedY, 0.055));

  if (edge) {
    state.aim = { valid: false, panel, center, reason: 'edge' };
    ghost.visible = true;
    ghost.position.copy(center);
    ghost.rotation.set(0, panel.ry, 0);
    ghostDiscMat.color.setHex(0xff4938);
    ghostRimMat.color.setHex(0xff4938);
    ghostDiscMat.opacity = 0.06;
    ghostRimMat.opacity = 0.75;
    ui.reticle.classList.remove('valid');
    ui.reticle.classList.add('edge');
    ui.aimLabel.textContent = 'EDGE CLEARANCE // RECENTER';
    return;
  }

  state.aim = { valid: true, panel, center, normal: panel.normal.clone(), ry: panel.ry };
  ghost.visible = true;
  ghost.position.copy(center);
  ghost.rotation.set(0, panel.ry, 0);
  ghostDiscMat.color.setHex(0xff8a45);
  ghostRimMat.color.setHex(0xffa268);
  ghostDiscMat.opacity = 0.075;
  ghostRimMat.opacity = 0.7;
  ui.reticle.classList.remove('edge');
  ui.reticle.classList.add('valid');
  ui.aimLabel.textContent = 'CERAMIC SURFACE // ALIGNED';
}

function tryPlacePortal() {
  if (state.mode !== 'playing') return;
  if (!state.aim || !state.aim.valid) {
    audio.placeDenied();
    audio.click();
    showToast('NO STABLE SURFACE // AIM AT A LIT CERAMIC PANEL', '', 1900);
    ui.reticle.classList.remove('edge');
    ui.reticle.classList.add('edge');
    window.setTimeout(() => {
      if (state.mode === 'playing') ui.reticle.classList.remove('edge');
    }, 220);
    state.recoil = Math.max(state.recoil, 0.4);
    return;
  }

  const { center, ry, panel } = state.aim;
  state.portalActive = true;
  state.portalPanel = panel;
  state.portalOpen = 0;
  state.placements += 1;
  state.totalPlacements += 1;
  state.portalCooldown = 0.6;

  portalRoot.position.copy(center);
  portalRoot.rotation.set(0, ry, 0);
  portalRoot.updateMatrixWorld(true);
  portalRoot.visible = true;
  portalVisual.scale.setScalar(0.01);
  state.level.anchor.setActive(true);
  updateHud();

  audio.portal();
  audio.click();
  flash('portal');
  state.recoil = 1;
  state.shakeTime = 0.23;
  state.shakePower = 0.028;
  spawnShockwave(center, new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry), 0xff7a2e, 1.5);
  spawnBurst(center, 0xff8438, 26, 2.2);
  showToast('SINGLE PORTAL LINKED // ANCHOR RECEIVER ACTIVE', 'cyan', 2600);
}

function recallPortal() {
  if (state.mode !== 'playing' || !state.portalActive) return;
  state.portalActive = false;
  state.portalPanel = null;
  state.portalOpen = 0;
  portalRoot.visible = false;
  if (state.level) state.level.anchor.setActive(false);
  updateHud();
  audio.recall();
  spawnBurst(portalRoot.position, 0xff6b23, 18, 1.4);
  showToast('PORTAL RECALLED // EMITTER READY', '', 1700);
}

function renderPortalView() {
  if (!state.portalActive || !state.level) return;
  const anchor = state.level.anchor;
  portalRoot.updateMatrixWorld(true);
  anchor.group.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);

  const flip = new THREE.Matrix4().makeRotationY(Math.PI);
  const virtual = new THREE.Matrix4()
    .multiplyMatrices(anchor.group.matrixWorld, flip)
    .multiply(new THREE.Matrix4().copy(portalRoot.matrixWorld).invert())
    .multiply(camera.matrixWorld);

  portalCamera.matrixWorld.copy(virtual);
  portalCamera.matrixWorldInverse.copy(virtual).invert();
  portalCamera.fov = camera.fov;
  portalCamera.aspect = PORTAL_RT_W / PORTAL_RT_H;
  portalCamera.near = camera.near;
  portalCamera.far = camera.far;
  portalCamera.updateProjectionMatrix();

  const planePos = anchor.position.clone().addScaledVector(anchor.normal, 0.18);
  const clipPlane = new THREE.Plane(anchor.normal.clone(), -anchor.normal.dot(planePos));
  const oldClipping = renderer.clippingPlanes;
  renderer.clippingPlanes = [clipPlane];

  portalRoot.visible = false;
  anchor.group.visible = false;
  ghost.visible = false;

  renderer.setRenderTarget(portalRT);
  renderer.clear();
  renderer.render(scene, portalCamera);
  renderer.setRenderTarget(null);

  renderer.clippingPlanes = oldClipping;
  portalRoot.visible = true;
  anchor.group.visible = true;
}

// ---------------------------------------------------------------------------
// Player update
// ---------------------------------------------------------------------------

function updatePlayer(dt) {
  const level = state.level;
  if (!level) return;

  let forwardInput = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) + state.touch.forward;
  let strafeInput = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + state.touch.strafe;
  const inputLength = Math.hypot(forwardInput, strafeInput);
  if (inputLength > 1) {
    forwardInput /= inputLength;
    strafeInput /= inputLength;
  }

  const sprint = keys.ShiftLeft || keys.ShiftRight;
  const targetSpeed = sprint ? 7.4 : 4.75;
  const sinYaw = Math.sin(player.yaw);
  const cosYaw = Math.cos(player.yaw);
  const wishX = -sinYaw * forwardInput + cosYaw * strafeInput;
  const wishZ = -cosYaw * forwardInput - sinYaw * strafeInput;

  const accel = player.onGround ? 34 : 8.5;
  if (inputLength > 0.05) {
    player.vel.x = THREE.MathUtils.damp(player.vel.x, wishX * targetSpeed, accel, dt);
    player.vel.z = THREE.MathUtils.damp(player.vel.z, wishZ * targetSpeed, accel, dt);
  } else if (player.onGround) {
    player.vel.x = THREE.MathUtils.damp(player.vel.x, 0, 13, dt);
    player.vel.z = THREE.MathUtils.damp(player.vel.z, 0, 13, dt);
  }

  if (state.touch.jump) {
    player.jumpQueued = true;
    state.touch.jump = false;
  }
  if (player.jumpQueued) {
    if (player.onGround || player.coyote > 0) {
      player.vel.y = 7.45;
      player.onGround = false;
      player.coyote = 0;
      audio.step(1.2);
    }
    player.jumpQueued = false;
  }

  player.vel.y -= 23.5 * dt;
  if (player.vel.y < -26) player.vel.y = -26;

  player.onGround = false;
  movePlayerAxis('x', player.vel.x * dt, level.boxes);
  movePlayerAxis('z', player.vel.z * dt, level.boxes);
  movePlayerAxis('y', player.vel.y * dt, level.boxes);

  if (player.onGround) {
    player.coyote = 0.11;
  } else {
    player.coyote = Math.max(0, player.coyote - dt);
  }

  const horizontalSpeed = Math.hypot(player.vel.x, player.vel.z);
  if (player.onGround && horizontalSpeed > 0.65) {
    player.walkCycle += dt * horizontalSpeed * 2.05;
    player.bob = Math.sin(player.walkCycle * 2) * 0.021 * Math.min(1, horizontalSpeed / 4.4);
    player.stepClock += dt * horizontalSpeed * 1.65;
    if (player.stepClock > 1.2) {
      player.stepClock = 0;
      audio.step(Math.min(1.4, horizontalSpeed / 4.4));
    }
  } else {
    player.bob = THREE.MathUtils.damp(player.bob, 0, 8, dt);
  }

  if (state.portalCooldown > 0) state.portalCooldown -= dt;
  checkPortalCrossing(level, dt);
  checkCorePickup(level);
  checkExit(level);

  if (player.pos.y < -9.5) {
    respawnPlayer();
  }
}

function intersectsPlayer(box) {
  return (
    player.pos.x + player.radius > box.minX &&
    player.pos.x - player.radius < box.maxX &&
    player.pos.y + player.height > box.minY &&
    player.pos.y < box.maxY &&
    player.pos.z + player.radius > box.minZ &&
    player.pos.z - player.radius < box.maxZ
  );
}

function movePlayerAxis(axis, amount, boxes) {
  if (amount === 0) return;
  player.pos[axis] += amount;
  for (const box of boxes) {
    if (!intersectsPlayer(box)) continue;
    if (axis === 'x') {
      if (amount > 0) player.pos.x = box.minX - player.radius - 0.0001;
      else player.pos.x = box.maxX + player.radius + 0.0001;
      player.vel.x = 0;
    } else if (axis === 'z') {
      if (amount > 0) player.pos.z = box.minZ - player.radius - 0.0001;
      else player.pos.z = box.maxZ + player.radius + 0.0001;
      player.vel.z = 0;
    } else {
      if (amount > 0) {
        player.pos.y = box.minY - player.height - 0.0001;
        player.vel.y = Math.min(0, player.vel.y);
      } else {
        player.pos.y = box.maxY + 0.0001;
        player.vel.y = 0;
        player.onGround = true;
      }
    }
  }
}

function bodyOverlapsPortal(portalPos, normal) {
  const dx = player.pos.x - portalPos.x;
  const dz = player.pos.z - portalPos.z;
  const along = dx * normal.x + dz * normal.z;
  const side = -dz * normal.x + dx * normal.z;
  const vertMin = portalPos.y - PORTAL_H * 0.5;
  const vertMax = portalPos.y + PORTAL_H * 0.5;
  const verticalOverlap = player.pos.y + player.height * 0.92 > vertMin && player.pos.y < vertMax;
  return {
    along,
    side,
    inRange: Math.abs(along) < 0.68 && Math.abs(side) < PORTAL_W * 0.47 && verticalOverlap,
  };
}

function checkPortalCrossing(level, dt) {
  if (state.portalCooldown > 0) return;
  const movingToward = (normal) => (player.vel.x * normal.x + player.vel.z * normal.z) < -0.35;

  // Entering the fixed cyan receiver.
  const anchor = level.anchor;
  if (anchor.active && state.portalActive && movingToward(anchor.normal)) {
    const check = bodyOverlapsPortal(anchor.position, anchor.normal);
    if (check.inRange) {
      teleportTo(portalRoot.position, new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), portalRoot.rotation.y));
      return;
    }
  }

  // Entering the player's placed orange portal.
  if (state.portalActive) {
    const placedNormal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), portalRoot.rotation.y);
    if (movingToward(placedNormal)) {
      const check = bodyOverlapsPortal(portalRoot.position, placedNormal);
      if (check.inRange) {
        teleportTo(anchor.position, anchor.normal);
      }
    }
  }
}

function findExitYaw(normal) {
  return Math.atan2(-normal.x, -normal.z);
}

function teleportTo(destination, normal) {
  const dest = destination.clone().addScaledVector(normal, 0.95);
  player.pos.set(dest.x, dest.y - player.eye + 0.08, dest.z);
  player.yaw = findExitYaw(normal);
  player.pitch = 0;
  const speed = Math.hypot(player.vel.x, player.vel.z);
  player.vel.set(normal.x * Math.max(3.3, speed * 0.45), 0.4, normal.z * Math.max(3.3, speed * 0.45));
  player.onGround = false;
  player.coyote = 0;
  state.portalCooldown = 1.15;
  state.teleports += 1;
  audio.teleport();
  flash('teleport');
  state.shakeTime = 0.48;
  state.shakePower = 0.055;
  state.recoil = Math.max(state.recoil, 0.55);
  spawnShockwave(dest, normal, 0x5deaff, 1.3);
  spawnBurst(dest, 0x7df2ff, 30, 2.0);
  showToast('SPATIAL LINK TRANSIT // POSITION REBASED', 'cyan', 1700);
}

function respawnPlayer() {
  const level = state.level;
  if (!level) return;
  player.pos.set(level.spawn.x, level.spawn.y, level.spawn.z);
  player.vel.set(0, 0, 0);
  player.yaw = level.spawn.yaw;
  player.pitch = level.spawn.pitch;
  player.onGround = false;
  state.portalCooldown = 1.0;
  audio.fail();
  flash('hit');
  ui.warnFx.classList.add('on');
  window.setTimeout(() => ui.warnFx.classList.remove('on'), 720);
  showToast('SUBJECT RECOVERED // POSITION RESET', '', 2200);
}

// ---------------------------------------------------------------------------
// Objectives
// ---------------------------------------------------------------------------

function checkCorePickup(level) {
  for (const core of level.cores) {
    if (core.collected) continue;
    const dx = player.pos.x - core.position.x;
    const dz = player.pos.z - core.position.z;
    const bodyY = player.pos.y + player.height * 0.55;
    if (dx * dx + dz * dz < 1.65 * 1.65 && Math.abs(bodyY - core.position.y) < 1.7) {
      core.collected = true;
      core.group.visible = false;
      state.cores += 1;
      audio.pickup();
      flash('portal');
      spawnBurst(core.position, 0x77efff, 38, 2.6);
      spawnShockwave(core.position, new THREE.Vector3(0, 1, 0), 0x69e9ff, 1.2);
      updateHud();
      const remaining = level.required - state.cores;
      if (remaining > 0) {
        ui.objectiveText.textContent = `${remaining} flux core${remaining === 1 ? '' : 's'} remaining. Use the single link.`;
        showToast(`FLUX CORE SECURED // ${state.cores} OF ${level.required}`, 'cyan', 2300);
      } else {
        unlockExit(level);
      }
    }
  }
}

function unlockExit(level) {
  if (!level.exit.locked) return;
  level.exit.locked = false;
  level.exit.open = true;
  level.exit.light?.color.setHex(0x54ff9e);
  if (level.exit.seams) {
    for (const seam of level.exit.seams) seam.material = mats.green;
  }
  if (level.exit.beam) {
    level.exit.beam.material.color.setHex(0x4beaff);
    level.exit.beam.material.opacity = 0.15;
    level.exit.ring.material = mats.cyan;
    level.exit.ring2.material = mats.cyan;
  }
  if (level.exit.ring && !level.exit.beam) {
    level.exit.ring.material = mats.cyan;
    level.exit.ring2.material = mats.cyan;
  }
  if (level.finalPanel) {
    setPanelEnabled(level.finalPanel, mats, true);
  }

  ui.objectiveMarker.classList.remove('hidden');
  ui.objectiveMarker.classList.add('unlocked');

  if (level.index === 2) {
    ui.objectiveText.textContent = 'Array complete. Place your portal on the lit loft panel and reach extraction.';
    ui.markerText.textContent = 'LOFT PANEL ONLINE';
    showToast('FLUX ARRAY COMPLETE // EXTRACTION LOFT ONLINE', 'cyan', 4200);
  } else {
    ui.objectiveText.textContent = 'Flux array complete. The extraction gate is open.';
    ui.markerText.textContent = 'EXTRACTION ONLINE';
    showToast('FLUX ARRAY COMPLETE // EXTRACTION GATE ONLINE', 'cyan', 3800);
  }
  audio.unlock();
  spawnBurst(level.exit.position, 0x65f3ff, 26, 2.8);
}

function checkExit(level) {
  const exit = level.exit;
  const dx = player.pos.x - exit.trigger.x;
  const dz = player.pos.z - exit.trigger.z;
  const dy = Math.abs(player.pos.y - exit.trigger.y);
  const near = dx * dx + dz * dz < 1.75 * 1.75 && dy < 2.1;
  if (!near) return;
  if (exit.locked) {
    const now = performance.now();
    if (!state.lockedMessageAt || now - state.lockedMessageAt > 2600) {
      state.lockedMessageAt = now;
      audio.placeDenied();
      showToast(`EXTRACTION LOCKED // ${level.required - state.cores} FLUX CORE${level.required - state.cores === 1 ? '' : 'S'} MISSING`, '', 2200);
    }
    return;
  }
  completeLevel();
}

function completeLevel() {
  if (state.mode !== 'playing') return;
  state.mode = 'complete';
  state.suppressPause = true;
  if (document.pointerLockElement) document.exitPointerLock();
  state.suppressPause = false;

  const level = state.level;
  const cores = state.cores;
  state.runStats[state.levelIndex] = {
    time: state.elapsed,
    cores,
    placements: state.placements,
    teleports: state.teleports,
  };
  const totalPlacements = state.runStats.reduce((sum, entry) => sum + (entry?.placements || 0), 0);
  const totalCores = state.runStats.reduce((sum, entry) => sum + (entry?.cores || 0), 0);
  const totalTime = state.runStats.reduce((sum, entry) => sum + (entry?.time || 0), 0);

  if (level.index === 2) {
    audio.success();
    ui.endingScreen.classList.remove('hidden');
    ui.endTime.textContent = formatTime(totalTime).replace(/^00:/, '');
    ui.endCores.textContent = String(totalCores);
    ui.endPlacements.textContent = String(totalPlacements);
    ui.touchControls.classList.add('hidden');
    ui.hud.classList.add('hidden');
    return;
  }

  audio.success();
  const nextNames = ['TRIANGULATION', 'SINGULARITY'];
  ui.completeKicker.textContent = 'CHAMBER CLEARED';
  ui.completeTitle.textContent = `${level.name} COMPLETE`;
  ui.completeBody.textContent = `Flux array stable. ${nextNames[level.index]} is waiting.`;
  ui.resultTime.textContent = formatTime(state.elapsed);
  ui.resultCores.textContent = `${cores} / ${level.required}`;
  ui.resultTeleports.textContent = String(state.teleports);
  ui.nextBtn.innerHTML = `NEXT CHAMBER <span>→</span>`;
  ui.nextBtn.classList.remove('hidden');
  ui.replayLevelBtn.classList.add('hidden');
  ui.completeFoot.textContent = 'SINGLE-EMITTER LINK HELD STABLE';
  ui.completeScreen.classList.remove('hidden');
  ui.touchControls.classList.add('hidden');
}

function formatTime(seconds) {
  const clamped = Math.max(0, seconds);
  const minutes = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  const tenths = Math.floor((clamped % 1) * 10);
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

function spawnBurst(position, color, count = 24, speed = 2) {
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = position.x + (Math.random() - 0.5) * 0.35;
    positions[i * 3 + 1] = position.y + (Math.random() - 0.5) * 0.35;
    positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.35;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const s = speed * (0.25 + Math.random() * 0.9);
    velocities.push(new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * s,
      Math.cos(phi) * s * 0.75 + 0.35,
      Math.sin(phi) * Math.sin(theta) * s,
    ));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size: 0.075,
    map: textures.glowTexture,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);
  effects.push({ object: points, velocities, life: 0, maxLife: 0.95, type: 'burst' });
}

function spawnShockwave(position, normal, color, scale = 1) {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 56), material);
  mesh.position.copy(position).addScaledVector(normal, 0.07);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize());
  scene.add(mesh);
  effects.push({ object: mesh, life: 0, maxLife: 0.75, type: 'ring', scale, baseOpacity: 0.9 });
}

function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const effect = effects[i];
    effect.life += dt;
    const progress = effect.life / effect.maxLife;
    if (progress >= 1) {
      scene.remove(effect.object);
      effect.object.geometry?.dispose?.();
      effect.object.material?.dispose?.();
      effects.splice(i, 1);
      continue;
    }
    if (effect.type === 'burst') {
      const attr = effect.object.geometry.attributes.position;
      for (let j = 0; j < effect.velocities.length; j++) {
        const vel = effect.velocities[j];
        attr.array[j * 3] += vel.x * dt;
        attr.array[j * 3 + 1] += vel.y * dt;
        attr.array[j * 3 + 2] += vel.z * dt;
        vel.multiplyScalar(1 - dt * 1.8);
        vel.y -= 3.4 * dt;
      }
      attr.needsUpdate = true;
      effect.object.material.opacity = (1 - progress) * 0.9;
    } else if (effect.type === 'ring') {
      const grow = 1 + progress * effect.scale * 3.0;
      effect.object.scale.setScalar(grow);
      effect.object.material.opacity = (1 - progress) * effect.baseOpacity;
    }
  }
}

// ---------------------------------------------------------------------------
// Camera, weapon
// ---------------------------------------------------------------------------

function updateCamera(dt, immediate = false) {
  const moving = player.onGround && Math.hypot(player.vel.x, player.vel.z) > 0.7;
  const bob = moving ? player.bob : 0;

  let shakeX = 0;
  let shakeY = 0;
  let shakeZ = 0;
  if (state.shakeTime > 0) {
    state.shakeTime = Math.max(0, state.shakeTime - dt);
    const power = state.shakePower * (state.shakeTime / 0.48);
    shakeX = (Math.random() - 0.5) * power;
    shakeY = (Math.random() - 0.5) * power;
    shakeZ = (Math.random() - 0.5) * power * 0.5;
  }

  camera.position.set(player.pos.x + shakeX, player.pos.y + player.eye + bob + shakeY, player.pos.z + shakeZ);
  camera.rotation.set(player.pitch + shakeY * 0.28, player.yaw + shakeX * 0.22, shakeZ * 0.35);
  const fovTarget = (keys.ShiftLeft || keys.ShiftRight) && Math.hypot(player.vel.x, player.vel.z) > 2.5 ? 78 : 74;
  if (Math.abs(camera.fov - fovTarget) > 0.02) {
    camera.fov = THREE.MathUtils.damp(camera.fov, fovTarget, immediate ? 100 : 4.2, immediate ? 1 : dt);
    camera.updateProjectionMatrix();
  }

  if (!immediate) {
    state.mouseDX = THREE.MathUtils.damp(state.mouseDX, 0, 10, dt);
    state.mouseDY = THREE.MathUtils.damp(state.mouseDY, 0, 10, dt);
  }
  updateWeapon(dt);
}

function updateWeapon(dt) {
  if (!weaponRoot.visible) return;
  state.recoil = THREE.MathUtils.damp(state.recoil, 0, 7.5, dt);
  const moving = player.onGround && Math.hypot(player.vel.x, player.vel.z) > 0.7;
  const bob = moving ? Math.sin(player.walkCycle * 2) * 0.013 : Math.sin(performance.now() * 0.0016) * 0.004;
  const swayX = THREE.MathUtils.clamp(state.mouseDX * 0.004, -0.035, 0.035);
  const swayY = THREE.MathUtils.clamp(state.mouseDY * 0.003, -0.022, 0.022);

  weaponRoot.position.x = THREE.MathUtils.damp(weaponRoot.position.x, weaponBase.x + swayX, 10, dt);
  weaponRoot.position.y = THREE.MathUtils.damp(weaponRoot.position.y, weaponBase.y + bob + swayY + state.recoil * 0.012, 10, dt);
  weaponRoot.position.z = THREE.MathUtils.damp(weaponRoot.position.z, weaponBase.z + state.recoil * 0.075, 13, dt);
  weaponRoot.rotation.x = THREE.MathUtils.damp(weaponRoot.rotation.x, -0.035 + swayY * 0.7 + state.recoil * 0.1, 10, dt);
  weaponRoot.rotation.y = THREE.MathUtils.damp(weaponRoot.rotation.y, -0.055 + swayX * 0.6, 10, dt);
  weaponRoot.rotation.z = THREE.MathUtils.damp(weaponRoot.rotation.z, 0.01 - swayX * 0.25, 10, dt);

  muzzleLight.intensity = THREE.MathUtils.damp(muzzleLight.intensity, 0, 16, dt);
  if (state.recoil > 0.85) muzzleLight.intensity = 2.4;
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

function onKeyDown(event) {
  if (event.repeat) {
    if (!['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) event.preventDefault();
    return;
  }

  if (state.mode === 'menu') {
    if (event.code === 'Enter' || event.code === 'Space') {
      event.preventDefault();
      startGame(true);
    }
    return;
  }

  if (event.code === 'Escape') {
    if (state.mode === 'playing') {
      pauseGame();
    } else if (state.mode === 'paused') {
      resumeGame();
    }
    return;
  }

  keys[event.code] = true;

  if (event.code === 'Space') {
    event.preventDefault();
    if (state.mode === 'playing') player.jumpQueued = true;
  }
  if (state.mode !== 'playing') return;

  if (event.code === 'KeyQ') recallPortal();
  if (event.code === 'KeyF') tryPlacePortal();
  if (event.code === 'KeyM') {
    const muted = audio.toggleMute();
    ui.audioBadge.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
    ui.audioBadge.classList.add('show');
    clearTimeout(state.audioBadgeTimer);
    state.audioBadgeTimer = window.setTimeout(() => ui.audioBadge.classList.remove('show'), 1300);
  }
}

function onKeyUp(event) {
  keys[event.code] = false;
}

function onMouseMove(event) {
  if (state.mode !== 'playing' || isTouch) return;
  if (document.pointerLockElement !== ui.canvas) return;
  player.yaw -= event.movementX * 0.00205;
  player.pitch -= event.movementY * 0.00195;
  player.pitch = THREE.MathUtils.clamp(player.pitch, -1.44, 1.44);
  state.mouseDX += event.movementX;
  state.mouseDY += event.movementY;
}

function onMouseDown(event) {
  if (state.mode !== 'playing' || isTouch) return;
  if (document.pointerLockElement !== ui.canvas) {
    ui.canvas.requestPointerLock?.();
    return;
  }
  if (event.button === 0) tryPlacePortal();
  if (event.button === 2) recallPortal();
}

function onPointerLockChange() {
  if (document.pointerLockElement === ui.canvas) {
    if (state.mode === 'paused') {
      ui.pauseScreen.classList.add('hidden');
      state.mode = 'playing';
      ui.touchControls.classList.add('hidden');
    }
    state.lockLost = false;
    return;
  }
  if (state.mode === 'playing' && !isTouch && !state.suppressPause) {
    pauseGame(false);
  }
}

function pauseGame(tryExit = true) {
  if (state.mode !== 'playing') return;
  state.mode = 'paused';
  ui.pauseScreen.classList.remove('hidden');
  ui.touchControls.classList.add('hidden');
  if (tryExit && document.pointerLockElement) {
    state.suppressPause = true;
    document.exitPointerLock();
    state.suppressPause = false;
  }
}

function resumeGame() {
  if (state.mode !== 'paused') return;
  ui.pauseScreen.classList.add('hidden');
  state.mode = 'playing';
  if (isTouch) ui.touchControls.classList.remove('hidden');
  if (!isTouch) ui.canvas.requestPointerLock?.();
}

function restartLevel() {
  const index = state.levelIndex;
  ui.pauseScreen.classList.add('hidden');
  ui.completeScreen.classList.add('hidden');
  ui.endingScreen.classList.add('hidden');
  loadLevel(index);
  if (isTouch) ui.touchControls.classList.remove('hidden');
  else ui.canvas.requestPointerLock?.();
}

function startGame(lockPointer = true) {
  audio.init();
  audio.click();
  state.runStats = [];
  state.totalPlacements = 0;
  state.lockedMessageAt = 0;
  ui.menu.classList.add('hidden');
  ui.pauseScreen.classList.add('hidden');
  ui.completeScreen.classList.add('hidden');
  ui.endingScreen.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  if (isTouch) ui.touchControls.classList.remove('hidden');
  loadLevel(0);
  if (lockPointer && !isTouch) {
    ui.canvas.requestPointerLock?.();
  }
}

function returnToMenu() {
  if (document.pointerLockElement) document.exitPointerLock();
  state.mode = 'menu';
  ui.pauseScreen.classList.add('hidden');
  ui.completeScreen.classList.add('hidden');
  ui.endingScreen.classList.add('hidden');
  ui.hud.classList.add('hidden');
  ui.touchControls.classList.add('hidden');
  ui.menu.classList.remove('hidden');
  state.runStats = [];
  loadLevel(0, { preview: true });
  updateMenuCamera(performance.now() * 0.001);
}

// Touch controls
let joystickPointer = null;
let joystickCenter = { x: 0, y: 0 };
let lookPointer = null;
let lookLast = { x: 0, y: 0 };

function setupTouch() {
  if (!isTouch) return;
  ui.touchControls.classList.add('hidden');

  const updateStick = (event) => {
    const rect = ui.joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const max = rect.width * 0.31;
    let dx = event.clientX - cx;
    let dy = event.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    ui.stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    state.touch.strafe = dx / max;
    state.touch.forward = -dy / max;
  };

  ui.joystick.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    joystickPointer = event.pointerId;
    ui.joystick.setPointerCapture(event.pointerId);
    const rect = ui.joystick.getBoundingClientRect();
    joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    updateStick(event);
  });
  ui.joystick.addEventListener('pointermove', (event) => {
    if (event.pointerId !== joystickPointer) return;
    event.preventDefault();
    updateStick(event);
  });
  const release = (event) => {
    if (event.pointerId !== joystickPointer) return;
    joystickPointer = null;
    state.touch.forward = 0;
    state.touch.strafe = 0;
    ui.stick.style.transform = 'translate(-50%, -50%)';
  };
  ui.joystick.addEventListener('pointerup', release);
  ui.joystick.addEventListener('pointercancel', release);

  ui.touchPortal.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    tryPlacePortal();
  });
  ui.touchJump.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (state.mode === 'playing') state.touch.jump = true;
  });
  ui.touchRecall.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    recallPortal();
  });

  ui.canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch' || state.mode !== 'playing') return;
    if (lookPointer !== null) return;
    lookPointer = event.pointerId;
    lookLast = { x: event.clientX, y: event.clientY };
    ui.canvas.setPointerCapture(event.pointerId);
  });
  ui.canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'touch' || event.pointerId !== lookPointer || state.mode !== 'playing') return;
    const dx = event.clientX - lookLast.x;
    const dy = event.clientY - lookLast.y;
    lookLast = { x: event.clientX, y: event.clientY };
    player.yaw -= dx * 0.0042;
    player.pitch = THREE.MathUtils.clamp(player.pitch - dy * 0.0038, -1.42, 1.42);
    state.mouseDX += dx;
    state.mouseDY += dy;
  });
  const endLook = (event) => {
    if (event.pointerId === lookPointer) lookPointer = null;
  };
  ui.canvas.addEventListener('pointerup', endLook);
  ui.canvas.addEventListener('pointercancel', endLook);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

ui.startBtn.addEventListener('click', () => startGame(true));
ui.resumeBtn.addEventListener('click', resumeGame);
ui.restartBtn.addEventListener('click', restartLevel);
ui.quitBtn.addEventListener('click', returnToMenu);
ui.nextBtn.addEventListener('click', () => {
  const nextIndex = Math.min(2, state.levelIndex + 1);
  ui.completeScreen.classList.add('hidden');
  loadLevel(nextIndex);
  if (isTouch) ui.touchControls.classList.remove('hidden');
  else ui.canvas.requestPointerLock?.();
});
ui.replayLevelBtn.addEventListener('click', () => {
  ui.completeScreen.classList.add('hidden');
  loadLevel(state.levelIndex);
  if (isTouch) ui.touchControls.classList.remove('hidden');
  else ui.canvas.requestPointerLock?.();
});
ui.runAgainBtn.addEventListener('click', () => {
  ui.endingScreen.classList.add('hidden');
  startGame(true);
});
ui.pauseBtn?.addEventListener('click', () => {
  if (state.mode === 'playing') pauseGame();
});

window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mousedown', onMouseDown);
window.addEventListener('contextmenu', (event) => event.preventDefault());
document.addEventListener('pointerlockchange', onPointerLockChange);
window.addEventListener('blur', () => {
  if (state.mode === 'playing' && !isTouch) pauseGame();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.mode === 'playing') pauseGame();
});

window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
});

setupTouch();

// ---------------------------------------------------------------------------
// Update loop
// ---------------------------------------------------------------------------

let lastHudUpdate = 0;
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (state.mode === 'menu') {
    updateMenuCamera(t);
  }

  if (state.level) {
    state.level.animate(t, dt);
    updatePortalVisual(dt, t);
    updateEffects(dt);

    if (state.mode === 'playing') {
      state.elapsed += dt;
      updatePlayer(dt);
      updateCamera(dt);
      updateAim();
      if (performance.now() - lastHudUpdate > 80) {
        lastHudUpdate = performance.now();
        ui.timer.textContent = formatTime(state.elapsed);
      }
      if (isTouch) ui.touchControls.classList.remove('hidden');
    }
  }

  dust.rotation.y = t * 0.0032;
  dust.rotation.x = Math.sin(t * 0.05) * 0.02;

  if (state.portalActive) renderPortalView();
  else if (portalRoot.visible) portalRoot.visible = false;

  composer.render();
}

function updatePortalVisual(dt, t) {
  if (!state.portalActive) return;
  state.portalOpen = Math.min(1, state.portalOpen + dt * 5.4);
  const open = 1 - Math.pow(1 - state.portalOpen, 3);
  const overshoot = 1 + Math.sin(state.portalOpen * Math.PI) * 0.055;
  portalVisual.scale.setScalar(Math.max(0.01, open * overshoot));
  portalDiscMaterial.uniforms.uTime.value = t;
  portalDiscMaterial.uniforms.uOpen.value = open;
  portalSparks.rotation.z += dt * (0.35 + state.portalOpen * 0.45);
  portalArcs[0].rotation.z += dt * 0.5;
  portalArcs[1].rotation.z -= dt * 0.32;
  portalRingGlow.rotation.z += dt * 0.18;
  portalLight.intensity = 4.5 + Math.sin(t * 3.4) * 1.1 + open * 2.0;
  if (state.level) {
    state.level.anchor.discMaterial.uniforms.uTime.value = t;
  }
}

// Debug surface used by visual checks and the project capture pipeline.
window.__ONE_PORTAL = {
  state,
  player,
  camera,
  scene,
  renderer,
  start: (lock = false) => startGame(lock),
  loadLevel,
  setPlayer: ({ x, y, z, yaw = 0, pitch = 0 }) => {
    player.pos.set(x, y, z);
    player.vel.set(0, 0, 0);
    player.yaw = yaw;
    player.pitch = pitch;
    updateCamera(0, true);
  },
  placePanel: (index = 0) => {
    if (!state.level) return false;
    const panel = state.level.panels[index];
    if (!panel) return false;
    const center = panel.group.localToWorld(new THREE.Vector3(0, 0, 0.055));
    state.aim = { valid: true, panel, center, normal: panel.normal.clone(), ry: panel.ry };
    tryPlacePortal();
    updateAim();
    return true;
  },
  recall: recallPortal,
  unlockExit: () => {
    if (state.level) unlockExit(state.level);
  },
  complete: () => completeLevel(),
  pause: pauseGame,
  // Show the exact live portal view in a still frame.
  tick: () => {
    if (state.portalActive) renderPortalView();
    composer.render();
  },
};

loadLevel(0, { preview: true });
animate();
