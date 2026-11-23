import * as THREE from 'three';
import type { CoverState, DistrictDef } from './types';
import type { ProceduralTextureSet } from './textures';

export interface DroneRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  rotors: THREE.Object3D[];
  gimbal: THREE.Group;
  sensorLensMat: THREE.MeshStandardMaterial;
  scanCone: THREE.Mesh;
  scanConeMat: THREE.MeshBasicMaterial;
  targetRing: THREE.Group;
  targetRingMat: THREE.MeshBasicMaterial;
  telegraphLine: THREE.Line;
  telegraphLineMat: THREE.LineBasicMaterial;
  muzzleFlash: THREE.Mesh;
}

export interface RunnerRig {
  root: THREE.Group;
  torsoGroup: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  statusDiodeMat: THREE.MeshStandardMaterial;
  bodyMat: THREE.MeshStandardMaterial;
  sonarOutlineRing: THREE.Mesh;
}

export interface CoverRig {
  id: string;
  root: THREE.Group;
  intactGroup: THREE.Group;
  rubbleGroup: THREE.Group;
  damageTintMats: THREE.MeshStandardMaterial[];
  hpBarBg: THREE.Mesh;
  hpBarFill: THREE.Mesh;
  hpBarFillMat: THREE.MeshBasicMaterial;
}

export interface ExtractionRig {
  root: THREE.Group;
  chevronRing: THREE.Mesh;
  beamMesh: THREE.Mesh;
  beamMat: THREE.MeshBasicMaterial;
  progressRing: THREE.Mesh;
  progressMat: THREE.MeshBasicMaterial;
}

/**
 * Composite 10-part Combat Hunter Quadcopter Drone (ExtrudeGeometry chassis, 4 carbon booms,
 * 4 ducted rotors with spinning blades & nav LEDs, underslung optical gimbal, twin autocannons,
 * volumetric scan cone, targeting ring, and laser telegraph beam).
 */
