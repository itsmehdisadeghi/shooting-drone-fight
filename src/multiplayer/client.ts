import type {
  DistrictId,
  InputSnapshot,
  PlayerRole,
  RoomPlayer,
  RoomState,
  WeatherMode,
} from '../game/types';

export interface SyncSnapshotPayload {
  elapsed: number;
  timeRemaining: number;
  extractionProgress: number;
  weather: string;
  outcome: string | null;
  runnerScore: number;
  droneScore: number;
  runner: {
    x: number;
    z: number;
    yaw: number;
    hp: number;
    crouching: boolean;
    sprinting: boolean;
    inCover: boolean;
    distanceWalked: number;
  };
  drone: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    aimX: number;
    aimZ: number;
    hp: number;
    heat: number;
    detection: number;
    alertState: string;
    sonarActiveTimer: number;
    empStunTimer: number;
    telegraphTimer: number;
    telegraphTargetX: number;
    telegraphTargetZ: number;
  };
  covers: Array<{ id: string; hp: number; destroyed: boolean }>;
}

export interface MultiplayerCallbacks {
  onStatusChange?: (connected: boolean) => void;
  onWelcome?: (playerId: string) => void;
  onRoomState?: (room: RoomState | null) => void;
  onError?: (message: string) => void;
  onGameStart?: (payload: {
    districtId: DistrictId;
    weatherMode: WeatherMode;
    roundNumber: number;
  }) => void;
  onRemoteInput?: (role: RoomPlayer['role'], input: InputSnapshot) => void;
  onRemoteSnapshot?: (snapshot: SyncSnapshotPayload) => void;
}

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private callbacks: MultiplayerCallbacks;
  private playerId: string | null = null;
  private reconnectTimer: number | null = null;
  private disposed = false;

  constructor(callbacks: MultiplayerCallbacks) {
    this.callbacks = callbacks;
  }

  public getPlayerId(): string | null {
    return this.playerId;
  }

  public connect(): void {
    if (this.disposed) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        this.callbacks.onStatusChange?.(true);
      };

      ws.onmessage = (ev) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        switch (msg.type) {
          case 'welcome':
            this.playerId = String(msg.playerId || '');
            this.callbacks.onWelcome?.(this.playerId);
            break;
          case 'room:state':
            this.callbacks.onRoomState?.(msg.room as RoomState);
            break;
          case 'room:error':
            this.callbacks.onError?.(String(msg.message || 'Room error'));
            break;
          case 'game:start':
            this.callbacks.onGameStart?.({
              districtId: msg.districtId as DistrictId,
              weatherMode: msg.weatherMode as WeatherMode,
              roundNumber: Number(msg.roundNumber || 1),
            });
            break;
          case 'game:input':
            this.callbacks.onRemoteInput?.(
              msg.role as RoomPlayer['role'],
              msg.input as InputSnapshot,
            );
            break;
          case 'game:snapshot':
            this.callbacks.onRemoteSnapshot?.(msg.snapshot as SyncSnapshotPayload);
            break;
        }
      };

      ws.onclose = () => {
        this.callbacks.onStatusChange?.(false);
        this.ws = null;
        if (!this.disposed) {
          this.reconnectTimer = window.setTimeout(() => this.connect(), 2500);
        }
      };

      ws.onerror = () => {
        // Handled cleanly by onclose reconnect
      };
    } catch {
      this.callbacks.onStatusChange?.(false);
    }
  }

  private send(payload: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public createRoom(
    name: string,
    districtId: DistrictId,
    weatherMode: WeatherMode,
    role: PlayerRole,
  ): void {
    this.send({ type: 'room:create', name, districtId, weatherMode, role });
  }

  public joinRoom(code: string, name: string): void {
    this.send({ type: 'room:join', code, name });
  }

  public leaveRoom(): void {
    this.send({ type: 'room:leave' });
    this.callbacks.onRoomState?.(null);
  }

  public setRole(role: RoomPlayer['role']): void {
    this.send({ type: 'room:set_role', role });
  }

  public updateConfig(districtId: DistrictId, weatherMode: WeatherMode): void {
    this.send({ type: 'room:update_config', districtId, weatherMode });
  }

  public startMatch(): void {
    this.send({ type: 'room:start' });
  }

  public nextTagRound(runnerScore: number, droneScore: number): void {
    this.send({ type: 'room:next_round', runnerScore, droneScore });
  }

  public sendInput(input: InputSnapshot): void {
    this.send({ type: 'game:input', input });
  }

  public sendSnapshot(snapshot: SyncSnapshotPayload): void {
    this.send({ type: 'game:snapshot', snapshot });
  }

  public dispose(): void {
    this.disposed = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}
