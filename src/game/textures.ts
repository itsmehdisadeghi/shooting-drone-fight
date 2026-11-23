import * as THREE from 'three';

export interface ProceduralTextureSet {
  asphaltMap: THREE.CanvasTexture;
  asphaltBump: THREE.CanvasTexture;
  glassFacadeMap: THREE.CanvasTexture;
  concreteFacadeMap: THREE.CanvasTexture;
  barrierMap: THREE.CanvasTexture;
  containerBump: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const aniso = Math.min(Math.max(maxAnisotropy, 1), 8);

  // 1. Satellite Urban Asphalt & Tactical Road Markings (tileable)
  const asphaltCanvas = document.createElement('canvas');
  asphaltCanvas.width = 512;
  asphaltCanvas.height = 512;
  const actx = asphaltCanvas.getContext('2d')!;
  actx.fillStyle = '#1e2430';
  actx.fillRect(0, 0, 512, 512);

  // Subtle asphalt grain speckles
  for (let i = 0; i < 3600; i++) {
    const x = (i * 73) % 512;
    const y = (i * 197 + Math.floor(i / 7) * 13) % 512;
    const shade = 26 + (i % 18);
    actx.fillStyle = `rgb(${shade}, ${shade + 5}, ${shade + 12})`;
    actx.fillRect(x, y, 2, 2);
  }

  // Avenue lane grid & satellite tile ticks
  actx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
  actx.lineWidth = 2;
  actx.strokeRect(2, 2, 508, 508);

  // Dashed traffic lane dividers
  actx.strokeStyle = 'rgba(226, 232, 240, 0.28)';
  actx.lineWidth = 4;
  actx.setLineDash([28, 24]);
  actx.beginPath();
  actx.moveTo(256, 0);
  actx.lineTo(256, 512);
  actx.moveTo(0, 256);
  actx.lineTo(512, 256);
  actx.stroke();
  actx.setLineDash([]);

  // Crosswalk stripes near intersections
  actx.fillStyle = 'rgba(226, 232, 240, 0.22)';
  for (let i = 0; i < 6; i++) {
    actx.fillRect(198 + i * 20, 22, 10, 32);
    actx.fillRect(22, 198 + i * 20, 32, 10);
  }

  // Subtle GPS map crosshair ticks
  actx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
  actx.lineWidth = 1.5;
  actx.beginPath();
  actx.moveTo(246, 256);
  actx.lineTo(266, 256);
  actx.moveTo(256, 246);
  actx.lineTo(256, 266);
  actx.stroke();

  const asphaltMap = new THREE.CanvasTexture(asphaltCanvas);
  asphaltMap.colorSpace = THREE.SRGBColorSpace;
  asphaltMap.wrapS = THREE.RepeatWrapping;
  asphaltMap.wrapT = THREE.RepeatWrapping;
  asphaltMap.repeat.set(9, 9);
  asphaltMap.anisotropy = aniso;

