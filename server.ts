import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import type { DistrictId, PlayerRole, RoomPlayer, RoomState, WeatherMode } from './src/game/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ClientMeta {
  id: string;
  ws: WebSocket;
  roomCode: string | null;
}

interface ServerRoom {
  state: RoomState;
  clients: Map<string, ClientMeta>;
}

const rooms = new Map<string, ServerRoom>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function generateClientId(): string {
  return `p_${Math.random().toString(36).slice(2, 9)}`;
}

function safeSend(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastRoom(room: ServerRoom, payload: unknown, excludeId?: string): void {
  const data = JSON.stringify(payload);
  for (const [cid, client] of room.clients) {
    if (cid === excludeId) continue;
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

function leaveCurrentRoom(client: ClientMeta): void {
  if (!client.roomCode) return;
  const room = rooms.get(client.roomCode);
  client.roomCode = null;
  if (!room) return;

  room.clients.delete(client.id);
  const idx = room.state.players.findIndex((p) => p.id === client.id);
  const wasHost = idx >= 0 && room.state.players[idx].isHost;
  if (idx >= 0) {
    room.state.players.splice(idx, 1);
  }

  if (room.state.players.length === 0) {
    rooms.delete(room.state.code);
    return;
  }

  if (wasHost && room.state.players.length > 0) {
    room.state.players[0].isHost = true;
  }

  broadcastRoom(room, { type: 'room:state', room: room.state });
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, activeRooms: rooms.size });
  });

  wss.on('connection', (ws) => {
    const client: ClientMeta = {
      id: generateClientId(),
      ws,
      roomCode: null,
    };

    safeSend(ws, { type: 'welcome', playerId: client.id });

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }

      const type = String(msg.type || '');

      if (type === 'room:create') {
        leaveCurrentRoom(client);
        const code = generateRoomCode();
        const playerName = String(msg.name || 'OPERATIVE').slice(0, 16).trim() || 'OPERATIVE';
        const districtId = (msg.districtId as DistrictId) || 'shibuya';
        const weatherMode = (msg.weatherMode as WeatherMode) || 'dynamic';
        const preferredRole: PlayerRole = msg.role === 'drone' ? 'drone' : 'runner';

        const player: RoomPlayer = {
          id: client.id,
          name: playerName,
          role: preferredRole,
          ready: true,
          isHost: true,
          score: 0,
        };

        const room: ServerRoom = {
          state: {
            code,
            districtId,
            weatherMode,
            status: 'lobby',
            roundNumber: 1,
            runnerScore: 0,
            droneScore: 0,
            players: [player],
          },
          clients: new Map([[client.id, client]]),
        };
        rooms.set(code, room);
        client.roomCode = code;
        safeSend(ws, { type: 'room:state', room: room.state });
        return;
      }

      if (type === 'room:join') {
        const code = String(msg.code || '').toUpperCase().trim();
        const room = rooms.get(code);
        if (!room) {
          safeSend(ws, { type: 'room:error', message: `Room "${code}" not found.` });
          return;
        }
        leaveCurrentRoom(client);
        const playerName = String(msg.name || 'AGENT').slice(0, 16).trim() || 'AGENT';

        const hasRunner = room.state.players.some((p) => p.role === 'runner');
        const hasDrone = room.state.players.some((p) => p.role === 'drone');
        const assignedRole: RoomPlayer['role'] = !hasRunner
          ? 'runner'
          : !hasDrone
            ? 'drone'
            : 'spectator';

        room.state.players.push({
          id: client.id,
          name: playerName,
          role: assignedRole,
          ready: true,
          isHost: false,
          score: 0,
        });
        room.clients.set(client.id, client);
        client.roomCode = code;
        broadcastRoom(room, { type: 'room:state', room: room.state });
        return;
      }

      if (type === 'room:leave') {
        leaveCurrentRoom(client);
        return;
      }

      if (!client.roomCode) return;
      const room = rooms.get(client.roomCode);
      if (!room) return;

      const sender = room.state.players.find((p) => p.id === client.id);
      if (!sender) return;

      if (type === 'room:set_role') {
        const desired = msg.role as RoomPlayer['role'];
        if (desired !== 'runner' && desired !== 'drone' && desired !== 'spectator') return;
        // If another player holds that active role, swap with them cleanly
        if (desired === 'runner' || desired === 'drone') {
          const holder = room.state.players.find((p) => p.id !== client.id && p.role === desired);
          if (holder) {
            holder.role = sender.role === 'spectator' ? (desired === 'runner' ? 'drone' : 'runner') : sender.role;
          }
        }
        sender.role = desired;
        broadcastRoom(room, { type: 'room:state', room: room.state });
        return;
      }

      if (type === 'room:update_config' && sender.isHost) {
        if (msg.districtId) room.state.districtId = msg.districtId as DistrictId;
        if (msg.weatherMode) room.state.weatherMode = msg.weatherMode as WeatherMode;
        broadcastRoom(room, { type: 'room:state', room: room.state });
        return;
      }

      if (type === 'room:start' && sender.isHost) {
        room.state.status = 'playing';
        room.state.roundNumber = 1;
        room.state.runnerScore = 0;
        room.state.droneScore = 0;
        broadcastRoom(room, { type: 'room:state', room: room.state });
        broadcastRoom(room, {
          type: 'game:start',
          districtId: room.state.districtId,
          weatherMode: room.state.weatherMode,
          roundNumber: room.state.roundNumber,
        });
        return;
      }

      if (type === 'room:next_round' && sender.isHost) {
        // Competitive Tag-Style Role Swap between Runner & Drone!
        room.state.roundNumber += 1;
        if (typeof msg.runnerScore === 'number') room.state.runnerScore = msg.runnerScore;
        if (typeof msg.droneScore === 'number') room.state.droneScore = msg.droneScore;
        for (const p of room.state.players) {
          if (p.role === 'runner') p.role = 'drone';
          else if (p.role === 'drone') p.role = 'runner';
        }
        broadcastRoom(room, { type: 'room:state', room: room.state });
        broadcastRoom(room, {
          type: 'game:start',
          districtId: room.state.districtId,
          weatherMode: room.state.weatherMode,
          roundNumber: room.state.roundNumber,
        });
        return;
      }

      if (type === 'game:input') {
        broadcastRoom(
          room,
          { type: 'game:input', from: client.id, role: sender.role, input: msg.input },
          client.id,
        );
        return;
      }

      if (type === 'game:snapshot' && sender.isHost) {
        broadcastRoom(room, { type: 'game:snapshot', snapshot: msg.snapshot }, client.id);
      }
    });

    ws.on('close', () => {
      leaveCurrentRoom(client);
    });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Vector Hunt server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server startup failed:', err);
  process.exit(1);
});