export function buildDroneMesh(): DroneRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Materials with strong roughness/metalness contrast
  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x1e2530,
    roughness: 0.35,
    metalness: 0.78,
  });
  const armorPlateMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.65,
    metalness: 0.25,
  });
  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x141820,
    roughness: 0.45,
    metalness: 0.6,
  });
  const gunMetalMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.24,
    metalness: 0.9,
  });
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.3,
    metalness: 0.5,
  });
  const sensorLensMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x22d3ee,
    emissiveIntensity: 1.6,
    roughness: 0.1,
    metalness: 0.2,
  });

  // 1. Primary beveled octagonal hull via ExtrudeGeometry
  const hullShape = new THREE.Shape();
  const r = 1.05;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(a) * r * (i % 2 === 0 ? 1.1 : 0.95);
    const y = Math.sin(a) * r;
    if (i === 0) hullShape.moveTo(x, y);
    else hullShape.lineTo(x, y);
  }
  hullShape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 0.42,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.1,
    bevelSegments: 2,
  });
  hullGeo.rotateX(Math.PI / 2);
  hullGeo.translate(0, 0.22, 0);
  const hullMesh = new THREE.Mesh(hullGeo, chassisMat);
  hullMesh.castShadow = true;
  bodyGroup.add(hullMesh);

  // 2. Top armored dorsal radome cowl
  const cowlGeo = new THREE.CylinderGeometry(0.55, 0.85, 0.24, 8);
  const cowl = new THREE.Mesh(cowlGeo, armorPlateMat);
  cowl.position.y = 0.42;
  bodyGroup.add(cowl);

  // 3. Four angled carbon booms + ducted shrouded rotors + spinning blades + nav LEDs
  const rotors: THREE.Object3D[] = [];
  const armGeo = new THREE.BoxGeometry(0.18, 0.14, 1.9);
  const shroudGeo = new THREE.TorusGeometry(0.68, 0.08, 8, 20);
  shroudGeo.rotateX(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.18, 10);
  const bladeGeo = new THREE.BoxGeometry(1.18, 0.03, 0.12);
  const ledGeo = new THREE.SphereGeometry(0.08, 8, 8);

  const armAngles = [
    Math.PI * 0.25,
    Math.PI * 0.75,
    -Math.PI * 0.25,
    -Math.PI * 0.75,
  ];
  armAngles.forEach((angle, idx) => {
    const arm = new THREE.Mesh(armGeo, carbonMat);
    const dist = 1.45;
    arm.position.set(Math.sin(angle) * (dist * 0.6), 0.08, Math.cos(angle) * (dist * 0.6));
    arm.rotation.y = angle;
    bodyGroup.add(arm);

    const podX = Math.sin(angle) * dist;
    const podZ = Math.cos(angle) * dist;

    const shroud = new THREE.Mesh(shroudGeo, armorPlateMat);
    shroud.position.set(podX, 0.12, podZ);
    bodyGroup.add(shroud);

    const hub = new THREE.Mesh(hubGeo, gunMetalMat);
    hub.position.set(podX, 0.12, podZ);
    bodyGroup.add(hub);

    const rotorSpin = new THREE.Group();
    rotorSpin.position.set(podX, 0.18, podZ);
    const b1 = new THREE.Mesh(bladeGeo, bladeMat);
    const b2 = new THREE.Mesh(bladeGeo, bladeMat);
    b2.rotation.y = Math.PI / 2;
    rotorSpin.add(b1, b2);
    bodyGroup.add(rotorSpin);
    rotors.push(rotorSpin);

    // Front amber vs rear crimson nav beacons
    const ledColor = idx === 0 || idx === 2 ? 0x38bdf8 : 0xf43f5e;
    const led = new THREE.Mesh(
      ledGeo,
      new THREE.MeshBasicMaterial({ color: ledColor }),
    );
    led.position.set(podX * 1.38, 0.16, podZ * 1.38);
    bodyGroup.add(led);
  });

  // 4. Underslung 2-axis optical sensor gimbal + twin 20mm autocannon barrels
  const gimbal = new THREE.Group();
  gimbal.position.set(0, -0.45, 0.25);
  bodyGroup.add(gimbal);

  const podMesh = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), chassisMat);
  gimbal.add(podMesh);

  const lensMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.22, 14), sensorLensMat);
  lensMesh.rotation.x = Math.PI / 2;
  lensMesh.position.set(0, -0.02, 0.3);
  gimbal.add(lensMesh);

  const barrelGeo = new THREE.CylinderGeometry(0.055, 0.065, 1.05, 8);
  barrelGeo.rotateX(Math.PI / 2);
  const leftBarrel = new THREE.Mesh(barrelGeo, gunMetalMat);
  leftBarrel.position.set(-0.34, -0.14, 0.45);
  const rightBarrel = new THREE.Mesh(barrelGeo, gunMetalMat);
  rightBarrel.position.set(0.34, -0.14, 0.45);
  gimbal.add(leftBarrel, rightBarrel);

  const muzzleFlash = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.9, 8),
    new THREE.MeshBasicMaterial({
      color: 0xffd166,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
  );
  muzzleFlash.rotation.x = Math.PI / 2;
  muzzleFlash.position.set(0, -0.14, 1.25);
  muzzleFlash.visible = false;
  gimbal.add(muzzleFlash);

  // 5. Volumetric Translucent Sensor Scan Cone (positioned & oriented in world space each frame)
  const coneGeo = new THREE.ConeGeometry(6.8, 1, 24, 1, true);
  // Shift so apex is at origin (0,0,0) and base extends along +Z for easy lookAt orientation
  coneGeo.translate(0, -0.5, 0);
  coneGeo.rotateX(-Math.PI / 2);
  const scanConeMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.13,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const scanCone = new THREE.Mesh(coneGeo, scanConeMat);
  scanCone.renderOrder = 3;

  // 6. Ground Target Reticle Ring
  const targetRing = new THREE.Group();
  const targetRingMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const outerRing = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.38, 32), targetRingMat);
  outerRing.rotation.x = -Math.PI / 2;
  outerRing.position.y = 0.06;
  const innerDot = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.42, 16), targetRingMat);
  innerDot.rotation.x = -Math.PI / 2;
  innerDot.position.y = 0.07;
  targetRing.add(outerRing, innerDot);

  // 7. Telegraph Laser Sightline (shown during windup before cover-buster burst!)
  const telegraphGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -10, 0),
  ]);
  const telegraphLineMat = new THREE.LineBasicMaterial({
    color: 0xff2a55,
    transparent: true,
    opacity: 0.92,
  });
  const telegraphLine = new THREE.Line(telegraphGeo, telegraphLineMat);
  telegraphLine.visible = false;

  return {
    root,
    bodyGroup,
    rotors,
    gimbal,
    sensorLensMat,
    scanCone,
    scanConeMat,
    targetRing,
    targetRingMat,
    telegraphLine,
    telegraphLineMat,
    muzzleFlash,
  };
}

