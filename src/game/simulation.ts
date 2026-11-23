import { DISTRICTS } from './districts';
import type {
  BuildingDef,
  CoverState,
  DistrictDef,
  DistrictId,
  DroneAIPolicy,
  HudSnapshot,
  InputSnapshot,
  PlayerRole,
  SimulationState,
  WeatherMode,
  WeatherParams,
  WeatherType,
} from './types';

export const WEATHER_PRESETS: Record<WeatherType, WeatherParams> = {
  clear: {
    type: 'clear',
    label: 'CLEAR DUSK',
    visibilityRange: 95,
    sensorRangeMult: 1.0,
    droneAccuracy: 0.96,
    spreadRad: 0.015,
    fogDensity: 0.0045,
    rainIntensity: 0,
    windStrength: 0.12,
    skyHex: 0x162235,
    fogHex: 0x182538,
    sunHex: 0xffc68a,
    sunIntensity: 2.1,
    hemiSkyHex: 0x6ea6d8,
    hemiGroundHex: 0x1a1f2c,
    hemiIntensity: 0.85,
  },
  rain: {
    type: 'rain',
    label: 'HEAVY RAIN',
    visibilityRange: 64,
    sensorRangeMult: 0.84,
    droneAccuracy: 0.82,
    spreadRad: 0.052,
    fogDensity: 0.0095,
    rainIntensity: 0.72,
    windStrength: 0.45,
    skyHex: 0x101926,
    fogHex: 0x121d2b,
    sunHex: 0x9fc2e6,
    sunIntensity: 1.25,
    hemiSkyHex: 0x5c7c9e,
    hemiGroundHex: 0x101622,
    hemiIntensity: 0.75,
  },
  fog: {
    type: 'fog',
    label: 'DENSE FOG',
    visibilityRange: 40,
    sensorRangeMult: 0.65,
    droneAccuracy: 0.76,
    spreadRad: 0.068,
    fogDensity: 0.0185,
    rainIntensity: 0.08,
    windStrength: 0.2,
    skyHex: 0x1d2734,
    fogHex: 0x222e3c,
    sunHex: 0xb7c9dc,
    sunIntensity: 1.0,
    hemiSkyHex: 0x8ea3b8,
    hemiGroundHex: 0x1a222d,
    hemiIntensity: 0.9,
  },
  storm: {
    type: 'storm',
    label: 'TYPHOON STORM',
    visibilityRange: 48,
    sensorRangeMult: 0.70,
    droneAccuracy: 0.64,
    spreadRad: 0.105,
    fogDensity: 0.014,
    rainIntensity: 1.0,
    windStrength: 0.92,
    skyHex: 0x0b111c,
    fogHex: 0x0e1624,
    sunHex: 0x7ba4d9,
    sunIntensity: 0.95,
    hemiSkyHex: 0x476182,
    hemiGroundHex: 0x0d121d,
    hemiIntensity: 0.65,
  },
};

export const WEATHER_SEQUENCE: WeatherType[] = ['clear', 'rain', 'fog', 'storm'];

export const RUNNER_RADIUS = 0.62;
export const RUNNER_WALK_SPEED = 7.4;
export const RUNNER_SPRINT_SPEED = 10.6;
export const RUNNER_CROUCH_SPEED = 4.2;
export const RUNNER_DASH_SPEED = 19.5;
export const RUNNER_DASH_DURATION = 0.24;
export const RUNNER_DASH_COOLDOWN = 3.2;
export const RUNNER_EMP_RADIUS = 28;
export const RUNNER_EMP_COOLDOWN = 9.0;
export const DRONE_ALTITUDE = 18.5;
export const DRONE_MAX_SPEED = 16.5;
export const DRONE_SENSOR_BASE_RANGE = 32;
export const DRONE_SONAR_COOLDOWN = 10.0;
export const DRONE_SONAR_DURATION = 3.8;
export const EXTRACTION_HOLD_SECONDS = 3.0;
export const DEFAULT_ROUND_DURATION = 90;

