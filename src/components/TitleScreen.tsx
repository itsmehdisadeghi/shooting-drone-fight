import { DISTRICT_LIST } from '../game/districts';
import type { DistrictId, PlayerRole, WeatherMode } from '../game/types';

interface TitleScreenProps {
  role: PlayerRole;
  districtId: DistrictId;
  weatherMode: WeatherMode;
  onChangeRole: (role: PlayerRole) => void;
  onChangeDistrict: (id: DistrictId) => void;
  onChangeWeather: (mode: WeatherMode) => void;
  onStartSolo: () => void;
  onOpenMultiplayer: () => void;
}

const WEATHER_OPTIONS: Array<{ id: WeatherMode; label: string }> = [
  { id: 'dynamic', label: 'DYNAMIC' },
  { id: 'clear', label: 'CLEAR' },
  { id: 'rain', label: 'RAIN' },
  { id: 'fog', label: 'FOG' },
  { id: 'storm', label: 'STORM' },
];

export function TitleScreen({
  role,
  districtId,
  weatherMode,
  onChangeRole,
  onChangeDistrict,
  onChangeWeather,
  onStartSolo,
  onOpenMultiplayer,
}: TitleScreenProps) {
  const activeDistrict =
    DISTRICT_LIST.find((d) => d.id === districtId) ?? DISTRICT_LIST[0];

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-6 md:p-10">
      {/* Subtle left vignette gradient (no backdrop-filter) so title reads cleanly over live 3D tour */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(105deg, rgba(7,11,18,0.88) 0%, rgba(7,11,18,0.58) 38%, rgba(7,11,18,0.08) 72%, rgba(7,11,18,0.35) 100%)',
        }}
      />

      {/* Main Asymmetric Left-Third Composition */}
      <main className="relative z-10 max-w-md my-auto flex flex-col gap-5 pointer-events-auto">
        {/* Bespoke Inline SVG Title Lockup */}
        <div>
          <svg
            viewBox="0 0 420 92"
            className="w-full max-w-[390px] h-auto overflow-visible"
            role="img"
            aria-label="Vector Hunt — Aerial Drone Extraction"
          >
            {/* Tactical reticle corner bracket */}
            <path
              d="M2 18 L2 4 L18 4 M402 4 L418 4 L418 18 M2 74 L2 88 L18 88"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.2"
              opacity="0.85"
            />
            {/* Drone silhouette icon integrated into emblem */}
            <g transform="translate(20, 22)">
              <polygon
                points="14,0 28,8 28,22 14,30 0,22 0,8"
                fill="#0f172a"
                stroke="#38bdf8"
                strokeWidth="2"
              />
              <circle cx="14" cy="15" r="4.5" fill="#f43f5e" />
              <line x1="-6" y1="2" x2="34" y2="28" stroke="#38bdf8" strokeWidth="1.5" opacity="0.6" />
              <line x1="34" y1="2" x2="-6" y2="28" stroke="#38bdf8" strokeWidth="1.5" opacity="0.6" />
            </g>
            <text
              x="66"
              y="46"
              fill="#f8fafc"
              fontFamily="Chakra Petch, sans-serif"
              fontWeight="700"
              fontSize="40"
              letterSpacing="4"
            >
              VECTOR HUNT
            </text>
            <rect x="66" y="56" width="84" height="3" fill="#f59e0b" />
            <text
              x="160"
              y="64"
              fill="#94a3b8"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="700"
              fontSize="11"
              letterSpacing="2.8"
            >
              3D URBAN DRONE EXTRACTION
            </text>
          </svg>
        </div>

        {/* Role Selector (Two Asymmetric Sides) */}
        <section aria-label="Select combat side" className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] font-mono-hud tracking-[0.2em] text-slate-400 uppercase">
            <span>SIDE SELECTION</span>
            <span className="text-sky-400">
              {role === 'runner' ? 'HIDE · EVADE · EXTRACT' : 'SCAN · SHRED COVER · TAG'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onChangeRole('runner')}
              aria-pressed={role === 'runner'}
              className={`hud-chamfer-sm px-4 py-3 text-left border transition-colors cursor-pointer ${
                role === 'runner'
                  ? 'bg-[#0e2236] border-sky-400 text-white'
                  : 'bg-[#0c121d]/90 border-slate-700/80 text-slate-300 hover:border-slate-500'
              }`}
            >
              <div className="font-display font-bold text-sm tracking-wider">RUNNER</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Ground Stealth · Evac</div>
            </button>
            <button
              type="button"
              onClick={() => onChangeRole('drone')}
              aria-pressed={role === 'drone'}
              className={`hud-chamfer-sm px-4 py-3 text-left border transition-colors cursor-pointer ${
                role === 'drone'
                  ? 'bg-[#2a131b] border-rose-500 text-white'
                  : 'bg-[#0c121d]/90 border-slate-700/80 text-slate-300 hover:border-slate-500'
              }`}
            >
              <div className="font-display font-bold text-sm tracking-wider">DRONE</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Aerial Gunship · Sonar</div>
            </button>
          </div>
        </section>

        {/* Urban District Selector */}
        <section aria-label="Select urban district" className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] font-mono-hud tracking-[0.2em] text-slate-400 uppercase">
            <span>URBAN MAP SECTOR</span>
            <span className="text-amber-400">{activeDistrict.coordsLabel}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {DISTRICT_LIST.map((d) => {
              const selected = d.id === districtId;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onChangeDistrict(d.id)}
                  aria-pressed={selected}
                  className={`hud-chamfer-sm px-2.5 py-2 text-left border transition-colors cursor-pointer ${
                    selected
                      ? 'bg-[#162336] border-amber-400 text-white'
                      : 'bg-[#0c121d]/90 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                  }`}
                >
                  <div className="font-display font-bold text-xs tracking-wide truncate">
                    {d.name.replace(' SECTOR', '')}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">{d.subtitle.split(' ')[0]}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Dynamic Weather Selector */}
        <section aria-label="Select weather condition" className="flex flex-col gap-2">
          <div className="text-[11px] font-mono-hud tracking-[0.2em] text-slate-400 uppercase">
            ATMOSPHERE &amp; VISIBILITY
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {WEATHER_OPTIONS.map((w) => {
              const selected = w.id === weatherMode;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => onChangeWeather(w.id)}
                  aria-pressed={selected}
                  className={`px-1.5 py-1.5 text-[10px] font-mono-hud font-bold tracking-wider border transition-colors cursor-pointer ${
                    selected
                      ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                      : 'bg-[#0c121d]/90 border-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {w.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Primary & Secondary CTAs (<= 3 menu actions total) */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStartSolo();
            }}
            className="hud-chamfer flex-1 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-display font-bold text-base tracking-[0.16em] px-6 py-3.5 transition-colors cursor-pointer"
          >
            DEPLOY SOLO
          </button>
          <button
            type="button"
            onClick={onOpenMultiplayer}
            className="hud-chamfer bg-[#101c2d] hover:bg-[#172840] border border-sky-400/70 text-sky-100 font-display font-bold text-sm tracking-[0.14em] px-5 py-3.5 transition-colors cursor-pointer"
          >
            MULTIPLAYER TAG
          </button>
        </div>
      </main>

      {/* Single Flat Borderless Control-Hint Line at Bottom Safe Margin */}
      <footer className="relative z-10 flex items-center justify-between text-[11px] md:text-xs font-mono-hud tracking-[0.14em] text-slate-400">
        <span>
          {role === 'runner'
            ? 'WASD Move · Shift Sprint · C Crouch Cover · Space Dash · E EMP · Esc Pause'
            : 'WASD Fly · Mouse Aim · Click Fire Autocannon · E Thermal Sonar · Esc Pause'}
        </span>
        <span className="hidden sm:inline text-slate-500">ENTER / SPACE TO DEPLOY</span>
      </footer>
    </div>
  );
}