/**
 * Composite 9-part Articulated Tactical Runner Operative (bottom-center grounded pivot,
 * articulated legs/arms, armored vest, visor helmet, stealth pack diode, contact shadow).
 */
export function buildRunnerMesh(textures: ProceduralTextureSet): RunnerRig {
  const root = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.72,
    metalness: 0.15,
  });
  const vestMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.42,
    metalness: 0.35,
  });
  const limbMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.78,
    metalness: 0.1,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.2,
    roughness: 0.12,
    metalness: 0.8,
  });
  const statusDiodeMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 1.5,
    roughness: 0.2,
    metalness: 0.2,
  });

  // Ground contact shadow disc
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.75, 20),
    new THREE.MeshBasicMaterial({
      map: textures.contactShadowMap,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  root.add(shadow);

  // Articulated legs pivoted near hip
  const legGeo = new THREE.CapsuleGeometry(0.14, 0.56, 4, 8);
  legGeo.translate(0, -0.36, 0);
  const leftLeg = new THREE.Mesh(legGeo, limbMat);
  leftLeg.position.set(-0.2, 0.78, 0);
  leftLeg.castShadow = true;
  const rightLeg = new THREE.Mesh(legGeo, limbMat);
  rightLeg.position.set(0.2, 0.78, 0);
  rightLeg.castShadow = true;
  root.add(leftLeg, rightLeg);

  // Upper torso assembly (compresses smoothly during crouch)
  const torsoGroup = new THREE.Group();
  torsoGroup.position.y = 0.8;
  root.add(torsoGroup);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.68, 0.36), bodyMat);
  torso.position.y = 0.34;
  torso.castShadow = true;
  torsoGroup.add(torso);

  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.36, 0.42), vestMat);
  chestPlate.position.y = 0.42;
  torsoGroup.add(chestPlate);

  // Tactical backpack + live stealth status diode
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.48, 0.22), limbMat);
  pack.position.set(0, 0.38, -0.27);
  torsoGroup.add(pack);

  const diode = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.06), statusDiodeMat);
  diode.position.set(0, 0.52, -0.39);
  torsoGroup.add(diode);

  // Helmet + glossy tactical visor
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), bodyMat);
  head.position.set(0, 0.88, 0.02);
  head.castShadow = true;
  torsoGroup.add(head);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.11, 0.2), visorMat);
  visor.position.set(0, 0.9, 0.16);
  torsoGroup.add(visor);

  // Articulated arms
  const armGeo = new THREE.CapsuleGeometry(0.1, 0.44, 4, 8);
  armGeo.translate(0, -0.24, 0);
  const leftArm = new THREE.Mesh(armGeo, bodyMat);
  leftArm.position.set(-0.42, 0.62, 0);
  const rightArm = new THREE.Mesh(armGeo, bodyMat);
  rightArm.position.set(0.42, 0.62, 0);
  torsoGroup.add(leftArm, rightArm);

  // Thermal Sonar highlight ring (visible when Drone pings Runner)
  const sonarOutlineRing = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.25, 24),
    new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  sonarOutlineRing.rotation.x = -Math.PI / 2;
  sonarOutlineRing.position.y = 0.08;
  sonarOutlineRing.visible = false;
  root.add(sonarOutlineRing);

  return {
    root,
    torsoGroup,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    statusDiodeMat,
    bodyMat,
    sonarOutlineRing,
  };
}