export function getWeatherParams(weather: WeatherType): WeatherParams {
  return WEATHER_PRESETS[weather];
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function dist2D(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * 3D slab test: returns intersection t in [0, 1] if segment P0->P1 intersects AABB, else null.
 */
export function segmentIntersectsAABB3D(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): number | null {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dz = z1 - z0;

  let tmin = 0;
  let tmax = 1;

  const axes: Array<[number, number, number, number]> = [
    [x0, dx, minX, maxX],
    [y0, dy, minY, maxY],
    [z0, dz, minZ, maxZ],
  ];

  for (const [origin, dir, bmin, bmax] of axes) {
    if (Math.abs(dir) < 1e-8) {
      if (origin < bmin || origin > bmax) return null;
    } else {
      const inv = 1 / dir;
      let t1 = (bmin - origin) * inv;
      let t2 = (bmax - origin) * inv;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }

  return tmin;
}

/**
 * Checks whether line-of-sight from drone position to runner is blocked by any building or intact cover.
 * Returns { blocked, blockerCoverId } so cover-buster AI knows which cover shields the runner.
 */
export function checkLineOfSight(
  droneX: number,
  droneY: number,
  droneZ: number,
  runnerX: number,
  runnerEyeY: number,
  runnerZ: number,
  buildings: BuildingDef[],
  covers: CoverState[],
): { blocked: boolean; blockerType: 'none' | 'building' | 'cover'; blockerCoverId: string | null } {
  for (const b of buildings) {
    const hw = b.w * 0.5;
    const hd = b.d * 0.5;
    const t = segmentIntersectsAABB3D(
      droneX,
      droneY,
      droneZ,
      runnerX,
      runnerEyeY,
      runnerZ,
      b.x - hw,
      0,
      b.z - hd,
      b.x + hw,
      b.h,
      b.z + hd,
    );
    if (t !== null && t > 0.01 && t < 0.99) {
      return { blocked: true, blockerType: 'building', blockerCoverId: null };
    }
  }

  for (const c of covers) {
    if (c.destroyed) continue;
    const hw = c.w * 0.5 + 0.2;
    const hd = c.d * 0.5 + 0.2;
    // Slight height margin for roof overhangs/tactical crouching concealment
    const effH = c.h + 0.22;
    const t = segmentIntersectsAABB3D(
      droneX,
      droneY,
      droneZ,
      runnerX,
      runnerEyeY,
      runnerZ,
      c.x - hw,
      0,
      c.z - hd,
      c.x + hw,
      effH,
      c.z + hd,
    );
    if (t !== null && t > 0.01 && t < 0.995) {
      return { blocked: true, blockerType: 'cover', blockerCoverId: c.id };
    }
  }

  return { blocked: false, blockerType: 'none', blockerCoverId: null };
}

/**
 * Resolves 2D circle against an axis-aligned rectangle, pushing circle out along minimum overlap axis.
 */
export function resolveCircleAABB(
  cx: number,
  cz: number,
  radius: number,
  bx: number,
  bz: number,
  bw: number,
  bd: number,
): { x: number; z: number; hit: boolean } {
  const minX = bx - bw * 0.5;
  const maxX = bx + bw * 0.5;
  const minZ = bz - bd * 0.5;
  const maxZ = bz + bd * 0.5;

  const closestX = clamp(cx, minX, maxX);
  const closestZ = clamp(cz, minZ, maxZ);

  const dx = cx - closestX;
  const dz = cz - closestZ;
  const distSq = dx * dx + dz * dz;

  if (distSq >= radius * radius) {
    return { x: cx, z: cz, hit: false };
  }

  if (distSq > 1e-8) {
    const d = Math.sqrt(distSq);
    const push = radius - d;
    return {
      x: cx + (dx / d) * push,
      z: cz + (dz / d) * push,
      hit: true,
    };
  }

  // Center is inside box: push out along nearest edge
  const leftPen = Math.abs(cx - minX);
  const rightPen = Math.abs(maxX - cx);
  const topPen = Math.abs(cz - minZ);
  const bottomPen = Math.abs(maxZ - cz);
  const m = Math.min(leftPen, rightPen, topPen, bottomPen);
  if (m === leftPen) return { x: minX - radius, z: cz, hit: true };
  if (m === rightPen) return { x: maxX + radius, z: cz, hit: true };
  if (m === topPen) return { x: cx, z: minZ - radius, hit: true };
  return { x: cx, z: maxZ + radius, hit: true };
}

export function createSimulationState(options: {
  districtId: DistrictId;
  localRole: PlayerRole;
  weatherMode: WeatherMode;
  isMultiplayer?: boolean;
  roundNumber?: number;
  runnerScore?: number;
  droneScore?: number;
  roundDuration?: number;
}): SimulationState {
  const district = DISTRICTS[options.districtId];
  const initialWeather: WeatherType =
    options.weatherMode === 'dynamic' ? 'clear' : options.weatherMode;

  const covers: CoverState[] = district.covers.map((c) => ({
    ...c,
    hp: c.maxHp,
    destroyed: false,
    hitFlash: 0,
  }));

  return {
    districtId: options.districtId,
    localRole: options.localRole,
    isMultiplayer: Boolean(options.isMultiplayer),
    roundNumber: options.roundNumber ?? 1,
    runnerScore: options.runnerScore ?? 0,
    droneScore: options.droneScore ?? 0,
    timeRemaining: options.roundDuration ?? DEFAULT_ROUND_DURATION,
    roundDuration: options.roundDuration ?? DEFAULT_ROUND_DURATION,
    elapsed: 0,
    extractionProgress: 0,
    extractionHoldSeconds: EXTRACTION_HOLD_SECONDS,
    weatherMode: options.weatherMode,
    weather: initialWeather,
    weatherTimer: 22,
    lightningFlash: 0,
    hitstopTimer: 0,
    cameraTrauma: 0,
    outcome: null,
    coversDestroyedCount: 0,
    runner: {
      x: district.runnerSpawn.x,
      y: 0,
      z: district.runnerSpawn.z,
      vx: 0,
      vz: 0,
      yaw: district.runnerSpawnYaw,
      hp: 100,
      maxHp: 100,
      stamina: 100,
      crouching: false,
      sprinting: false,
      inCover: false,
      nearestCoverId: null,
      dashCooldown: 0,
      dashTimer: 0,
      empCooldown: 0,
      hitFlash: 0,
      distanceWalked: 0,
      damageTaken: 0,
      invulnTimer: 0,
    },
    drone: {
      x: district.droneSpawn.x,
      y: district.droneSpawn.y,
      z: district.droneSpawn.z,
      vx: 0,
      vz: 0,
      yaw: Math.atan2(
        district.runnerSpawn.x - district.droneSpawn.x,
        district.runnerSpawn.z - district.droneSpawn.z,
      ),
      aimX: 0,
      aimZ: 0,
      hp: 100,
      maxHp: 100,
      heat: 0,
      overheated: false,
      fireCooldown: 0,
      sonarCooldown: 0,
      sonarActiveTimer: 0,
      sonarOriginX: district.droneSpawn.x,
      sonarOriginZ: district.droneSpawn.z,
      empStunTimer: 0,
      detection: 0,
      alertState: 'patrol',
      aiPolicy: 'sweep',
      policyTimer: 6,
      waypointIndex: 0,
      telegraphTimer: 0,
      telegraphTargetX: 0,
      telegraphTargetZ: 0,
      lastKnownX: district.runnerSpawn.x * 0.4,
      lastKnownZ: district.runnerSpawn.z * 0.4,
      lastKnownTimer: 0,
      hitFlash: 0,
      shotsFired: 0,
      shotsHit: 0,
    },
    covers,
    projectiles: [],
    nextProjectileId: 1,
    events: [],
  };
}

export function createNeutralInput(): InputSnapshot {
  return {
    moveX: 0,
    moveZ: 0,
    sprint: false,
    crouch: false,
    dashPressed: false,
    abilityPressed: false,
    fireHeld: false,
    firePressed: false,
    aimWorldX: 0,
    aimWorldZ: 0,
    cameraYaw: 0,
  };
}

/**
 * Damage a specific destructible cover object.
 */
export function damageCover(state: SimulationState, cover: CoverState, amount: number): boolean {
  if (cover.destroyed || amount <= 0) return false;
  cover.hp = Math.max(0, cover.hp - amount);
  cover.hitFlash = 0.14;
  state.events.push({
    type: 'cover_hit',
    x: cover.x,
    y: cover.h * 0.6,
    z: cover.z,
    intensity: 0.6,
  });
  if (cover.hp <= 0) {
    cover.destroyed = true;
    state.coversDestroyedCount += 1;
    state.hitstopTimer = Math.max(state.hitstopTimer, 0.045);
    state.cameraTrauma = Math.min(1, state.cameraTrauma + 0.45);
    state.events.push({
      type: 'cover_destroyed',
      x: cover.x,
      y: cover.h * 0.5,
      z: cover.z,
      intensity: 1.0,
      detail: cover.kind.toUpperCase(),
    });
    return true;
  }
  return false;
}

/**
 * Fires a drone autocannon projectile with weather-scaled spread.
 */
export function fireDroneWeapon(
  state: SimulationState,
  targetX: number,
  targetZ: number,
  rng: () => number = Math.random,
): boolean {
  const drone = state.drone;
  if (drone.overheated || drone.fireCooldown > 0 || drone.empStunTimer > 0) {
    return false;
  }

  const weather = getWeatherParams(state.weather);
  const dx = targetX - drone.x;
  const dy = 0.9 - drone.y;
  const dz = targetZ - drone.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

  // Apply weather-driven wind & accuracy dispersion
  const spread = weather.spreadRad * (1 + (drone.heat / 100) * 0.45);
  const rx = (rng() - 0.5) * 2 * spread;
  const rz = (rng() - 0.5) * 2 * spread;

  const dirX = dx / len + rx;
  const dirY = dy / len;
  const dirZ = dz / len + rz;
  const norm = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ) || 1;
  const speed = 78;

  state.projectiles.push({
    id: state.nextProjectileId++,
    x: drone.x + (dirX / norm) * 1.4,
    y: drone.y - 0.6,
    z: drone.z + (dirZ / norm) * 1.4,
    vx: (dirX / norm) * speed,
    vy: (dirY / norm) * speed,
    vz: (dirZ / norm) * speed,
    ttl: 1.4,
    fromDrone: true,
    damage: 16,
    coverDamage: 28,
  });

  drone.fireCooldown = 0.145;
  drone.heat = Math.min(100, drone.heat + 8.5);
  drone.shotsFired += 1;
  if (drone.heat >= 100) {
    drone.overheated = true;
  }

  state.events.push({
    type: 'drone_shot',
    x: drone.x,
    y: drone.y - 0.5,
    z: drone.z,
    intensity: 0.5,
  });

  return true;
}

/**
 * Trigger Runner EMP pulse: jams drone sensors & damages drone shield if in range.
 */
export function triggerRunnerEmp(state: SimulationState): boolean {
  const runner = state.runner;
  if (runner.empCooldown > 0) return false;
  runner.empCooldown = RUNNER_EMP_COOLDOWN;

  const horizontalDist = dist2D(runner.x, runner.z, state.drone.x, state.drone.z);
  state.events.push({
    type: 'emp_pulse',
    x: runner.x,
    y: 1.0,
    z: runner.z,
    intensity: 1.0,
  });

  if (horizontalDist <= RUNNER_EMP_RADIUS) {
    state.drone.empStunTimer = 2.8;
    state.drone.detection = Math.max(0, state.drone.detection - 45);
    state.drone.telegraphTimer = 0;
    state.drone.hp = Math.max(15, state.drone.hp - 22);
    state.drone.hitFlash = 0.25;
    state.hitstopTimer = Math.max(state.hitstopTimer, 0.04);
    state.cameraTrauma = Math.min(1, state.cameraTrauma + 0.35);
  }
  return true;
}

/**
 * Trigger Drone Thermal Sonar Ping: reveals Runner briefly through fog/cover.
 */
export function triggerDroneSonar(state: SimulationState): boolean {
  const drone = state.drone;
  if (drone.sonarCooldown > 0 || drone.empStunTimer > 0) return false;
  drone.sonarCooldown = DRONE_SONAR_COOLDOWN;
  drone.sonarActiveTimer = DRONE_SONAR_DURATION;
  drone.sonarOriginX = drone.x;
  drone.sonarOriginZ = drone.z;

  const d = dist2D(drone.x, drone.z, state.runner.x, state.runner.z);
  if (d <= 46) {
    drone.lastKnownX = state.runner.x;
    drone.lastKnownZ = state.runner.z;
    drone.lastKnownTimer = 5.0;
    drone.detection = Math.min(100, drone.detection + 28);
  }

  state.events.push({
    type: 'sonar_ping',
    x: drone.x,
    y: 0.4,
    z: drone.z,
    intensity: 0.9,
  });
  return true;
}

function findNearestIntactCover(
  x: number,
  z: number,
  covers: CoverState[],
  maxDist = 3.2,
): CoverState | null {
  let best: CoverState | null = null;
  let bestD = maxDist;
  for (const c of covers) {
    if (c.destroyed) continue;
    const halfDiag = Math.max(c.w, c.d) * 0.5;
    const d = dist2D(x, z, c.x, c.z) - halfDiag;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/**
 * Autonomous AI Runner when local player controls the Aerial Combat Drone.
 */
function computeAiRunnerInput(state: SimulationState, district: DistrictDef): InputSnapshot {
  const runner = state.runner;
  const drone = state.drone;
  const input = createNeutralInput();

  // Pick intermediate cover hops toward extraction if drone is nearby, else push extraction
  let targetX = district.extractionPos.x;
  let targetZ = district.extractionPos.z;

  const distToExtract = dist2D(runner.x, runner.z, targetX, targetZ);
  const distToDrone = dist2D(runner.x, runner.z, drone.x, drone.z);

  if (distToExtract > district.extractionRadius * 0.7) {
    // Look for an intact cover that moves closer to extraction when under drone threat
    if (drone.detection > 35 || distToDrone < 26) {
      let bestCover: CoverState | null = null;
      let bestScore = Infinity;
      for (const c of state.covers) {
        if (c.destroyed) continue;
        const cToEx = dist2D(c.x, c.z, district.extractionPos.x, district.extractionPos.z);
        const rToC = dist2D(runner.x, runner.z, c.x, c.z);
        if (rToC < 20 && cToEx < distToExtract + 6) {
          const score = cToEx + rToC * 0.7;
          if (score < bestScore) {
            bestScore = score;
            bestCover = c;
          }
        }
      }
      if (bestCover) {
        // Duck on opposite side of cover from drone
        const awayX = bestCover.x - drone.x;
        const awayZ = bestCover.z - drone.z;
        const awayLen = Math.hypot(awayX, awayZ) || 1;
        targetX = bestCover.x + (awayX / awayLen) * (Math.max(bestCover.w, bestCover.d) * 0.5 + 1.2);
        targetZ = bestCover.z + (awayZ / awayLen) * (Math.max(bestCover.w, bestCover.d) * 0.5 + 1.2);
      }
    }
  }

  // Steer around buildings with simple tangential avoidance
  let dx = targetX - runner.x;
  let dz = targetZ - runner.z;
  const distToTarget = Math.hypot(dx, dz) || 1;
  dx /= distToTarget;
  dz /= distToTarget;

  for (const b of district.buildings) {
    const avoidR = Math.max(b.w, b.d) * 0.5 + 3.6;
    const bx = runner.x - b.x;
    const bz = runner.z - b.z;
    const bd = Math.hypot(bx, bz) || 1;
    if (bd < avoidR) {
      const push = (avoidR - bd) / avoidR;
      dx += (bx / bd) * push * 1.8;
      dz += (bz / bd) * push * 1.8;
    }
  }

  const moveLen = Math.hypot(dx, dz) || 1;
  if (distToTarget > 0.75) {
    input.moveX = dx / moveLen;
    input.moveZ = dz / moveLen;
  }

  // Crouch if in cover and drone is close, sprint when open & safe
  if (runner.inCover && distToDrone < 24 && distToExtract > 8) {
    input.crouch = true;
    input.moveX *= 0.2;
    input.moveZ *= 0.2;
  } else if (distToDrone > 20 || distToExtract < 16) {
    input.sprint = runner.stamina > 25;
  }

  // Dash if locked on or drone is actively firing nearby
  if (drone.detection > 72 && runner.dashCooldown <= 0) {
    input.dashPressed = true;
  }
  // Fire EMP if drone gets close while chasing
  if (distToDrone < 20 && drone.detection > 60 && runner.empCooldown <= 0) {
    input.abilityPressed = true;
  }

  return input;
}

/**
 * Autonomous AI Drone with 3 distinct behavior policies:
 * 1. 'sweep'        - Patrols avenues with sweeping sensor cones
 * 2. 'cover_buster' - Locks onto intact cover shielding the runner, telegraphs, then shreds it
 * 3. 'flanker'      - Orbits around buildings to cut off the extraction corridor
 */
function updateAiDrone(
  state: SimulationState,
  district: DistrictDef,
  dt: number,
  rng: () => number,
): void {
  const drone = state.drone;
  const runner = state.runner;

  if (drone.empStunTimer > 0) {
    drone.vx *= Math.exp(-4 * dt);
    drone.vz *= Math.exp(-4 * dt);
    drone.telegraphTimer = 0;
    return;
  }

  const runnerEyeY = runner.crouching ? 0.92 : 1.65;
  const los = checkLineOfSight(
    drone.x,
    drone.y,
    drone.z,
    runner.x,
    runnerEyeY,
    runner.z,
    district.buildings,
    state.covers,
  );

  // Escalate AI policy dynamically based on tactical context & time elapsed
  drone.policyTimer -= dt;
  const difficultyRamp = clamp(state.elapsed / 60, 0, 1);

  if (drone.policyTimer <= 0) {
    if (los.blocked && los.blockerType === 'cover' && drone.lastKnownTimer > 0) {
      drone.aiPolicy = 'cover_buster';
      drone.policyTimer = 5.0;
    } else if (state.extractionProgress > 15 || dist2D(runner.x, runner.z, district.extractionPos.x, district.extractionPos.z) < 24) {
      drone.aiPolicy = 'flanker';
      drone.policyTimer = 5.5;
    } else if (drone.alertState === 'patrol') {
      drone.aiPolicy = 'sweep';
      drone.policyTimer = 4.5;
    } else {
      const policies: DroneAIPolicy[] = ['cover_buster', 'flanker', 'sweep'];
      drone.aiPolicy = policies[(Math.floor(state.elapsed) + drone.waypointIndex) % policies.length];
      drone.policyTimer = 4.5;
    }
  }

  // Determine desired flight destination based on active policy
  let desiredX = drone.x;
  let desiredZ = drone.z;
  let desiredAimX = drone.aimX;
  let desiredAimZ = drone.aimZ;

  // Give player an approachable opening 6 seconds where drone sweeps mid-plaza first
  const openingGrace = state.elapsed < 5.5;

  if (drone.aiPolicy === 'cover_buster' && los.blockerCoverId && !openingGrace) {
    const cover = state.covers.find((c) => c.id === los.blockerCoverId && !c.destroyed);
    if (cover) {
      // Hover at firing vantage ~14m from the cover
      const dirX = drone.x - cover.x;
      const dirZ = drone.z - cover.z;
      const d = Math.hypot(dirX, dirZ) || 1;
      desiredX = cover.x + (dirX / d) * 14;
      desiredZ = cover.z + (dirZ / d) * 14;
      desiredAimX = cover.x;
      desiredAimZ = cover.z;

      // Telegraph laser windup before bursting the cover!
      if (d < 26 && !drone.overheated) {
        if (drone.telegraphTimer <= 0 && drone.fireCooldown <= 0) {
          drone.telegraphTimer = 0.55;
          drone.telegraphTargetX = cover.x;
          drone.telegraphTargetZ = cover.z;
          state.events.push({
            type: 'telegraph_start',
            x: cover.x,
            y: cover.h,
            z: cover.z,
          });
        }
      }
    }
  } else if (drone.aiPolicy === 'flanker' && !openingGrace) {
    // Intercept along the vector between Runner's last known position and Extraction Zone
    const anchorX = drone.lastKnownTimer > 0 ? drone.lastKnownX : district.extractionPos.x * 0.5;
    const anchorZ = drone.lastKnownTimer > 0 ? drone.lastKnownZ : district.extractionPos.z * 0.5;
    const midX = anchorX * 0.55 + district.extractionPos.x * 0.45;
    const midZ = anchorZ * 0.55 + district.extractionPos.z * 0.45;
    const orbitAngle = state.elapsed * 0.75;
    desiredX = midX + Math.cos(orbitAngle) * 12;
    desiredZ = midZ + Math.sin(orbitAngle) * 12;
    desiredAimX = drone.lastKnownTimer > 0 ? drone.lastKnownX : district.extractionPos.x;
    desiredAimZ = drone.lastKnownTimer > 0 ? drone.lastKnownZ : district.extractionPos.z;
  } else {
    // 'sweep' policy: patrol urban avenue waypoints
    const wp = district.patrolWaypoints[drone.waypointIndex % district.patrolWaypoints.length];
    if (drone.lastKnownTimer > 0 && !openingGrace) {
      desiredX = drone.lastKnownX;
      desiredZ = drone.lastKnownZ;
      desiredAimX = drone.lastKnownX;
      desiredAimZ = drone.lastKnownZ;
    } else {
      desiredX = wp.x;
      desiredZ = wp.z;
      desiredAimX = wp.x + Math.sin(state.elapsed * 1.4) * 10;
      desiredAimZ = wp.z + Math.cos(state.elapsed * 1.1) * 10;
      if (dist2D(drone.x, drone.z, wp.x, wp.z) < 4.5) {
        drone.waypointIndex = (drone.waypointIndex + 1) % district.patrolWaypoints.length;
      }
    }
  }

  // Trigger sonar periodically when searching in low visibility weather
  if (
    !openingGrace &&
    drone.sonarCooldown <= 0 &&
    drone.alertState !== 'locked' &&
    (state.weather === 'fog' || state.weather === 'storm' || drone.lastKnownTimer <= 0)
  ) {
    triggerDroneSonar(state);
  }

  // Smooth acceleration toward desired aerial coordinates
  const speedLimit = (10.5 + difficultyRamp * 4.5);
  const toX = desiredX - drone.x;
  const toZ = desiredZ - drone.z;
  const toDist = Math.hypot(toX, toZ) || 1;
  const desiredVx = toDist > 1 ? (toX / toDist) * Math.min(speedLimit, toDist * 1.8) : 0;
  const desiredVz = toDist > 1 ? (toZ / toDist) * Math.min(speedLimit, toDist * 1.8) : 0;

  const dampAlpha = 1 - Math.exp(-3.4 * dt);
  drone.vx += (desiredVx - drone.vx) * dampAlpha;
  drone.vz += (desiredVz - drone.vz) * dampAlpha;

  const aimAlpha = 1 - Math.exp(-6.0 * dt);
  drone.aimX += (desiredAimX - drone.aimX) * aimAlpha;
  drone.aimZ += (desiredAimZ - drone.aimZ) * aimAlpha;

  // Handle telegraph windup -> firing burst on locked Runner or Cover
  if (drone.telegraphTimer > 0) {
    drone.telegraphTimer = Math.max(0, drone.telegraphTimer - dt);
    drone.aimX = drone.telegraphTargetX;
    drone.aimZ = drone.telegraphTargetZ;
    if (drone.telegraphTimer === 0) {
      fireDroneWeapon(state, drone.telegraphTargetX, drone.telegraphTargetZ, rng);
    }
  } else if (!openingGrace && drone.alertState === 'locked' && !los.blocked) {
    // Track runner directly and telegraph before opening fire
    drone.aimX = runner.x;
    drone.aimZ = runner.z;
    if (drone.fireCooldown <= 0 && !drone.overheated) {
      fireDroneWeapon(state, runner.x + runner.vx * 0.14, runner.z + runner.vz * 0.14, rng);
    }
  }
}

/**
 * Advances the pure game simulation by `rawDt` seconds.
 * Safe to run in unit tests (Node) or browser `requestAnimationFrame`.
 */
export function stepSimulation(
  state: SimulationState,
  localInput: InputSnapshot,
  rawDt: number,
  remoteInput?: InputSnapshot | null,
  rng: () => number = Math.random,
): void {
  state.events.length = 0;

  if (state.outcome !== null) {
    state.cameraTrauma = Math.max(0, state.cameraTrauma - rawDt * 1.8);
    return;
  }

  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  state.cameraTrauma = Math.max(0, state.cameraTrauma - dt * 1.9);
  state.lightningFlash = Math.max(0, state.lightningFlash - dt * 3.5);

  // Hitstop freezes physics briefly on heavy cover shatters / EMP hits while visuals decay
  if (state.hitstopTimer > 0) {
    state.hitstopTimer = Math.max(0, state.hitstopTimer - dt);
    return;
  }

  const district = DISTRICTS[state.districtId];
  state.elapsed += dt;
  state.timeRemaining = Math.max(0, state.timeRemaining - dt);

  // 1. Dynamic weather progression
  if (state.weatherMode === 'dynamic') {
    state.weatherTimer -= dt;
    if (state.weatherTimer <= 0) {
      const idx = WEATHER_SEQUENCE.indexOf(state.weather);
      const nextWeather = WEATHER_SEQUENCE[(idx + 1) % WEATHER_SEQUENCE.length];
      state.weather = nextWeather;
      state.weatherTimer = 22;
      state.events.push({
        type: 'weather_change',
        detail: WEATHER_PRESETS[nextWeather].label,
      });
    }
  } else if (state.weather !== state.weatherMode) {
    state.weather = state.weatherMode;
  }

  if (state.weather === 'storm' && rng() < dt * 0.16) {
    state.lightningFlash = 1.0;
    state.events.push({ type: 'lightning', intensity: 1.0 });
  }

  const weatherParams = getWeatherParams(state.weather);

  // 2. Determine Runner & Drone inputs (local player, remote player, or AI)
  const runnerInput =
    state.localRole === 'runner'
      ? localInput
      : state.isMultiplayer && remoteInput
        ? remoteInput
        : computeAiRunnerInput(state, district);

  const droneInput =
    state.localRole === 'drone'
      ? localInput
      : state.isMultiplayer && remoteInput
        ? remoteInput
        : null;

  // 3. Update Runner physics & abilities
  const runner = state.runner;
  runner.dashCooldown = Math.max(0, runner.dashCooldown - dt);
  runner.dashTimer = Math.max(0, runner.dashTimer - dt);
  runner.empCooldown = Math.max(0, runner.empCooldown - dt);
  runner.hitFlash = Math.max(0, runner.hitFlash - dt);
  runner.invulnTimer = Math.max(0, runner.invulnTimer - dt);

  if (runnerInput.abilityPressed) {
    triggerRunnerEmp(state);
  }

  const rawMoveMag = Math.hypot(runnerInput.moveX, runnerInput.moveZ);
  let moveDirX = rawMoveMag > 0.01 ? runnerInput.moveX / Math.max(1, rawMoveMag) : 0;
  let moveDirZ = rawMoveMag > 0.01 ? runnerInput.moveZ / Math.max(1, rawMoveMag) : 0;

  if (runnerInput.dashPressed && runner.dashCooldown <= 0 && runner.stamina >= 18) {
    runner.dashCooldown = RUNNER_DASH_COOLDOWN;
    runner.dashTimer = RUNNER_DASH_DURATION;
    runner.invulnTimer = 0.2;
    runner.stamina = Math.max(0, runner.stamina - 22);
    if (rawMoveMag < 0.05) {
      moveDirX = Math.sin(runner.yaw);
      moveDirZ = Math.cos(runner.yaw);
    }
    runner.vx = moveDirX * RUNNER_DASH_SPEED;
    runner.vz = moveDirZ * RUNNER_DASH_SPEED;
    state.events.push({ type: 'dash', x: runner.x, y: 0.5, z: runner.z });
  }

  runner.crouching = runnerInput.crouch && runner.dashTimer <= 0;
  const wantsSprint = runnerInput.sprint && !runner.crouching && rawMoveMag > 0.1 && runner.stamina > 2;
  runner.sprinting = wantsSprint;

  if (wantsSprint) {
    runner.stamina = Math.max(0, runner.stamina - 24 * dt);
  } else {
    runner.stamina = Math.min(100, runner.stamina + 18 * dt);
  }

  if (runner.dashTimer <= 0) {
    const speed = runner.crouching
      ? RUNNER_CROUCH_SPEED
      : wantsSprint
        ? RUNNER_SPRINT_SPEED
        : RUNNER_WALK_SPEED;
    const targetVx = moveDirX * speed;
    const targetVz = moveDirZ * speed;
    const accelAlpha = 1 - Math.exp(-14 * dt);
    runner.vx += (targetVx - runner.vx) * accelAlpha;
    runner.vz += (targetVz - runner.vz) * accelAlpha;
  }

  const prevRx = runner.x;
  const prevRz = runner.z;
  runner.x += runner.vx * dt;
  runner.z += runner.vz * dt;

  // Clamp to arena perimeter
  const arenaLimit = district.arenaHalfSize - 2.0;
  runner.x = clamp(runner.x, -arenaLimit, arenaLimit);
  runner.z = clamp(runner.z, -arenaLimit, arenaLimit);

  // Resolve collisions against buildings & intact covers
  for (const b of district.buildings) {
    const res = resolveCircleAABB(runner.x, runner.z, RUNNER_RADIUS, b.x, b.z, b.w, b.d);
    runner.x = res.x;
    runner.z = res.z;
  }
  for (const c of state.covers) {
    if (c.destroyed) continue;
    const res = resolveCircleAABB(runner.x, runner.z, RUNNER_RADIUS, c.x, c.z, c.w, c.d);
    runner.x = res.x;
    runner.z = res.z;
  }

  const stepDist = dist2D(prevRx, prevRz, runner.x, runner.z);
  runner.distanceWalked += stepDist;
  if (Math.hypot(runner.vx, runner.vz) > 0.6) {
    const targetYaw = Math.atan2(runner.vx, runner.vz);
    let diff = targetYaw - runner.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    runner.yaw += diff * (1 - Math.exp(-14 * dt));
  }

  // Check proximity to intact cover
  const nearestCover = findNearestIntactCover(runner.x, runner.z, state.covers, 2.5);
  runner.inCover = nearestCover !== null;
  runner.nearestCoverId = nearestCover ? nearestCover.id : null;

  // 4. Update Drone physics, weapons, sensors & AI
  const drone = state.drone;
  drone.fireCooldown = Math.max(0, drone.fireCooldown - dt);
  drone.sonarCooldown = Math.max(0, drone.sonarCooldown - dt);
  drone.sonarActiveTimer = Math.max(0, drone.sonarActiveTimer - dt);
  drone.empStunTimer = Math.max(0, drone.empStunTimer - dt);
  drone.lastKnownTimer = Math.max(0, drone.lastKnownTimer - dt);
  drone.hitFlash = Math.max(0, drone.hitFlash - dt);

  // Weapon heat cooling
  const coolRate = drone.overheated ? 26 : 30;
  drone.heat = Math.max(0, drone.heat - coolRate * dt);
  if (drone.overheated && drone.heat <= 25) {
    drone.overheated = false;
  }

  if (droneInput) {
    // Player-controlled or Remote-controlled Drone
    if (drone.empStunTimer <= 0) {
      const m = Math.hypot(droneInput.moveX, droneInput.moveZ);
      const dx = m > 0.01 ? droneInput.moveX / Math.max(1, m) : 0;
      const dz = m > 0.01 ? droneInput.moveZ / Math.max(1, m) : 0;
      const speed = droneInput.sprint ? DRONE_MAX_SPEED * 1.25 : DRONE_MAX_SPEED;
      const windGustX = Math.sin(state.elapsed * 1.7) * weatherParams.windStrength * 2.2;
      const windGustZ = Math.cos(state.elapsed * 1.3) * weatherParams.windStrength * 1.8;
      const damp = 1 - Math.exp(-6.5 * dt);
      drone.vx += (dx * speed + windGustX - drone.vx) * damp;
      drone.vz += (dz * speed + windGustZ - drone.vz) * damp;
      drone.aimX = clamp(droneInput.aimWorldX, -arenaLimit, arenaLimit);
      drone.aimZ = clamp(droneInput.aimWorldZ, -arenaLimit, arenaLimit);

      if (droneInput.abilityPressed) {
        triggerDroneSonar(state);
      }
      if (droneInput.fireHeld || droneInput.firePressed) {
        fireDroneWeapon(state, drone.aimX, drone.aimZ, rng);
      }
    } else {
      drone.vx *= Math.exp(-3 * dt);
      drone.vz *= Math.exp(-3 * dt);
    }
  } else {
    updateAiDrone(state, district, dt, rng);
  }

  drone.x = clamp(drone.x + drone.vx * dt, -arenaLimit, arenaLimit);
  drone.z = clamp(drone.z + drone.vz * dt, -arenaLimit, arenaLimit);
  drone.y = DRONE_ALTITUDE + Math.sin(state.elapsed * 2.4) * 0.35;

  const aimDx = drone.aimX - drone.x;
  const aimDz = drone.aimZ - drone.z;
  if (Math.hypot(aimDx, aimDz) > 0.3) {
    const targetYaw = Math.atan2(aimDx, aimDz);
    let diff = targetYaw - drone.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    drone.yaw += diff * (1 - Math.exp(-10 * dt));
  }

  // 5. Drone Sensor Detection Cone & LOS Calculation
  const runnerEyeY = runner.crouching ? 0.92 : 1.65;
  const los = checkLineOfSight(
    drone.x,
    drone.y,
    drone.z,
    runner.x,
    runnerEyeY,
    runner.z,
    district.buildings,
    state.covers,
  );

  const sensorRange = DRONE_SENSOR_BASE_RANGE * weatherParams.sensorRangeMult;
  const groundDistToRunner = dist2D(drone.x, drone.z, runner.x, runner.z);
  const aimDistToRunner = dist2D(drone.aimX, drone.aimZ, runner.x, runner.z);
  const inScanSpot = aimDistToRunner < 11.5 * weatherParams.sensorRangeMult || groundDistToRunner < sensorRange * 0.65;

  if (drone.empStunTimer > 0) {
    drone.detection = Math.max(0, drone.detection - 40 * dt);
  } else if (!los.blocked && groundDistToRunner <= sensorRange && inScanSpot) {
    // Exposed! Rate scales with stance, distance, and weather
    const stanceMult = runner.crouching ? 0.45 : runner.sprinting ? 1.45 : 1.0;
    const proxMult = 1 + clamp(1 - groundDistToRunner / sensorRange, 0, 1) * 0.9;
    const rate = 44 * stanceMult * proxMult * weatherParams.sensorRangeMult;
    drone.detection = Math.min(100, drone.detection + rate * dt);
    drone.lastKnownX = runner.x;
    drone.lastKnownZ = runner.z;
    drone.lastKnownTimer = 4.5;
  } else {
    // Hidden behind building/cover or out of range — decay detection
    const decayRate = runner.inCover && runner.crouching ? 34 : 20;
    drone.detection = Math.max(0, drone.detection - decayRate * dt);
  }

  drone.alertState =
    drone.detection >= 70 ? 'locked' : drone.detection >= 25 ? 'suspicious' : 'patrol';

  // 6. Update Cover flash timers & Projectiles
  for (const c of state.covers) {
    if (c.hitFlash > 0) c.hitFlash = Math.max(0, c.hitFlash - dt);
  }

  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    const prevX = p.x;
    const prevY = p.y;
    const prevZ = p.z;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.ttl -= dt;

    let hitSomething = false;

    // Check buildings
    for (const b of district.buildings) {
      const hw = b.w * 0.5;
      const hd = b.d * 0.5;
      const t = segmentIntersectsAABB3D(
        prevX,
        prevY,
        prevZ,
        p.x,
        p.y,
        p.z,
        b.x - hw,
        0,
        b.z - hd,
        b.x + hw,
        b.h,
        b.z + hd,
      );
      if (t !== null) {
        hitSomething = true;
        break;
      }
    }

    // Check destructible cover
    if (!hitSomething) {
      for (const c of state.covers) {
        if (c.destroyed) continue;
        const hw = c.w * 0.5 + 0.15;
        const hd = c.d * 0.5 + 0.15;
        const t = segmentIntersectsAABB3D(
          prevX,
          prevY,
          prevZ,
          p.x,
          p.y,
          p.z,
          c.x - hw,
          0,
          c.z - hd,
          c.x + hw,
          c.h + 0.15,
          c.z + hd,
        );
        if (t !== null) {
          damageCover(state, c, p.coverDamage);
          hitSomething = true;
          break;
        }
      }
    }

    // Check runner hit (when projectile reaches runner vertical band)
    if (!hitSomething && p.fromDrone && runner.invulnTimer <= 0) {
      const rHeight = runner.crouching ? 1.15 : 1.85;
      const t = segmentIntersectsAABB3D(
        prevX,
        prevY,
        prevZ,
        p.x,
        p.y,
        p.z,
        runner.x - 0.85,
        0,
        runner.z - 0.85,
        runner.x + 0.85,
        rHeight,
        runner.z + 0.85,
      );
      if (t !== null) {
        runner.hp = Math.max(0, runner.hp - p.damage);
        runner.damageTaken += p.damage;
        runner.hitFlash = 0.22;
        runner.invulnTimer = 0.12;
        drone.shotsHit += 1;
        state.hitstopTimer = Math.max(state.hitstopTimer, 0.035);
        state.cameraTrauma = Math.min(1, state.cameraTrauma + 0.42);
        state.events.push({
          type: 'runner_hit',
          x: runner.x,
          y: 1.1,
          z: runner.z,
          intensity: 0.9,
        });
        hitSomething = true;
      }
    }

    if (hitSomething || p.y <= 0.05 || p.ttl <= 0) {
      state.projectiles.splice(i, 1);
    }
  }

  // 7. Extraction Zone Capture Progress
  const distToExtract = dist2D(
    runner.x,
    runner.z,
    district.extractionPos.x,
    district.extractionPos.z,
  );
  if (distToExtract <= district.extractionRadius) {
    state.extractionProgress = Math.min(
      100,
      state.extractionProgress + (100 / state.extractionHoldSeconds) * dt,
    );
    state.events.push({ type: 'extract_tick', intensity: state.extractionProgress / 100 });
  } else if (state.extractionProgress > 0) {
    state.extractionProgress = Math.max(0, state.extractionProgress - 18 * dt);
  }

  // 8. Check Win / Loss Conditions
  if (runner.hp <= 0) {
    state.outcome = 'runner_eliminated';
    state.droneScore += 1;
    state.events.push({ type: 'round_end', detail: 'RUNNER NEUTRALIZED' });
  } else if (state.extractionProgress >= 100) {
    state.outcome = 'runner_extracted';
    state.runnerScore += 1;
    state.events.push({ type: 'round_end', detail: 'EXTRACTION COMPLETE' });
  } else if (state.timeRemaining <= 0) {
    state.outcome = 'time_expired';
    state.droneScore += 1;
    state.events.push({ type: 'round_end', detail: 'EXTRACTION WINDOW CLOSED' });
  }
}

/**
 * Tag-Style Round Advance: swaps Runner <-> Drone roles and preserves match score!
 */
export function advanceTagRound(prev: SimulationState, swapRoles = true): SimulationState {
  const nextRole: PlayerRole = swapRoles
    ? prev.localRole === 'runner'
      ? 'drone'
      : 'runner'
    : prev.localRole;

  return createSimulationState({
    districtId: prev.districtId,
    localRole: nextRole,
    weatherMode: prev.weatherMode,
    isMultiplayer: prev.isMultiplayer,
    roundNumber: prev.roundNumber + 1,
    runnerScore: prev.runnerScore,
    droneScore: prev.droneScore,
    roundDuration: prev.roundDuration,
  });
}

/**
 * Builds a clean, UI-ready HUD telemetry snapshot (throttled in React).
 */
export function buildHudSnapshot(state: SimulationState, phase: HudSnapshot['phase']): HudSnapshot {
  const district = DISTRICTS[state.districtId];
  const weatherParams = getWeatherParams(state.weather);
  const coversIntact = state.covers.filter((c) => !c.destroyed).length;

  return {
    phase,
    role: state.localRole,
    districtId: state.districtId,
    districtName: district.name,
    coordsLabel: district.coordsLabel,
    roundNumber: state.roundNumber,
    runnerScore: state.runnerScore,
    droneScore: state.droneScore,
    timeRemaining: Math.ceil(state.timeRemaining),
    extractionProgress: Math.round(state.extractionProgress),
    runnerHp: Math.round(state.runner.hp),
    runnerMaxHp: state.runner.maxHp,
    runnerStamina: Math.round(state.runner.stamina),
    runnerCrouching: state.runner.crouching,
    runnerInCover: state.runner.inCover,
    dashCooldown: Number(state.runner.dashCooldown.toFixed(1)),
    empCooldown: Number(state.runner.empCooldown.toFixed(1)),
    droneHp: Math.round(state.drone.hp),
    droneMaxHp: state.drone.maxHp,
    droneHeat: Math.round(state.drone.heat),
    droneOverheated: state.drone.overheated,
    sonarCooldown: Number(state.drone.sonarCooldown.toFixed(1)),
    sonarActive: state.drone.sonarActiveTimer > 0,
    empStunned: state.drone.empStunTimer > 0,
    detection: Math.round(state.drone.detection),
    alertState: state.drone.alertState,
    telegraphing: state.drone.telegraphTimer > 0,
    weather: state.weather,
    weatherLabel: weatherParams.label,
    visibilityRange: weatherParams.visibilityRange,
    droneAccuracyPct: Math.round(weatherParams.droneAccuracy * 100),
    coversIntact,
    coversTotal: state.covers.length,
    outcome: state.outcome,
    damageTaken: Math.round(state.runner.damageTaken),
    coversDestroyedCount: state.coversDestroyedCount,
    clearTime: Math.round(state.elapsed),
    minimap: {
      arenaHalfSize: district.arenaHalfSize,
      runnerX: state.runner.x,
      runnerZ: state.runner.z,
      runnerYaw: state.runner.yaw,
      droneX: state.drone.x,
      droneZ: state.drone.z,
      droneAimX: state.drone.aimX,
      droneAimZ: state.drone.aimZ,
      extractionX: district.extractionPos.x,
      extractionZ: district.extractionPos.z,
      sonarActive: state.drone.sonarActiveTimer > 0,
      covers: state.covers.map((c) => ({
        x: c.x,
        z: c.z,
        w: c.w,
        d: c.d,
        destroyed: c.destroyed,
        hpRatio: c.hp / c.maxHp,
      })),
    },
  };
}
