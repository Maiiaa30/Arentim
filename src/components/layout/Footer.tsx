/** Persistent footer carrying the mandatory play-money disclaimer (PT-PT). */
export function Footer() {
  return (
    <footer className="border-t border-border bg-bg/60">
      <div className="mx-auto flex max-w-[1480px] flex-col items-center justify-between gap-2 px-5 py-5 text-xs text-muted-2 sm:flex-row sm:px-9">
        <p className="font-sans">
          <span className="font-display text-sm text-text">Arentim</span> · casa de jogos entre amigos
        </p>
        <p className="rounded-full border border-border px-3 py-1 font-sans tracking-wide">
          Apenas dinheiro de brincadeira — sem moeda real.
        </p>
      </div>
    </footer>
  );
}
