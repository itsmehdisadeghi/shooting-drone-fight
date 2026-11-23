import type { DistrictDef, DistrictId } from './types';

export const DISTRICTS: Record<DistrictId, DistrictDef> = {
  shibuya: {
    id: 'shibuya',
    name: 'SHIBUYA SECTOR',
    subtitle: 'Scramble Plaza & Neon Overpass',
    coordsLabel: '35.6595° N · 139.7004° E',
    arenaHalfSize: 56,
    asphaltColor: 0x1c222d,
    accentHex: '#38bdf8',
    runnerSpawn: { x: -34, z: 34 },
    runnerSpawnYaw: Math.PI * 0.25,
    droneSpawn: { x: 4, y: 19, z: 2 },
    extractionPos: { x: 34, z: -34 },
    extractionRadius: 5.5,
    buildings: [
      // Four corner-offset midrise blocks forming wide crossing avenues + tactical alleys
      { id: 'sh-b1', x: -32, z: -18, w: 16, d: 14, h: 28, style: 'glass', accentColor: 0x38bdf8 },
      { id: 'sh-b2', x: 28, z: 24, w: 18, d: 14, h: 32, style: 'glass', accentColor: 0xf59e0b },
      { id: 'sh-b3', x: -6, z: -34, w: 18, d: 12, h: 24, style: 'concrete', accentColor: 0x22d3ee },
      { id: 'sh-b4', x: 4, z: 34, w: 16, d: 12, h: 22, style: 'concrete', accentColor: 0xfb7185 },
      // Central iconic landmark tower (offset so main diagonal crossing stays open)
      { id: 'sh-landmark', x: -12, z: 4, w: 10, d: 12, h: 38, style: 'landmark', accentColor: 0x38bdf8 },
      { id: 'sh-b6', x: 16, z: -8, w: 12, d: 10, h: 26, style: 'glass', accentColor: 0x0ea5e9 },
    ],
    covers: [
      // Near runner spawn — immediate safe shelter
      { id: 'sh-c1', kind: 'van', x: -26, z: 26, w: 5.2, d: 2.5, h: 2.4, maxHp: 110, rotationY: 0.4 },
      { id: 'sh-c2', kind: 'barrier', x: -18, z: 30, w: 4.4, d: 1.3, h: 1.5, maxHp: 85 },
      { id: 'sh-c3', kind: 'kiosk', x: -24, z: 12, w: 4.5, d: 2.8, h: 2.8, maxHp: 90 },
      // Mid-crossing scramble cover chain
      { id: 'sh-c4', kind: 'container', x: -4, z: 18, w: 6.2, d: 2.6, h: 2.9, maxHp: 145 },
      { id: 'sh-c5', kind: 'barrier', x: 4, z: 10, w: 4.6, d: 1.3, h: 1.5, maxHp: 80 },
      { id: 'sh-c6', kind: 'van', x: 2, z: -4, w: 5.2, d: 2.5, h: 2.4, maxHp: 110, rotationY: -0.35 },
      { id: 'sh-c7', kind: 'kiosk', x: -14, z: -12, w: 4.5, d: 2.8, h: 2.8, maxHp: 95 },
      { id: 'sh-c8', kind: 'container', x: 6, z: -18, w: 6.2, d: 2.6, h: 2.9, maxHp: 145 },
      // Final approach to extraction pad
      { id: 'sh-c9', kind: 'barrier', x: 18, z: -24, w: 4.8, d: 1.3, h: 1.5, maxHp: 85 },
      { id: 'sh-c10', kind: 'van', x: 28, z: -18, w: 5.2, d: 2.5, h: 2.4, maxHp: 110 },
      { id: 'sh-c11', kind: 'barrier', x: 24, z: -34, w: 1.4, d: 4.6, h: 1.5, maxHp: 85 },
      { id: 'sh-c12', kind: 'kiosk', x: 16, z: 8, w: 4.5, d: 2.8, h: 2.8, maxHp: 95 },
    ],
    patrolWaypoints: [
      { x: 0, z: 0 },
      { x: -18, z: 22 },
      { x: 16, z: 14 },
      { x: 24, z: -22 },
      { x: -16, z: -22 },
    ],
  },

  manhattan: {
    id: 'manhattan',
    name: 'MIDTOWN GRID',
    subtitle: 'Sixth Ave Concrete Canyon',
    coordsLabel: '40.7580° N · 73.9855° W',
    arenaHalfSize: 56,
    asphaltColor: 0x20242c,
    accentHex: '#f59e0b',
    runnerSpawn: { x: -36, z: 32 },
    runnerSpawnYaw: Math.PI * 0.25,
    droneSpawn: { x: 6, y: 20, z: 4 },
    extractionPos: { x: 36, z: -32 },
    extractionRadius: 5.5,
    buildings: [
      // Classic Manhattan rectangular grid towers creating straight high-risk avenues
      { id: 'mn-b1', x: -24, z: 6, w: 14, d: 20, h: 36, style: 'concrete', accentColor: 0xf59e0b },
      { id: 'mn-b2', x: 0, z: -18, w: 14, d: 16, h: 42, style: 'landmark', accentColor: 0xfbbf24 },
      { id: 'mn-b3', x: 24, z: 10, w: 14, d: 20, h: 34, style: 'glass', accentColor: 0x38bdf8 },
      { id: 'mn-b4', x: -24, z: -30, w: 16, d: 14, h: 28, style: 'concrete', accentColor: 0x94a3b8 },
      { id: 'mn-b5', x: 2, z: 26, w: 16, d: 12, h: 26, style: 'glass', accentColor: 0xf59e0b },
    ],
    covers: [
      { id: 'mn-c1', kind: 'van', x: -26, z: 28, w: 5.4, d: 2.5, h: 2.4, maxHp: 115 },
      { id: 'mn-c2', kind: 'barrier', x: -14, z: 24, w: 4.6, d: 1.3, h: 1.5, maxHp: 85 },
      { id: 'mn-c3', kind: 'container', x: -10, z: 8, w: 2.6, d: 6.2, h: 2.9, maxHp: 150 },
      { id: 'mn-c4', kind: 'kiosk', x: 4, z: 6, w: 4.5, d: 2.8, h: 2.8, maxHp: 90 },
      { id: 'mn-c5', kind: 'van', x: 10, z: -4, w: 5.4, d: 2.5, h: 2.4, maxHp: 115 },
      { id: 'mn-c6', kind: 'barrier', x: -10, z: -10, w: 4.6, d: 1.3, h: 1.5, maxHp: 85 },
      { id: 'mn-c7', kind: 'container', x: 16, z: -14, w: 6.2, d: 2.6, h: 2.9, maxHp: 150 },
      { id: 'mn-c8', kind: 'barrier', x: 24, z: -22, w: 4.6, d: 1.3, h: 1.5, maxHp: 85 },
      { id: 'mn-c9', kind: 'kiosk', x: 32, z: -16, w: 4.5, d: 2.8, h: 2.8, maxHp: 90 },
      { id: 'mn-c10', kind: 'van', x: 18, z: -32, w: 5.4, d: 2.5, h: 2.4, maxHp: 115 },
      { id: 'mn-c11', kind: 'barrier', x: -28, z: -12, w: 4.6, d: 1.3, h: 1.5, maxHp: 85 },
    ],
    patrolWaypoints: [
      { x: -8, z: 16 },
      { x: 12, z: 14 },
      { x: 14, z: -16 },
      { x: -12, z: -20 },
      { x: 28, z: -28 },
    ],
  },

  canary_wharf: {
    id: 'canary_wharf',
    name: 'CANARY WHARF',
    subtitle: 'Docklands Glass Concourse',
    coordsLabel: '51.5054° N · 0.0235° W',
    arenaHalfSize: 56,
    asphaltColor: 0x1a2229,
    accentHex: '#2dd4bf',
    runnerSpawn: { x: -34, z: 36 },
    runnerSpawnYaw: Math.PI * 0.25,
    droneSpawn: { x: 14, y: 19, z: -12 },
    extractionPos: { x: 34, z: -34 },
    extractionRadius: 5.5,
    buildings: [
      // Open docklands financial plaza with sleek glass monoliths & central freight corridor
      { id: 'cw-landmark', x: 0, z: 0, w: 12, d: 12, h: 44, style: 'landmark', accentColor: 0x2dd4bf },
      { id: 'cw-b1', x: -30, z: -8, w: 14, d: 16, h: 30, style: 'glass', accentColor: 0x38bdf8 },
      { id: 'cw-b2', x: 30, z: 8, w: 14, d: 16, h: 32, style: 'glass', accentColor: 0x2dd4bf },
      { id: 'cw-b3', x: -10, z: -34, w: 18, d: 12, h: 24, style: 'concrete', accentColor: 0x64748b },
      { id: 'cw-b4', x: 12, z: 34, w: 18, d: 12, h: 24, style: 'concrete', accentColor: 0x64748b },
    ],
    covers: [
      { id: 'cw-c1', kind: 'container', x: -24, z: 26, w: 6.2, d: 2.6, h: 2.9, maxHp: 155 },
      { id: 'cw-c2', kind: 'barrier', x: -14, z: 28, w: 4.6, d: 1.3, h: 1.5, maxHp: 85 },
      { id: 'cw-c3', kind: 'kiosk', x: -16, z: 12, w: 4.5, d: 2.8, h: 2.8, maxHp: 95 },
      { id: 'cw-c4', kind: 'van', x: -14, z: -8, w: 5.2, d: 2.5, h: 2.4, maxHp: 115 },
      { id: 'cw-c5', kind: 'container', x: 14, z: 14, w: 6.2, d: 2.6, h: 2.9, maxHp: 155 },
      { id: 'cw-c6', kind: 'barrier', x: 14, z: -4, w: 1.3, d: 4.8, h: 1.5, maxHp: 85 },
      { id: 'cw-c7', kind: 'van', x: 4, z: -16, w: 5.2, d: 2.5, h: 2.4, maxHp: 115 },
      { id: 'cw-c8', kind: 'container', x: 20, z: -18, w: 6.2, d: 2.6, h: 2.9, maxHp: 155 },
      { id: 'cw-c9', kind: 'kiosk', x: 30, z: -18, w: 4.5, d: 2.8, h: 2.8, maxHp: 95 },
      { id: 'cw-c10', kind: 'barrier', x: 22, z: -32, w: 1.3, d: 4.8, h: 1.5, maxHp: 85 },
      { id: 'cw-c11', kind: 'barrier', x: -2, z: 18, w: 4.8, d: 1.3, h: 1.5, maxHp: 85 },
    ],
    patrolWaypoints: [
      { x: -16, z: 18 },
      { x: 16, z: 20 },
      { x: 22, z: -14 },
      { x: -14, z: -18 },
      { x: 28, z: -30 },
    ],
  },
};

export const DISTRICT_LIST: DistrictDef[] = [
  DISTRICTS.shibuya,
  DISTRICTS.manhattan,
  DISTRICTS.canary_wharf,
];
