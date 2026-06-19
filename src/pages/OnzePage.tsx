import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Eyebrow, RingAvatar, SectionHeader } from '@/components/ui/primitives';
import {
  FORMATIONS,
  type Formation,
  type RunResult,
  dailySeed,
  generateDraft,
  rateXI,
  simulateRun,
} from '@/features/onze/onze';
import { ERA_LABEL, type Line, type Player } from '@/features/onze/players';
import { useOnzeLeaderboard, useSubmitOnzeScore, type OnzeScope } from '@/features/onze/useOnze';

type Mode = 'daily' | 'practice';
type Phase = 'setup' | 'draft' | 'result';

const LINE_ORDER: Line[] = ['FW', 'MF', 'DF', 'GK'];
const LINE_LABEL: Record<Line, string> = { GK: 'Guarda-redes', DF: 'Defesa', MF: 'Meio-campo', FW: 'Ataque' };

function PlayerChip({ p, almanac, onClick, active }: { p: Player; almanac: boolean; onClick?: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`focus-ring flex w-full items-center justify-between gap-2 rounded border px-3 py-2 text-left transition-colors disabled:cursor-default ${
        active ? 'border-gold bg-gold/10' : 'border-border bg-surface hover:border-gold/50'
      }`}
    >
      <span className="min-w-0">
        <span className="block truncate font-sans text-sm text-text">{p.name}</span>
        <span className="font-sans text-[10px] uppercase tracking-wider text-muted-2">
          {p.club} · {ERA_LABEL[p.era]}
        </span>
      </span>
      {!almanac && <span className="shrink-0 font-mono text-sm font-semibold text-gold">{p.rating}</span>}
    </button>
  );
}

function Leaderboard() {
  const [scope, setScope] = useState<OnzeScope>('global');
  const { data } = useOnzeLeaderboard(scope);
  return (
    <div className="space-y-3">
      <SectionHeader
        title="Classificação de hoje"
        right={
          <span className="flex gap-1">
            {(['global', 'friends'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`rounded-full px-2.5 py-0.5 font-sans text-[10px] uppercase tracking-wider ${
                  scope === s ? 'bg-gold text-bg' : 'text-muted-2 hover:text-text'
                }`}
              >
                {s === 'global' ? 'Global' : 'Amigos'}
              </button>
            ))}
          </span>
        }
      />
      <div className="space-y-1">
        {(data ?? []).map((row, i) => (
          <div
            key={row.id}
            className={`flex items-center gap-3 rounded px-3 py-2 ${row.is_me ? 'bg-gold/[0.07]' : ''}`}
          >
            <span className={`w-5 text-right font-display ${i < 3 ? 'text-gold' : 'text-muted-2'}`}>{i + 1}</span>
            <RingAvatar initials={row.display_name.slice(0, 2).toUpperCase()} size={30} tone={i < 3 ? 'gold' : 'muted'} />
            <span className="flex-1 truncate font-sans text-sm text-body">{row.display_name}</span>
            {row.champion && <span title="Campeão 7-0" aria-hidden>🏆</span>}
            <span className="font-mono text-sm text-gold">{row.score}</span>
          </div>
        ))}
        {(!data || data.length === 0) && <p className="px-3 py-2 text-sm text-muted-2">Ainda ninguém jogou hoje.</p>}
      </div>
    </div>
  );
}

