import type { GamePhase, HudSnapshot } from '../game/types';

interface StatusModalProps {
  phase: GamePhase;
  hud: HudSnapshot;
  isMultiplayer: boolean;
  isHost: boolean;
  onResume: () => void;
  onRestart: () => void;
  onNextTagRound: () => void;
  onReturnTitle: () => void;
}

export function StatusModal({
  phase,
  hud,
  isMultiplayer,
  isHost,
  onResume,
  onRestart,
  onNextTagRound,
  onReturnTitle,
}: StatusModalProps) {
  if (phase !== 'paused' && phase !== 'gameover') return null;

  if (phase === 'paused') {
    return (
      <div
        className="fixed inset-0 z-30 flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(6, 10, 16, 0.78)' }}
        role="dialog"
        aria-modal="true"
        aria-label="Game Paused"
      >
        <div className="hud-chamfer w-full max-w-sm bg-[#0c1320] border border-slate-700 p-6 flex flex-col gap-5">
          <div>
            <div className="text-[11px] font-mono-hud tracking-[0.22em] text-amber-400">
              {hud.districtName} · RD {hud.roundNumber}
            </div>
            <h2 className="font-display font-bold text-2xl tracking-[0.14em] text-white mt-1">
              OPERATION PAUSED
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-[#070b13] border border-slate-800 p-3">
              <div className="text-[10px] font-mono-hud text-slate-400">TIME LEFT</div>
              <div className="font-mono-hud font-bold text-xl text-amber-300 mt-0.5">
                {hud.timeRemaining}s
              </div>
            </div>
            <div className="bg-[#070b13] border border-slate-800 p-3">
              <div className="text-[10px] font-mono-hud text-slate-400">COVER INTACT</div>
              <div className="font-mono-hud font-bold text-xl text-sky-300 mt-0.5">
                {hud.coversIntact}/{hud.coversTotal}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onResume}
              className="hud-chamfer-sm w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm tracking-[0.16em] py-3 cursor-pointer"
            >
              RESUME
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-display font-bold text-xs tracking-[0.16em] py-2.5 cursor-pointer"
            >
              RESTART ROUND
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="w-full bg-transparent hover:bg-slate-900 text-slate-400 hover:text-slate-200 font-mono-hud text-xs tracking-[0.16em] py-2 cursor-pointer"
            >
              RETURN TO TITLE
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Victory / Game Over Outcome Card
  const localWon =
    (hud.role === 'runner' && hud.outcome === 'runner_extracted') ||
    (hud.role === 'drone' && hud.outcome !== 'runner_extracted');

  const headline =
    hud.outcome === 'runner_extracted'
      ? hud.role === 'runner'
        ? 'EXTRACTION COMPLETE'
        : 'TARGET ESCAPED'
      : hud.outcome === 'runner_eliminated'
        ? hud.role === 'drone'
          ? 'TARGET NEUTRALIZED'
          : 'TAGGED BY DRONE'
        : hud.role === 'drone'
          ? 'SECTOR LOCKED DOWN'
          : 'EXTRACTION WINDOW CLOSED';

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(6, 10, 16, 0.82)' }}
      role="dialog"
      aria-modal="true"
      aria-label={localWon ? 'Round Victory' : 'Round Defeat'}
    >
      <div
        className={`hud-chamfer w-full max-w-md bg-[#0c1320] border p-6 flex flex-col gap-5 ${
          localWon ? 'border-emerald-400/80' : 'border-rose-500/80'
        }`}
      >
        <div>
          <div
            className={`text-[11px] font-mono-hud tracking-[0.22em] font-bold ${
              localWon ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            ROUND {hud.roundNumber} · {localWon ? 'VICTORY' : 'DEFEAT'}
          </div>
          <h2 className="font-display font-bold text-2xl tracking-[0.12em] text-white mt-1">
            {headline}
          </h2>
          <p className="text-xs font-mono-hud text-slate-400 mt-1">
            SCORE · RUNNER {hud.runnerScore} — {hud.droneScore} DRONE
          </p>
        </div>

        {/* 3 Tabular Mastery / Progress Tiles */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#070b13] border border-slate-800 p-3">
            <div className="text-[10px] font-mono-hud text-slate-400">TIME</div>
            <div className="font-mono-hud font-bold text-lg text-slate-100 mt-0.5">
              {hud.clearTime}s
            </div>
          </div>
          <div className="bg-[#070b13] border border-slate-800 p-3">
            <div className="text-[10px] font-mono-hud text-slate-400">COVER LOST</div>
            <div className="font-mono-hud font-bold text-lg text-amber-300 mt-0.5">
              {hud.coversDestroyedCount}
            </div>
          </div>
          <div className="bg-[#070b13] border border-slate-800 p-3">
            <div className="text-[10px] font-mono-hud text-slate-400">
              {hud.role === 'runner' ? 'DMG TAKEN' : 'EVAC HELD'}
            </div>
            <div className="font-mono-hud font-bold text-lg text-sky-300 mt-0.5">
              {hud.role === 'runner' ? `${hud.damageTaken}` : `${hud.extractionProgress}%`}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {(!isMultiplayer || isHost) && (
            <button
              type="button"
              data-start="true"
              onClick={onNextTagRound}
              className="hud-chamfer-sm w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm tracking-[0.15em] py-3.5 cursor-pointer"
            >
              SWAP SIDES &amp; NEXT TAG ROUND
            </button>
          )}
          {!isMultiplayer && (
            <button
              type="button"
              onClick={onRestart}
              className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-display font-bold text-xs tracking-[0.16em] py-2.5 cursor-pointer"
            >
              PLAY SAME SIDE AGAIN
            </button>
          )}
          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full bg-transparent hover:bg-slate-900 text-slate-400 hover:text-slate-200 font-mono-hud text-xs tracking-[0.16em] py-2 cursor-pointer"
          >
            RETURN TO TITLE
          </button>
        </div>
      </div>
    </div>
  );
}
