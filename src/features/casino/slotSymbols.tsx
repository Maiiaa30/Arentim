import { useId } from 'react';

/**
 * Hand-drawn SVG art for every slot symbol, keyed by the symbol id the server
 * sends. Each value is the inner markup of a 0 0 100 100 viewBox. Vector, tiny,
 * no downloads, CSP-safe. Unknown ids fall back to the emoji glyph so nothing
 * ever renders blank.
 */
// eslint-disable-next-line react-refresh/only-export-components -- data table colocated with its renderer
export const SYMBOL_SVG: Record<string, string> = {
  cherry: `
    <defs><radialGradient id="chy" cx="38%" cy="35%" r="70%"><stop offset="0" stop-color="#ef6b73"/><stop offset="55%" stop-color="#b0303a"/><stop offset="100%" stop-color="#7a1f27"/></radialGradient></defs>
    <path d="M52 22 C58 34 78 36 80 54" fill="none" stroke="#1f8a5b" stroke-width="4" stroke-linecap="round"/>
    <path d="M52 22 C46 36 30 40 30 58" fill="none" stroke="#1f8a5b" stroke-width="4" stroke-linecap="round"/>
    <path d="M52 22 C62 12 80 12 88 20 C76 24 64 22 52 28 Z" fill="#2fae6b"/>
    <circle cx="30" cy="70" r="17" fill="url(#chy)"/>
    <circle cx="72" cy="66" r="17" fill="url(#chy)"/>
    <circle cx="25" cy="64" r="4.5" fill="#ffd2d2" opacity="0.8"/>
    <circle cx="67" cy="60" r="4.5" fill="#ffd2d2" opacity="0.8"/>`,
  lemon: `
    <defs><radialGradient id="lem" cx="40%" cy="35%" r="75%"><stop offset="0" stop-color="#fff2a8"/><stop offset="55%" stop-color="#f4c93b"/><stop offset="100%" stop-color="#c2900f"/></radialGradient></defs>
    <ellipse cx="50" cy="56" rx="34" ry="26" fill="url(#lem)" transform="rotate(-18 50 56)"/>
    <path d="M50 24 C58 22 66 26 70 32 C62 30 56 30 50 32 Z" fill="#2fae6b"/>
    <ellipse cx="40" cy="46" rx="9" ry="5" fill="#fff7cf" opacity="0.7" transform="rotate(-18 40 46)"/>`,
  bell: `
    <defs><linearGradient id="bel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7e4ad"/><stop offset="55%" stop-color="#C9A24B"/><stop offset="100%" stop-color="#8a6c2c"/></linearGradient></defs>
    <circle cx="50" cy="20" r="6" fill="#8a6c2c"/>
    <path d="M50 22 C30 24 30 44 26 64 C24 72 18 74 18 80 L82 80 C82 74 76 72 74 64 C70 44 70 24 50 22 Z" fill="url(#bel)" stroke="#6b542a" stroke-width="2"/>
    <ellipse cx="40" cy="44" rx="6" ry="14" fill="#fff3cf" opacity="0.45"/>
    <circle cx="50" cy="88" r="7" fill="#8a6c2c"/>`,
  star: `
    <defs><linearGradient id="str" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset="55%" stop-color="#e7b73d"/><stop offset="100%" stop-color="#a9802a"/></linearGradient></defs>
    <path d="M50 8 L61 38 L94 38 L67 58 L77 90 L50 70 L23 90 L33 58 L6 38 L39 38 Z" fill="url(#str)" stroke="#7a5e1f" stroke-width="2" stroke-linejoin="round"/>
    <path d="M50 18 L57 40 L46 40 Z" fill="#fff6d8" opacity="0.6"/>`,
  seven: `
    <defs><linearGradient id="sev" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset="55%" stop-color="#e7b73d"/><stop offset="100%" stop-color="#a9802a"/></linearGradient></defs>
    <path d="M22 20 L80 20 L80 34 L54 88 L34 88 L60 34 L22 34 Z" fill="url(#sev)" stroke="#b0303a" stroke-width="3" stroke-linejoin="round"/>`,
  melon: `
    <defs><linearGradient id="mel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a86"/><stop offset="100%" stop-color="#d83a4a"/></linearGradient></defs>
    <path d="M14 30 A46 46 0 0 0 86 30 Z" fill="url(#mel)"/>
    <path d="M14 30 L88 30 L84 24 L16 24 Z" fill="#2fae6b"/>
    <path d="M16 24 L84 24 L82 20 L18 20 Z" fill="#176b43"/>
    <circle cx="40" cy="44" r="3" fill="#3a1518"/><circle cx="55" cy="50" r="3" fill="#3a1518"/><circle cx="50" cy="38" r="3" fill="#3a1518"/><circle cx="63" cy="40" r="3" fill="#3a1518"/>`,
  grape: `
    <defs><radialGradient id="grp" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#c79be8"/><stop offset="60%" stop-color="#8a44c0"/><stop offset="100%" stop-color="#4f2080"/></radialGradient></defs>
    <path d="M52 20 C56 28 66 28 72 24" fill="none" stroke="#6b4a2a" stroke-width="4" stroke-linecap="round"/>
    <path d="M72 22 C82 14 92 18 92 26 C84 26 80 24 72 30 Z" fill="#2fae6b"/>
    <g fill="url(#grp)">
      <circle cx="40" cy="40" r="11"/><circle cx="60" cy="40" r="11"/>
      <circle cx="30" cy="56" r="11"/><circle cx="50" cy="56" r="11"/><circle cx="70" cy="56" r="11"/>
      <circle cx="40" cy="72" r="11"/><circle cx="60" cy="72" r="11"/>
      <circle cx="50" cy="86" r="11"/>
    </g>
    <circle cx="37" cy="37" r="3.5" fill="#e9d3f7" opacity="0.8"/>`,
  orange: `
    <defs><radialGradient id="org" cx="38%" cy="34%" r="72%"><stop offset="0" stop-color="#ffd27a"/><stop offset="55%" stop-color="#ff8c1a"/><stop offset="100%" stop-color="#c25e00"/></radialGradient></defs>
    <circle cx="50" cy="58" r="32" fill="url(#org)"/>
    <path d="M50 30 C58 26 66 28 70 34 C62 32 56 32 50 36 Z" fill="#2fae6b"/>
    <ellipse cx="40" cy="48" rx="8" ry="5" fill="#ffe7bf" opacity="0.6"/>`,
  straw: `
    <defs><radialGradient id="stb" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#ff7a86"/><stop offset="55%" stop-color="#d8324a"/><stop offset="100%" stop-color="#8f1626"/></radialGradient></defs>
    <path d="M50 30 C24 34 26 58 50 90 C74 58 76 34 50 30 Z" fill="url(#stb)"/>
    <path d="M50 22 C42 22 36 26 32 32 C40 30 44 32 50 36 C56 32 60 30 68 32 C64 26 58 22 50 22 Z" fill="#2fae6b"/>
    <g fill="#ffe39a"><circle cx="44" cy="46" r="2"/><circle cx="56" cy="46" r="2"/><circle cx="50" cy="56" r="2"/><circle cx="40" cy="58" r="2"/><circle cx="60" cy="58" r="2"/><circle cx="50" cy="70" r="2"/></g>`,
  gem: `
    <defs><linearGradient id="gemg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cdeeff"/><stop offset="50%" stop-color="#5aa9e6"/><stop offset="100%" stop-color="#1f5d96"/></linearGradient></defs>
    <path d="M28 26 L72 26 L88 44 L50 90 L12 44 Z" fill="url(#gemg)" stroke="#9fe0ff" stroke-width="1.5"/>
    <path d="M28 26 L40 44 L12 44 Z" fill="#bfe6ff" opacity="0.85"/>
    <path d="M72 26 L60 44 L88 44 Z" fill="#9fcff0" opacity="0.7"/>
    <path d="M40 44 L60 44 L50 90 Z" fill="#2b6fae" opacity="0.6"/>
    <path d="M40 44 L60 44 L72 26 L28 26 Z" fill="#7fc0ee" opacity="0.5"/>`,
  sardine: `
    <defs><linearGradient id="sar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="55%" stop-color="#c2ccd4"/><stop offset="100%" stop-color="#7e8d99"/></linearGradient></defs>
    <path d="M14 50 C30 30 64 30 80 50 C64 70 30 70 14 50 Z" fill="url(#sar)" stroke="#6b7884" stroke-width="2"/>
    <path d="M80 50 L94 38 L92 50 L94 62 Z" fill="#9aa7b2"/>
    <path d="M44 32 L52 22 L56 34 Z" fill="#aab6c0"/>
    <circle cx="30" cy="48" r="4" fill="#2a323a"/>
    <path d="M40 50 q10 -8 22 0 q-10 8 -22 0" fill="#ffffff" opacity="0.5"/>`,
  olive: `
    <defs><radialGradient id="olv" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#9ed16a"/><stop offset="60%" stop-color="#5a8a2c"/><stop offset="100%" stop-color="#33571a"/></radialGradient></defs>
    <path d="M26 30 C40 40 60 44 78 38" fill="none" stroke="#5a8a2c" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="38" cy="60" rx="13" ry="18" fill="url(#olv)"/>
    <ellipse cx="62" cy="54" rx="13" ry="18" fill="url(#olv)"/>
    <circle cx="62" cy="54" r="4" fill="#b0303a"/>
    <ellipse cx="34" cy="54" rx="3" ry="6" fill="#d3edae" opacity="0.6"/>`,
  wine: `
    <defs><linearGradient id="win" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e0555f"/><stop offset="100%" stop-color="#8f1626"/></linearGradient></defs>
    <path d="M32 18 L68 18 C68 42 60 52 50 52 C40 52 32 42 32 18 Z" fill="#16120b" stroke="#C9A24B" stroke-width="2"/>
    <path d="M35 21 L65 21 C65 40 58 49 50 49 C42 49 35 40 35 21 Z" fill="url(#win)"/>
    <rect x="48" y="52" width="4" height="26" fill="#C9A24B"/>
    <rect x="34" y="80" width="32" height="5" rx="2" fill="#C9A24B"/>
    <ellipse cx="42" cy="30" rx="3" ry="7" fill="#ff9aa2" opacity="0.5"/>`,
  galo: `
    <defs><linearGradient id="glb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2b2b"/><stop offset="100%" stop-color="#000"/></linearGradient></defs>
    <path d="M40 22 C44 18 50 20 50 26 C56 20 62 24 60 30 C66 26 70 32 66 38 Z" fill="#b0303a"/>
    <path d="M50 34 C34 34 26 48 28 64 C30 80 42 86 54 84 C70 82 76 70 74 56 C72 44 64 34 50 34 Z" fill="url(#glb)"/>
    <path d="M28 64 C18 66 14 76 18 86 C24 84 30 82 34 78 Z" fill="#1f8a5b"/>
    <path d="M40 60 C30 66 24 78 26 90 C34 84 42 78 46 70 Z" fill="#C9A24B"/>
    <circle cx="44" cy="46" r="3.5" fill="#fff"/><circle cx="44" cy="46" r="1.8" fill="#000"/>
    <path d="M30 50 L18 48 L30 56 Z" fill="#e7b73d"/>
    <path d="M30 56 L20 60 L31 62 Z" fill="#b0303a"/>`,
  coin: `
    <defs><radialGradient id="coi" cx="40%" cy="35%" r="72%"><stop offset="0" stop-color="#fff0b8"/><stop offset="55%" stop-color="#e7b73d"/><stop offset="100%" stop-color="#9a7322"/></radialGradient></defs>
    <circle cx="50" cy="52" r="34" fill="url(#coi)" stroke="#7a5e1f" stroke-width="3"/>
    <circle cx="50" cy="52" r="26" fill="none" stroke="#b8902f" stroke-width="2"/>
    <path d="M50 36 L56 49 L70 49 L59 58 L63 72 L50 63 L37 72 L41 58 L30 49 L44 49 Z" fill="#a9802a"/>
    <ellipse cx="40" cy="40" rx="7" ry="4" fill="#fff7d6" opacity="0.6"/>`,
  parrot: `
    <defs><linearGradient id="par" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3fd07a"/><stop offset="100%" stop-color="#177a44"/></linearGradient></defs>
    <path d="M58 22 C36 22 26 40 28 60 C30 78 44 86 58 84 L58 22 Z" fill="url(#par)"/>
    <path d="M58 20 C74 22 82 34 80 48 C78 60 70 64 58 62 Z" fill="#e0555f"/>
    <circle cx="50" cy="40" r="5" fill="#fff"/><circle cx="50" cy="40" r="2.5" fill="#000"/>
    <path d="M40 46 C28 44 22 50 22 56 C30 56 36 54 42 52 Z" fill="#f4c93b"/>
    <path d="M58 62 C66 70 64 82 56 88 C54 80 54 72 58 66 Z" fill="#2b7fd0"/>`,
  anchor: `
    <defs><linearGradient id="anc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef2f5"/><stop offset="100%" stop-color="#8a98a3"/></linearGradient></defs>
    <g fill="none" stroke="url(#anc)" stroke-width="7" stroke-linecap="round">
      <circle cx="50" cy="22" r="8" fill="none"/>
      <line x1="50" y1="30" x2="50" y2="82"/>
      <line x1="34" y1="44" x2="66" y2="44"/>
      <path d="M24 60 C24 80 40 86 50 86 C60 86 76 80 76 60"/>
    </g>
    <path d="M50 86 L42 78 L58 78 Z" fill="#cfd6dc"/>`,
  map: `
    <defs><linearGradient id="mpp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0dcae"/><stop offset="100%" stop-color="#c89b6a"/></linearGradient></defs>
    <path d="M18 24 L82 20 L84 78 L16 82 Z" fill="url(#mpp)" stroke="#8a5a2c" stroke-width="2"/>
    <path d="M30 64 C36 50 30 44 40 38 C50 34 52 46 62 42" fill="none" stroke="#6b4a2a" stroke-width="2.5" stroke-dasharray="4 4"/>
    <path d="M58 38 L70 50 M70 38 L58 50" stroke="#b0303a" stroke-width="4" stroke-linecap="round"/>
    <circle cx="30" cy="64" r="3" fill="#6b4a2a"/>`,
  chest: `
    <defs><linearGradient id="chs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a86a34"/><stop offset="100%" stop-color="#5a3a1c"/></linearGradient></defs>
    <path d="M20 44 C20 32 80 32 80 44 L80 50 L20 50 Z" fill="#8a5a2c"/>
    <rect x="20" y="50" width="60" height="34" rx="3" fill="url(#chs)"/>
    <rect x="20" y="44" width="60" height="8" fill="#C9A24B"/>
    <rect x="20" y="62" width="60" height="6" fill="#C9A24B"/>
    <rect x="44" y="56" width="12" height="16" rx="2" fill="#e7b73d"/>
    <circle cx="50" cy="62" r="2.5" fill="#5a3a1c"/>
    <circle cx="34" cy="40" r="4" fill="#ffe39a"/><circle cx="62" cy="38" r="4" fill="#ffe39a"/><circle cx="50" cy="36" r="4" fill="#fff0b8"/>`,
  skull: `
    <defs><radialGradient id="skl" cx="42%" cy="35%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset="100%" stop-color="#cdd3d8"/></radialGradient></defs>
    <path d="M50 18 C28 18 18 34 18 50 C18 60 24 66 30 70 L30 80 L70 80 L70 70 C76 66 82 60 82 50 C82 34 72 18 50 18 Z" fill="url(#skl)"/>
    <circle cx="37" cy="48" r="9" fill="#1a1a1a"/><circle cx="63" cy="48" r="9" fill="#1a1a1a"/>
    <path d="M50 58 L45 68 L55 68 Z" fill="#1a1a1a"/>
    <rect x="36" y="80" width="6" height="8" fill="#e6eaee"/><rect x="46" y="80" width="6" height="8" fill="#e6eaee"/><rect x="56" y="80" width="6" height="8" fill="#e6eaee"/>`,
  ruby: `
    <defs><radialGradient id="rby" cx="40%" cy="32%" r="75%"><stop offset="0" stop-color="#ff8b95"/><stop offset="55%" stop-color="#cc2b3c"/><stop offset="100%" stop-color="#7a1020"/></radialGradient></defs>
    <path d="M28 26 L72 26 L88 44 L50 90 L12 44 Z" fill="url(#rby)" stroke="#ff9aa2" stroke-width="1.5"/>
    <path d="M28 26 L40 44 L12 44 Z" fill="#ff9aa2" opacity="0.7"/>
    <path d="M72 26 L60 44 L88 44 Z" fill="#d8485a" opacity="0.7"/>
    <path d="M40 44 L60 44 L50 90 Z" fill="#8f1626" opacity="0.6"/>`,
  crown: `
    <defs><linearGradient id="crn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset="55%" stop-color="#e7b73d"/><stop offset="100%" stop-color="#a9802a"/></linearGradient></defs>
    <path d="M18 70 L24 34 L40 54 L50 28 L60 54 L76 34 L82 70 Z" fill="url(#crn)" stroke="#7a5e1f" stroke-width="2" stroke-linejoin="round"/>
    <rect x="18" y="70" width="64" height="12" rx="2" fill="#C9A24B" stroke="#7a5e1f" stroke-width="1.5"/>
    <circle cx="50" cy="26" r="5" fill="#e0555f"/>
    <circle cx="24" cy="32" r="4" fill="#5aa9e6"/><circle cx="76" cy="32" r="4" fill="#5aa9e6"/>
    <circle cx="34" cy="76" r="3" fill="#cc2b3c"/><circle cx="50" cy="76" r="3" fill="#3fd07a"/><circle cx="66" cy="76" r="3" fill="#cc2b3c"/>`,
};

/**
 * Renders a slot symbol by id. Gradient ids are namespaced per instance so the
 * same symbol can appear many times on a page (reels, paytable) without their
 * gradients colliding. Falls back to the emoji glyph for any unmapped id.
 */
export function SymbolArt({
  id,
  glyph,
  className,
}: {
  id: string;
  glyph?: string | undefined;
  className?: string | undefined;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const raw = SYMBOL_SVG[id];
  if (!raw) {
    return (
      <span className={className} style={{ display: 'grid', placeItems: 'center', fontSize: '2.5em' }} aria-hidden>
        {glyph ?? '❔'}
      </span>
    );
  }
  const inner = raw
    .replace(/id="([^"]+)"/g, (_m, g) => `id="${g}-${uid}"`)
    .replace(/url\(#([^)]+)\)/g, (_m, g) => `url(#${g}-${uid})`);
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg"
      dangerouslySetInnerHTML={{ __html: inner }} aria-hidden />
  );
}