/**
 * Builds a composite 3-7 part Destructible Tactical Cover assembly with intact state,
 * progressive damage tinting, miniature world-space integrity strip, and collapsed rubble state.
 */
export function buildCoverMesh(
  cover: CoverState,
  textures: ProceduralTextureSet,
): CoverRig {
  const root = new THREE.Group();
  root.position.set(cover.x, 0, cover.z);

  const intactGroup = new THREE.Group();
  const rubbleGroup = new THREE.Group();
  rubbleGroup.visible = false;
  root.add(intactGroup, rubbleGroup);

  const damageTintMats: THREE.MeshStandardMaterial[] = [];

  if (cover.kind === 'barrier') {
    // Jersey concrete barrier: wide base skirt + tapered upper wall + steel end bollards
    const barMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.barrierMap,
      roughness: 0.86,
      metalness: 0.05,
    });
    damageTintMats.push(barMat);
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.35,
      metalness: 0.8,
    });

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(cover.w, cover.h * 0.42, cover.d),
      barMat,
    );
    base.position.y = cover.h * 0.21;
    base.castShadow = true;
    base.receiveShadow = true;

    const top = new THREE.Mesh(
      new THREE.BoxGeometry(cover.w * 0.96, cover.h * 0.58, cover.d * 0.62),
      barMat,
    );
    top.position.y = cover.h * 0.71;
    top.castShadow = true;

    const bollardGeo = new THREE.CylinderGeometry(0.14, 0.16, cover.h * 0.9, 10);
    const leftPost = new THREE.Mesh(bollardGeo, steelMat);
    leftPost.position.set(-cover.w * 0.46, cover.h * 0.45, 0);
    const rightPost = new THREE.Mesh(bollardGeo, steelMat);
    rightPost.position.set(cover.w * 0.46, cover.h * 0.45, 0);

    intactGroup.add(base, top, leftPost, rightPost);
  } else if (cover.kind === 'container') {
    // Ribbed industrial cargo container with corner castings & lock bars
    const contMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      bumpMap: textures.containerBump,
      bumpScale: 0.14,
      roughness: 0.62,
      metalness: 0.48,
    });
    damageTintMats.push(contMat);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.42,
      metalness: 0.78,
    });

    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(cover.w, cover.h, cover.d),
      contMat,
    );
    hull.position.y = cover.h * 0.5;
    hull.castShadow = true;
    hull.receiveShadow = true;
    intactGroup.add(hull);

    // Top/bottom steel structural rails
    const railTop = new THREE.Mesh(
      new THREE.BoxGeometry(cover.w + 0.12, 0.18, cover.d + 0.12),
      frameMat,
    );
    railTop.position.y = cover.h - 0.08;
    const railBot = new THREE.Mesh(
      new THREE.BoxGeometry(cover.w + 0.12, 0.18, cover.d + 0.12),
      frameMat,
    );
    railBot.position.y = 0.09;
    intactGroup.add(railTop, railBot);
  } else if (cover.kind === 'kiosk') {
    // Urban metro/transit shelter kiosk with plinth, steel pillars, canopy roof, & backlit sign
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x263244,
      roughness: 0.38,
      metalness: 0.72,
    });
    damageTintMats.push(steelMat);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0c4a6e,
      emissiveIntensity: 0.55,
      roughness: 0.2,
      metalness: 0.25,
    });
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(cover.w, 0.24, cover.d),
      steelMat,
    );
    base.position.y = 0.12;
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(cover.w * 0.94, cover.h * 0.85, 0.28),
      panelMat,
    );
    backWall.position.set(0, cover.h * 0.46, -cover.d * 0.34);
    backWall.castShadow = true;
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(cover.w + 0.3, 0.22, cover.d + 0.25),
      steelMat,
    );
    roof.position.y = cover.h - 0.11;
    roof.castShadow = true;

    const colGeo = new THREE.BoxGeometry(0.22, cover.h, 0.22);
    const c1 = new THREE.Mesh(colGeo, steelMat);
    c1.position.set(-cover.w * 0.44, cover.h * 0.5, cover.d * 0.38);
    const c2 = new THREE.Mesh(colGeo, steelMat);
    c2.position.set(cover.w * 0.44, cover.h * 0.5, cover.d * 0.38);
    intactGroup.add(base, backWall, roof, c1, c2);
  } else {
    // Armored urban transit van: lower body, cab cabin, windshield, 4 wheels, roof rack
    const vanMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.48,
      metalness: 0.52,
    });
    damageTintMats.push(vanMat);
    const cabGlassMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.12,
      metalness: 0.85,
    });
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.92,
      metalness: 0.05,
    });

    const lowerBody = new THREE.Mesh(
      new THREE.BoxGeometry(cover.w, cover.h * 0.55, cover.d),
      vanMat,
    );
    lowerBody.position.y = cover.h * 0.38;
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = true;

    const upperCabin = new THREE.Mesh(
      new THREE.BoxGeometry(cover.w * 0.78, cover.h * 0.42, cover.d * 0.92),
      vanMat,
    );
    upperCabin.position.set(-cover.w * 0.08, cover.h * 0.78, 0);
    upperCabin.castShadow = true;

    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, cover.h * 0.34, cover.d * 0.82),
      cabGlassMat,
    );
    windshield.position.set(cover.w * 0.32, cover.h * 0.76, 0);

    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.28, 12);
    wheelGeo.rotateX(Math.PI / 2);
    const wheelOffsets: Array<[number, number]> = [
      [-cover.w * 0.34, cover.d * 0.46],
      [cover.w * 0.34, cover.d * 0.46],
      [-cover.w * 0.34, -cover.d * 0.46],
      [cover.w * 0.34, -cover.d * 0.46],
    ];
    for (const [wx, wz] of wheelOffsets) {
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.position.set(wx, 0.42, wz);
      intactGroup.add(wheel);
    }

    intactGroup.add(lowerBody, upperCabin, windshield);
  }

  // Collapsed rubble assembly (low passable debris chunks when cover is destroyed)
  const rubbleMat = new THREE.MeshStandardMaterial({
    color: 0x3b4250,
    roughness: 0.95,
    metalness: 0.1,
  });
  for (let i = 0; i < 6; i++) {
    const chunk = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.32 + (i % 3) * 0.16, 0),
      rubbleMat,
    );
    chunk.position.set(
      ((i % 3) - 1) * (cover.w * 0.26),
      0.16,
      (i < 3 ? -0.25 : 0.25) * cover.d,
    );
    chunk.scale.set(1.2, 0.42, 1.0);
    chunk.rotation.set(i * 0.7, i * 1.1, 0);
    rubbleGroup.add(chunk);
  }

  // Floating world-space Cover Integrity Bar (visible once damaged)
  const hpBarBg = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 0.22),
    new THREE.MeshBasicMaterial({
      color: 0x090d14,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
    }),
  );
  hpBarBg.position.set(0, cover.h + 0.75, 0);
  hpBarBg.visible = false;

  const hpBarFillMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    side: THREE.DoubleSide,
  });
  const hpBarFill = new THREE.Mesh(new THREE.PlaneGeometry(2.28, 0.13), hpBarFillMat);
  hpBarFill.position.set(0, 0, 0.01);
  hpBarBg.add(hpBarFill);
  root.add(hpBarBg);

  return {
    id: cover.id,
    root,
    intactGroup,
    rubbleGroup,
    damageTintMats,
    hpBarBg,
    hpBarFill,
    hpBarFillMat,
  };
}

