import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { DISTRICTS } from './districts';
import { SoundEngine } from './audio';
import {
  buildCoverMesh,
  buildDroneMesh,
  buildExtractionMesh,
  buildRunnerMesh,
  buildUrbanDistrict,
  type CoverRig,
  type DroneRig,
  type ExtractionRig,
  type RunnerRig,
} from './models';
import {
  advanceTagRound,
  buildHudSnapshot,
  createNeutralInput,
  createSimulationState,
  getWeatherParams,
  stepSimulation,
} from './simulation';
import { createProceduralTextures, type ProceduralTextureSet } from './textures';
import type {
  DistrictId,
  GamePhase,
  HudSnapshot,
  InputSnapshot,
  KillFeedEntry,
  PlayerRole,
  SimulationState,
  WeatherMode,
  WeatherType,
} from './types';
import type { SyncSnapshotPayload } from '../multiplayer/client';

export interface TouchInputState {
  moveX: number;
  moveZ: number;
  sprint: boolean;
  crouch: boolean;
  fireHeld: boolean;
  dashQueued: boolean;
  abilityQueued: boolean;
}

export interface GameEngineHandle {
  startSolo: (districtId: DistrictId, role: PlayerRole, weatherMode: WeatherMode) => void;
  startMultiplayer: (
    districtId: DistrictId,
    role: PlayerRole,
    weatherMode: WeatherMode,
    isHost: boolean,
    roundNumber: number,
    runnerScore: number,
    droneScore: number,
  ) => void;
  restartRound: () => void;
  nextTagRound: (swapRoles: boolean) => void;
  setPreviewConfig: (districtId: DistrictId, weatherMode: WeatherMode) => void;
  setPhase: (phase: GamePhase) => void;
  toggleMute: () => boolean;
  isMuted: () => boolean;
  applyRemoteInput: (input: InputSnapshot) => void;
  applyRemoteSnapshot: (snap: SyncSnapshotPayload) => void;
  touchInput: TouchInputState;
}

interface GameCanvasProps {
  initialDistrict: DistrictId;
  initialRole: PlayerRole;
  initialWeather: WeatherMode;
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onPhaseChange: (phase: GamePhase) => void;
  onFeedEvent: (entry: KillFeedEntry) => void;
  onSendInput?: (input: InputSnapshot) => void;
  onSendSnapshot?: (snapshot: SyncSnapshotPayload) => void;
  engineRef: React.MutableRefObject<GameEngineHandle | null>;
}

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
  color: THREE.Color;
}

// Pre-allocated scratch math helpers outside render loop (zero GC)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _targetSky = new THREE.Color();
const _targetSun = new THREE.Color();
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();

