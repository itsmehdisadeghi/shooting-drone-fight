export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type PlayerRole = 'runner' | 'drone';

export type DistrictId = 'shibuya' | 'manhattan' | 'canary_wharf';

export type WeatherType = 'clear' | 'rain' | 'fog' | 'storm';
export type WeatherMode = 'dynamic' | WeatherType;

export type CoverKind = 'barrier' | 'container' | 'kiosk' | 'van';

export type DroneAlertState = 'patrol' | 'suspicious' | 'locked';

export type DroneAIPolicy = 'sweep' | 'cover_buster' | 'flanker';

export type RoundOutcome =
  | null
  | 'runner_extracted'
  | 'runner_eliminated'
  | 'time_expired';

export interface Vec2 {
  x: number;
  z: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface BuildingDef {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  style: 'glass' | 'concrete' | 'landmark';
  accentColor: number;
}

export interface CoverDef {
  id: string;
  kind: CoverKind;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  maxHp: number;
  rotationY?: number;
}

export interface CoverState extends CoverDef {
  hp: number;
  destroyed: boolean;
  hitFlash: number;
}

export interface DistrictDef {
  id: DistrictId;
  name: string;
  subtitle: string;
  coordsLabel: string;
  arenaHalfSize: number;
  asphaltColor: number;
  accentHex: string;
  runnerSpawn: Vec2;
  runnerSpawnYaw: number;
  droneSpawn: Vec3;
  extractionPos: Vec2;
  extractionRadius: number;
  buildings: BuildingDef[];
  covers: CoverDef[];
  patrolWaypoints: Vec2[];
}

export interface WeatherParams {
  type: WeatherType;
  label: string;
  visibilityRange: number; // meters
  sensorRangeMult: number; // 0.65 - 1.0
  droneAccuracy: number; // 0.64 - 1.0 (1.0 = tightest spread)
  spreadRad: number; // angular bullet spread in radians
  fogDensity: number;
  rainIntensity: number; // 0 - 1
  windStrength: number; // 0 - 1
  skyHex: number;
  fogHex: number;
  sunHex: number;
  sunIntensity: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
}

export interface RunnerState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  hp: number;
  maxHp: number;
  stamina: number;
  crouching: boolean;
  sprinting: boolean;
  inCover: boolean;
  nearestCoverId: string | null;
  dashCooldown: number;
  dashTimer: number;
  empCooldown: number;
  hitFlash: number;
  distanceWalked: number;
  damageTaken: number;
  invulnTimer: number;
}

export interface DroneState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  aimX: number;
  aimZ: number;
  hp: number;
  maxHp: number;
  heat: number; // 0..100
  overheated: boolean;
  fireCooldown: number;
  sonarCooldown: number;
  sonarActiveTimer: number;
  sonarOriginX: number;
  sonarOriginZ: number;
  empStunTimer: number;
  detection: number; // 0..100
  alertState: DroneAlertState;
  aiPolicy: DroneAIPolicy;
  policyTimer: number;
  waypointIndex: number;
  telegraphTimer: number; // >0 means windup laser locked before heavy burst
  telegraphTargetX: number;
  telegraphTargetZ: number;
  lastKnownX: number;
  lastKnownZ: number;
  lastKnownTimer: number;
  hitFlash: number;
  shotsFired: number;
  shotsHit: number;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  ttl: number;
  fromDrone: boolean;
  damage: number;
  coverDamage: number;
}

export interface SimEvent {
  type:
    | 'drone_shot'
    | 'cover_hit'
    | 'cover_destroyed'
    | 'runner_hit'
    | 'emp_pulse'
    | 'sonar_ping'
    | 'dash'
    | 'telegraph_start'
    | 'weather_change'
    | 'lightning'
    | 'extract_tick'
    | 'round_end';
  x?: number;
  y?: number;
  z?: number;
  intensity?: number;
  detail?: string;
}

export interface InputSnapshot {
  moveX: number; // -1..1
  moveZ: number; // -1..1
  sprint: boolean;
  crouch: boolean;
  dashPressed: boolean;
  abilityPressed: boolean; // EMP for runner, Sonar for drone
  fireHeld: boolean;
  firePressed: boolean;
  aimWorldX: number;
  aimWorldZ: number;
  cameraYaw: number;
}

export interface SimulationState {
  districtId: DistrictId;
  localRole: PlayerRole;
  isMultiplayer: boolean;
  roundNumber: number;
  runnerScore: number;
  droneScore: number;
  timeRemaining: number;
  roundDuration: number;
  elapsed: number;
  extractionProgress: number; // 0..100
  extractionHoldSeconds: number;
  weatherMode: WeatherMode;
  weather: WeatherType;
  weatherTimer: number;
  lightningFlash: number;
  hitstopTimer: number;
  cameraTrauma: number;
  outcome: RoundOutcome;
  coversDestroyedCount: number;
  runner: RunnerState;
  drone: DroneState;
  covers: CoverState[];
  projectiles: Projectile[];
  nextProjectileId: number;
  events: SimEvent[];
}

export interface HudSnapshot {
  phase: GamePhase;
  role: PlayerRole;
  districtId: DistrictId;
  districtName: string;
  coordsLabel: string;
  roundNumber: number;
  runnerScore: number;
  droneScore: number;
  timeRemaining: number;
  extractionProgress: number;
  runnerHp: number;
  runnerMaxHp: number;
  runnerStamina: number;
  runnerCrouching: boolean;
  runnerInCover: boolean;
  dashCooldown: number;
  empCooldown: number;
  droneHp: number;
  droneMaxHp: number;
  droneHeat: number;
  droneOverheated: boolean;
  sonarCooldown: number;
  sonarActive: boolean;
  empStunned: boolean;
  detection: number;
  alertState: DroneAlertState;
  telegraphing: boolean;
  weather: WeatherType;
  weatherLabel: string;
  visibilityRange: number;
  droneAccuracyPct: number;
  coversIntact: number;
  coversTotal: number;
  outcome: RoundOutcome;
  damageTaken: number;
  coversDestroyedCount: number;
  clearTime: number;
  minimap: {
    arenaHalfSize: number;
    runnerX: number;
    runnerZ: number;
    runnerYaw: number;
    droneX: number;
    droneZ: number;
    droneAimX: number;
    droneAimZ: number;
    extractionX: number;
    extractionZ: number;
    sonarActive: boolean;
    covers: Array<{ x: number; z: number; w: number; d: number; destroyed: boolean; hpRatio: number }>;
  };
}

export interface RoomPlayer {
  id: string;
  name: string;
  role: PlayerRole | 'spectator';
  ready: boolean;
  isHost: boolean;
  score: number;
}

export interface RoomState {
  code: string;
  districtId: DistrictId;
  weatherMode: WeatherMode;
  status: 'lobby' | 'playing';
  roundNumber: number;
  runnerScore: number;
  droneScore: number;
  players: RoomPlayer[];
}

export interface KillFeedEntry {
  id: string;
  text: string;
  accent: 'cyan' | 'amber' | 'crimson' | 'emerald';
  timestamp: number;
}
