import test from 'node:test';
import assert from 'node:assert/strict';
import { DISTRICTS, DISTRICT_LIST } from './districts';
import {
  advanceTagRound,
  checkLineOfSight,
  createNeutralInput,
  createSimulationState,
  damageCover,
  fireDroneWeapon,
  getWeatherParams,
  stepSimulation,
  triggerDroneSonar,
  triggerRunnerEmp,
} from './simulation';

test('weather system degrades visibility and drone accuracy in rain, fog, and storm', () => {
  const clear = getWeatherParams('clear');
  const rain = getWeatherParams('rain');
  const fog = getWeatherParams('fog');
  const storm = getWeatherParams('storm');

  assert.ok(clear.visibilityRange > rain.visibilityRange);
  assert.ok(rain.visibilityRange > fog.visibilityRange);
  assert.ok(clear.droneAccuracy > rain.droneAccuracy);
  assert.ok(rain.droneAccuracy > storm.droneAccuracy);
  assert.ok(clear.spreadRad < storm.spreadRad);
  assert.ok(clear.sensorRangeMult > fog.sensorRangeMult);
});

test('all urban districts have open runner spawn, reachable extraction, and valid non-overlapping covers', () => {
  for (const d of DISTRICT_LIST) {
    for (const b of d.buildings) {
      const insideSpawnX = Math.abs(d.runnerSpawn.x - b.x) < b.w * 0.5 + 1.5;
      const insideSpawnZ = Math.abs(d.runnerSpawn.z - b.z) < b.d * 0.5 + 1.5;
      assert.equal(insideSpawnX && insideSpawnZ, false, `${d.id} spawn collides with ${b.id}`);

      const insideExX = Math.abs(d.extractionPos.x - b.x) < b.w * 0.5 + 2.0;
      const insideExZ = Math.abs(d.extractionPos.z - b.z) < b.d * 0.5 + 2.0;
      assert.equal(insideExX && insideExZ, false, `${d.id} extraction collides with ${b.id}`);
    }
    assert.ok(d.covers.length >= 10, `${d.id} should have rich cover network`);
  }
});

test('intact cover blocks drone LOS when crouching, and destroying cover unblocks LOS', () => {
  const state = createSimulationState({
    districtId: 'shibuya',
    localRole: 'runner',
    weatherMode: 'clear',
  });
  const cover = state.covers[0];
  // Place drone in front of cover and runner crouched directly behind it
  const droneX = cover.x + 8;
  const droneY = 5.0;
  const droneZ = cover.z;
  const runnerX = cover.x - cover.w * 0.5 - 0.9;
  const runnerZ = cover.z;

  const before = checkLineOfSight(
    droneX,
    droneY,
    droneZ,
    runnerX,
    0.92,
    runnerZ,
    [],
    state.covers,
  );
  assert.equal(before.blocked, true);
  assert.equal(before.blockerType, 'cover');
  assert.equal(before.blockerCoverId, cover.id);

  const destroyed = damageCover(state, cover, cover.maxHp + 10);
  assert.equal(destroyed, true);
  assert.equal(cover.destroyed, true);
  assert.equal(state.coversDestroyedCount, 1);

  const after = checkLineOfSight(
    droneX,
    droneY,
    droneZ,
    runnerX,
    0.92,
    runnerZ,
    [],
    state.covers,
  );
  assert.equal(after.blocked, false);
});

test('runner reaches extraction zone and completes extraction win condition', () => {
  const state = createSimulationState({
    districtId: 'shibuya',
    localRole: 'runner',
    weatherMode: 'fog',
  });
  const district = DISTRICTS.shibuya;
  state.runner.x = district.extractionPos.x;
  state.runner.z = district.extractionPos.z;
  // Move drone far away so extraction isn't interrupted
  state.drone.x = -40;
  state.drone.z = 40;

  const idle = createNeutralInput();
  for (let i = 0; i < 80; i++) {
    stepSimulation(state, idle, 0.05, null, () => 0.5);
  }

  assert.equal(state.outcome, 'runner_extracted');
  assert.equal(state.runnerScore, 1);
  assert.equal(state.extractionProgress, 100);
});

test('drone autocannon hits reduce runner HP to zero and trigger elimination defeat', () => {
  const state = createSimulationState({
    districtId: 'manhattan',
    localRole: 'drone',
    weatherMode: 'clear',
    isMultiplayer: true,
  });
  // Place runner directly beneath drone in open lane
  state.drone.x = 0;
  state.drone.y = 14;
  state.drone.z = 0;
  state.runner.x = 0;
  state.runner.z = 0;
  state.covers = [];

  const droneInput = createNeutralInput();
  droneInput.aimWorldX = 0;
  droneInput.aimWorldZ = 0;
  droneInput.fireHeld = true;
  const runnerIdle = createNeutralInput();

  for (let i = 0; i < 160 && state.outcome === null; i++) {
    stepSimulation(state, droneInput, 0.05, runnerIdle, () => 0.5);
  }

  assert.equal(state.outcome, 'runner_eliminated');
  assert.equal(state.runner.hp, 0);
  assert.equal(state.droneScore, 1);
});

test('runner EMP stuns drone and reduces drone HP; drone sonar reveals runner', () => {
  const state = createSimulationState({
    districtId: 'canary_wharf',
    localRole: 'runner',
    weatherMode: 'fog',
  });
  state.drone.x = state.runner.x + 8;
  state.drone.z = state.runner.z + 8;
  state.drone.detection = 80;

  const empFired = triggerRunnerEmp(state);
  assert.equal(empFired, true);
  assert.ok(state.drone.empStunTimer > 2.0);
  assert.ok(state.drone.hp < 100);
  assert.ok(state.drone.detection < 50);

  // Clear stun and trigger sonar
  state.drone.empStunTimer = 0;
  const sonarFired = triggerDroneSonar(state);
  assert.equal(sonarFired, true);
  assert.ok(state.drone.sonarActiveTimer > 3.0);
});

test('time limit expiration awards round to drone and tag-style advance swaps sides', () => {
  const state = createSimulationState({
    districtId: 'shibuya',
    localRole: 'runner',
    weatherMode: 'clear',
    roundDuration: 1.0,
  });
  const idle = createNeutralInput();
  for (let i = 0; i < 30 && state.outcome === null; i++) {
    stepSimulation(state, idle, 0.05, null, () => 0.5);
  }
  assert.equal(state.outcome, 'time_expired');
  assert.equal(state.droneScore, 1);

  const nextRound = advanceTagRound(state, true);
  assert.equal(nextRound.roundNumber, 2);
  assert.equal(nextRound.localRole, 'drone');
  assert.equal(nextRound.droneScore, 1);
  assert.equal(nextRound.outcome, null);
});

test('drone weapon firing builds heat and triggers overheat', () => {
  const state = createSimulationState({
    districtId: 'shibuya',
    localRole: 'drone',
    weatherMode: 'storm',
  });
  let shots = 0;
  for (let i = 0; i < 15; i++) {
    state.drone.fireCooldown = 0;
    if (fireDroneWeapon(state, 0, 0, () => 0.5)) {
      shots++;
    }
  }
  assert.ok(shots >= 10 && shots <= 13);
  assert.equal(state.drone.overheated, true);
});
