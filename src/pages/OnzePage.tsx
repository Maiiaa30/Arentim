import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Eyebrow, RingAvatar, SectionHeader } from '@/components/ui/primitives';
import {
  FORMATIONS,
  FORMATION_COORDS,
  YOUR_TEAM,
  type Formation,
  type GamePlayer,
  type Mode,
  type Offer,
  type SeasonResult,
  type SeteResult,
  buildOffers,
  latestIn,
  posEligible,
  predictTable,
  rateXI,
  rosterOf,
  simulateSeason,
  simulateSete,
  standingsAfter,
  yourMatch,
} from '@/features/onze/onze';
import { MAX_YEAR, MIN_YEAR, YEARS, seasonLabel } from '@/features/onze/onzeData';
import { useOnzeLeaderboard, useSubmitOnzeScore, type OnzeScope } from '@/features/onze/useOnze';

type Phase = 'setup' | 'draft' | 'result';

/** Subtle vertical-pitch markings (own goal at the bottom). */
function PitchLines() {
  return (
    <svg viewBox="0 0 100 140" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <g fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth="0.5">
        <rect x="2" y="2" width="96" height="136" rx="1" />
        <line x1="2" y1="70" x2="98" y2="70" />
        <circle cx="50" cy="70" r="11" />
        <circle cx="50" cy="70" r="0.8" fill="rgba(255,255,255,0.2)" />
        {/* bottom box (own goal) */}
        <rect x="26" y="118" width="48" height="20" />
        <rect x="40" y="131" width="20" height="7" />
        {/* top box (attack) */}
        <rect x="26" y="2" width="48" height="20" />
        <rect x="40" y="2" width="20" height="7" />
      </g>
    </svg>
  );
}

function Face({ p, size = 40 }: { p: GamePlayer; size?: number }) {
  const [err, setErr] = useState(false);
  if (p.photo && !err) {
    return <img src={p.photo} alt="" width={size} height={size} loading="lazy" onError={() => setErr(true)} className="shrink-0 rounded-full bg-surface-raised object-cover" style={{ width: size, height: size }} />;
  }
  const initials = p.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || p.name.slice(0, 2).toUpperCase();
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full border border-gold/25 bg-surface-raised font-sans font-medium text-muted" style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}>
      {initials}
    </span>
  );
}

function Leaderboard() {
  const [scope, setScope] = useState<OnzeScope>('global');
  const { data } = useOnzeLeaderboard(scope);
  return (
    <div className="space-y-3">
      <SectionHeader
        title="Classificação"
        right={
          <span className="flex gap-1">
            {(['global', 'friends'] as const).map((s) => (
              <button key={s} onClick={() => setScope(s)} className={`rounded-full px-2.5 py-0.5 font-sans text-[10px] uppercase tracking-wider ${scope === s ? 'bg-gold text-bg' : 'text-muted-2 hover:text-text'}`}>
                {s === 'global' ? 'Global' : 'Amigos'}
              </button>
            ))}
          </span>
        }
      />
      <div className="space-y-1">
        {(data ?? []).map((row, i) => (
          <div key={row.id} className={`flex items-center gap-3 rounded px-3 py-2 ${row.is_me ? 'bg-gold/[0.07]' : ''}`}>
            <span className={`w-5 text-right font-display ${i < 3 ? 'text-gold' : 'text-muted-2'}`}>{i + 1}</span>
            <RingAvatar initials={row.display_name.slice(0, 2).toUpperCase()} size={30} tone={i < 3 ? 'gold' : 'muted'} />
            <span className="flex-1 truncate font-sans text-sm text-body">{row.display_name}</span>
            {row.champion && <span aria-hidden>🏆</span>}
            <span className="font-mono text-sm text-gold">{row.score}</span>
          </div>
        ))}
        {(!data || data.length === 0) && <p className="px-3 py-2 text-sm text-muted-2">Ainda ninguém jogou hoje.</p>}
      </div>
    </div>
  );
}

