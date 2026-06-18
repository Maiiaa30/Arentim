/** Persistent footer carrying the mandatory play-money disclaimer. */
export function Footer() {
  return (
    <footer className="border-t border-border bg-bg/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted sm:flex-row">
        <p>
          <span className="font-medium text-text">Arentim</span> · a social game for friends
        </p>
        <p className="rounded-full border border-border px-3 py-1">
          Play money only — no real currency involved.
        </p>
      </div>
    </footer>
  );
}