  // Asphalt grayscale bump map
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bctx = bumpCanvas.getContext('2d')!;
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const x = (i * 53) % 256;
    const y = (i * 131 + Math.floor(i / 5) * 11) % 256;
    const v = 96 + (i % 64);
    bctx.fillStyle = `rgb(${v},${v},${v})`;
    bctx.fillRect(x, y, 2, 2);
  }
  const asphaltBump = new THREE.CanvasTexture(bumpCanvas);
  asphaltBump.wrapS = THREE.RepeatWrapping;
  asphaltBump.wrapT = THREE.RepeatWrapping;
  asphaltBump.repeat.set(14, 14);
  asphaltBump.anisotropy = aniso;

  // 2. Glass Skyscraper Facade Texture
  const glassCanvas = document.createElement('canvas');
  glassCanvas.width = 256;
  glassCanvas.height = 512;
  const gctx = glassCanvas.getContext('2d')!;
  gctx.fillStyle = '#182436';
  gctx.fillRect(0, 0, 256, 512);

  const cols = 8;
  const rows = 16;
  const cw = 256 / cols;
  const rh = 512 / rows;
  for (let r = 0; r < rows; r++) {
    // Floor spandrel band
    gctx.fillStyle = '#0f1724';
    gctx.fillRect(0, r * rh, 256, 6);
    for (let c = 0; c < cols; c++) {
      const hash = ((r * 37 + c * 17 + r * c * 11) % 100) / 100;
      if (hash > 0.72) {
        gctx.fillStyle = hash > 0.88 ? '#eab676' : '#58b4e3';
      } else if (hash > 0.45) {
        gctx.fillStyle = '#253952';
      } else {
        gctx.fillStyle = '#19273b';
      }
      gctx.fillRect(c * cw + 3, r * rh + 8, cw - 6, rh - 10);
    }
  }
  const glassFacadeMap = new THREE.CanvasTexture(glassCanvas);
  glassFacadeMap.colorSpace = THREE.SRGBColorSpace;
  glassFacadeMap.wrapS = THREE.RepeatWrapping;
  glassFacadeMap.wrapT = THREE.RepeatWrapping;
  glassFacadeMap.anisotropy = aniso;

  // 3. Concrete Urban Midrise Facade Texture
  const concCanvas = document.createElement('canvas');
  concCanvas.width = 256;
  concCanvas.height = 512;
  const cctx = concCanvas.getContext('2d')!;
  cctx.fillStyle = '#333b48';
  cctx.fillRect(0, 0, 256, 512);

  for (let r = 0; r < 14; r++) {
    const y = r * (512 / 14);
    cctx.fillStyle = '#252b36';
    cctx.fillRect(0, y, 256, 5);
    for (let c = 0; c < 6; c++) {
      const hash = ((r * 29 + c * 41) % 100) / 100;
      cctx.fillStyle = hash > 0.78 ? '#f0c487' : hash > 0.5 ? '#1c2633' : '#141b26';
      cctx.fillRect(c * 42 + 6, y + 9, 30, 18);
    }
  }
  const concreteFacadeMap = new THREE.CanvasTexture(concCanvas);
  concreteFacadeMap.colorSpace = THREE.SRGBColorSpace;
  concreteFacadeMap.wrapS = THREE.RepeatWrapping;
  concreteFacadeMap.wrapT = THREE.RepeatWrapping;
  concreteFacadeMap.anisotropy = aniso;

  // 4. Concrete Jersey Barrier with Tactical Hazard Stripe
  const barCanvas = document.createElement('canvas');
  barCanvas.width = 256;
  barCanvas.height = 128;
  const barCtx = barCanvas.getContext('2d')!;
  barCtx.fillStyle = '#737d8c';
  barCtx.fillRect(0, 0, 256, 128);
  // Top hazard chevron band
  barCtx.fillStyle = '#eab308';
  barCtx.fillRect(0, 10, 256, 22);
  barCtx.fillStyle = '#181c22';
  for (let x = -32; x < 288; x += 32) {
    barCtx.beginPath();
    barCtx.moveTo(x, 10);
    barCtx.lineTo(x + 14, 10);
    barCtx.lineTo(x + 4, 32);
    barCtx.lineTo(x - 10, 32);
    barCtx.closePath();
    barCtx.fill();
  }
  const barrierMap = new THREE.CanvasTexture(barCanvas);
  barrierMap.colorSpace = THREE.SRGBColorSpace;
  barrierMap.wrapS = THREE.RepeatWrapping;
  barrierMap.wrapT = THREE.ClampToEdgeWrapping;
  barrierMap.anisotropy = aniso;

  // 5. Corrugated Cargo Container Bump Map
  const contCanvas = document.createElement('canvas');
  contCanvas.width = 256;
  contCanvas.height = 128;
  const contCtx = contCanvas.getContext('2d')!;
  for (let x = 0; x < 256; x++) {
    const wave = Math.sin((x / 256) * Math.PI * 32) * 0.5 + 0.5;
    const v = Math.floor(80 + wave * 140);
    contCtx.fillStyle = `rgb(${v},${v},${v})`;
    contCtx.fillRect(x, 0, 1, 128);
  }
  const containerBump = new THREE.CanvasTexture(contCanvas);
  containerBump.wrapS = THREE.RepeatWrapping;
  containerBump.wrapT = THREE.RepeatWrapping;
  containerBump.anisotropy = aniso;

  // 6. Soft Radial Contact Shadow Disc
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sctx = shadowCanvas.getContext('2d')!;
  const grad = sctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.78)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 128, 128);
  const contactShadowMap = new THREE.CanvasTexture(shadowCanvas);

  return {
    asphaltMap,
    asphaltBump,
    glassFacadeMap,
    concreteFacadeMap,
    barrierMap,
    containerBump,
    contactShadowMap,
    dispose() {
      asphaltMap.dispose();
      asphaltBump.dispose();
      glassFacadeMap.dispose();
      concreteFacadeMap.dispose();
      barrierMap.dispose();
      containerBump.dispose();
      contactShadowMap.dispose();
    },
  };
}
