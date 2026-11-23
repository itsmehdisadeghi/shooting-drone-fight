import { useEffect, useRef } from 'react';
import { DISTRICTS } from '../game/districts';
import type { HudSnapshot, KillFeedEntry, RoomState } from '../game/types';
import type { TouchInputState } from '../game/GameCanvas';

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  streamerMode: boolean;
  room: RoomState | null;
  killFeed: KillFeedEntry[];
  onToggleMute: () => void;
  onPause: () => void;
  onRestart: () => void;
  onToggleStreamerMode: () => void;
  touchInputRef: React.MutableRefObject<TouchInputState | null>;
}

export function GameHud({
  hud,
  muted,
  streamerMode,
  room,
  killFeed,
  onToggleMute,
  onPause,
  onRestart,
  onToggleStreamerMode,
  touchInputRef,
}: GameHudProps) {
  const ghostHpRef = useRef<number>(hud.runnerHp);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);

  // Smooth delayed trailing damage ghost bar
  useEffect(() => {
    if (hud.runnerHp > ghostHpRef.current) {
      ghostHpRef.current = hud.runnerHp;
    } else if (hud.runnerHp < ghostHpRef.current) {
      const t = window.setTimeout(() => {
        ghostHpRef.current = hud.runnerHp;
      }, 360);
      return () => clearTimeout(t);
    }
  }, [hud.runnerHp]);

  // Render live tactical GPS minimap onto 2D canvas
  useEffect(() => {
    const canvas = minimapRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const district = DISTRICTS[hud.districtId];
    const half = hud.minimap.arenaHalfSize;
    const toPx = (v: number) => ((v + half) / (half * 2)) * size;
    const scalePx = (v: number) => (v / (half * 2)) * size;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#09101a';
    ctx.fillRect(0, 0, size, size);

    // Subtle satellite grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const p = (size / 4) * i;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }

    // Buildings
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#334155';
    for (const b of district.buildings) {
      const bx = toPx(b.x - b.w * 0.5);
      const bz = toPx(b.z - b.d * 0.5);
      ctx.fillRect(bx, bz, scalePx(b.w), scalePx(b.d));
      ctx.strokeRect(bx, bz, scalePx(b.w), scalePx(b.d));
    }

    // Destructible cover nodes
    for (const c of hud.minimap.covers) {
      const cx = toPx(c.x - c.w * 0.5);
      const cz = toPx(c.z - c.d * 0.5);
      ctx.fillStyle = c.destroyed
        ? 'rgba(100, 116, 139, 0.35)'
        : c.hpRatio < 0.45
          ? '#f97316'
          : '#eab308';
      ctx.fillRect(cx, cz, Math.max(3, scalePx(c.w)), Math.max(3, scalePx(c.d)));
    }

    // Extraction Beacon
    const ex = toPx(hud.minimap.extractionX);
    const ez = toPx(hud.minimap.extractionZ);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ex, ez, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(16, 185, 129, 0.35)';
    ctx.fill();

    // Drone scan aim tether + Drone marker
    const dx = toPx(hud.minimap.droneX);
    const dz = toPx(hud.minimap.droneZ);
    const ax = toPx(hud.minimap.droneAimX);
    const az = toPx(hud.minimap.droneAimZ);
    ctx.strokeStyle =
      hud.alertState === 'locked'
        ? 'rgba(244, 63, 94, 0.7)'
        : hud.alertState === 'suspicious'
          ? 'rgba(245, 158, 11, 0.65)'
          : 'rgba(34, 211, 238, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(dx, dz);
    ctx.lineTo(ax, az);
    ctx.stroke();

    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(dx, dz, 4, 0, Math.PI * 2);
    ctx.fill();

    // Runner marker (always visible to Runner; visible to Drone when detected or Sonar active)
    const showRunner =
      hud.role === 'runner' || hud.detection >= 30 || hud.minimap.sonarActive;
    if (showRunner) {
      const rx = toPx(hud.minimap.runnerX);
      const rz = toPx(hud.minimap.runnerZ);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(rx, rz, 3.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [hud]);

  const mins = Math.floor(hud.timeRemaining / 60);
  const secs = hud.timeRemaining % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
  const lowTime = hud.timeRemaining <= 18;
  const criticalHp = hud.role === 'runner' && hud.runnerHp <= 32;

  const isRunner = hud.role === 'runner';
  const primaryHp = isRunner ? hud.runnerHp : hud.droneHp;
  const primaryMax = isRunner ? hud.runnerMaxHp : hud.droneMaxHp;

  const setTouchField = (patch: Partial<TouchInputState>) => {
    if (!touchInputRef.current) return;
    Object.assign(touchInputRef.current, patch);
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none">
      {/* Critical low-HP or Lock-On peripheral edge vignette (no blur, zero center occlusion) */}
      {(criticalHp || hud.alertState === 'locked') && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: criticalHp
              ? 'inset 0 0 90px rgba(244, 63, 94, 0.45)'
              : 'inset 0 0 60px rgba(244, 63, 94, 0.25)',
          }}
        />
      )}

      {/* MOBILE COMPACT TOP BAR (< md): zero overlap on 390px screens */}
      <div className="md:hidden fixed top-2 inset-x-2 flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2 bg-[#090e17]/92 border border-slate-700/85 px-2.5 py-1.5">
          {/* Compact HP */}
          <div className="flex flex-col min-w-[76px]">
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-[9px] font-mono-hud text-slate-400">
                {isRunner ? 'HP' : 'DRONE'}
              </span>
              <span className={`font-mono-hud font-bold text-sm leading-none ${primaryHp <= 35 ? 'text-rose-400' : 'text-slate-100'}`}>
                {primaryHp}
              </span>
            </div>
            <div className="h-1.5 mt-1 bg-slate-900 overflow-hidden">
              <div
                className={`h-full ${primaryHp <= 35 ? 'bg-rose-500' : isRunner ? 'bg-sky-400' : 'bg-amber-400'}`}
                style={{ width: `${Math.max(0, (primaryHp / primaryMax) * 100)}%` }}
              />
            </div>
          </div>

          {/* Compact Score + Timer */}
          <div className="flex items-center gap-2.5 px-2 border-x border-slate-700/80">
            <span className="font-mono-hud text-xs font-bold text-sky-400">{hud.runnerScore}</span>
            <span className={`font-mono-hud font-bold text-base ${lowTime ? 'text-rose-400' : 'text-amber-300'}`}>
              {timeStr}
            </span>
            <span className="font-mono-hud text-xs font-bold text-rose-400">{hud.droneScore}</span>
          </div>

          {/* Compact Utility Buttons */}
          <div className="flex items-center gap-1 pointer-events-auto">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
              className="w-8 h-8 flex items-center justify-center bg-slate-900 border border-slate-700 text-slate-200"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                {muted ? <path d="M22 9l-6 6M16 9l6 6" /> : <path d="M15.5 8.5a5 5 0 010 7" />}
              </svg>
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              aria-label="Pause Game"
              className="w-8 h-8 flex items-center justify-center bg-slate-900 border border-slate-700 text-slate-200"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" />
                <rect x="14" y="5" width="4" height="14" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between bg-[#090e17]/88 border border-slate-800 px-2.5 py-1 text-[9px] font-mono-hud tracking-wider text-slate-300">
          <span className="text-sky-300">{hud.weatherLabel}</span>
          <span>VIS {hud.visibilityRange}M</span>
          <span>ACC {hud.droneAccuracyPct}%</span>
          <span>COVER {hud.coversIntact}/{hud.coversTotal}</span>
        </div>
      </div>

      {/* DESKTOP TOP-LEFT CLUSTER (md+): Vitality Bar, Stance/Heat, Active Abilities */}
      <div className="hidden md:flex fixed top-4 left-4 flex-col gap-2.5 max-w-[260px]">
        <div className="hud-chamfer-sm bg-[#090e17]/90 border border-slate-700/80 px-3.5 py-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[10px] font-mono-hud tracking-[0.2em] text-slate-400 uppercase">
              {isRunner ? 'OPERATIVE HP' : 'DRONE CHASSIS'}
            </span>
            <span
              className={`font-mono-hud font-bold text-xl leading-none ${
                primaryHp <= 35 ? 'text-rose-400' : 'text-slate-100'
              }`}
            >
              {primaryHp}
            </span>
          </div>
          {/* Continuous Health Bar with trailing ghost damage layer */}
          <div className="relative h-2.5 mt-1.5 bg-slate-900 border border-slate-700/80 overflow-hidden">
            {isRunner && (
              <div
                className="absolute inset-y-0 left-0 bg-rose-300/70 transition-all duration-300"
                style={{ width: `${Math.max(0, (ghostHpRef.current / primaryMax) * 100)}%` }}
              />
            )}
            <div
              className={`absolute inset-y-0 left-0 transition-all duration-100 ${
                primaryHp <= 35
                  ? 'bg-rose-500'
                  : isRunner
                    ? 'bg-sky-400'
                    : 'bg-amber-400'
              }`}
              style={{ width: `${Math.max(0, (primaryHp / primaryMax) * 100)}%` }}
            />
          </div>

          {/* Secondary Bar: Stamina (Runner) or Autocannon Heat (Drone) */}
          <div className="flex items-center justify-between mt-2 text-[10px] font-mono-hud tracking-[0.16em]">
            <span className="text-slate-400">
              {isRunner
                ? hud.runnerInCover
                  ? hud.runnerCrouching
                    ? 'CONCEALED IN COVER'
                    : 'COVER NEARBY [C]'
                  : 'EXPOSED'
                : hud.droneOverheated
                  ? 'CANNON OVERHEAT'
                  : 'CANNON HEAT'}
            </span>
            <span
              className={
                isRunner
                  ? hud.runnerInCover && hud.runnerCrouching
                    ? 'text-emerald-400'
                    : 'text-sky-300'
                  : hud.droneOverheated
                    ? 'text-rose-400'
                    : 'text-amber-300'
              }
            >
              {isRunner ? `${hud.runnerStamina}%` : `${hud.droneHeat}%`}
            </span>
          </div>
          <div className="h-1.5 mt-1 bg-slate-900 overflow-hidden">
            <div
              className={`h-full transition-all duration-100 ${
                isRunner
                  ? 'bg-emerald-400'
                  : hud.droneOverheated
                    ? 'bg-rose-500'
                    : 'bg-amber-400'
              }`}
              style={{
                width: `${isRunner ? hud.runnerStamina : hud.droneHeat}%`,
              }}
            />
          </div>
        </div>

        {/* Ability Cooldown Sockets (compact, 1-to-1 with live mechanics) */}
        <div className="flex gap-2">
          {isRunner ? (
            <>
              <div className="hud-chamfer-sm bg-[#090e17]/90 border border-slate-700/80 px-2.5 py-1.5 flex items-center gap-2">
                <span className="text-[10px] font-mono-hud font-bold px-1 py-0.5 bg-slate-800 text-sky-300">
                  SPC
                </span>
                <div className="leading-tight">
                  <div className="text-[10px] font-mono-hud text-slate-400">DASH</div>
                  <div className="text-xs font-mono-hud font-bold text-slate-100">
                    {hud.dashCooldown > 0 ? `${hud.dashCooldown.toFixed(1)}s` : 'READY'}
                  </div>
                </div>
              </div>
              <div className="hud-chamfer-sm bg-[#090e17]/90 border border-slate-700/80 px-2.5 py-1.5 flex items-center gap-2">
                <span className="text-[10px] font-mono-hud font-bold px-1 py-0.5 bg-slate-800 text-sky-300">
                  E
                </span>
                <div className="leading-tight">
                  <div className="text-[10px] font-mono-hud text-slate-400">EMP JAM</div>
                  <div className="text-xs font-mono-hud font-bold text-slate-100">
                    {hud.empCooldown > 0 ? `${hud.empCooldown.toFixed(1)}s` : 'READY'}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="hud-chamfer-sm bg-[#090e17]/90 border border-slate-700/80 px-2.5 py-1.5 flex items-center gap-2">
                <span className="text-[10px] font-mono-hud font-bold px-1 py-0.5 bg-slate-800 text-amber-300">
                  LMB
                </span>
                <div className="leading-tight">
                  <div className="text-[10px] font-mono-hud text-slate-400">20MM</div>
                  <div className="text-xs font-mono-hud font-bold text-slate-100">
                    {hud.empStunned ? 'JAMMED' : hud.droneOverheated ? 'COOLING' : 'ARMED'}
                  </div>
                </div>
              </div>
              <div className="hud-chamfer-sm bg-[#090e17]/90 border border-slate-700/80 px-2.5 py-1.5 flex items-center gap-2">
                <span className="text-[10px] font-mono-hud font-bold px-1 py-0.5 bg-slate-800 text-rose-300">
                  E
                </span>
                <div className="leading-tight">
                  <div className="text-[10px] font-mono-hud text-slate-400">SONAR</div>
                  <div className="text-xs font-mono-hud font-bold text-slate-100">
                    {hud.sonarActive
                      ? 'ACTIVE'
                      : hud.sonarCooldown > 0
                        ? `${hud.sonarCooldown.toFixed(1)}s`
                        : 'READY'}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* DESKTOP TOP-CENTER CLUSTER (md+): Countdown Timer, Tag Score, Weather Optics */}
      <div className="hidden md:flex fixed top-4 left-1/2 -translate-x-1/2 flex-col items-center gap-1.5">
        <div className="hud-chamfer bg-[#090e17]/92 border border-slate-700/85 px-5 py-2 flex items-center gap-5">
          {/* Runner Score */}
          <div className="text-center">
            <div className="text-[9px] font-mono-hud tracking-[0.2em] text-sky-400">RUNNER</div>
            <div className="font-mono-hud font-bold text-lg leading-none text-slate-100">
              {hud.runnerScore}
            </div>
          </div>

          {/* Primary Countdown Timer */}
          <div className="px-4 border-x border-slate-700/80 text-center">
            <div className="text-[9px] font-mono-hud tracking-[0.22em] text-slate-400">
              RD {hud.roundNumber} · EXTRACTION
            </div>
            <div
              className={`font-mono-hud font-bold text-2xl leading-tight ${
                lowTime ? 'text-rose-400' : 'text-amber-300'
              }`}
              data-testid="hud-timer"
            >
              {timeStr}
            </div>
          </div>

          {/* Drone Score */}
          <div className="text-center">
            <div className="text-[9px] font-mono-hud tracking-[0.2em] text-rose-400">DRONE</div>
            <div className="font-mono-hud font-bold text-lg leading-none text-slate-100">
              {hud.droneScore}
            </div>
          </div>
        </div>

        {/* Compact Weather & Cover Telemetry Strip */}
        <div className="flex items-center gap-3 bg-[#090e17]/85 border border-slate-800 px-3 py-1 text-[10px] font-mono-hud tracking-[0.14em] text-slate-300">
          <span className="text-sky-300">{hud.weatherLabel}</span>
          <span className="text-slate-600">|</span>
          <span>VIS {hud.visibilityRange}M</span>
          <span className="text-slate-600">|</span>
          <span>ACC {hud.droneAccuracyPct}%</span>
          <span className="text-slate-600">|</span>
          <span>
            COVER {hud.coversIntact}/{hud.coversTotal}
          </span>
          {room && (
            <>
              <span className="text-slate-600">|</span>
              <span className="text-amber-300">
                ROOM {streamerMode ? '****' : room.code}
              </span>
            </>
          )}
        </div>
      </div>

      {/* DESKTOP TOP-RIGHT CLUSTER (md+): Utility Icon Buttons + Tactical GPS Minimap + Kill/Tag Ticker */}
      <div className="hidden md:flex fixed top-4 right-4 flex-col items-end gap-2">
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleStreamerMode();
            }}
            aria-label={streamerMode ? 'Disable Streamer Privacy Mode' : 'Enable Streamer Privacy Mode'}
            title="Streamer Privacy Mode"
            className={`w-9 h-9 flex items-center justify-center border transition-colors cursor-pointer ${
              streamerMode
                ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                : 'bg-[#090e17]/90 border-slate-700/80 text-slate-300 hover:border-slate-500'
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
              <circle cx="12" cy="12" r="2.5" />
              {streamerMode && <line x1="4" y1="4" x2="20" y2="20" />}
            </svg>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
            title="Toggle Audio [M]"
            className="w-9 h-9 flex items-center justify-center bg-[#090e17]/90 border border-slate-700/80 text-slate-300 hover:border-slate-500 transition-colors cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              {muted ? (
                <path d="M22 9l-6 6M16 9l6 6" />
              ) : (
                <path d="M15.5 8.5a5 5 0 010 7M19 5a9 9 0 010 14" />
              )}
            </svg>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onRestart();
            }}
            aria-label="Restart Round"
            title="Restart Round [R]"
            className="w-9 h-9 flex items-center justify-center bg-[#090e17]/90 border border-slate-700/80 text-slate-300 hover:border-slate-500 transition-colors cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            aria-label="Pause Game"
            title="Pause [Esc / P]"
            className="w-9 h-9 flex items-center justify-center bg-[#090e17]/90 border border-slate-700/80 text-slate-300 hover:border-slate-500 transition-colors cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" />
              <rect x="14" y="5" width="4" height="14" />
            </svg>
          </button>
        </div>

        {/* Tactical GPS Sector Minimap */}
        <div className="bg-[#090e17]/92 border border-slate-700/80 p-1.5">
          <div className="flex items-center justify-between text-[9px] font-mono-hud tracking-[0.16em] text-slate-400 mb-1 px-0.5">
            <span>{hud.districtName}</span>
            <span className="text-emerald-400">EVAC</span>
          </div>
          <canvas
            ref={minimapRef}
            width={132}
            height={132}
            className="block w-[132px] h-[132px]"
          />
        </div>

        {/* Minimalist Streamer Event Ticker (latest 3 events) */}
        {killFeed.length > 0 && (
          <div className="flex flex-col items-end gap-1 mt-1">
            {killFeed.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className={`px-2.5 py-1 text-[10px] font-mono-hud tracking-[0.14em] bg-[#090e17]/88 border-r-2 ${
                  item.accent === 'crimson'
                    ? 'border-rose-500 text-rose-200'
                    : item.accent === 'amber'
                      ? 'border-amber-400 text-amber-200'
                      : item.accent === 'emerald'
                        ? 'border-emerald-400 text-emerald-200'
                        : 'border-sky-400 text-sky-200'
                }`}
              >
                {item.text}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOTTOM-CENTER CONTEXTUAL GAUGES: Drone Sensor Exposure & Extraction Capture */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 w-[280px] max-w-[85vw]">
        {hud.extractionProgress > 0 && (
          <div className="w-full hud-chamfer-sm bg-[#071f17]/95 border border-emerald-400 px-3.5 py-2">
            <div className="flex items-center justify-between text-[11px] font-mono-hud tracking-[0.18em] text-emerald-300">
              <span>EXTRACTING</span>
              <span className="font-bold">{hud.extractionProgress}%</span>
            </div>
            <div className="h-2 mt-1.5 bg-slate-950 overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-100"
                style={{ width: `${hud.extractionProgress}%` }}
              />
            </div>
          </div>
        )}

        {(hud.detection > 0 || hud.telegraphing || hud.empStunned) && (
          <div
            className={`w-full hud-chamfer-sm px-3.5 py-2 border ${
              hud.empStunned
                ? 'bg-[#091b2a]/92 border-sky-400'
                : hud.alertState === 'locked' || hud.telegraphing
                  ? 'bg-[#2a0c14]/94 border-rose-500'
                  : 'bg-[#241a08]/92 border-amber-400'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] font-mono-hud tracking-[0.18em]">
              <span
                className={
                  hud.empStunned
                    ? 'text-sky-300'
                    : hud.alertState === 'locked' || hud.telegraphing
                      ? 'text-rose-300 font-bold'
                      : 'text-amber-300'
                }
              >
                {hud.empStunned
                  ? 'DRONE SENSORS JAMMED'
                  : hud.telegraphing
                    ? 'INCOMING COVER STRIKE'
                    : hud.alertState === 'locked'
                      ? 'DRONE SENSOR LOCK'
                      : 'DRONE SENSOR SCANNING'}
              </span>
              <span className="font-bold text-slate-100">{hud.detection}%</span>
            </div>
            <div className="h-1.5 mt-1.5 bg-slate-950 overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  hud.empStunned
                    ? 'bg-sky-400'
                    : hud.alertState === 'locked'
                      ? 'bg-rose-500'
                      : 'bg-amber-400'
                }`}
                style={{ width: `${hud.detection}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* CROSS-PLATFORM TOUCH CONTROLS (Visible on small/touch viewports only) */}
      <div className="md:hidden fixed bottom-4 inset-x-4 flex items-end justify-between pointer-events-none">
        {/* Compact D-Pad */}
        <div className="grid grid-cols-3 gap-1 pointer-events-auto">
          <div />
          <button
            type="button"
            aria-label="Move Forward"
            onPointerDown={() => setTouchField({ moveZ: -1 })}
            onPointerUp={() => setTouchField({ moveZ: 0 })}
            onPointerLeave={() => setTouchField({ moveZ: 0 })}
            className="w-11 h-11 bg-[#090e17]/88 border border-slate-700 text-slate-200 font-mono-hud text-sm active:bg-sky-500/40"
          >
            W
          </button>
          <div />
          <button
            type="button"
            aria-label="Move Left"
            onPointerDown={() => setTouchField({ moveX: -1 })}
            onPointerUp={() => setTouchField({ moveX: 0 })}
            onPointerLeave={() => setTouchField({ moveX: 0 })}
            className="w-11 h-11 bg-[#090e17]/88 border border-slate-700 text-slate-200 font-mono-hud text-sm active:bg-sky-500/40"
          >
            A
          </button>
          <button
            type="button"
            aria-label="Move Backward"
            onPointerDown={() => setTouchField({ moveZ: 1 })}
            onPointerUp={() => setTouchField({ moveZ: 0 })}
            onPointerLeave={() => setTouchField({ moveZ: 0 })}
            className="w-11 h-11 bg-[#090e17]/88 border border-slate-700 text-slate-200 font-mono-hud text-sm active:bg-sky-500/40"
          >
            S
          </button>
          <button
            type="button"
            aria-label="Move Right"
            onPointerDown={() => setTouchField({ moveX: 1 })}
            onPointerUp={() => setTouchField({ moveX: 0 })}
            onPointerLeave={() => setTouchField({ moveX: 0 })}
            className="w-11 h-11 bg-[#090e17]/88 border border-slate-700 text-slate-200 font-mono-hud text-sm active:bg-sky-500/40"
          >
            D
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pointer-events-auto">
          {isRunner ? (
            <>
              <button
                type="button"
                aria-label="Toggle Crouch"
                onClick={() =>
                  setTouchField({ crouch: !(touchInputRef.current?.crouch ?? false) })
                }
                className="w-14 h-14 bg-[#090e17]/90 border border-emerald-500/70 text-emerald-300 font-mono-hud text-[11px] font-bold"
              >
                HIDE
              </button>
              <button
                type="button"
                aria-label="Dash"
                onClick={() => setTouchField({ dashQueued: true })}
                className="w-14 h-14 bg-[#0e2236]/92 border border-sky-400 text-sky-200 font-mono-hud text-[11px] font-bold"
              >
                DASH
              </button>
              <button
                type="button"
                aria-label="EMP Pulse"
                onClick={() => setTouchField({ abilityQueued: true })}
                className="w-14 h-14 bg-[#1c1a36]/92 border border-amber-400 text-amber-200 font-mono-hud text-[11px] font-bold"
              >
                EMP
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                aria-label="Sonar Ping"
                onClick={() => setTouchField({ abilityQueued: true })}
                className="w-14 h-14 bg-[#24121b]/92 border border-rose-400 text-rose-200 font-mono-hud text-[11px] font-bold"
              >
                SONAR
              </button>
              <button
                type="button"
                aria-label="Fire Autocannon"
                onPointerDown={() => setTouchField({ fireHeld: true })}
                onPointerUp={() => setTouchField({ fireHeld: false })}
                onPointerLeave={() => setTouchField({ fireHeld: false })}
                className="w-16 h-16 bg-amber-500/90 text-slate-950 font-mono-hud text-xs font-bold"
              >
                FIRE
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
