import { useState } from 'react';
import { DISTRICT_LIST } from '../game/districts';
import type { DistrictId, PlayerRole, RoomPlayer, RoomState, WeatherMode } from '../game/types';

interface MultiplayerModalProps {
  connected: boolean;
  playerId: string | null;
  room: RoomState | null;
  error: string | null;
  streamerMode: boolean;
  defaultDistrict: DistrictId;
  defaultWeather: WeatherMode;
  defaultRole: PlayerRole;
  onCreateRoom: (name: string, districtId: DistrictId, weatherMode: WeatherMode, role: PlayerRole) => void;
  onJoinRoom: (code: string, name: string) => void;
  onLeaveRoom: () => void;
  onSetRole: (role: RoomPlayer['role']) => void;
  onUpdateConfig: (districtId: DistrictId, weatherMode: WeatherMode) => void;
  onStartMatch: () => void;
  onToggleStreamerMode: () => void;
  onClose: () => void;
}

export function MultiplayerModal({
  connected,
  playerId,
  room,
  error,
  streamerMode,
  defaultDistrict,
  defaultWeather,
  defaultRole,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onSetRole,
  onUpdateConfig,
  onStartMatch,
  onToggleStreamerMode,
  onClose,
}: MultiplayerModalProps) {
  const [callsign, setCallsign] = useState('SPECTRE');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);

  const me = room?.players.find((p) => p.id === playerId) ?? null;
  const isHost = Boolean(me?.isHost);

  const handleCopyInvite = () => {
    if (!room) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${room.code}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(6, 10, 16, 0.84)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Multiplayer Tag Lobby"
    >
      <div className="hud-chamfer w-full max-w-lg bg-[#0c1320] border border-slate-700 p-6 flex flex-col gap-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="font-display font-bold text-xl tracking-[0.14em] text-white">
              MULTIPLAYER TAG ROOM
            </h2>
            <p className="text-xs font-mono-hud text-slate-400 mt-1">
              CROSS-PLATFORM WEBSOCKET · AUTO SIDE-SWAP EVERY ROUND
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Multiplayer Lobby"
            className="w-8 h-8 flex items-center justify-center bg-slate-900 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-rose-950/80 border border-rose-500/70 px-3 py-2 text-xs font-mono-hud text-rose-200">
            {error}
          </div>
        )}

        {!room ? (
          <div className="flex flex-col gap-4">
            {/* Player Callsign */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="mp-callsign"
                className="text-[11px] font-mono-hud tracking-[0.18em] text-slate-400 uppercase"
              >
                OPERATOR CALLSIGN
              </label>
              <input
                id="mp-callsign"
                type="text"
                maxLength={16}
                value={callsign}
                onChange={(e) => setCallsign(e.target.value.toUpperCase())}
                className="bg-[#070b13] border border-slate-700 px-3 py-2.5 text-sm font-mono-hud text-white focus:outline-none focus:border-sky-400"
                placeholder="ENTER CALLSIGN"
              />
            </div>

            {/* Create Room */}
            <button
              type="button"
              disabled={!connected}
              onClick={() =>
                onCreateRoom(
                  callsign || 'SPECTRE',
                  defaultDistrict,
                  defaultWeather,
                  defaultRole,
                )
              }
              className="hud-chamfer-sm w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-display font-bold text-sm tracking-[0.16em] py-3 transition-colors cursor-pointer"
            >
              {connected ? 'CREATE COMPETITIVE TAG ROOM' : 'CONNECTING TO SERVER...'}
            </button>

            {/* Join Existing Room by 4-char Code */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (joinCode.trim().length >= 4) {
                  onJoinRoom(joinCode.trim().toUpperCase(), callsign || 'AGENT');
                }
              }}
              className="flex flex-col gap-1.5 pt-2 border-t border-slate-800"
            >
              <label
                htmlFor="mp-room-code"
                className="text-[11px] font-mono-hud tracking-[0.18em] text-slate-400 uppercase"
              >
                JOIN WITH ROOM CODE
              </label>
              <div className="flex gap-2">
                <input
                  id="mp-room-code"
                  type="text"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="E.G. K7M2"
                  className="flex-1 bg-[#070b13] border border-slate-700 px-3 py-2.5 text-sm font-mono-hud tracking-[0.22em] text-white uppercase focus:outline-none focus:border-sky-400"
                />
                <button
                  type="submit"
                  disabled={!connected || joinCode.trim().length < 4}
                  className="hud-chamfer-sm bg-sky-500/20 hover:bg-sky-500/30 disabled:opacity-40 border border-sky-400 text-sky-200 font-display font-bold text-xs tracking-[0.16em] px-5 cursor-pointer"
                >
                  JOIN
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Room Code & Streamer Mode Strip */}
            <div className="flex items-center justify-between gap-3 bg-[#070b13] border border-slate-800 px-4 py-3">
              <div>
                <div className="text-[10px] font-mono-hud tracking-[0.2em] text-slate-400">
                  ROOM CODE
                </div>
                <div
                  className="font-mono-hud font-bold text-2xl tracking-[0.26em] text-amber-400"
                  data-testid="room-code-value"
                >
                  {streamerMode ? '****' : room.code}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleStreamerMode}
                  className={`px-2.5 py-1.5 text-[10px] font-mono-hud border cursor-pointer ${
                    streamerMode
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {streamerMode ? 'STREAMER HIDE: ON' : 'STREAMER HIDE: OFF'}
                </button>
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="px-3 py-1.5 text-[10px] font-mono-hud font-bold bg-sky-500/20 border border-sky-400 text-sky-200 hover:bg-sky-500/30 cursor-pointer"
                >
                  {copied ? 'COPIED!' : 'COPY LINK'}
                </button>
              </div>
            </div>

            {/* Connected Roster */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] font-mono-hud tracking-[0.18em] text-slate-400">
                <span>OPERATORS ({room.players.length})</span>
                <span>PICK ROLE BELOW</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {room.players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between bg-[#080e19] border border-slate-800 px-3 py-2 text-xs font-mono-hud"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100">{p.name}</span>
                      {p.isHost && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300">
                          HOST
                        </span>
                      )}
                      {p.id === playerId && (
                        <span className="text-[9px] text-slate-400">(YOU)</span>
                      )}
                    </div>
                    <span
                      className={`font-bold uppercase tracking-wider ${
                        p.role === 'runner'
                          ? 'text-sky-400'
                          : p.role === 'drone'
                            ? 'text-rose-400'
                            : 'text-slate-400'
                      }`}
                    >
                      {p.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Role Switcher */}
            <div className="grid grid-cols-3 gap-2">
              {(['runner', 'drone', 'spectator'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onSetRole(r)}
                  className={`py-2 text-xs font-mono-hud font-bold uppercase border cursor-pointer ${
                    me?.role === r
                      ? 'bg-sky-500/25 border-sky-400 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Host District / Weather Controls */}
            {isHost && (
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="flex flex-col gap-1">
                  <label htmlFor="mp-district" className="text-[10px] font-mono-hud text-slate-400">
                    SECTOR
                  </label>
                  <select
                    id="mp-district"
                    value={room.districtId}
                    onChange={(e) =>
                      onUpdateConfig(e.target.value as DistrictId, room.weatherMode)
                    }
                    className="bg-[#070b13] border border-slate-700 px-2.5 py-2 text-xs font-mono-hud text-slate-100"
                  >
                    {DISTRICT_LIST.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="mp-weather" className="text-[10px] font-mono-hud text-slate-400">
                    WEATHER
                  </label>
                  <select
                    id="mp-weather"
                    value={room.weatherMode}
                    onChange={(e) =>
                      onUpdateConfig(room.districtId, e.target.value as WeatherMode)
                    }
                    className="bg-[#070b13] border border-slate-700 px-2.5 py-2 text-xs font-mono-hud text-slate-100"
                  >
                    <option value="dynamic">DYNAMIC CYCLE</option>
                    <option value="clear">CLEAR DUSK</option>
                    <option value="rain">HEAVY RAIN</option>
                    <option value="fog">DENSE FOG</option>
                    <option value="storm">TYPHOON STORM</option>
                  </select>
                </div>
              </div>
            )}

            {/* Room Footer Actions */}
            <div className="flex gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onLeaveRoom}
                className="px-4 py-3 text-xs font-mono-hud font-bold bg-slate-900 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
              >
                LEAVE
              </button>
              {isHost ? (
                <button
                  type="button"
                  onClick={onStartMatch}
                  className="hud-chamfer-sm flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm tracking-[0.16em] py-3 cursor-pointer"
                >
                  LAUNCH TAG MATCH
                </button>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs font-mono-hud text-slate-400 bg-slate-900/70 border border-slate-800">
                  WAITING FOR HOST TO LAUNCH...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
