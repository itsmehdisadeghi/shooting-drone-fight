import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameCanvas, type GameEngineHandle, type TouchInputState } from './game/GameCanvas';
import { buildHudSnapshot, createSimulationState } from './game/simulation';
import type {
  DistrictId,
  GamePhase,
  HudSnapshot,
  InputSnapshot,
  KillFeedEntry,
  PlayerRole,
  RoomPlayer,
  RoomState,
  WeatherMode,
} from './game/types';
import { MultiplayerClient, type SyncSnapshotPayload } from './multiplayer/client';
import { TitleScreen } from './components/TitleScreen';
import { GameHud } from './components/GameHud';
import { MultiplayerModal } from './components/MultiplayerModal';
import { StatusModal } from './components/StatusModal';

export default function App() {
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const autostart = urlParams.get('autostart') === '1';
  const initialRoomCode = urlParams.get('room')?.toUpperCase().trim() || '';
  const initialRoleParam: PlayerRole = urlParams.get('role') === 'drone' ? 'drone' : 'runner';

  const [phase, setPhase] = useState<GamePhase>('title');
  const [role, setRole] = useState<PlayerRole>(initialRoleParam);
  const [districtId, setDistrictId] = useState<DistrictId>('shibuya');
  const [weatherMode, setWeatherMode] = useState<WeatherMode>('dynamic');
  const [muted, setMuted] = useState(false);
  const [streamerMode, setStreamerMode] = useState(false);
  const [killFeed, setKillFeed] = useState<KillFeedEntry[]>([]);

  // Multiplayer state
  const [mpOpen, setMpOpen] = useState(Boolean(initialRoomCode));
  const [mpConnected, setMpConnected] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [mpError, setMpError] = useState<string | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(() =>
    buildHudSnapshot(
      createSimulationState({
        districtId: 'shibuya',
        localRole: initialRoleParam,
        weatherMode: 'dynamic',
      }),
      'title',
    ),
  );

  const engineRef = useRef<GameEngineHandle | null>(null);
  const touchProxyRef = useRef<TouchInputState | null>(null);
  const mpClientRef = useRef<MultiplayerClient | null>(null);
  const roomRef = useRef<RoomState | null>(null);
  const playerIdRef = useRef<string | null>(null);
  roomRef.current = room;
  playerIdRef.current = playerId;

  // Keep touch ref pointed to live engine touch object
  useEffect(() => {
    const syncTouch = () => {
      if (engineRef.current) {
        touchProxyRef.current = engineRef.current.touchInput;
      }
    };
    syncTouch();
    const id = window.setInterval(syncTouch, 250);
    return () => clearInterval(id);
  }, []);

  // Autostart support (?autostart=1)
  useEffect(() => {
    if (!autostart) return;
    const t = window.setTimeout(() => {
      engineRef.current?.startSolo(districtId, role, weatherMode);
    }, 60);
    return () => clearTimeout(t);
    // Run once on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // WebSocket Multiplayer Client lifecycle
  useEffect(() => {
    const client = new MultiplayerClient({
      onStatusChange: (connected) => {
        setMpConnected(connected);
      },
      onWelcome: (id) => {
        setPlayerId(id);
        if (initialRoomCode && !roomRef.current) {
          client.joinRoom(initialRoomCode, 'AGENT');
        }
      },
      onRoomState: (nextRoom) => {
        setRoom(nextRoom);
        setMpError(null);
      },
      onError: (msg) => {
        setMpError(msg);
      },
      onGameStart: ({ districtId: dId, weatherMode: wMode, roundNumber }) => {
        const curRoom = roomRef.current;
        const me = curRoom?.players.find((p) => p.id === playerIdRef.current);
        const assignedRole: PlayerRole = me?.role === 'drone' ? 'drone' : 'runner';
        const isHost = Boolean(me?.isHost);
        setDistrictId(dId);
        setWeatherMode(wMode);
        setRole(assignedRole);
        setMpOpen(false);
        engineRef.current?.startMultiplayer(
          dId,
          assignedRole,
          wMode,
          isHost,
          roundNumber,
          curRoom?.runnerScore ?? 0,
          curRoom?.droneScore ?? 0,
        );
      },
      onRemoteInput: (_remoteRole, input) => {
        engineRef.current?.applyRemoteInput(input);
      },
      onRemoteSnapshot: (snap) => {
        engineRef.current?.applyRemoteSnapshot(snap);
      },
    });
    mpClientRef.current = client;
    client.connect();

    return () => {
      client.dispose();
      mpClientRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartSolo = useCallback(() => {
    setMpOpen(false);
    engineRef.current?.startSolo(districtId, role, weatherMode);
  }, [districtId, role, weatherMode]);

  const handleDistrictChange = useCallback(
    (next: DistrictId) => {
      setDistrictId(next);
      engineRef.current?.setPreviewConfig(next, weatherMode);
    },
    [weatherMode],
  );

  const handleWeatherChange = useCallback(
    (next: WeatherMode) => {
      setWeatherMode(next);
      engineRef.current?.setPreviewConfig(districtId, next);
    },
    [districtId],
  );

  const handleFeedEvent = useCallback((entry: KillFeedEntry) => {
    setKillFeed((prev) => [entry, ...prev].slice(0, 5));
  }, []);

  const handleToggleMute = useCallback(() => {
    const next = engineRef.current?.toggleMute() ?? false;
    setMuted(next);
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.setPhase('paused');
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.setPhase('playing');
  }, []);

  const handleRestart = useCallback(() => {
    engineRef.current?.restartRound();
  }, []);

  const handleNextTagRound = useCallback(() => {
    if (room && mpClientRef.current) {
      mpClientRef.current.nextTagRound(hud.runnerScore, hud.droneScore);
    } else {
      const nextRole: PlayerRole = role === 'runner' ? 'drone' : 'runner';
      setRole(nextRole);
      engineRef.current?.nextTagRound(true);
    }
  }, [room, hud.runnerScore, hud.droneScore, role]);

  const handleReturnTitle = useCallback(() => {
    if (room) {
      mpClientRef.current?.leaveRoom();
      setRoom(null);
    }
    engineRef.current?.setPhase('title');
  }, [room]);

  const handleSendInput = useCallback((input: InputSnapshot) => {
    mpClientRef.current?.sendInput(input);
  }, []);

  const handleSendSnapshot = useCallback((snapshot: SyncSnapshotPayload) => {
    mpClientRef.current?.sendSnapshot(snapshot);
  }, []);

  // Global keyboard shortcuts for Title Start (Enter/Space), Pause (Esc/P), Restart (R)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      if (phase === 'title' && !mpOpen && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        handleStartSolo();
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (mpOpen) {
          setMpOpen(false);
        } else if (phase === 'playing') {
          e.preventDefault();
          handlePause();
        } else if (phase === 'paused') {
          e.preventDefault();
          handleResume();
        }
        return;
      }

      if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused')) {
        e.preventDefault();
        handleRestart();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, mpOpen, handleStartSolo, handlePause, handleResume, handleRestart]);

  const isHost = Boolean(room?.players.find((p) => p.id === playerId)?.isHost);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#090d14]">
      {/* Isolated Persistent 3D WebGL Viewport */}
      <GameCanvas
        initialDistrict={districtId}
        initialRole={role}
        initialWeather={weatherMode}
        onHudUpdate={setHud}
        onPhaseChange={setPhase}
        onFeedEvent={handleFeedEvent}
        onSendInput={handleSendInput}
        onSendSnapshot={handleSendSnapshot}
        engineRef={engineRef}
      />

      {/* Full-Viewport Title Screen Overlay */}
      {phase === 'title' && (
        <TitleScreen
          role={role}
          districtId={districtId}
          weatherMode={weatherMode}
          onChangeRole={setRole}
          onChangeDistrict={handleDistrictChange}
          onChangeWeather={handleWeatherChange}
          onStartSolo={handleStartSolo}
          onOpenMultiplayer={() => setMpOpen(true)}
        />
      )}

      {/* Minimalist World-Matched Tactical HUD (Playing & Paused background) */}
      {phase !== 'title' && (
        <GameHud
          hud={hud}
          muted={muted}
          streamerMode={streamerMode}
          room={room}
          killFeed={killFeed}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          onRestart={handleRestart}
          onToggleStreamerMode={() => setStreamerMode((v) => !v)}
          touchInputRef={touchProxyRef}
        />
      )}

      {/* Multiplayer Competitive Tag Lobby Modal */}
      {mpOpen && (
        <MultiplayerModal
          connected={mpConnected}
          playerId={playerId}
          room={room}
          error={mpError}
          streamerMode={streamerMode}
          defaultDistrict={districtId}
          defaultWeather={weatherMode}
          defaultRole={role}
          onCreateRoom={(name, dId, wMode, r) =>
            mpClientRef.current?.createRoom(name, dId, wMode, r)
          }
          onJoinRoom={(code, name) => mpClientRef.current?.joinRoom(code, name)}
          onLeaveRoom={() => mpClientRef.current?.leaveRoom()}
          onSetRole={(r: RoomPlayer['role']) => mpClientRef.current?.setRole(r)}
          onUpdateConfig={(dId, wMode) => mpClientRef.current?.updateConfig(dId, wMode)}
          onStartMatch={() => mpClientRef.current?.startMatch()}
          onToggleStreamerMode={() => setStreamerMode((v) => !v)}
          onClose={() => setMpOpen(false)}
        />
      )}

      {/* Pause / Victory / Game Over Modal */}
      <StatusModal
        phase={phase}
        hud={hud}
        isMultiplayer={Boolean(room)}
        isHost={isHost}
        onResume={handleResume}
        onRestart={handleRestart}
        onNextTagRound={handleNextTagRound}
        onReturnTitle={handleReturnTitle}
      />
    </div>
  );
}