export function OnzePage() {
  const [mode, setMode] = useState<Mode>('epoca');
  const [formation, setFormation] = useState<Formation>('4-3-3');
  const [startY, setStartY] = useState(MIN_YEAR); // default: use all available seasons
  const [endY, setEndY] = useState(MAX_YEAR);
  const [almanac, setAlmanac] = useState(false);

  const [phase, setPhase] = useState<Phase>('setup');
  const [seed, setSeed] = useState('');
  const [compYear, setCompYear] = useState(MAX_YEAR);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerIdx, setOfferIdx] = useState(0);
  const [picks, setPicks] = useState<(GamePlayer | null)[]>([]);
  const [slotClub, setSlotClub] = useState<(string | null)[]>([]);
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [armed, setArmed] = useState<GamePlayer | null>(null);

  const [sete, setSete] = useState<SeteResult | null>(null);
  const [season, setSeason] = useState<SeasonResult | null>(null);
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(false);

  const submit = useSubmitOnzeScore();
  const submitted = useRef<string | null>(null);

  const slots = FORMATIONS[formation];
  const xi = useMemo(() => picks.filter((p): p is GamePlayer => p != null), [picks]);
  const live = useMemo(() => rateXI(xi), [xi]);
  const complete = picks.length === 11 && picks.every(Boolean);

  const offer = offers[offerIdx];
  const roster = useMemo(() => (offer ? rosterOf(offer) : []), [offer]);
  const openEligible = (p: GamePlayer) => slots.reduce<number[]>((acc, pos, i) => (picks[i] == null && posEligible(pos, p) ? [...acc, i] : acc), []);

  function start() {
    const s = `onze-${Math.floor(Math.random() * 1e9)}`;
    const deck = buildOffers(s, startY, endY);
    const empty: (GamePlayer | null)[] = Array(11).fill(null);
    let first = deck.findIndex((o) => rosterOf(o).some((p) => slots.some((pos, i) => empty[i] == null && posEligible(pos, p))));
    if (first < 0) first = 0;
    setSeed(s);
    setCompYear(latestIn(startY, endY));
    setOffers(deck);
    setOfferIdx(first);
    setPicks(Array(11).fill(null));
    setSlotClub(Array(11).fill(null));
    setUsed(new Set());
    setArmed(null);
    setSete(null);
    setSeason(null);
    setStep(0);
    setAuto(false);
    setPhase('draft');
  }

  // A team is only offered if it has a player who fits an OPEN position — so you
  // can always pick from the team you're shown.
  function teamUsable(o: Offer, ps: (GamePlayer | null)[]): boolean {
    return rosterOf(o).some((p) => slots.some((pos, i) => ps[i] == null && posEligible(pos, p)));
  }
  function findNextTeam(from: number, ps: (GamePlayer | null)[], us: Set<string>): number {
    for (let k = 0; k < offers.length; k++) {
      const idx = (from + k) % offers.length;
      const o = offers[idx]!;
      if (!us.has(o.club) && teamUsable(o, ps)) return idx;
    }
    return -1; // none left (XI full, or nothing can fill the open slots)
  }

  function place(player: GamePlayer, slotIdx: number) {
    if (!offer) return;
    const club = offer.club;
    const newPicks = [...picks]; newPicks[slotIdx] = player;
    const newSlot = [...slotClub]; newSlot[slotIdx] = club;
    const newUsed = new Set(used); newUsed.add(club);
    setPicks(newPicks);
    setSlotClub(newSlot);
    setUsed(newUsed);
    setArmed(null);
    setOfferIdx(findNextTeam(offerIdx + 1, newPicks, newUsed));
  }
  function clearSlot(i: number) {
    const club = slotClub[i];
    const newPicks = [...picks]; newPicks[i] = null;
    const newSlot = [...slotClub]; newSlot[i] = null;
    const newUsed = new Set(used); if (club) newUsed.delete(club);
    setPicks(newPicks);
    setSlotClub(newSlot);
    setUsed(newUsed);
    // If we'd finished (no team showing), bring up a team for the freed slot.
    if (offerIdx < 0) setOfferIdx(findNextTeam(0, newPicks, newUsed));
  }

  function play() {
    if (mode === 'sete') setSete(simulateSete(xi, compYear, seed));
    else { setSeason(simulateSeason(xi, compYear, seed)); setStep(0); }
    setPhase('result');
  }

  useEffect(() => {
    if (!auto || !season) return;
    if (step >= season.jornadas.length) { setAuto(false); return; }
    const t = window.setTimeout(() => setStep((s) => s + 1), 650);
    return () => window.clearTimeout(t);
  }, [auto, step, season]);

  const finalTable = useMemo(() => (season ? standingsAfter(season, season.jornadas.length) : []), [season]);
  const seasonOver = !!season && step >= season.jornadas.length;

  useEffect(() => {
    if (phase !== 'result' || submitted.current === seed) return;
    if (mode === 'sete' && sete) {
      submitted.current = seed;
      submit.mutate({ score: sete.score, rating: sete.rating.total, wins: sete.wins, champion: sete.champion, record: sete.record, formation, xi: xi.map((p) => p.id) });
    } else if (mode === 'epoca' && season && seasonOver) {
      submitted.current = seed;
      const pos = finalTable.findIndex((r) => r.team === YOUR_TEAM) + 1;
      const me = finalTable.find((r) => r.team === YOUR_TEAM)!;
      const champion = pos === 1;
      const score = me.PTS * 5 + (season.teams.length - pos) * 20 + (champion ? 500 : 0) + season.rating.total;
      submit.mutate({ score, rating: season.rating.total, wins: me.W, champion, record: `${pos}º · ${me.PTS} pts`, formation, xi: xi.map((p) => p.id) });
    }
  }, [phase, mode, sete, season, seasonOver, seed, formation, xi, finalTable, submit]);

  const tableUpTo = season ? standingsAfter(season, step) : [];
  const lastMatch = season && step > 0 ? yourMatch(season, step - 1) : null;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link to="/sportsbook" className="font-sans text-sm text-muted-2 hover:text-text">← Futebol</Link>
        <Eyebrow className="mt-3">Arentim · Futebol</Eyebrow>
        <h1 className="mt-2 font-display text-[36px] font-medium leading-tight text-text">Onze de Ouro</h1>
        <p className="mt-2 max-w-prose font-sans text-sm text-muted">
          Aparece-lhe uma equipa de cada vez. Escolha um jogador e depois toque na posição do campo onde
          ele joga — um jogador por clube.
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-5">
          {phase === 'setup' && (
            <div className="card space-y-5 p-6">
              <div>
                <p className="mb-2 font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">Modo de jogo</p>
                <div className="flex gap-2">
                  {([['sete', '7 Jogos'], ['epoca', 'Época completa']] as const).map(([m, label]) => (
                    <button key={m} onClick={() => setMode(m)} className={`focus-ring flex-1 rounded border py-2.5 font-sans text-sm transition-colors ${mode === m ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted'}`}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">De</span>
                  <select value={startY} onChange={(e) => setStartY(Number(e.target.value))} className="focus-ring w-full rounded border border-border bg-surface px-3 py-2 font-mono text-sm text-text">
                    {YEARS.map((y) => <option key={y} value={y}>{seasonLabel(y)}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">Até</span>
                  <select value={endY} onChange={(e) => setEndY(Number(e.target.value))} className="focus-ring w-full rounded border border-border bg-surface px-3 py-2 font-mono text-sm text-text">
                    {YEARS.map((y) => <option key={y} value={y}>{seasonLabel(y)}</option>)}
                  </select>
                </label>
              </div>
              <div>
                <p className="mb-2 font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">Tática</p>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(FORMATIONS) as Formation[]).map((f) => (
                    <button key={f} onClick={() => setFormation(f)} className={`focus-ring rounded border py-2.5 font-mono text-sm transition-colors ${formation === f ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted'}`}>{f}</button>
                  ))}
                </div>
              </div>
              <label className="flex items-center justify-between">
                <span className="font-sans text-sm text-text">Modo Almanaque <span className="text-muted-2">· esconde as notas</span></span>
                <button type="button" role="switch" aria-checked={almanac} onClick={() => setAlmanac((v) => !v)} className={`focus-ring relative h-6 w-11 shrink-0 rounded-full transition-colors ${almanac ? 'bg-gold' : 'bg-border'}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-bg transition-transform ${almanac ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </label>
              <Button variant="primary" onClick={start} className="w-full">Começar</Button>
            </div>
          )}

          {phase !== 'setup' && (
            <div className="grid gap-5 lg:grid-cols-[minmax(360px,440px)_minmax(0,1fr)] lg:items-start">
              {/* Pitch (left) — each slot sits at its real position on the field. */}
              <div className="felt felt-rail w-full rounded-lg p-3 sm:p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-xs text-gold-light">{formation}</span>
                  <span className="font-sans text-xs text-muted">{almanac ? 'Almanaque' : `Equipa ${live.total} · Química +${live.chemistry}`}</span>
                </div>
                <div className="relative mx-auto w-full" style={{ aspectRatio: '5 / 7' }}>
                  <PitchLines />
                  {slots.map((pos, i) => {
                    const p = picks[i];
                    const c = FORMATION_COORDS[formation][i]!;
                    const canPlace = phase === 'draft' && !!armed && !p && posEligible(pos, armed);
                    const dim = phase === 'draft' && !!armed && !p && !posEligible(pos, armed);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          if (phase !== 'draft') return;
                          if (armed) { if (canPlace) place(armed, i); }
                          else if (p) clearSlot(i);
                        }}
                        title={canPlace ? 'Colocar aqui' : p ? 'Tocar para remover' : pos}
                        style={{ left: `${c.x}%`, top: `${c.y}%` }}
                        className="absolute flex w-[18%] min-w-[52px] max-w-[68px] -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                      >
                        <span className={`flex aspect-square w-full items-center justify-center rounded-full border-2 transition-all ${
                          canPlace ? 'animate-glow cursor-pointer border-gold bg-gold/25'
                          : dim ? 'border-border/20 bg-bg/20 opacity-30'
                          : p ? 'border-gold/50 bg-bg/70 hover:border-negative/60'
                          : 'border-dashed border-gold/30 bg-bg/30'
                        }`}>
                          {p ? <Face p={p} size={34} /> : <span className="font-display text-sm font-medium text-muted-2">{pos}</span>}
                        </span>
                        {p ? (
                          <span className="mt-0.5 w-full rounded bg-black/55 px-1 text-center">
                            <span className="block truncate font-sans text-[10px] leading-tight text-text">{p.name}</span>
                            {!almanac && <span className="font-mono text-[9px] font-semibold text-gold">{p.rating}{p.year ? ` · ${seasonLabel(p.year)}` : ''}</span>}
                          </span>
                        ) : (
                          <span className="mt-0.5 font-mono text-[8px] font-semibold uppercase tracking-wider text-gold/70">{pos}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {phase === 'draft' ? (
                <div className="card space-y-3 p-4 sm:p-5">
                  {offer && (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate font-sans text-sm font-medium text-text">
                          A tua equipa: {offer.club} <span className="font-mono text-gold">· {seasonLabel(offer.year)}</span>
                        </p>
                        <span className="shrink-0 font-sans text-[10px] uppercase tracking-wider text-muted-2">{xi.length}/11</span>
                      </div>

                      {armed ? (
                        <div className="flex items-center justify-between gap-2 rounded border border-gold/40 bg-gold/10 px-3 py-2">
                          <span className="min-w-0 truncate font-sans text-xs text-gold">Toque na posição realçada para <span className="font-semibold">{armed.name}</span>.</span>
                          <button onClick={() => setArmed(null)} className="focus-ring shrink-0 font-sans text-[11px] text-muted-2 hover:text-text">cancelar</button>
                        </div>
                      ) : (
                        <p className="font-sans text-[11px] text-muted-2">Escolha um jogador — só pode tirar um de cada clube.</p>
                      )}

                      <div className="grid max-h-[460px] gap-2 overflow-y-auto sm:grid-cols-2">
                        {roster.map((p) => {
                          const usable = openEligible(p).length > 0;
                          const isArmed = armed?.id === p.id;
                          return (
                            <button
                              key={p.id}
                              onClick={() => usable && setArmed((cur) => (cur?.id === p.id ? null : p))}
                              disabled={!usable}
                              title={usable ? `Pode jogar: ${openEligible(p).map((i) => slots[i]).join(', ')}` : 'Não encaixa em nenhuma posição livre'}
                              className={`focus-ring flex items-center gap-2 rounded border px-3 py-2 text-left transition-colors ${
                                isArmed ? 'border-gold bg-gold/15' : usable ? 'border-border bg-surface hover:border-gold/50' : 'cursor-not-allowed border-border/40 bg-surface/40 opacity-45'
                              }`}
                            >
                              <Face p={p} size={34} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-sans text-sm text-text">{p.name}</span>
                                <span className="font-sans text-[10px] uppercase tracking-wider text-muted-2">{p.pos}{p.nat ? ` · ${p.nat}` : ''}</span>
                              </span>
                              {!almanac && <span className="shrink-0 font-mono text-sm font-semibold text-gold">{p.rating}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                  <Button variant="primary" onClick={play} disabled={!complete} className="w-full">
                    {complete ? (mode === 'sete' ? 'Jogar os 7 jogos' : 'Iniciar a época') : `Faltam ${picks.filter((x) => !x).length} jogadores`}
                  </Button>
                </div>
              ) : mode === 'sete' && sete ? (
                <div className="card space-y-4 p-6 text-center">
                  <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-muted-2">Resultado</p>
                  <p className={`font-display text-3xl font-bold ${sete.champion ? 'text-gold' : 'text-text'}`}>{sete.champion ? '✦ 7–0 · CAMPEÃO ✦' : sete.record}</p>
                  <p className="font-sans text-sm text-muted">Equipa {sete.rating.total} · química +{sete.rating.chemistry} · {sete.score} pts</p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {sete.rounds.map((r) => (
                      <span key={r.round} title={`${r.opponent} (${r.opponentRating})${r.boss ? ' · Lendas' : ''}`} className={`flex h-7 w-7 items-center justify-center rounded text-xs font-bold ${r.win ? 'bg-positive text-bg' : 'bg-negative text-white'} ${r.boss ? 'ring-2 ring-gold' : ''}`}>{r.win ? 'V' : 'D'}</span>
                    ))}
                  </div>

                  {/* The XI you fielded, with each player's rating. */}
                  <div className="border-t border-border pt-4 text-left">
                    <p className="mb-2 text-center font-sans text-[10px] uppercase tracking-[0.3em] text-muted-2">O teu onze</p>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                      {[...xi].sort((a, b) => b.rating - a.rating).map((p) => (
                        <div key={p.id} className="flex items-center gap-2 rounded border border-border bg-surface px-2 py-1.5">
                          <Face p={p} size={26} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-sans text-[11px] text-text">{p.name}</span>
                            <span className="font-sans text-[9px] uppercase tracking-wider text-muted-2">{p.pos}</span>
                          </span>
                          <span className="shrink-0 font-mono text-sm font-semibold text-gold">{p.rating}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button variant="secondary" onClick={() => setPhase('setup')} className="w-full">Jogar outra vez</Button>
                </div>
              ) : season ? (
                <div className="min-w-0">
                  <SeasonView
                    season={season} step={step} auto={auto} over={seasonOver} table={tableUpTo} lastMatch={lastMatch}
                    predicted={predictTable(season)}
                    onNext={() => setStep((s) => Math.min(season.jornadas.length, s + 1))}
                    onAuto={() => setAuto((v) => !v)}
                    onSkip={() => { setAuto(false); setStep(season.jornadas.length); }}
                    onAgain={() => setPhase('setup')}
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Leaderboard moved to the bottom, full-width. */}
        <div className="mx-auto w-full max-w-2xl border-t border-border pt-5"><Leaderboard /></div>
      </div>
    </div>
  );
}

function SeasonView({
  season, step, auto, over, table, lastMatch, predicted, onNext, onAuto, onSkip, onAgain,
}: {
  season: SeasonResult; step: number; auto: boolean; over: boolean;
  table: ReturnType<typeof standingsAfter>; lastMatch: ReturnType<typeof yourMatch>;
  predicted: ReturnType<typeof predictTable>;
  onNext: () => void; onAuto: () => void; onSkip: () => void; onAgain: () => void;
}) {
  const total = season.jornadas.length;
  const myPos = over ? table.findIndex((r) => r.team === YOUR_TEAM) + 1 : 0;
  const myExpected = predicted.find((r) => r.team === YOUR_TEAM)?.pos ?? 0;
  const [view, setView] = useState<'tabela' | 'prog'>('tabela');
  return (
    <div className="card space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">{over ? 'Época terminada' : `Jornada ${step} / ${total}`}</span>
        {!over ? (
          <div className="flex gap-2">
            <Button variant="primary" onClick={onNext} className="!px-3 !py-1.5 text-xs" disabled={auto}>Seguinte ▸</Button>
            <Button variant="secondary" onClick={onAuto} className="!px-3 !py-1.5 text-xs">{auto ? '⏸ Parar' : 'Auto ▸▸'}</Button>
            <Button variant="ghost" onClick={onSkip} className="!px-3 !py-1.5 text-xs">Saltar</Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={onAgain} className="!px-3 !py-1.5 text-xs">Jogar outra vez</Button>
        )}
      </div>
      {over ? (
        <p className={`text-center font-display text-2xl font-bold ${myPos === 1 ? 'text-gold' : 'text-text'}`}>{myPos === 1 ? '🏆 Campeão da Liga!' : `${myPos}.º lugar`}</p>
      ) : lastMatch ? (
        <div key={step} className="animate-pop rounded border border-border bg-surface p-3 text-center">
          <p className="font-sans text-[9px] uppercase tracking-[0.3em] text-muted-2">O teu jogo</p>
          <p className="mt-1 font-display text-lg font-medium text-text">
            <span className={lastMatch.home === YOUR_TEAM ? 'text-gold' : ''}>{lastMatch.home}</span>
            <span className="px-2 font-bold">{lastMatch.hs} – {lastMatch.as}</span>
            <span className={lastMatch.away === YOUR_TEAM ? 'text-gold' : ''}>{lastMatch.away}</span>
          </p>
          {lastMatch.scorers.length > 0 && <p className="mt-1 font-sans text-[11px] text-muted-2">{lastMatch.scorers.map((s) => `${s.minute}' ${s.name}`).join(' · ')}</p>}
        </div>
      ) : (
        <p className="py-1 text-center font-sans text-sm text-muted-2">
          Prognóstico antes do apito inicial — o teu XI parte como{' '}
          <span className="font-semibold text-gold">{myExpected}.º favorito</span>. Carregue em Seguinte para começar.
        </p>
      )}

      {/* Ranking — available at any time: live table or the pre-season prediction. */}
      <div>
        <div className="mb-2 flex gap-1.5">
          {([['tabela', 'Classificação'], ['prog', 'Prognóstico']] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setView(k)}
              className={`focus-ring rounded-full px-3 py-1 font-sans text-[11px] font-medium uppercase tracking-wider transition-colors ${
                view === k ? 'bg-gold text-bg' : 'border border-border text-muted-2 hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded border border-border">
          {view === 'tabela' ? (
            <>
              <div className="grid grid-cols-[26px_1fr_40px_30px_38px] gap-1.5 border-b border-border bg-surface px-3 py-1.5 font-sans text-[9px] uppercase tracking-wider text-muted-2">
                <span>#</span><span>Clube</span><span className="text-right">DG</span><span className="text-right">J</span><span className="text-right">Pts</span>
              </div>
              <div className="max-h-[440px] overflow-y-auto">
                {table.map((r, i) => (
                  <div key={r.team} className={`grid grid-cols-[26px_1fr_40px_30px_38px] items-center gap-1.5 border-b border-border/50 px-3 py-1.5 text-sm ${r.team === YOUR_TEAM ? 'bg-gold/[0.1]' : ''}`}>
                    <span className={`font-display ${i < 4 ? 'text-positive' : i >= table.length - 3 ? 'text-negative' : 'text-muted-2'}`}>{i + 1}</span>
                    <span className={`truncate font-sans ${r.team === YOUR_TEAM ? 'font-semibold text-gold' : 'text-body'}`}>{r.team}</span>
                    <span className="text-right font-mono text-xs text-muted-2">{r.GD > 0 ? `+${r.GD}` : r.GD}</span>
                    <span className="text-right font-mono text-xs text-muted-2">{r.P}</span>
                    <span className="text-right font-mono font-semibold text-text">{r.PTS}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-[26px_1fr_48px] gap-1.5 border-b border-border bg-surface px-3 py-1.5 font-sans text-[9px] uppercase tracking-wider text-muted-2">
                <span>#</span><span>Classificação esperada</span><span className="text-right">Força</span>
              </div>
              <div className="max-h-[440px] overflow-y-auto">
                {predicted.map((r) => (
                  <div key={r.team} className={`grid grid-cols-[26px_1fr_48px] items-center gap-1.5 border-b border-border/50 px-3 py-1.5 text-sm ${r.team === YOUR_TEAM ? 'bg-gold/[0.1]' : ''}`}>
                    <span className={`font-display ${r.pos <= 4 ? 'text-positive' : r.pos > predicted.length - 3 ? 'text-negative' : 'text-muted-2'}`}>{r.pos}</span>
                    <span className={`truncate font-sans ${r.team === YOUR_TEAM ? 'font-semibold text-gold' : 'text-body'}`}>{r.team}</span>
                    <span className="text-right font-mono text-xs text-gold">{r.rating}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
