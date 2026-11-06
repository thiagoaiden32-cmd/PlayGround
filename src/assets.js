import * as THREE from 'three';

function canvas2d(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return { canvas, ctx: canvas.getContext('2d') };
}

function speckle(ctx, size, count, alpha, colors) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[(Math.random() * colors.length) | 0];
    ctx.globalAlpha = alpha * Math.random();
    const s = Math.random() * 2 + 0.4;
    ctx.fillRect(Math.random() * size, Math.random() * size, s, s);
  }
  ctx.globalAlpha = 1;
}

function makeFloorTexture() {
  const size = 512;
  const { canvas, ctx } = canvas2d(size);
  ctx.fillStyle = '#171e25';
  ctx.fillRect(0, 0, size, size);

  // Broad brushed-metal gradient.
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, 'rgba(120,150,160,.08)');
  grad.addColorStop(0.48, 'rgba(0,0,0,.04)');
  grad.addColorStop(1, 'rgba(40,75,90,.10)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Ceramic/metal floor plates.
  const cell = size / 4;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const px = x * cell;
      const py = y * cell;
      ctx.fillStyle = (x + y) % 2 ? 'rgba(255,255,255,.012)' : 'rgba(0,0,0,.035)';
      ctx.fillRect(px + 2, py + 2, cell - 4, cell - 4);
      ctx.strokeStyle = 'rgba(4,7,10,.72)';
      ctx.lineWidth = 3;
      ctx.strokeRect(px + 1.5, py + 1.5, cell - 3, cell - 3);
      ctx.strokeStyle = 'rgba(150,190,200,.09)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 4, py + 4, cell - 8, cell - 8);
      // Tiny corner fasteners.
      for (const fx of [px + 12, px + cell - 12]) {
        for (const fy of [py + 12, py + cell - 12]) {
          ctx.fillStyle = 'rgba(170,200,205,.16)';
          ctx.beginPath();
          ctx.arc(fx, fy, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // Hairline scratches.
  for (let i = 0; i < 70; i++) {
    ctx.strokeStyle = `rgba(190,220,225,${Math.random() * 0.05})`;
    ctx.lineWidth = Math.random() * 0.7 + 0.2;
    ctx.beginPath();
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.random() * 40 - 20, y + Math.random() * 8 - 4);
    ctx.stroke();
  }

  speckle(ctx, size, 3200, 0.11, ['#cfe1e2', '#000000', '#577080']);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(7, 7);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeWallTexture() {
  const size = 512;
  const { canvas, ctx } = canvas2d(size);
  ctx.fillStyle = '#10161d';
  ctx.fillRect(0, 0, size, size);
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, 'rgba(105,140,155,.10)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,.28)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Tall architectural panel seams.
  for (let x = 0; x <= 4; x++) {
    const px = x * (size / 4);
    ctx.strokeStyle = 'rgba(3,5,8,.9)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, size);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(145,185,195,.10)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px + 5, 0);
    ctx.lineTo(px + 5, size);
    ctx.stroke();
  }
  for (let y = 0; y <= 2; y++) {
    const py = y * (size / 2);
    ctx.strokeStyle = 'rgba(2,4,6,.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(size, py);
    ctx.stroke();
  }
  speckle(ctx, size, 2200, 0.08, ['#a8c5ca', '#000000', '#3b5260']);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeCeramicTexture() {
  const size = 512;
  const { canvas, ctx } = canvas2d(size);
  ctx.fillStyle = '#dce5e3';
  ctx.fillRect(0, 0, size, size);

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, 'rgba(255,255,255,.34)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(96,130,138,.10)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Inset frame.
  ctx.strokeStyle = 'rgba(66,96,104,.38)';
  ctx.lineWidth = 3;
  ctx.strokeRect(16, 16, size - 32, size - 32);
  ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, size - 44, size - 44);

  // Faint inner alignment grid.
  ctx.strokeStyle = 'rgba(62,92,100,.09)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo((size / 4) * i, 34);
    ctx.lineTo((size / 4) * i, size - 34);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(34, (size / 4) * i);
    ctx.lineTo(size - 34, (size / 4) * i);
    ctx.stroke();
  }

  // Corner brackets.
  ctx.strokeStyle = 'rgba(80,115,122,.32)';
  ctx.lineWidth = 4;
  for (const [x, y, sx, sy] of [[34, 34, 1, 1], [size - 34, 34, -1, 1], [34, size - 34, 1, -1], [size - 34, size - 34, -1, -1]]) {
    ctx.beginPath();
    ctx.moveTo(x + 18 * sx, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + 18 * sy);
    ctx.stroke();
  }
  speckle(ctx, size, 1600, 0.11, ['#87999a', '#ffffff', '#537078']);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function makeGlowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const { canvas, ctx } = canvas2d(128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(0.18, inner);
  g.addColorStop(0.5, outer);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeSignTexture({ eyebrow = 'HORIZON // TEST NETWORK', title = 'CALIBRATION', sub = '', color = '#7cecff', align = 'left' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 1024, 384);

  ctx.save();
  ctx.globalAlpha = 0.36;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let x = 32; x < 1024; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 384);
    ctx.stroke();
  }
  for (let y = 32; y < 384; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = color;
  ctx.globalAlpha = 0.95;
  ctx.fillRect(52, 58, 10, 58);
  ctx.globalAlpha = 1;
  ctx.font = '600 26px "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
  ctx.letterSpacing = '4px';
  ctx.fillText(eyebrow.toUpperCase(), 82, 95);
  ctx.font = '700 78px "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillStyle = '#f2fbfc';
  ctx.fillText(title.toUpperCase(), 78, 181);
  ctx.font = '400 28px ui-monospace, "Roboto Mono", monospace';
  ctx.letterSpacing = '2px';
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.fillText(sub.toUpperCase(), 82, 234);
  ctx.globalAlpha = 0.5;
  ctx.fillRect(82, 268, 760, 2);
  ctx.globalAlpha = 0.7;
  ctx.font = '500 19px ui-monospace, "Roboto Mono", monospace';
  ctx.fillText('HORIZON INITIATIVE  /  SPATIAL SYSTEMS DIVISION', 82, 305);
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function createAssets() {
  const floorTexture = makeFloorTexture();
  const wallTexture = makeWallTexture();
  const ceramicTexture = makeCeramicTexture();
  const glowTexture = makeGlowTexture();
  const softGlowTexture = makeGlowTexture('rgba(150,235,255,.95)', 'rgba(70,180,230,.12)');

  const mats = {
    floor: new THREE.MeshStandardMaterial({
      map: floorTexture,
      color: 0xa8bac0,
      roughness: 0.42,
      metalness: 0.55,
      envMapIntensity: 0.9,
      bumpMap: floorTexture,
      bumpScale: 0.018,
    }),
    wall: new THREE.MeshStandardMaterial({
      map: wallTexture,
      color: 0x7c8d94,
      roughness: 0.58,
      metalness: 0.42,
      envMapIntensity: 0.55,
      bumpMap: wallTexture,
      bumpScale: 0.012,
    }),
    wallDark: new THREE.MeshStandardMaterial({
      color: 0x11171c,
      roughness: 0.45,
      metalness: 0.72,
      envMapIntensity: 0.65,
    }),
    black: new THREE.MeshStandardMaterial({
      color: 0x070a0d,
      roughness: 0.28,
      metalness: 0.9,
      envMapIntensity: 0.85,
    }),
    metal: new THREE.MeshStandardMaterial({
      color: 0x87969b,
      roughness: 0.28,
      metalness: 0.96,
      envMapIntensity: 1.1,
    }),
    metalDark: new THREE.MeshStandardMaterial({
      color: 0x29343b,
      roughness: 0.34,
      metalness: 0.88,
      envMapIntensity: 0.8,
    }),
    ceramic: new THREE.MeshStandardMaterial({
      map: ceramicTexture,
      color: 0xffffff,
      roughness: 0.34,
      metalness: 0.04,
      envMapIntensity: 0.55,
    }),
    ceramicEdge: new THREE.MeshStandardMaterial({
      color: 0x7b8f92,
      roughness: 0.3,
      metalness: 0.7,
    }),
    orange: new THREE.MeshStandardMaterial({
      color: 0x2a0b02,
      emissive: 0xff5b16,
      emissiveIntensity: 4.2,
      roughness: 0.35,
      metalness: 0.3,
    }),
    orangeSoft: new THREE.MeshBasicMaterial({ color: 0xff7a23 }),
    cyan: new THREE.MeshStandardMaterial({
      color: 0x021b22,
      emissive: 0x40e8ff,
      emissiveIntensity: 4.5,
      roughness: 0.3,
      metalness: 0.4,
    }),
    cyanSoft: new THREE.MeshBasicMaterial({ color: 0x75efff }),
    whiteGlow: new THREE.MeshBasicMaterial({ color: 0xe9ffff }),
    red: new THREE.MeshStandardMaterial({
      color: 0x210303,
      emissive: 0xff2d24,
      emissiveIntensity: 4.0,
      roughness: 0.4,
      metalness: 0.3,
    }),
    green: new THREE.MeshStandardMaterial({
      color: 0x021a0d,
      emissive: 0x52ff9e,
      emissiveIntensity: 4.2,
      roughness: 0.35,
      metalness: 0.3,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x87cfe2,
      roughness: 0.06,
      metalness: 0.15,
      transparent: true,
      opacity: 0.16,
      transmission: 0.2,
      thickness: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
      envMapIntensity: 1.3,
    }),
    core: new THREE.MeshStandardMaterial({
      color: 0x8bf7ff,
      emissive: 0x25d9ff,
      emissiveIntensity: 3.6,
      roughness: 0.16,
      metalness: 0.2,
      transparent: true,
      opacity: 0.92,
    }),
    coreShell: new THREE.MeshBasicMaterial({
      color: 0x9af8ff,
      wireframe: true,
      transparent: true,
      opacity: 0.52,
    }),
  };

  return { mats, textures: { floorTexture, wallTexture, ceramicTexture, glowTexture, softGlowTexture } };
}