/**
 * Builds the elevated Extraction Beacon Helipad with rotating chevrons, vertical light column,
 * and dynamic capture progress arc.
 */
export function buildExtractionMesh(radius: number): ExtractionRig {
  const root = new THREE.Group();

  const padMat = new THREE.MeshStandardMaterial({
    color: 0x162130,
    roughness: 0.5,
    metalness: 0.55,
  });
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + 0.4, 0.16, 8), padMat);
  pad.position.y = 0.08;
  pad.receiveShadow = true;
  root.add(pad);

  const chevronMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const chevronRing = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.55, radius - 0.1, 8),
    chevronMat,
  );
  chevronRing.rotation.x = -Math.PI / 2;
  chevronRing.position.y = 0.2;
  root.add(chevronRing);

  const progressMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const progressRing = new THREE.Mesh(new THREE.CircleGeometry(radius - 0.65, 24), progressMat);
  progressRing.rotation.x = -Math.PI / 2;
  progressRing.position.y = 0.19;
  progressRing.scale.set(0.01, 0.01, 1);
  root.add(progressRing);

  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beamMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.42, radius * 0.82, 34, 16, 1, true),
    beamMat,
  );
  beamMesh.position.y = 17;
  beamMesh.renderOrder = 2;
  root.add(beamMesh);

  // Corner landing beacon pylons
  const pylonMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.4,
    metalness: 0.75,
  });
  const lightMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const px = Math.cos(a) * (radius + 0.15);
    const pz = Math.sin(a) * (radius + 0.15);
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.9, 6), pylonMat);
    pylon.position.set(px, 0.45, pz);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), lightMat);
    tip.position.set(px, 0.95, pz);
    root.add(pylon, tip);
  }

  return {
    root,
    chevronRing,
    beamMesh,
    beamMat,
    progressRing,
    progressMat,
  };
}