export function OnzePage() {
  const [mode, setMode] = useState<Mode>('daily');
  const [almanac, setAlmanac] = useState(false);
  const [formation, setFormation] = useState<Formation>('4-3-3');
  const [phase, setPhase] = useState<Phase>('setup');
  const [seed, setSeed] = useState('');
  const [packs, setPacks] = useState<Player[][]>([]);
  const [picks, setPicks] = useState<(Player | null)[]>([]);
  const [active, setActive] = useState(0);
  const [swaps, setSwaps] = useState(3);
  const [result, setResult] = useState<RunResult | null>(null);

  const submit = useSubmitOnzeScore();
  const submittedFor = useRef<string | null>(null);

  const lines = FORMATIONS[formation];
  const xi = useMemo(() => picks.filter((p): p is Player => p != null), [picks]);
  const liveRating = useMemo(() => rateXI(xi), [xi]);
  const complete = picks.length === 11 && picks.every(Boolean);

  function start() {
    const s = mode === 'daily' ? dailySeed() : `practice-${Math.floor(Math.random() * 1e9)}`;
    setSeed(s);
    setPacks(generateDraft(s, formation));
    setPicks(Array(11).fill(null));
    setActive(0);
    setSwaps(3);
    setResult(null);
    setPhase('draft');
  }

  function choose(p: Player) {
    const wasFilled = picks[active] != null;
    if (wasFilled && picks[active]!.id === p.id) return;
    if (wasFilled && swaps <= 0) return;
    if (wasFilled) setSwaps((s) => s - 1);
    const next = [...picks];
    next[active] = p;
    setPicks(next);
    const nextEmpty = next.findIndex((x) => x == null);
    if (nextEmpty >= 0) setActive(nextEmpty);
  }

  function play() {
    setResult(simulateRun(xi, seed));
    setPhase('result');
  }

  // Submit the daily ranked run once.
  useEffect(() => {
    if (phase !== 'result' || !result || mode !== 'daily') return;
    if (submittedFor.current === seed) return;
    submittedFor.current = seed;
    submit.mutate({
      score: result.score,
      rating: result.rating.total,
      wins: result.wins,
      champion: result.champion,
      record: result.record,
      formation,
      xi: xi.map((p) => p.id),
    });
  }, [phase, result, mode, seed, formation, xi, submit]);

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link to="/sportsbook" className="font-sans text-sm text-muted-2 hover:text-text">← Futebol</Link>
        <Eyebrow className="mt-3">Arentim · Futebol</Eyebrow>
        <h1 className="mt-2 font-display text-[36px] font-medium leading-tight text-text">Onze de Ouro</h1>
        <p className="mt-2 max-w-prose font-sans text-sm text-muted">
          Construa o seu onze português. Escolha um jogador por posição, ganhe química juntando colegas de
          clube e de geração, e veja até onde a sua equipa chega — o objetivo é o <span className="text-gold">7–0</span> contra os lendários.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          {phase === 'setup' && (
            <div className="card space-y-5 p-6">
              <div>
                <p className="mb-2 font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">Modo</p>
                <div className="flex gap-2">
                  {(['daily', 'practice'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`focus-ring flex-1 rounded border py-2.5 font-sans text-sm transition-colors ${
                        mode === m ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted'
                      }`}
                    >
                      {m === 'daily' ? 'Desafio diário' : 'Treino'}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 font-sans text-[11px] text-muted-2">
                  {mode === 'daily'
                    ? 'Mesmo sorteio para todos hoje. Conta para a classificação.'
                    : 'Sorteio aleatório, à vontade. Não conta para a classificação.'}
                </p>
              </div>

              <div>
                <p className="mb-2 font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">Formação</p>
                <div className="flex gap-2">
                  {(Object.keys(FORMATIONS) as Formation[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFormation(f)}
                      className={`focus-ring flex-1 rounded border py-2.5 font-mono text-sm transition-colors ${
                        formation === f ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between">
                <span>
                  <span className="block font-sans text-sm text-text">Modo Almanaque</span>
                  <span className="font-sans text-[11px] text-muted-2">Esconde as notas — confie no seu conhecimento.</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={almanac}
                  onClick={() => setAlmanac((v) => !v)}
                  className={`focus-ring relative h-6 w-11 shrink-0 rounded-full transition-colors ${almanac ? 'bg-gold' : 'bg-border'}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-bg transition-transform ${almanac ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </label>

              <Button variant="primary" onClick={start} className="w-full">Começar a sortear</Button>
            </div>
          )}

          {phase !== 'setup' && (
            <>
              {/* Pitch */}
              <div className="felt felt-rail space-y-3 rounded-lg p-5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-gold-light">{formation}</span>
                  <span className="font-sans text-xs text-muted">
                    {almanac ? 'Almanaque' : `Equipa ${liveRating.total} · Química +${liveRating.chemistry}`}
                  </span>
                </div>
                {LINE_ORDER.map((line) => {
                  const idxs = lines.map((l, i) => (l === line ? i : -1)).filter((i) => i >= 0);
                  if (idxs.length === 0) return null;
                  return (
                    <div key={line} className="flex flex-wrap justify-center gap-2">
                      {idxs.map((i) => {
                        const p = picks[i];
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => phase === 'draft' && setActive(i)}
                            className={`flex h-16 w-[88px] flex-col items-center justify-center rounded border px-1 text-center transition-colors ${
                              active === i && phase === 'draft' ? 'border-gold bg-gold/15' : 'border-gold/25 bg-bg/40'
                            }`}
                          >
                            {p ? (
                              <>
                                <span className="line-clamp-2 font-sans text-[11px] leading-tight text-text">{p.name}</span>
                                {!almanac && <span className="font-mono text-[10px] text-gold">{p.rating}</span>}
                              </>
                            ) : (
                              <span className="font-sans text-[10px] uppercase tracking-wider text-muted-2">{LINE_LABEL[line]}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Draft pack or result */}
              {phase === 'draft' ? (
                <div className="card space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <p className="font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">
                      Escolha — {LINE_LABEL[lines[active]!]}
                    </p>
                    <span className="font-sans text-xs text-muted-2">Trocas: {swaps}</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {packs[active]?.map((p) => (
                      <PlayerChip key={p.id} p={p} almanac={almanac} onClick={() => choose(p)} active={picks[active]?.id === p.id} />
                    ))}
                  </div>
                  <Button variant="primary" onClick={play} disabled={!complete} className="w-full">
                    {complete ? 'Simular a campanha' : `Faltam ${picks.filter((x) => !x).length} jogadores`}
                  </Button>
                </div>
              ) : result ? (
                <div className="card space-y-4 p-6 text-center">
                  <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-muted-2">Resultado</p>
                  <p className={`font-display text-3xl font-bold ${result.champion ? 'text-gold' : 'text-text'}`}>
                    {result.champion ? '✦ 7–0 · CAMPEÃO ✦' : result.record}
                  </p>
                  <p className="font-sans text-sm text-muted">
                    Equipa {result.rating.total} · base {result.rating.base} · química +{result.rating.chemistry} · {result.score} pts
                  </p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {result.rounds.map((r) => (
                      <span
                        key={r.round}
                        title={`Ronda ${r.round} · adv ${r.opponent}${r.boss ? ' (Lendas)' : ''}`}
                        className={`flex h-7 w-7 items-center justify-center rounded text-xs font-bold ${
                          r.win ? 'bg-positive text-bg' : 'bg-negative text-white'
                        } ${r.boss ? 'ring-2 ring-gold' : ''}`}
                      >
                        {r.win ? 'V' : 'D'}
                      </span>
                    ))}
                  </div>
                  {mode === 'daily' && (
                    <p className="font-sans text-xs text-muted-2">
                      {submit.isPending ? 'A submeter…' : 'Resultado submetido à classificação de hoje.'}
                    </p>
                  )}
                  <Button variant="secondary" onClick={() => setPhase('setup')} className="w-full">
                    {mode === 'daily' ? 'Voltar' : 'Jogar outra vez'}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>

        <aside className="lg:pt-2">
          <Leaderboard />
        </aside>
      </div>
    </div>
  );
}