function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function GameCanvas({
  initialDistrict,
  initialRole,
  initialWeather,
  onHudUpdate,
  onPhaseChange,
  onFeedEvent,
  onSendInput,
  onSendSnapshot,
  engineRef,
}: GameCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const callbacksRef = useRef({
    onHudUpdate,
    onPhaseChange,
    onFeedEvent,
    onSendInput,
    onSendSnapshot,
  });
  callbacksRef.current = {
    onHudUpdate,
    onPhaseChange,
    onFeedEvent,
    onSendInput,
    onSendSnapshot,
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const sound = new SoundEngine();

    // Renderer setup per Three.js & Software-WebGL guidelines
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const initWeatherParams = getWeatherParams(
      initialWeather === 'dynamic' ? 'clear' : initialWeather,
    );
    scene.background = new THREE.Color(initWeatherParams.skyHex);
    scene.fog = new THREE.FogExp2(initWeatherParams.fogHex, initWeatherParams.fogDensity);

    // Studio RoomEnvironment reflection map on every device
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      56,
      (mount.clientWidth || window.innerWidth) / Math.max(1, mount.clientHeight || window.innerHeight),
      0.3,
      360,
    );
    camera.position.set(-48, 34, 48);

    // Warm/cool 3-point lighting rig (1 shadow caster with tight frustum)
    const hemiLight = new THREE.HemisphereLight(
      initWeatherParams.hemiSkyHex,
      initWeatherParams.hemiGroundHex,
      initWeatherParams.hemiIntensity,
    );
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(
      initWeatherParams.sunHex,
      initWeatherParams.sunIntensity,
    );
    sunLight.position.set(42, 68, 34);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 175;
    sunLight.shadow.camera.left = -62;
    sunLight.shadow.camera.right = 62;
    sunLight.shadow.camera.top = 62;
    sunLight.shadow.camera.bottom = -62;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.55);
    rimLight.position.set(-46, 26, -42);
    scene.add(rimLight);

    const textures: ProceduralTextureSet = createProceduralTextures(
      renderer.capabilities.getMaxAnisotropy(),
    );

    // Core actors
    const droneRig: DroneRig = buildDroneMesh();
    const runnerRig: RunnerRig = buildRunnerMesh(textures);
    scene.add(
      droneRig.root,
      droneRig.scanCone,
      droneRig.targetRing,
      droneRig.telegraphLine,
      runnerRig.root,
    );

    // Expanding 3D wave rings (EMP cyan ring + Thermal Sonar crimson-amber ring)
    const empWaveMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const empWaveMesh = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.0, 32), empWaveMat);
    empWaveMesh.rotation.x = -Math.PI / 2;
    empWaveMesh.position.y = 0.25;
    empWaveMesh.visible = false;
    scene.add(empWaveMesh);

    const sonarWaveMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const sonarWaveMesh = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.0, 36), sonarWaveMat);
    sonarWaveMesh.rotation.x = -Math.PI / 2;
    sonarWaveMesh.position.y = 0.28;
    sonarWaveMesh.visible = false;
    scene.add(sonarWaveMesh);

    // Diegetic grounded Extraction Waypoint Chevron orbiting near Runner feet
    const evacArrowGeo = new THREE.ConeGeometry(0.32, 0.78, 3);
    evacArrowGeo.rotateX(Math.PI / 2);
    const evacArrowMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const evacArrowMesh = new THREE.Mesh(evacArrowGeo, evacArrowMat);
    evacArrowMesh.position.y = 0.22;
    scene.add(evacArrowMesh);

    // Pooled Zero-GC Debris & Spark Particle Ring Buffer (InstancedMesh)
    const PARTICLE_COUNT = 160;
    const particles: ParticleSlot[] = Array.from({ length: PARTICLE_COUNT }, () => ({
      active: false,
      x: 0,
      y: -999,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 1,
      scale: 0.2,
      color: new THREE.Color(0xf59e0b),
    }));
    let particleCursor = 0;
    const particleInst = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.22, 0),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      PARTICLE_COUNT,
    );
    particleInst.frustumCulled = false;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      _dummy.position.set(0, -999, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      particleInst.setMatrixAt(i, _dummy.matrix);
      particleInst.setColorAt(i, _color.setHex(0xffffff));
    }
    particleInst.instanceMatrix.needsUpdate = true;
    scene.add(particleInst);

    function spawnParticleBurst(
      x: number,
      y: number,
      z: number,
      count: number,
      hex: number,
      speed: number,
      scaleBase: number,
    ) {
      for (let i = 0; i < count; i++) {
        const slot = particles[particleCursor];
        particleCursor = (particleCursor + 1) % PARTICLE_COUNT;
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.4 + Math.random() * 0.9);
        slot.active = true;
        slot.x = x;
        slot.y = y;
        slot.z = z;
        slot.vx = Math.cos(a) * s;
        slot.vy = speed * (0.45 + Math.random() * 0.85);
        slot.vz = Math.sin(a) * s;
        slot.maxLife = 0.35 + Math.random() * 0.45;
        slot.life = slot.maxLife;
        slot.scale = scaleBase * (0.65 + Math.random() * 0.75);
        slot.color.setHex(hex);
      }
    }

    // Pooled 20mm Autocannon Tracer Bolts (InstancedMesh)
    const TRACER_POOL = 40;
    const tracerGeo = new THREE.BoxGeometry(0.14, 0.14, 1.5);
    const tracerInst = new THREE.InstancedMesh(
      tracerGeo,
      new THREE.MeshBasicMaterial({ color: 0xffd166 }),
      TRACER_POOL,
    );
    tracerInst.frustumCulled = false;
    scene.add(tracerInst);

    // Instanced 3D Rain Streak Field (scales with dynamic weather)
    const RAIN_COUNT = 260;
    const rainGeo = new THREE.BoxGeometry(0.035, 1.55, 0.035);
    const rainMat = new THREE.MeshBasicMaterial({
      color: 0xa5d8ff,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const rainInst = new THREE.InstancedMesh(rainGeo, rainMat, RAIN_COUNT);
    rainInst.frustumCulled = false;
    const rainPositions = new Float32Array(RAIN_COUNT * 3);
    for (let i = 0; i < RAIN_COUNT; i++) {
      rainPositions[i * 3] = (Math.random() - 0.5) * 90;
      rainPositions[i * 3 + 1] = Math.random() * 34;
      rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    scene.add(rainInst);

    // Dynamic District World Container
    let districtGroup: THREE.Group | null = null;
    let buildingMeshes: THREE.Object3D[] = [];
    let extractionRig: ExtractionRig | null = null;
    let coverRigs: Map<string, CoverRig> = new Map();
    let activeDistrictId: DistrictId | null = null;

    let phase: GamePhase = 'title';
    let isMultiplayerHost = true;
    let sim: SimulationState = createSimulationState({
      districtId: initialDistrict,
      localRole: initialRole,
      weatherMode: initialWeather,
    });

    function mountDistrictGeometry(state: SimulationState) {
      if (activeDistrictId === state.districtId && districtGroup) {
        // Just reset cover visual states
        for (const c of state.covers) {
          const rig = coverRigs.get(c.id);
          if (rig) {
            rig.intactGroup.visible = !c.destroyed;
            rig.rubbleGroup.visible = c.destroyed;
            rig.hpBarBg.visible = false;
            rig.intactGroup.rotation.set(0, 0, 0);
          }
        }
        return;
      }

      if (districtGroup) {
        scene.remove(districtGroup);
        districtGroup = null;
      }
      for (const rig of coverRigs.values()) {
        scene.remove(rig.root);
      }
      coverRigs.clear();
      if (extractionRig) {
        scene.remove(extractionRig.root);
        extractionRig = null;
      }

      const district = DISTRICTS[state.districtId];
      const built = buildUrbanDistrict(district, textures);
      districtGroup = built.group;
      buildingMeshes = built.buildingMeshes;
      scene.add(districtGroup);

      extractionRig = buildExtractionMesh(district.extractionRadius);
      extractionRig.root.position.set(district.extractionPos.x, 0, district.extractionPos.z);
      scene.add(extractionRig.root);

      for (const c of state.covers) {
        const rig = buildCoverMesh(c, textures);
        coverRigs.set(c.id, rig);
        scene.add(rig.root);
      }
      activeDistrictId = state.districtId;
    }

    mountDistrictGeometry(sim);
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Unified Input State
    const keysDown = new Set<string>();
    let dashBufferTimer = 0;
    let abilityQueued = false;
    let fireHeld = false;
    let fireQueued = false;
    let pointerClientX = window.innerWidth * 0.5;
    let pointerClientY = window.innerHeight * 0.5;
    let remoteInput: InputSnapshot | null = null;

    const touchInput: TouchInputState = {
      moveX: 0,
      moveZ: 0,
      sprint: false,
      crouch: false,
      fireHeld: false,
      dashQueued: false,
      abilityQueued: false,
    };

    const clearInputs = () => {
      keysDown.clear();
      fireHeld = false;
      dashBufferTimer = 0;
      abilityQueued = false;
      fireQueued = false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (!e.repeat) {
        if (e.code === 'Space') {
          if (phase === 'playing') {
            e.preventDefault();
            if (sim.localRole === 'runner') dashBufferTimer = 0.14;
            else fireQueued = true;
          }
        } else if (e.code === 'KeyE' || e.code === 'KeyQ') {
          if (phase === 'playing') abilityQueued = true;
        } else if (e.code === 'KeyM') {
          sound.toggleMute();
        }
      }
      keysDown.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysDown.delete(e.code);
    };

    const onPointerMove = (e: PointerEvent) => {
      pointerClientX = e.clientX;
      pointerClientY = e.clientY;
    };

    const onPointerDown = (e: PointerEvent) => {
      sound.unlock();
      if (phase !== 'playing') return;
      if (e.target !== renderer.domElement) return;
      pointerClientX = e.clientX;
      pointerClientY = e.clientY;
      if (e.button === 0) {
        if (sim.localRole === 'drone') {
          fireHeld = true;
          fireQueued = true;
        } else {
          abilityQueued = true;
        }
      } else if (e.button === 2 && sim.localRole === 'drone') {
        abilityQueued = true;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button === 0) fireHeld = false;
    };

    const onContextMenu = (e: MouseEvent) => {
      if (phase === 'playing') e.preventDefault();
    };

    const onBlur = () => clearInputs();
    const onVisibility = () => {
      if (document.hidden) clearInputs();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);

    const resizeObserver = new ResizeObserver(() => {
      const w = mount.clientWidth || window.innerWidth;
      const h = Math.max(1, mount.clientHeight || window.innerHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(mount);

    // Expose Engine Controller API to React Shell
    const pushFeed = (text: string, accent: KillFeedEntry['accent']) => {
      callbacksRef.current.onFeedEvent({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        text,
        accent,
        timestamp: Date.now(),
      });
    };

    const snapCameraToGameplay = () => {
      const district = DISTRICTS[sim.districtId];
      if (sim.localRole === 'runner') {
        camera.position.set(
          sim.runner.x - 0.68 * 13.5,
          10.2,
          sim.runner.z + 0.73 * 13.5,
        );
        camera.lookAt(sim.runner.x + 2.0, 1.4, sim.runner.z - 2.0);
      } else {
        camera.position.set(sim.drone.x - 4.5, sim.drone.y + 26, sim.drone.z + 12.5);
        camera.lookAt(sim.drone.x, 1.2, sim.drone.z);
      }
      // Also ensure initial aim is over the district center
      if (sim.localRole === 'drone') {
        sim.drone.aimX = sim.drone.x;
        sim.drone.aimZ = sim.drone.z;
      } else {
        void district;
      }
    };

    const setEnginePhase = (next: GamePhase) => {
      const wasPlaying = phase === 'playing';
      phase = next;
      document.body.dataset.state = next;
      if (next === 'playing') {
        clearInputs();
        sound.unlock();
        if (!wasPlaying) {
          snapCameraToGameplay();
        }
      } else {
        sound.setWeatherAmbience(0, false);
      }
      callbacksRef.current.onPhaseChange(next);
      callbacksRef.current.onHudUpdate(buildHudSnapshot(sim, phase));
    };

    engineRef.current = {
      startSolo(districtId, role, weatherMode) {
        isMultiplayerHost = true;
        remoteInput = null;
        sim = createSimulationState({
          districtId,
          localRole: role,
          weatherMode,
          isMultiplayer: false,
        });
        mountDistrictGeometry(sim);
        setEnginePhase('playing');
        pushFeed(
          `DEPLOYED AS ${role.toUpperCase()} · ${DISTRICTS[districtId].name}`,
          role === 'runner' ? 'cyan' : 'amber',
        );
      },
      startMultiplayer(districtId, role, weatherMode, isHost, roundNumber, runnerScore, droneScore) {
        isMultiplayerHost = isHost;
        remoteInput = null;
        sim = createSimulationState({
          districtId,
          localRole: role,
          weatherMode,
          isMultiplayer: true,
          roundNumber,
          runnerScore,
          droneScore,
        });
        mountDistrictGeometry(sim);
        setEnginePhase('playing');
        pushFeed(
          `ROUND ${roundNumber} LIVE · ${role.toUpperCase()} ONLINE`,
          role === 'runner' ? 'cyan' : 'crimson',
        );
      },
      restartRound() {
        sim = createSimulationState({
          districtId: sim.districtId,
          localRole: sim.localRole,
          weatherMode: sim.weatherMode,
          isMultiplayer: sim.isMultiplayer,
          roundNumber: sim.roundNumber,
          runnerScore: sim.runnerScore,
          droneScore: sim.droneScore,
        });
        mountDistrictGeometry(sim);
        setEnginePhase('playing');
      },
      nextTagRound(swapRoles) {
        sim = advanceTagRound(sim, swapRoles);
        mountDistrictGeometry(sim);
        setEnginePhase('playing');
        pushFeed(
          `TAG SWAP · ROUND ${sim.roundNumber} AS ${sim.localRole.toUpperCase()}`,
          sim.localRole === 'runner' ? 'cyan' : 'amber',
        );
      },
      setPreviewConfig(districtId, weatherMode) {
        if (phase !== 'title') return;
        sim = createSimulationState({
          districtId,
          localRole: sim.localRole,
          weatherMode,
        });
        mountDistrictGeometry(sim);
        callbacksRef.current.onHudUpdate(buildHudSnapshot(sim, phase));
      },
      setPhase(next) {
        setEnginePhase(next);
      },
      toggleMute() {
        return sound.toggleMute();
      },
      isMuted() {
        return sound.isMuted();
      },
      applyRemoteInput(input) {
        remoteInput = input;
      },
      applyRemoteSnapshot(snap) {
        if (isMultiplayerHost) return;
        sim.elapsed = snap.elapsed;
        sim.timeRemaining = snap.timeRemaining;
        sim.extractionProgress = snap.extractionProgress;
        sim.weather = snap.weather as WeatherType;
        sim.runnerScore = snap.runnerScore;
        sim.droneScore = snap.droneScore;
        sim.runner.x = snap.runner.x;
        sim.runner.z = snap.runner.z;
        sim.runner.yaw = snap.runner.yaw;
        sim.runner.hp = snap.runner.hp;
        sim.runner.crouching = snap.runner.crouching;
        sim.runner.sprinting = snap.runner.sprinting;
        sim.runner.inCover = snap.runner.inCover;
        sim.runner.distanceWalked = snap.runner.distanceWalked;
        sim.drone.x = snap.drone.x;
        sim.drone.y = snap.drone.y;
        sim.drone.z = snap.drone.z;
        sim.drone.yaw = snap.drone.yaw;
        sim.drone.aimX = snap.drone.aimX;
        sim.drone.aimZ = snap.drone.aimZ;
        sim.drone.hp = snap.drone.hp;
        sim.drone.heat = snap.drone.heat;
        sim.drone.detection = snap.drone.detection;
        sim.drone.alertState = snap.drone.alertState as SimulationState['drone']['alertState'];
        sim.drone.sonarActiveTimer = snap.drone.sonarActiveTimer;
        sim.drone.empStunTimer = snap.drone.empStunTimer;
        sim.drone.telegraphTimer = snap.drone.telegraphTimer;
        sim.drone.telegraphTargetX = snap.drone.telegraphTargetX;
        sim.drone.telegraphTargetZ = snap.drone.telegraphTargetZ;

        for (const sc of snap.covers) {
          const localC = sim.covers.find((c) => c.id === sc.id);
          if (localC) {
            if (!localC.destroyed && sc.destroyed) {
              spawnParticleBurst(localC.x, localC.h * 0.5, localC.z, 22, 0xf59e0b, 9, 0.35);
              sound.playCoverHit(true);
            }
            localC.hp = sc.hp;
            localC.destroyed = sc.destroyed;
          }
        }
        if (snap.outcome && !sim.outcome) {
          sim.outcome = snap.outcome as SimulationState['outcome'];
          setEnginePhase('gameover');
        }
      },
      touchInput,
    };

    // Wave animation state
    let empWaveAge = 99;
    let sonarWaveAge = 99;
    let muzzleFlashTimer = 0;
    let lastHudPush = 0;
    let lastNetPush = 0;
    let lastTime = performance.now();
    let titleOrbitAngle = 0.65;
    let frameId = 0;
    let disposed = false;

    const screenToGround = (clientX: number, clientY: number): { x: number; z: number } => {
      const rect = renderer.domElement.getBoundingClientRect();
      _ndc.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      _ndc.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
      _raycaster.setFromCamera(_ndc, camera);
      const hit = _raycaster.ray.intersectPlane(_groundPlane, _v1);
      if (hit) {
        return { x: hit.x, z: hit.z };
      }
      return { x: sim.drone.x, z: sim.drone.z };
    };

    const buildLocalInput = (dt: number): InputSnapshot => {
      const input = createNeutralInput();
      let ix = 0;
      let iz = 0;
      if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) iz -= 1;
      if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) iz += 1;
      if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) ix -= 1;
      if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) ix += 1;

      if (Math.hypot(touchInput.moveX, touchInput.moveZ) > 0.08) {
        ix = touchInput.moveX;
        iz = touchInput.moveZ;
      }

      // Align movement to current camera forward/right projection on XZ plane
      camera.getWorldDirection(_v2);
      _v2.y = 0;
      if (_v2.lengthSq() < 1e-4) _v2.set(0, 0, -1);
      _v2.normalize();
      _v3.set(-_v2.z, 0, _v2.x); // camera right

      input.moveX = _v3.x * ix + _v2.x * -iz;
      input.moveZ = _v3.z * ix + _v2.z * -iz;
      input.sprint = keysDown.has('ShiftLeft') || keysDown.has('ShiftRight') || touchInput.sprint;
      input.crouch = keysDown.has('KeyC') || keysDown.has('ControlLeft') || touchInput.crouch;

      if (dashBufferTimer > 0) {
        input.dashPressed = true;
        dashBufferTimer = Math.max(0, dashBufferTimer - dt);
      }
      if (touchInput.dashQueued) {
        input.dashPressed = true;
        touchInput.dashQueued = false;
      }
      if (abilityQueued || touchInput.abilityQueued) {
        input.abilityPressed = true;
        abilityQueued = false;
        touchInput.abilityQueued = false;
      }

      input.fireHeld =
        fireHeld ||
        touchInput.fireHeld ||
        (sim.localRole === 'drone' && keysDown.has('Space'));
      input.firePressed = fireQueued;
      fireQueued = false;

      const aim = screenToGround(pointerClientX, pointerClientY);
      input.aimWorldX = aim.x;
      input.aimWorldZ = aim.z;
      return input;
    };

    const syncVisualsFromSim = (dt: number, elapsedSec: number) => {
      const weatherParams = getWeatherParams(sim.weather);
      const damp = 1 - Math.exp(-3.0 * dt);

      // Weather lighting, fog, and lightning flashes
      _targetSky.setHex(weatherParams.skyHex);
      if (sim.lightningFlash > 0.05) {
        _targetSky.lerp(_color.setHex(0xcbd5e1), sim.lightningFlash * 0.72);
      }
      (scene.background as THREE.Color).lerp(_targetSky, damp);
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(scene.background as THREE.Color);
        scene.fog.density += (weatherParams.fogDensity - scene.fog.density) * damp;
      }

      _targetSun.setHex(weatherParams.sunHex);
      sunLight.color.lerp(_targetSun, damp);
      sunLight.intensity +=
        (weatherParams.sunIntensity + sim.lightningFlash * 3.2 - sunLight.intensity) * damp;
      hemiLight.color.lerp(_color.setHex(weatherParams.hemiSkyHex), damp);
      hemiLight.intensity += (weatherParams.hemiIntensity - hemiLight.intensity) * damp;

      sound.setWeatherAmbience(weatherParams.rainIntensity, phase === 'playing');

      // Runner articulated visual sync
      runnerRig.root.position.set(sim.runner.x, 0, sim.runner.z);
      runnerRig.root.rotation.y = sim.runner.yaw;

      const targetTorsoY = sim.runner.crouching ? 0.46 : 0.8;
      runnerRig.torsoGroup.position.y +=
        (targetTorsoY - runnerRig.torsoGroup.position.y) * (1 - Math.exp(-15 * dt));

      // Squash & stretch on dash
      const dashStretch = sim.runner.dashTimer > 0 ? 1.18 : 1.0;
      const dashSquash = sim.runner.dashTimer > 0 ? 0.86 : 1.0;
      runnerRig.root.scale.x += (dashSquash - runnerRig.root.scale.x) * (1 - Math.exp(-14 * dt));
      runnerRig.root.scale.y += (dashStretch - runnerRig.root.scale.y) * (1 - Math.exp(-14 * dt));
      runnerRig.root.scale.z += (dashStretch - runnerRig.root.scale.z) * (1 - Math.exp(-14 * dt));

      // Gait synced strictly to distance traveled (never skates)
      const speedMag = Math.hypot(sim.runner.vx, sim.runner.vz);
      const strideAmp = Math.min(0.65, speedMag * 0.08);
      const swing = Math.sin(sim.runner.distanceWalked * 2.5) * strideAmp;
      runnerRig.leftLeg.rotation.x = swing;
      runnerRig.rightLeg.rotation.x = -swing;
      runnerRig.leftArm.rotation.x = -swing * 0.85;
      runnerRig.rightArm.rotation.x = swing * 0.85;

      // Runner status diode & hit flash
      if (sim.runner.hitFlash > 0) {
        runnerRig.bodyMat.emissive.setHex(0xffffff);
        runnerRig.bodyMat.emissiveIntensity = 1.6;
      } else {
        runnerRig.bodyMat.emissive.setHex(0x000000);
        runnerRig.bodyMat.emissiveIntensity = 0;
      }
      const diodeColor =
        sim.drone.alertState === 'locked'
          ? 0xf43f5e
          : sim.runner.inCover && sim.runner.crouching
            ? 0x10b981
            : 0x38bdf8;
      runnerRig.statusDiodeMat.color.setHex(diodeColor);
      runnerRig.statusDiodeMat.emissive.setHex(diodeColor);
      runnerRig.sonarOutlineRing.visible = sim.drone.sonarActiveTimer > 0;
      if (runnerRig.sonarOutlineRing.visible) {
        const s = 1 + Math.sin(elapsedSec * 12) * 0.14;
        runnerRig.sonarOutlineRing.scale.set(s, s, 1);
      }

      // Drone visual sync + rotor spin + bank tilt + volumetric scan cone
      droneRig.root.position.set(sim.drone.x, sim.drone.y, sim.drone.z);
      droneRig.root.rotation.y = sim.drone.yaw;
      droneRig.bodyGroup.rotation.z = THREE.MathUtils.clamp(-sim.drone.vx * 0.022, -0.26, 0.26);
      droneRig.bodyGroup.rotation.x = THREE.MathUtils.clamp(sim.drone.vz * 0.022, -0.26, 0.26);

      const rotorSpinRate = sim.drone.empStunTimer > 0 ? 5 : 28;
      for (let i = 0; i < droneRig.rotors.length; i++) {
        droneRig.rotors[i].rotation.y += (i % 2 === 0 ? 1 : -1) * rotorSpinRate * dt;
      }

      const coneColor =
        sim.drone.empStunTimer > 0
          ? 0x64748b
          : sim.drone.alertState === 'locked'
            ? 0xf43f5e
            : sim.drone.alertState === 'suspicious'
              ? 0xf59e0b
              : 0x22d3ee;
      droneRig.sensorLensMat.color.setHex(coneColor);
      droneRig.sensorLensMat.emissive.setHex(coneColor);
      droneRig.scanConeMat.color.setHex(coneColor);
      droneRig.scanConeMat.opacity =
        sim.drone.empStunTimer > 0 ? 0.04 : sim.drone.alertState === 'locked' ? 0.2 : 0.12;
      droneRig.targetRingMat.color.setHex(coneColor);

      // Position & orient volumetric scan cone from drone gimbal to ground aim point
      _v1.set(sim.drone.x, sim.drone.y - 0.55, sim.drone.z);
      _v2.set(sim.drone.aimX, 0.1, sim.drone.aimZ);
      const coneDist = Math.max(2, _v1.distanceTo(_v2));
      droneRig.scanCone.position.copy(_v1);
      droneRig.scanCone.lookAt(_v2);
      const coneScaleR = weatherParams.sensorRangeMult;
      droneRig.scanCone.scale.set(coneScaleR, coneScaleR, coneDist);

      droneRig.targetRing.position.set(sim.drone.aimX, 0, sim.drone.aimZ);
      droneRig.targetRing.rotation.y += dt * 1.4;
      droneRig.targetRing.visible = sim.drone.empStunTimer <= 0;

      // Telegraph windup laser sightline
      if (sim.drone.telegraphTimer > 0) {
        droneRig.telegraphLine.visible = true;
        const posAttr = droneRig.telegraphLine.geometry.getAttribute('position') as THREE.BufferAttribute;
        posAttr.setXYZ(0, sim.drone.x, sim.drone.y - 0.55, sim.drone.z);
        posAttr.setXYZ(1, sim.drone.telegraphTargetX, 1.0, sim.drone.telegraphTargetZ);
        posAttr.needsUpdate = true;
      } else {
        droneRig.telegraphLine.visible = false;
      }

      if (muzzleFlashTimer > 0) {
        muzzleFlashTimer = Math.max(0, muzzleFlashTimer - dt);
        droneRig.muzzleFlash.visible = true;
      } else {
        droneRig.muzzleFlash.visible = false;
      }

      // Extraction Beacon animation + Runner grounded direction chevron
      if (extractionRig) {
        extractionRig.chevronRing.rotation.z += dt * (0.7 + (sim.extractionProgress / 100) * 3.0);
        const prog = Math.max(0.02, sim.extractionProgress / 100);
        extractionRig.progressRing.scale.set(prog, prog, 1);
        extractionRig.beamMat.opacity = 0.14 + (sim.extractionProgress / 100) * 0.25;
      }

      if (phase === 'playing' && sim.localRole === 'runner') {
        const district = DISTRICTS[sim.districtId];
        const dx = district.extractionPos.x - sim.runner.x;
        const dz = district.extractionPos.z - sim.runner.z;
        const dist = Math.hypot(dx, dz);
        if (dist > district.extractionRadius) {
          evacArrowMesh.visible = true;
          const angle = Math.atan2(dx, dz);
          evacArrowMesh.position.set(
            sim.runner.x + (dx / dist) * 1.75,
            0.22,
            sim.runner.z + (dz / dist) * 1.75,
          );
          evacArrowMesh.rotation.y = angle;
        } else {
          evacArrowMesh.visible = false;
        }
      } else {
        evacArrowMesh.visible = false;
      }

      // Destructible Covers sync
      for (const c of sim.covers) {
        const rig = coverRigs.get(c.id);
        if (!rig) continue;
        rig.intactGroup.visible = !c.destroyed;
        rig.rubbleGroup.visible = c.destroyed;

        if (!c.destroyed) {
          const hpRatio = c.hp / c.maxHp;
          // Show floating integrity strip when damaged
          if (hpRatio < 0.99) {
            rig.hpBarBg.visible = true;
            rig.hpBarBg.lookAt(camera.position);
            rig.hpBarFill.scale.x = Math.max(0.02, hpRatio);
            rig.hpBarFill.position.x = -(1 - hpRatio) * 1.14;
            rig.hpBarFillMat.color.setHex(hpRatio < 0.35 ? 0xf43f5e : 0xf59e0b);
            // Subtle battle damage tilt
            rig.intactGroup.rotation.z = (1 - hpRatio) * 0.08 * (c.x >= 0 ? 1 : -1);
          } else {
            rig.hpBarBg.visible = false;
            rig.intactGroup.rotation.z = 0;
          }

          for (const mat of rig.damageTintMats) {
            if (c.hitFlash > 0) {
              mat.emissive.setHex(0xffffff);
              mat.emissiveIntensity = 0.9;
            } else {
              mat.emissive.setHex(0x000000);
              mat.emissiveIntensity = 0;
            }
          }
        } else {
          rig.hpBarBg.visible = false;
        }
      }

      // Update pooled tracers
      for (let i = 0; i < TRACER_POOL; i++) {
        if (i < sim.projectiles.length) {
          const p = sim.projectiles[i];
          _dummy.position.set(p.x, p.y, p.z);
          _v1.set(p.x + p.vx, p.y + p.vy, p.z + p.vz);
          _dummy.lookAt(_v1);
          _dummy.scale.set(1, 1, 1);
        } else {
          _dummy.position.set(0, -999, 0);
          _dummy.scale.setScalar(0.001);
        }
        _dummy.updateMatrix();
        tracerInst.setMatrixAt(i, _dummy.matrix);
      }
      tracerInst.instanceMatrix.needsUpdate = true;

      // Update pooled sparks / debris particles
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i];
        if (p.active) {
          p.life -= dt;
          if (p.life <= 0) {
            p.active = false;
            _dummy.position.set(0, -999, 0);
            _dummy.scale.setScalar(0.001);
          } else {
            p.vy -= 18 * dt;
            p.x += p.vx * dt;
            p.y = Math.max(0.08, p.y + p.vy * dt);
            p.z += p.vz * dt;
            const s = p.scale * (p.life / p.maxLife);
            _dummy.position.set(p.x, p.y, p.z);
            _dummy.rotation.set(p.life * 6, p.life * 4, 0);
            _dummy.scale.setScalar(Math.max(0.01, s));
            particleInst.setColorAt(i, p.color);
          }
        } else {
          _dummy.position.set(0, -999, 0);
          _dummy.scale.setScalar(0.001);
        }
        _dummy.updateMatrix();
        particleInst.setMatrixAt(i, _dummy.matrix);
      }
      particleInst.instanceMatrix.needsUpdate = true;
      if (particleInst.instanceColor) particleInst.instanceColor.needsUpdate = true;

      // Update expanding EMP & Sonar wave meshes
      if (empWaveAge < 0.75) {
        empWaveAge += dt;
        const t = empWaveAge / 0.75;
        empWaveMesh.visible = true;
        empWaveMesh.scale.setScalar(1 + t * 27);
        empWaveMat.opacity = (1 - t) * 0.75;
      } else {
        empWaveMesh.visible = false;
      }

      if (sonarWaveAge < 1.1) {
        sonarWaveAge += dt;
        const t = sonarWaveAge / 1.1;
        sonarWaveMesh.visible = true;
        sonarWaveMesh.scale.setScalar(1 + t * 44);
        sonarWaveMat.opacity = (1 - t) * 0.65;
      } else {
        sonarWaveMesh.visible = false;
      }

      // Dynamic 3D Rain streaks
      if (weatherParams.rainIntensity > 0.05) {
        rainInst.visible = true;
        rainMat.opacity = 0.22 + weatherParams.rainIntensity * 0.35;
        const fallSpeed = 32 + weatherParams.rainIntensity * 22;
        const windTilt = weatherParams.windStrength * 0.24;
        const windDrift = weatherParams.windStrength * 9;
        for (let i = 0; i < RAIN_COUNT; i++) {
          let rx = rainPositions[i * 3] + windDrift * dt;
          let ry = rainPositions[i * 3 + 1] - fallSpeed * dt;
          let rz = rainPositions[i * 3 + 2] + windDrift * 0.4 * dt;
          if (ry < 0) {
            ry = 32 + (i % 6);
            rx = sim.runner.x + ((i * 37) % 90) - 45;
            rz = sim.runner.z + ((i * 59) % 90) - 45;
          }
          rainPositions[i * 3] = rx;
          rainPositions[i * 3 + 1] = ry;
          rainPositions[i * 3 + 2] = rz;
          _dummy.position.set(rx, ry, rz);
          _dummy.rotation.set(0, 0, -windTilt);
          _dummy.scale.set(1, 0.8 + weatherParams.rainIntensity * 0.7, 1);
          _dummy.updateMatrix();
          rainInst.setMatrixAt(i, _dummy.matrix);
        }
        rainInst.instanceMatrix.needsUpdate = true;
      } else {
        rainInst.visible = false;
      }
    };

    const updateCamera = (dt: number) => {
      const district = DISTRICTS[sim.districtId];
      const damp = 1 - Math.exp(-6.8 * dt);

      if (phase === 'title') {
        titleOrbitAngle += dt * 0.14;
        const rad = 46;
        _camDesired.set(
          Math.cos(titleOrbitAngle) * rad,
          32 + Math.sin(titleOrbitAngle * 1.3) * 3,
          Math.sin(titleOrbitAngle) * rad,
        );
        camera.position.lerp(_camDesired, 1 - Math.exp(-3.0 * dt));
        // Frame the central scramble plaza & hovering drone slightly to the right of title UI
        _lookTarget.set(4, 7, -4);
        camera.lookAt(_lookTarget);
        return;
      }

      if (sim.localRole === 'runner') {
        // Tactical over-the-shoulder / isometric-tilted stealth camera aligned toward Extraction
        const toExX = district.extractionPos.x - sim.runner.x;
        const toExZ = district.extractionPos.z - sim.runner.z;
        const len = Math.hypot(toExX, toExZ) || 1;
        // Stable diagonal south-west offset so WASD stays intuitive & extraction stays framed ahead
        const backX = -0.68;
        const backZ = 0.73;
        const camDist = sim.runner.crouching ? 11.2 : 13.5;
        const camHeight = sim.runner.crouching ? 7.6 : 10.2;

        _v1.set(sim.runner.x, 1.8, sim.runner.z);
        _camDesired.set(
          sim.runner.x + backX * camDist,
          camHeight,
          sim.runner.z + backZ * camDist,
        );

        // Raycast camera pull-in against skyscrapers so camera never clips inside a building
        _v2.subVectors(_camDesired, _v1);
        const desiredLen = _v2.length();
        if (desiredLen > 0.1 && buildingMeshes.length > 0) {
          _raycaster.set(_v1, _v2.normalize());
          _raycaster.far = desiredLen;
          const hits = _raycaster.intersectObjects(buildingMeshes, false);
          if (hits.length > 0) {
            const safeDist = Math.max(4.5, hits[0].distance - 1.2);
            _camDesired.copy(_v1).addScaledVector(_v2, safeDist);
          }
        }

        camera.position.lerp(_camDesired, damp);
        _lookTarget.set(
          sim.runner.x + (toExX / len) * 2.8,
          1.4,
          sim.runner.z + (toExZ / len) * 2.8,
        );
      } else {
        // Aerial Combat Drone Gunship Camera: elevated rooftop-clearing tactical overwatch
        // Tight horizontal offset + high altitude so surrounding skyscrapers never occlude the drone or street
        const baseY = sim.drone.y + 26;
        _camDesired.set(sim.drone.x - 4.5, baseY, sim.drone.z + 12.5);

        // Elevate camera smoothly above any nearby skyscraper roof if close to one
        for (const b of district.buildings) {
          const nearX = Math.abs(_camDesired.x - b.x) < b.w * 0.5 + 5.5;
          const nearZ = Math.abs(_camDesired.z - b.z) < b.d * 0.5 + 5.5;
          if (nearX && nearZ) {
            _camDesired.y = Math.max(_camDesired.y, b.h + 12);
          }
        }

        camera.position.lerp(_camDesired, damp);
        _lookTarget.set(
          sim.drone.x * 0.62 + sim.drone.aimX * 0.38,
          1.2,
          sim.drone.z * 0.62 + sim.drone.aimZ * 0.38,
        );
      }

      // Decaying trauma^2 camera shake
      if (sim.cameraTrauma > 0.01) {
        const shake = sim.cameraTrauma * sim.cameraTrauma * 0.9;
        _lookTarget.x += (Math.random() - 0.5) * shake;
        _lookTarget.y += (Math.random() - 0.5) * shake;
        _lookTarget.z += (Math.random() - 0.5) * shake;
      }

      camera.lookAt(_lookTarget);
    };

    const handleSimEvents = () => {
      for (const ev of sim.events) {
        switch (ev.type) {
          case 'drone_shot':
            muzzleFlashTimer = 0.06;
            sound.playDroneShot();
            break;
          case 'cover_hit':
            spawnParticleBurst(ev.x ?? 0, ev.y ?? 1, ev.z ?? 0, 6, 0xfbbf24, 6.5, 0.18);
            sound.playCoverHit(false);
            break;
          case 'cover_destroyed':
            spawnParticleBurst(ev.x ?? 0, ev.y ?? 1, ev.z ?? 0, 24, 0xf97316, 10.5, 0.38);
            sound.playCoverHit(true);
            pushFeed(`COVER SHATTERED (${ev.detail || 'BARRIER'})`, 'amber');
            break;
          case 'runner_hit':
            spawnParticleBurst(ev.x ?? 0, ev.y ?? 1.2, ev.z ?? 0, 16, 0xf43f5e, 8.5, 0.22);
            sound.playRunnerHit();
            break;
          case 'dash':
            spawnParticleBurst(ev.x ?? 0, 0.4, ev.z ?? 0, 8, 0x38bdf8, 5, 0.16);
            sound.playDash();
            break;
          case 'emp_pulse':
            empWaveMesh.position.set(ev.x ?? 0, 0.25, ev.z ?? 0);
            empWaveAge = 0;
            sound.playEmp();
            pushFeed('EMP DISRUPTOR DEPLOYED', 'cyan');
            break;
          case 'sonar_ping':
            sonarWaveMesh.position.set(ev.x ?? 0, 0.28, ev.z ?? 0);
            sonarWaveAge = 0;
            sound.playSonarPing();
            pushFeed('DRONE THERMAL SONAR SWEEP', 'crimson');
            break;
          case 'telegraph_start':
            sound.playTelegraph();
            break;
          case 'weather_change':
            pushFeed(`WEATHER SHIFT: ${ev.detail || 'STORM'}`, 'cyan');
            break;
          case 'lightning':
            sound.playThunder();
            break;
          case 'round_end': {
            const won =
              (sim.localRole === 'runner' && sim.outcome === 'runner_extracted') ||
              (sim.localRole === 'drone' && sim.outcome !== 'runner_extracted');
            sound.playRoundEnd(won);
            pushFeed(ev.detail || 'ROUND COMPLETE', won ? 'emerald' : 'crimson');
            break;
          }
        }
      }
    };

    // Software WebGL afterDraw pacing per Three.js skill
    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const rawDt = Math.max(0.001, (now - lastTime) / 1000);
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      if (phase === 'title') {
        // Ambient live drone patrol flyover on title screen
        const t = now * 0.0005;
        sim.drone.x = Math.cos(t) * 20;
        sim.drone.z = Math.sin(t * 0.8) * 18;
        sim.drone.y = 18.5 + Math.sin(t * 3) * 0.4;
        sim.drone.aimX = Math.cos(t + 0.35) * 16;
        sim.drone.aimZ = Math.sin(t * 0.8 + 0.35) * 14;
        sim.drone.yaw = Math.atan2(sim.drone.aimX - sim.drone.x, sim.drone.aimZ - sim.drone.z);
        syncVisualsFromSim(dt, now / 1000);
        updateCamera(dt);
      } else if (phase === 'playing') {
        const localInput = buildLocalInput(dt);

        if (sim.isMultiplayer && !isMultiplayerHost) {
          // Guest sends input at ~20Hz; visuals follow host snapshots
          if (now - lastNetPush > 50) {
            lastNetPush = now;
            callbacksRef.current.onSendInput?.(localInput);
          }
          syncVisualsFromSim(dt, now / 1000);
          updateCamera(dt);
        } else {
          stepSimulation(sim, localInput, dt, remoteInput);
          // Clear one-shot flags on remote input once consumed
          if (remoteInput) {
            remoteInput.dashPressed = false;
            remoteInput.abilityPressed = false;
            remoteInput.firePressed = false;
          }
          handleSimEvents();
          syncVisualsFromSim(dt, now / 1000);
          updateCamera(dt);

          if (sim.isMultiplayer && isMultiplayerHost && now - lastNetPush > 50) {
            lastNetPush = now;
            callbacksRef.current.onSendSnapshot?.({
              elapsed: sim.elapsed,
              timeRemaining: sim.timeRemaining,
              extractionProgress: sim.extractionProgress,
              weather: sim.weather,
              outcome: sim.outcome,
              runnerScore: sim.runnerScore,
              droneScore: sim.droneScore,
              runner: {
                x: sim.runner.x,
                z: sim.runner.z,
                yaw: sim.runner.yaw,
                hp: sim.runner.hp,
                crouching: sim.runner.crouching,
                sprinting: sim.runner.sprinting,
                inCover: sim.runner.inCover,
                distanceWalked: sim.runner.distanceWalked,
              },
              drone: {
                x: sim.drone.x,
                y: sim.drone.y,
                z: sim.drone.z,
                yaw: sim.drone.yaw,
                aimX: sim.drone.aimX,
                aimZ: sim.drone.aimZ,
                hp: sim.drone.hp,
                heat: sim.drone.heat,
                detection: sim.drone.detection,
                alertState: sim.drone.alertState,
                sonarActiveTimer: sim.drone.sonarActiveTimer,
                empStunTimer: sim.drone.empStunTimer,
                telegraphTimer: sim.drone.telegraphTimer,
                telegraphTargetX: sim.drone.telegraphTargetX,
                telegraphTargetZ: sim.drone.telegraphTargetZ,
              },
              covers: sim.covers.map((c) => ({
                id: c.id,
                hp: c.hp,
                destroyed: c.destroyed,
              })),
            });
          }

          if (sim.outcome !== null) {
            setEnginePhase('gameover');
          }
        }

        // Throttle React HUD updates to <= 10Hz
        if (now - lastHudPush >= 100) {
          lastHudPush = now;
          callbacksRef.current.onHudUpdate(buildHudSnapshot(sim, phase));
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    // Push initial HUD snapshot & kick off loop
    callbacksRef.current.onHudUpdate(buildHudSnapshot(sim, phase));
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      sound.dispose();
      textures.dispose();
      envRT.dispose();
      renderer.dispose();
      engineRef.current = null;
    };
  }, []);

  return (
    <div
      ref={mountRef}
      data-testid="game-canvas-mount"
      className="fixed inset-0 w-full h-full overflow-hidden"
    />
  );
}