/**
 * Builds the 3D Urban District map sector: textured asphalt avenues, multi-tier skyscrapers
 * with rooftop equipment, streetlamps, perimeter low traffic curbs, and an extended distant
 * skyline ring fading smoothly into horizon fog (never boxed in an empty void!).
 */
export function buildUrbanDistrict(
  district: DistrictDef,
  textures: ProceduralTextureSet,
): { group: THREE.Group; buildingMeshes: THREE.Object3D[] } {
  const group = new THREE.Group();
  const buildingMeshes: THREE.Object3D[] = [];

  // 1. Extended Urban Ground Plane (340m x 340m so horizon fog blends naturally)
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.asphaltMap,
    bumpMap: textures.asphaltBump,
    bumpScale: 0.08,
    roughness: 0.82,
    metalness: 0.12,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(340, 340), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Subtle tactical sector perimeter line (flush with polygonOffset to avoid Z-fighting)
  const half = district.arenaHalfSize;
  const borderPts = [
    new THREE.Vector3(-half, 0.05, -half),
    new THREE.Vector3(half, 0.05, -half),
    new THREE.Vector3(half, 0.05, half),
    new THREE.Vector3(-half, 0.05, half),
    new THREE.Vector3(-half, 0.05, -half),
  ];
  const borderLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(borderPts),
    new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35 }),
  );
  group.add(borderLine);

  // 2. Playable Sector Skyscrapers (multi-tier composite assemblies with rooftop HVAC & spires)
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.glassFacadeMap,
    roughness: 0.24,
    metalness: 0.65,
  });
  const concMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.concreteFacadeMap,
    roughness: 0.76,
    metalness: 0.15,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x1e2531,
    roughness: 0.85,
    metalness: 0.2,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.35,
    metalness: 0.72,
  });

  for (const b of district.buildings) {
    const bGroup = new THREE.Group();
    bGroup.position.set(b.x, 0, b.z);

    // Sidewalk plinth slightly wider than tower
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(b.w + 1.4, 0.26, b.d + 1.4),
      roofMat,
    );
    plinth.position.y = 0.13;
    plinth.receiveShadow = true;
    bGroup.add(plinth);

    // Main architectural tower shaft
    const bodyMat = b.style === 'concrete' ? concMat : glassMat;
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), bodyMat);
    shaft.position.y = b.h * 0.5;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    bGroup.add(shaft);
    buildingMeshes.push(shaft);

    // Rooftop parapet collar + mechanical penthouse
    const parapet = new THREE.Mesh(
      new THREE.BoxGeometry(b.w + 0.35, 0.7, b.d + 0.35),
      trimMat,
    );
    parapet.position.y = b.h + 0.2;
    bGroup.add(parapet);

    const penthouse = new THREE.Mesh(
      new THREE.BoxGeometry(b.w * 0.48, 2.8, b.d * 0.48),
      roofMat,
    );
    penthouse.position.y = b.h + 1.5;
    bGroup.add(penthouse);

    // Architectural accent light strip near crown
    const crownAccent = new THREE.Mesh(
      new THREE.BoxGeometry(b.w + 0.45, 0.32, b.d + 0.45),
      new THREE.MeshBasicMaterial({ color: b.accentColor }),
    );
    crownAccent.position.y = b.h - 0.8;
    bGroup.add(crownAccent);

    if (b.style === 'landmark') {
      // Tall comms spire + red aviation warning beacon on landmark tower
      const spire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.38, 12, 8),
        trimMat,
      );
      spire.position.y = b.h + 8.2;
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xf43f5e }),
      );
      beacon.position.y = b.h + 14.3;
      bGroup.add(spire, beacon);
    }

    group.add(bGroup);
  }

  // 3. Distant Surrounding City Skyline Ring (InstancedMesh > 40 towers fading into horizon fog)
  const skylineCount = 64;
  const skylineGeo = new THREE.BoxGeometry(1, 1, 1);
  const skylineMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.glassFacadeMap,
    roughness: 0.55,
    metalness: 0.4,
  });
  const skylineMesh = new THREE.InstancedMesh(skylineGeo, skylineMat, skylineCount);
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();

  for (let i = 0; i < skylineCount; i++) {
    const angle = (i / skylineCount) * Math.PI * 2;
    const ringRadius = 74 + (i % 4) * 18 + Math.sin(i * 3.7) * 6;
    const bw = 10 + (i % 5) * 3.2;
    const bd = 10 + ((i * 3) % 5) * 3.0;
    const bh = 18 + ((i * 7) % 11) * 5.2;

    dummy.position.set(
      Math.cos(angle) * ringRadius,
      bh * 0.5,
      Math.sin(angle) * ringRadius,
    );
    dummy.rotation.set(0, angle * 0.5, 0);
    dummy.scale.set(bw, bh, bd);
    dummy.updateMatrix();
    skylineMesh.setMatrixAt(i, dummy.matrix);

    const lum = 0.55 + (i % 5) * 0.08;
    tint.setRGB(lum * 0.85, lum * 0.92, lum);
    skylineMesh.setColorAt(i, tint);
  }
  skylineMesh.instanceMatrix.needsUpdate = true;
  if (skylineMesh.instanceColor) skylineMesh.instanceColor.needsUpdate = true;
  skylineMesh.computeBoundingSphere();
  group.add(skylineMesh);

  // 4. Instanced Streetlamps lining the main avenues (zero extra point lights!)
  const lampPositions: Array<[number, number]> = [
    [-42, -42], [-18, -44], [18, -44], [42, -42],
    [-42, 42], [-18, 44], [18, 44], [42, 42],
    [-44, -14], [-44, 14], [44, -14], [44, 14],
    [-8, 0], [8, 0], [0, -14], [0, 14],
  ];
  const poleInst = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.08, 0.12, 6.2, 6),
    trimMat,
    lampPositions.length,
  );
  const bulbInst = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.65, 0.14, 0.28),
    new THREE.MeshBasicMaterial({ color: 0xfde68a }),
    lampPositions.length,
  );
  lampPositions.forEach(([lx, lz], i) => {
    dummy.position.set(lx, 3.1, lz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poleInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(lx, 6.25, lz);
    dummy.updateMatrix();
    bulbInst.setMatrixAt(i, dummy.matrix);
  });
  poleInst.instanceMatrix.needsUpdate = true;
  bulbInst.instanceMatrix.needsUpdate = true;
  poleInst.computeBoundingSphere();
  bulbInst.computeBoundingSphere();
  group.add(poleInst, bulbInst);

  return { group, buildingMeshes };
}
