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
    <defs>
      <radialGradient id="chy" cx="36%" cy="30%" r="72%"><stop offset="0" stop-color="#ff8f95"/><stop offset="45%" stop-color="#e24a52"/><stop offset="80%" stop-color="#b0303a"/><stop offset="100%" stop-color="#6f1820"/></radialGradient>
      <linearGradient id="chy2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3fd07a"/><stop offset="100%" stop-color="#137a44"/></linearGradient>
    </defs>
    <path d="M52 22 C58 34 78 36 80 54" fill="none" stroke="#0e5e3a" stroke-width="6.5" stroke-linecap="round"/>
    <path d="M52 22 C46 36 30 40 30 58" fill="none" stroke="#0e5e3a" stroke-width="6.5" stroke-linecap="round"/>
    <path d="M52 22 C58 34 78 36 80 54" fill="none" stroke="#2fae6b" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M52 22 C46 36 30 40 30 58" fill="none" stroke="#2fae6b" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M52 22 C62 11 81 11 89 19 C76 24 64 22 52 28 Z" fill="url(#chy2)" stroke="#0e5e3a" stroke-width="1.5"/>
    <circle cx="30" cy="70" r="18" fill="url(#chy)" stroke="#5c141b" stroke-width="2"/>
    <circle cx="72" cy="66" r="18" fill="url(#chy)" stroke="#5c141b" stroke-width="2"/>
    <ellipse cx="24" cy="63" rx="6" ry="4" fill="#ffd6d9" opacity="0.85"/>
    <ellipse cx="66" cy="59" rx="6" ry="4" fill="#ffd6d9" opacity="0.85"/>
    <circle cx="38" cy="78" r="2" fill="#fff" opacity="0.7"/>`,
  lemon: `
    <defs>
      <radialGradient id="lem" cx="38%" cy="30%" r="78%"><stop offset="0" stop-color="#fff7c4"/><stop offset="45%" stop-color="#ffe066"/><stop offset="78%" stop-color="#f4c12b"/><stop offset="100%" stop-color="#b9860c"/></radialGradient>
      <linearGradient id="lem2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3fd07a"/><stop offset="100%" stop-color="#137a44"/></linearGradient>
    </defs>
    <ellipse cx="50" cy="56" rx="35" ry="27" fill="url(#lem)" stroke="#9a6e0c" stroke-width="2.5" transform="rotate(-18 50 56)"/>
    <ellipse cx="22" cy="48" rx="3.5" ry="2.5" fill="#fff6c0" transform="rotate(-18 22 48)"/>
    <ellipse cx="78" cy="64" rx="3.5" ry="2.5" fill="#c79110" transform="rotate(-18 78 64)"/>
    <path d="M50 23 C58 21 67 25 71 32 C62 29 56 29 50 32 Z" fill="url(#lem2)" stroke="#0e5e3a" stroke-width="1.2"/>
    <ellipse cx="39" cy="44" rx="11" ry="6" fill="#fffbe0" opacity="0.75" transform="rotate(-18 39 44)"/>
    <circle cx="64" cy="50" r="2.2" fill="#fff" opacity="0.7"/>`,
  bell: `
    <defs>
      <linearGradient id="bel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c6"/><stop offset="40%" stop-color="#f0cf6c"/><stop offset="75%" stop-color="#C9A24B"/><stop offset="100%" stop-color="#7e6126"/></linearGradient>
      <radialGradient id="bel2" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#7a5a22"/><stop offset="100%" stop-color="#4a3614"/></radialGradient>
    </defs>
    <rect x="46" y="14" width="8" height="9" rx="3" fill="#6b542a"/>
    <path d="M50 22 C29 24 30 45 26 64 C24 73 17 74 17 81 L83 81 C83 74 76 73 74 64 C70 45 71 24 50 22 Z" fill="url(#bel)" stroke="#5c4720" stroke-width="2.5"/>
    <path d="M50 27 C36 30 36 48 33 64 L26 64 C30 45 33 28 50 27 Z" fill="#fff3cf" opacity="0.5"/>
    <ellipse cx="40" cy="46" rx="5" ry="15" fill="#fffbe6" opacity="0.55"/>
    <circle cx="50" cy="88" r="8" fill="url(#bel2)"/>
    <circle cx="47" cy="85" r="2.4" fill="#a98a48" opacity="0.8"/>`,
  star: `
    <defs>
      <linearGradient id="str" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6cf"/><stop offset="45%" stop-color="#f5cf52"/><stop offset="80%" stop-color="#dba62f"/><stop offset="100%" stop-color="#9c7322"/></linearGradient>
    </defs>
    <path d="M50 8 L61 38 L94 38 L67 58 L77 90 L50 70 L23 90 L33 58 L6 38 L39 38 Z" fill="url(#str)" stroke="#6b521b" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M50 18 L57 40 L46 40 Z" fill="#fffbe6" opacity="0.7"/>
    <path d="M50 70 L33 58 L40 53 L50 60 Z" fill="#8a661e" opacity="0.5"/>
    <circle cx="63" cy="44" r="2.4" fill="#fff" opacity="0.85"/>
    <path d="M82 22 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z" fill="#fffbe6" opacity="0.9"/>`,
  seven: `
    <defs>
      <linearGradient id="sev" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7c80"/><stop offset="40%" stop-color="#e23440"/><stop offset="80%" stop-color="#b81f2c"/><stop offset="100%" stop-color="#7c1018"/></linearGradient>
      <linearGradient id="sev2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset="55%" stop-color="#e7b73d"/><stop offset="100%" stop-color="#a9802a"/></linearGradient>
    </defs>
    <path d="M22 19 L80 19 L80 35 L54 89 L33 89 L60 35 L22 35 Z" fill="url(#sev2)" stroke="#6b521b" stroke-width="6" stroke-linejoin="round"/>
    <path d="M26 23 L76 23 L76 33 L50 87 L37 87 L63 33 L26 33 Z" fill="url(#sev)" stroke="#7c1018" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M30 27 L60 27 L57 32 L33 32 Z" fill="#ff9aa0" opacity="0.7"/>
    <path d="M58 36 L48 56 L44 54 L54 36 Z" fill="#ff9aa0" opacity="0.5"/>`,
  melon: `
    <defs>
      <linearGradient id="mel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a93"/><stop offset="55%" stop-color="#e2414e"/><stop offset="100%" stop-color="#a3212d"/></linearGradient>
      <linearGradient id="mel2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3fd07a"/><stop offset="100%" stop-color="#137a3f"/></linearGradient>
    </defs>
    <path d="M14 30 A46 46 0 0 0 86 30 Z" fill="url(#mel)" stroke="#8a1b25" stroke-width="2"/>
    <path d="M14 30 L88 30 L84 23 L16 23 Z" fill="url(#mel2)"/>
    <path d="M16 23 L84 23 L82 19 L18 19 Z" fill="#176b43"/>
    <path d="M18 32 A40 40 0 0 0 50 64" fill="none" stroke="#ff9aa0" stroke-width="3" opacity="0.4"/>
    <circle cx="40" cy="44" r="3" fill="#3a1518"/><circle cx="55" cy="50" r="3" fill="#3a1518"/><circle cx="50" cy="38" r="3" fill="#3a1518"/><circle cx="63" cy="40" r="3" fill="#3a1518"/>`,
  grape: `
    <defs>
      <radialGradient id="grp" cx="36%" cy="30%" r="78%"><stop offset="0" stop-color="#d4adf0"/><stop offset="50%" stop-color="#9a52d0"/><stop offset="100%" stop-color="#4a1e7a"/></radialGradient>
      <linearGradient id="grp2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3fd07a"/><stop offset="100%" stop-color="#137a44"/></linearGradient>
    </defs>
    <path d="M52 20 C56 28 66 28 72 24" fill="none" stroke="#6b4a2a" stroke-width="4" stroke-linecap="round"/>
    <path d="M72 22 C82 13 93 17 93 26 C84 26 80 24 72 30 Z" fill="url(#grp2)" stroke="#0e5e3a" stroke-width="1.2"/>
    <g fill="url(#grp)" stroke="#3a1560" stroke-width="1.4">
      <circle cx="40" cy="40" r="11.5"/><circle cx="60" cy="40" r="11.5"/>
      <circle cx="30" cy="56" r="11.5"/><circle cx="50" cy="56" r="11.5"/><circle cx="70" cy="56" r="11.5"/>
      <circle cx="40" cy="72" r="11.5"/><circle cx="60" cy="72" r="11.5"/>
      <circle cx="50" cy="86" r="11.5"/>
    </g>
    <circle cx="36" cy="36" r="3.5" fill="#f0ddfa" opacity="0.9"/>
    <circle cx="56" cy="36" r="2.5" fill="#f0ddfa" opacity="0.7"/>`,
  orange: `
    <defs>
      <radialGradient id="org" cx="36%" cy="30%" r="76%"><stop offset="0" stop-color="#ffe0a0"/><stop offset="45%" stop-color="#ffa733"/><stop offset="80%" stop-color="#f4810f"/><stop offset="100%" stop-color="#b85500"/></radialGradient>
      <linearGradient id="org2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3fd07a"/><stop offset="100%" stop-color="#137a44"/></linearGradient>
    </defs>
    <circle cx="50" cy="58" r="33" fill="url(#org)" stroke="#a34a00" stroke-width="2.5"/>
    <circle cx="50" cy="58" r="33" fill="none" stroke="#ffd9a0" stroke-width="1" opacity="0.5"/>
    <path d="M50 29 C58 25 67 27 71 33 C62 31 56 31 50 35 Z" fill="url(#org2)" stroke="#0e5e3a" stroke-width="1.2"/>
    <ellipse cx="39" cy="46" rx="10" ry="6" fill="#fff0d6" opacity="0.65"/>
    <circle cx="63" cy="50" r="2.4" fill="#fff" opacity="0.7"/>`,
  straw: `
    <defs>
      <radialGradient id="stb" cx="38%" cy="26%" r="82%"><stop offset="0" stop-color="#ff8e96"/><stop offset="50%" stop-color="#e0354c"/><stop offset="100%" stop-color="#8a1424"/></radialGradient>
      <linearGradient id="stb2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3fd07a"/><stop offset="100%" stop-color="#137a3f"/></linearGradient>
    </defs>
    <path d="M50 30 C23 34 25 58 50 91 C75 58 77 34 50 30 Z" fill="url(#stb)" stroke="#75101f" stroke-width="2"/>
    <path d="M50 21 C42 21 35 25 31 32 C40 30 44 32 50 36 C56 32 60 30 69 32 C65 25 58 21 50 21 Z" fill="url(#stb2)" stroke="#0e5e3a" stroke-width="1.2"/>
    <g fill="#ffe39a" stroke="#caa53a" stroke-width="0.5"><circle cx="44" cy="46" r="2.2"/><circle cx="56" cy="46" r="2.2"/><circle cx="50" cy="56" r="2.2"/><circle cx="40" cy="58" r="2.2"/><circle cx="60" cy="58" r="2.2"/><circle cx="50" cy="70" r="2.2"/></g>
    <ellipse cx="40" cy="44" rx="6" ry="4" fill="#ffd6da" opacity="0.6"/>`,
  gem: `
    <defs>
      <linearGradient id="gemg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e0f5ff"/><stop offset="45%" stop-color="#6cbcf0"/><stop offset="100%" stop-color="#1a5290"/></linearGradient>
    </defs>
    <path d="M28 25 L72 25 L89 44 L50 91 L11 44 Z" fill="url(#gemg)" stroke="#0e3a66" stroke-width="2.5"/>
    <path d="M28 25 L40 44 L11 44 Z" fill="#d2f0ff" opacity="0.9"/>
    <path d="M72 25 L60 44 L89 44 Z" fill="#9fcff0" opacity="0.7"/>
    <path d="M40 44 L60 44 L50 91 Z" fill="#1f5d96" opacity="0.7"/>
    <path d="M40 44 L60 44 L72 25 L28 25 Z" fill="#8fc8ee" opacity="0.55"/>
    <path d="M40 44 L50 91 L11 44 Z" fill="#2b6fae" opacity="0.4"/>
    <path d="M32 29 L46 29 L42 40 L36 40 Z" fill="#fff" opacity="0.7"/>
    <path d="M78 30 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5 Z" fill="#fff"/>`,
  sardine: `
    <defs>
      <linearGradient id="sar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="45%" stop-color="#d2dbe2"/><stop offset="100%" stop-color="#6d7c88"/></linearGradient>
    </defs>
    <path d="M14 50 C30 29 64 29 80 50 C64 71 30 71 14 50 Z" fill="url(#sar)" stroke="#56636e" stroke-width="2.5"/>
    <path d="M80 50 L95 37 L92 50 L95 63 Z" fill="#9aa7b2" stroke="#56636e" stroke-width="1.5"/>
    <path d="M44 31 L52 21 L57 34 Z" fill="#aab6c0" stroke="#56636e" stroke-width="1.2"/>
    <path d="M22 50 C36 38 60 38 72 50" fill="none" stroke="#aeb9c2" stroke-width="2" opacity="0.6"/>
    <circle cx="30" cy="48" r="5" fill="#2a323a"/>
    <circle cx="28.5" cy="46.5" r="1.6" fill="#fff"/>
    <path d="M40 50 q10 -8 22 0 q-10 8 -22 0" fill="#ffffff" opacity="0.55"/>`,
  olive: `
    <defs>
      <radialGradient id="olv" cx="36%" cy="28%" r="78%"><stop offset="0" stop-color="#b6e088"/><stop offset="55%" stop-color="#5f9230"/><stop offset="100%" stop-color="#2c4a16"/></radialGradient>
    </defs>
    <path d="M26 30 C40 40 60 44 78 38" fill="none" stroke="#5a8a2c" stroke-width="3.5" stroke-linecap="round"/>
    <ellipse cx="38" cy="60" rx="14" ry="19" fill="url(#olv)" stroke="#2c4a16" stroke-width="1.6"/>
    <ellipse cx="62" cy="54" rx="14" ry="19" fill="url(#olv)" stroke="#2c4a16" stroke-width="1.6"/>
    <circle cx="62" cy="54" r="4.5" fill="#cc2b3c" stroke="#7a1020" stroke-width="1"/>
    <ellipse cx="33" cy="52" rx="3.5" ry="7" fill="#d8f0b6" opacity="0.7"/>
    <ellipse cx="57" cy="46" rx="3" ry="6" fill="#d8f0b6" opacity="0.6"/>`,
  wine: `
    <defs>
      <linearGradient id="win" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f06b74"/><stop offset="55%" stop-color="#b02232"/><stop offset="100%" stop-color="#7a1020"/></linearGradient>
      <linearGradient id="win2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset="55%" stop-color="#C9A24B"/><stop offset="100%" stop-color="#8a6c2c"/></linearGradient>
    </defs>
    <path d="M32 17 L68 17 C68 42 60 53 50 53 C40 53 32 42 32 17 Z" fill="#16120b" stroke="url(#win2)" stroke-width="2.5"/>
    <path d="M35 21 L65 21 C65 41 58 50 50 50 C42 50 35 41 35 21 Z" fill="url(#win)"/>
    <rect x="48" y="52" width="4" height="26" fill="url(#win2)"/>
    <rect x="33" y="79" width="34" height="6" rx="2.5" fill="url(#win2)" stroke="#7a5e1f" stroke-width="1"/>
    <ellipse cx="42" cy="30" rx="3.5" ry="8" fill="#ff9aa2" opacity="0.6"/>
    <circle cx="58" cy="26" r="2" fill="#fff" opacity="0.4"/>`,
  galo: `
    <defs>
      <linearGradient id="glb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3a3a"/><stop offset="100%" stop-color="#000"/></linearGradient>
      <linearGradient id="glb2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2414e"/><stop offset="100%" stop-color="#8a1424"/></linearGradient>
    </defs>
    <path d="M40 22 C44 17 50 19 50 25 C56 19 62 23 60 29 C66 25 70 31 66 38 Z" fill="url(#glb2)" stroke="#5c141b" stroke-width="1.2"/>
    <path d="M50 34 C34 34 26 48 28 64 C30 80 42 86 54 84 C70 82 76 70 74 56 C72 44 64 34 50 34 Z" fill="url(#glb)" stroke="#000" stroke-width="1.5"/>
    <path d="M50 34 C40 36 33 46 33 60 C33 72 40 80 48 82 C40 80 36 70 36 58 C36 46 42 36 50 34 Z" fill="#4a4a4a" opacity="0.5"/>
    <path d="M28 64 C18 66 14 76 18 86 C24 84 30 82 34 78 Z" fill="#1f8a5b" stroke="#0e5e3a" stroke-width="1"/>
    <path d="M40 60 C30 66 24 78 26 90 C34 84 42 78 46 70 Z" fill="#C9A24B" stroke="#7a5e1f" stroke-width="1"/>
    <circle cx="44" cy="46" r="4" fill="#fff"/><circle cx="44" cy="46" r="2" fill="#000"/>
    <path d="M30 50 L18 48 L30 56 Z" fill="#e7b73d" stroke="#a9802a" stroke-width="1"/>
    <path d="M30 56 L20 60 L31 62 Z" fill="#b0303a"/>`,
  coin: `
    <defs>
      <radialGradient id="coi" cx="38%" cy="30%" r="76%"><stop offset="0" stop-color="#fff6cf"/><stop offset="50%" stop-color="#ecc24c"/><stop offset="100%" stop-color="#9a7322"/></radialGradient>
    </defs>
    <circle cx="50" cy="52" r="35" fill="url(#coi)" stroke="#6b521b" stroke-width="3.5"/>
    <circle cx="50" cy="52" r="27" fill="none" stroke="#b8902f" stroke-width="2.5"/>
    <path d="M50 35 L57 49 L72 49 L60 59 L64 73 L50 64 L36 73 L40 59 L28 49 L43 49 Z" fill="#a9802a" stroke="#8a661e" stroke-width="0.8"/>
    <ellipse cx="38" cy="38" rx="8" ry="5" fill="#fffbe0" opacity="0.7"/>
    <path d="M78 28 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5 Z" fill="#fffbe6"/>`,
  parrot: `
    <defs>
      <linearGradient id="par" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#54e08c"/><stop offset="100%" stop-color="#137a44"/></linearGradient>
      <linearGradient id="par3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f06b74"/><stop offset="100%" stop-color="#b02232"/></linearGradient>
    </defs>
    <path d="M58 22 C36 22 26 40 28 60 C30 78 44 86 58 84 L58 22 Z" fill="url(#par)" stroke="#0e5e3a" stroke-width="1.5"/>
    <path d="M58 20 C74 22 82 34 80 48 C78 60 70 64 58 62 Z" fill="url(#par3)" stroke="#7a1020" stroke-width="1.5"/>
    <circle cx="50" cy="40" r="5.5" fill="#fff"/><circle cx="50" cy="40" r="2.8" fill="#000"/>
    <circle cx="48.5" cy="38.5" r="1.2" fill="#fff"/>
    <path d="M40 46 C27 44 21 50 21 56 C30 56 36 54 42 52 Z" fill="#f4c93b" stroke="#c79110" stroke-width="1"/>
    <path d="M58 62 C66 70 64 82 56 88 C54 80 54 72 58 66 Z" fill="#2b7fd0" stroke="#1a5290" stroke-width="1"/>
    <path d="M34 30 C28 38 28 52 32 62" fill="none" stroke="#a7f0c4" stroke-width="2" opacity="0.5"/>`,
  anchor: `
    <defs>
      <linearGradient id="anc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="45%" stop-color="#c8d2da"/><stop offset="100%" stop-color="#76858f"/></linearGradient>
    </defs>
    <g fill="none" stroke="#56636e" stroke-width="11" stroke-linecap="round">
      <circle cx="50" cy="22" r="8"/>
      <line x1="50" y1="30" x2="50" y2="82"/>
      <line x1="33" y1="44" x2="67" y2="44"/>
      <path d="M23 60 C23 80 40 87 50 87 C60 87 77 80 77 60"/>
    </g>
    <g fill="none" stroke="url(#anc)" stroke-width="7" stroke-linecap="round">
      <circle cx="50" cy="22" r="8"/>
      <line x1="50" y1="30" x2="50" y2="82"/>
      <line x1="33" y1="44" x2="67" y2="44"/>
      <path d="M23 60 C23 80 40 87 50 87 C60 87 77 80 77 60"/>
    </g>
    <path d="M50 87 L41 78 L59 78 Z" fill="#d8dee3" stroke="#56636e" stroke-width="1.5"/>
    <line x1="48" y1="34" x2="48" y2="78" stroke="#ffffff" stroke-width="2" opacity="0.6"/>`,
  map: `
    <defs>
      <linearGradient id="mpp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7e8c2"/><stop offset="55%" stop-color="#e2c690"/><stop offset="100%" stop-color="#bb9362"/></linearGradient>
    </defs>
    <path d="M18 24 L82 20 L84 78 L16 82 Z" fill="url(#mpp)" stroke="#6e4720" stroke-width="2.5"/>
    <path d="M18 24 L82 20 L84 78 L16 82 Z" fill="none" stroke="#b88f55" stroke-width="1" opacity="0.6" transform="scale(0.94) translate(3.3 3)"/>
    <path d="M30 64 C36 50 30 44 40 38 C50 34 52 46 62 42" fill="none" stroke="#7a4f24" stroke-width="2.5" stroke-dasharray="4 4"/>
    <path d="M58 38 L70 50 M70 38 L58 50" stroke="#cc2b3c" stroke-width="4.5" stroke-linecap="round"/>
    <circle cx="30" cy="64" r="3.5" fill="#7a4f24"/>
    <path d="M22 28 L34 26" stroke="#cbac7a" stroke-width="3" stroke-linecap="round" opacity="0.6"/>`,
  chest: `
    <defs>
      <linearGradient id="chs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bb7a3c"/><stop offset="100%" stop-color="#5a3a1c"/></linearGradient>
      <linearGradient id="chs2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset="55%" stop-color="#C9A24B"/><stop offset="100%" stop-color="#8a6c2c"/></linearGradient>
    </defs>
    <path d="M20 44 C20 31 80 31 80 44 L80 50 L20 50 Z" fill="#9a6630" stroke="#4a2e14" stroke-width="2"/>
    <rect x="20" y="50" width="60" height="35" rx="3" fill="url(#chs)" stroke="#4a2e14" stroke-width="2"/>
    <rect x="20" y="43" width="60" height="9" fill="url(#chs2)" stroke="#7a5e1f" stroke-width="1"/>
    <rect x="20" y="62" width="60" height="6" fill="url(#chs2)"/>
    <rect x="44" y="56" width="12" height="17" rx="2" fill="#e7b73d" stroke="#8a6c2c" stroke-width="1"/>
    <circle cx="50" cy="63" r="2.5" fill="#5a3a1c"/>
    <circle cx="34" cy="40" r="4" fill="#ffe39a"/><circle cx="62" cy="38" r="4" fill="#ffe39a"/><circle cx="50" cy="35" r="4.5" fill="#fff0b8"/>
    <circle cx="50" cy="33" r="1.5" fill="#fff"/>`,
  skull: `
    <defs>
      <radialGradient id="skl" cx="40%" cy="30%" r="72%"><stop offset="0" stop-color="#ffffff"/><stop offset="65%" stop-color="#e2e7eb"/><stop offset="100%" stop-color="#bdc4ca"/></radialGradient>
    </defs>
    <path d="M50 17 C27 17 17 34 17 50 C17 60 23 66 30 70 L30 81 L70 81 L70 70 C77 66 83 60 83 50 C83 34 73 17 50 17 Z" fill="url(#skl)" stroke="#9aa2a9" stroke-width="2"/>
    <circle cx="37" cy="48" r="9.5" fill="#15191c"/><circle cx="63" cy="48" r="9.5" fill="#15191c"/>
    <circle cx="40" cy="45" r="2.5" fill="#3a444c"/><circle cx="66" cy="45" r="2.5" fill="#3a444c"/>
    <path d="M50 58 L44 69 L56 69 Z" fill="#15191c"/>
    <rect x="35" y="80" width="6" height="9" rx="1" fill="#eef2f5" stroke="#bdc4ca" stroke-width="0.8"/><rect x="46" y="80" width="6" height="9" rx="1" fill="#eef2f5" stroke="#bdc4ca" stroke-width="0.8"/><rect x="57" y="80" width="6" height="9" rx="1" fill="#eef2f5" stroke="#bdc4ca" stroke-width="0.8"/>
    <ellipse cx="34" cy="32" rx="8" ry="5" fill="#fff" opacity="0.6"/>`,
  ruby: `
    <defs>
      <radialGradient id="rby" cx="38%" cy="28%" r="78%"><stop offset="0" stop-color="#ff9ca4"/><stop offset="50%" stop-color="#d8324a"/><stop offset="100%" stop-color="#6f0e1c"/></radialGradient>
    </defs>
    <path d="M28 25 L72 25 L89 44 L50 91 L11 44 Z" fill="url(#rby)" stroke="#5c0c18" stroke-width="2.5"/>
    <path d="M28 25 L40 44 L11 44 Z" fill="#ffb4ba" opacity="0.8"/>
    <path d="M72 25 L60 44 L89 44 Z" fill="#e0556a" opacity="0.7"/>
    <path d="M40 44 L60 44 L50 91 Z" fill="#8f1626" opacity="0.7"/>
    <path d="M40 44 L60 44 L72 25 L28 25 Z" fill="#e87f8c" opacity="0.5"/>
    <path d="M32 29 L46 29 L42 40 L36 40 Z" fill="#fff" opacity="0.55"/>`,
  crown: `
    <defs>
      <linearGradient id="crn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6cf"/><stop offset="45%" stop-color="#f0cf6c"/><stop offset="80%" stop-color="#d9a52d"/><stop offset="100%" stop-color="#9c7322"/></linearGradient>
    </defs>
    <path d="M18 70 L24 33 L40 54 L50 27 L60 54 L76 33 L82 70 Z" fill="url(#crn)" stroke="#6b521b" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="18" y="70" width="64" height="13" rx="2" fill="url(#crn)" stroke="#6b521b" stroke-width="2"/>
    <rect x="18" y="73" width="64" height="3" fill="#7a5e1f" opacity="0.4"/>
    <circle cx="50" cy="25" r="5.5" fill="#e0555f" stroke="#8f1626" stroke-width="1"/>
    <circle cx="24" cy="31" r="4" fill="#5aa9e6" stroke="#1f5d96" stroke-width="0.8"/><circle cx="76" cy="31" r="4" fill="#5aa9e6" stroke="#1f5d96" stroke-width="0.8"/>
    <circle cx="34" cy="76" r="3" fill="#cc2b3c"/><circle cx="50" cy="76" r="3" fill="#3fd07a"/><circle cx="66" cy="76" r="3" fill="#cc2b3c"/>
    <path d="M40 54 L50 36 L46 54 Z" fill="#fffbe6" opacity="0.5"/>`,
  pote: `
    <defs>
      <linearGradient id="trf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6cf"/><stop offset="45%" stop-color="#f0cf6c"/><stop offset="80%" stop-color="#d9a52d"/><stop offset="100%" stop-color="#9c7322"/></linearGradient>
    </defs>
    <path d="M30 22 C16 22 14 40 28 44" fill="none" stroke="#C9A24B" stroke-width="5.5" stroke-linecap="round"/>
    <path d="M70 22 C84 22 86 40 72 44" fill="none" stroke="#C9A24B" stroke-width="5.5" stroke-linecap="round"/>
    <path d="M30 18 L70 18 L70 34 C70 51 61 60 50 60 C39 60 30 51 30 34 Z" fill="url(#trf)" stroke="#6b521b" stroke-width="2.5"/>
    <rect x="45" y="60" width="10" height="14" fill="#a9802a"/>
    <path d="M34 80 L66 80 L61 73 L39 73 Z" fill="url(#trf)" stroke="#6b521b" stroke-width="2.5"/>
    <rect x="31" y="80" width="38" height="7" rx="2.5" fill="url(#trf)" stroke="#6b521b" stroke-width="2"/>
    <path d="M43 28 L51 46 L42 41 Z" fill="#fffbe6" opacity="0.7"/>
    <path d="M62 24 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5 Z" fill="#fffbe6"/>`,
  clover: `
    <defs>
      <radialGradient id="clv" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="#9cf0a8"/><stop offset="55%" stop-color="#34b862"/><stop offset="100%" stop-color="#137a3a"/></radialGradient>
    </defs>
    <path d="M50 56 C53 70 55 80 60 90 L40 90 C45 80 47 70 50 56 Z" fill="#137a3a"/>
    <g fill="url(#clv)" stroke="#0e5e2c" stroke-width="2">
      <circle cx="38" cy="40" r="15"/><circle cx="62" cy="40" r="15"/>
      <circle cx="38" cy="60" r="15"/><circle cx="62" cy="60" r="15"/>
    </g>
    <ellipse cx="38" cy="36" rx="5" ry="7" fill="#dcf7df" opacity="0.7"/>
    <ellipse cx="62" cy="36" rx="4" ry="5" fill="#dcf7df" opacity="0.5"/>`,
  bar: `
    <defs>
      <linearGradient id="bar1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3a3a"/><stop offset="100%" stop-color="#0c0c0c"/></linearGradient>
      <linearGradient id="bar1g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset="55%" stop-color="#C9A24B"/><stop offset="100%" stop-color="#8a6c2c"/></linearGradient>
    </defs>
    <rect x="10" y="36" width="80" height="28" rx="7" fill="url(#bar1g)"/>
    <rect x="13.5" y="39.5" width="73" height="21" rx="4.5" fill="url(#bar1)" stroke="#5c4720" stroke-width="1"/>
    <rect x="16" y="41" width="68" height="6" rx="3" fill="#ffffff" opacity="0.12"/>
    <text x="50" y="51" text-anchor="middle" dominant-baseline="central" font-family="Georgia, serif" font-weight="bold" font-size="22" fill="url(#bar1g)" stroke="#5c4720" stroke-width="0.5">BAR</text>`,
  barbar: `
    <defs>
      <linearGradient id="bar2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3a3a"/><stop offset="100%" stop-color="#0c0c0c"/></linearGradient>
      <linearGradient id="bar2g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset="55%" stop-color="#C9A24B"/><stop offset="100%" stop-color="#8a6c2c"/></linearGradient>
    </defs>
    <g>
      <rect x="10" y="20" width="80" height="26" rx="6" fill="url(#bar2g)"/>
      <rect x="13.5" y="23.5" width="73" height="19" rx="4" fill="url(#bar2)" stroke="#5c4720" stroke-width="1"/>
      <text x="50" y="33.5" text-anchor="middle" dominant-baseline="central" font-family="Georgia, serif" font-weight="bold" font-size="19" fill="url(#bar2g)" stroke="#5c4720" stroke-width="0.5">BAR</text>
    </g>
    <g>
      <rect x="10" y="54" width="80" height="26" rx="6" fill="url(#bar2g)"/>
      <rect x="13.5" y="57.5" width="73" height="19" rx="4" fill="url(#bar2)" stroke="#5c4720" stroke-width="1"/>
      <text x="50" y="67.5" text-anchor="middle" dominant-baseline="central" font-family="Georgia, serif" font-weight="bold" font-size="19" fill="url(#bar2g)" stroke="#5c4720" stroke-width="0.5">BAR</text>
    </g>`,
  barbarbar: `
    <defs>
      <linearGradient id="bar3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3a3a"/><stop offset="100%" stop-color="#0c0c0c"/></linearGradient>
      <linearGradient id="bar3g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset="55%" stop-color="#C9A24B"/><stop offset="100%" stop-color="#8a6c2c"/></linearGradient>
    </defs>
    <g>
      <rect x="11" y="14" width="78" height="20" rx="5" fill="url(#bar3g)"/>
      <rect x="14" y="17" width="72" height="14" rx="3" fill="url(#bar3)" stroke="#5c4720" stroke-width="0.9"/>
      <text x="50" y="24.5" text-anchor="middle" dominant-baseline="central" font-family="Georgia, serif" font-weight="bold" font-size="15" fill="url(#bar3g)" stroke="#5c4720" stroke-width="0.4">BAR</text>
    </g>
    <g>
      <rect x="11" y="40" width="78" height="20" rx="5" fill="url(#bar3g)"/>
      <rect x="14" y="43" width="72" height="14" rx="3" fill="url(#bar3)" stroke="#5c4720" stroke-width="0.9"/>
      <text x="50" y="50.5" text-anchor="middle" dominant-baseline="central" font-family="Georgia, serif" font-weight="bold" font-size="15" fill="url(#bar3g)" stroke="#5c4720" stroke-width="0.4">BAR</text>
    </g>
    <g>
      <rect x="11" y="66" width="78" height="20" rx="5" fill="url(#bar3g)"/>
      <rect x="14" y="69" width="72" height="14" rx="3" fill="url(#bar3)" stroke="#5c4720" stroke-width="0.9"/>
      <text x="50" y="76.5" text-anchor="middle" dominant-baseline="central" font-family="Georgia, serif" font-weight="bold" font-size="15" fill="url(#bar3g)" stroke="#5c4720" stroke-width="0.4">BAR</text>
    </g>`,
  diamond: `
    <defs>
      <linearGradient id="dia" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="45%" stop-color="#aee0ff"/><stop offset="100%" stop-color="#4a93d6"/></linearGradient>
    </defs>
    <path d="M24 36 L76 36 L88 46 L50 92 L12 46 Z" fill="url(#dia)" stroke="#2a6aa6" stroke-width="2.5"/>
    <path d="M24 36 L76 36 L66 46 L34 46 Z" fill="#e8f6ff"/>
    <path d="M24 36 L34 46 L12 46 Z" fill="#bfe6ff"/>
    <path d="M76 36 L66 46 L88 46 Z" fill="#9fcdf0"/>
    <path d="M34 46 L66 46 L50 92 Z" fill="#7fbdee" opacity="0.85"/>
    <path d="M34 46 L50 92 L12 46 Z" fill="#5aa1dd" opacity="0.8"/>
    <path d="M66 46 L88 46 L50 92 Z" fill="#3f88cc" opacity="0.8"/>
    <path d="M28 39 L46 39 L42 44 L33 44 Z" fill="#ffffff" opacity="0.85"/>
    <path d="M80 30 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z" fill="#ffffff"/>
    <circle cx="22" cy="60" r="2" fill="#fff" opacity="0.8"/>`,
  goldbar: `
    <defs>
      <linearGradient id="gldt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6cf"/><stop offset="100%" stop-color="#ecc24c"/></linearGradient>
      <linearGradient id="gldf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7b73d"/><stop offset="100%" stop-color="#9a7322"/></linearGradient>
      <linearGradient id="glds" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#caa53a"/><stop offset="100%" stop-color="#7a5e1f"/></linearGradient>
    </defs>
    <path d="M22 44 L78 44 L92 56 L36 56 Z" fill="url(#gldt)" stroke="#7a5e1f" stroke-width="2"/>
    <path d="M36 56 L92 56 L92 78 L36 86 Z" fill="url(#glds)" stroke="#6b521b" stroke-width="2"/>
    <path d="M22 44 L36 56 L36 86 L22 72 Z" fill="url(#gldf)" stroke="#6b521b" stroke-width="2"/>
    <path d="M28 47 L70 47 L66 51 L32 51 Z" fill="#fffbe6" opacity="0.6"/>
    <path d="M44 62 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5 Z" fill="#fffbe6" opacity="0.9"/>`,
  dice: `
    <defs>
      <linearGradient id="dic" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f06b74"/><stop offset="100%" stop-color="#b02232"/></linearGradient>
      <linearGradient id="dic2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2414e"/><stop offset="100%" stop-color="#8f1626"/></linearGradient>
    </defs>
    <g transform="rotate(-12 36 62)">
      <rect x="16" y="42" width="40" height="40" rx="8" fill="url(#dic)" stroke="#7a1020" stroke-width="2.5"/>
      <rect x="20" y="46" width="32" height="9" rx="4" fill="#fff" opacity="0.18"/>
      <circle cx="27" cy="53" r="3.5" fill="#fff"/><circle cx="45" cy="53" r="3.5" fill="#fff"/>
      <circle cx="36" cy="62" r="3.5" fill="#fff"/>
      <circle cx="27" cy="71" r="3.5" fill="#fff"/><circle cx="45" cy="71" r="3.5" fill="#fff"/>
    </g>
    <g transform="rotate(10 66 40)">
      <rect x="48" y="20" width="36" height="36" rx="7" fill="url(#dic2)" stroke="#7a1020" stroke-width="2.5"/>
      <rect x="51" y="23" width="30" height="8" rx="3.5" fill="#fff" opacity="0.16"/>
      <circle cx="58" cy="30" r="3.2" fill="#fff"/><circle cx="74" cy="30" r="3.2" fill="#fff"/>
      <circle cx="58" cy="46" r="3.2" fill="#fff"/><circle cx="74" cy="46" r="3.2" fill="#fff"/>
    </g>`,
  ring: `
    <defs>
      <linearGradient id="rng" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6cf"/><stop offset="50%" stop-color="#e7b73d"/><stop offset="100%" stop-color="#9a7322"/></linearGradient>
      <radialGradient id="rngd" cx="40%" cy="30%" r="72%"><stop offset="0" stop-color="#ffffff"/><stop offset="55%" stop-color="#9fdcff"/><stop offset="100%" stop-color="#3f88cc"/></radialGradient>
    </defs>
    <ellipse cx="50" cy="66" rx="26" ry="22" fill="none" stroke="#7a5e1f" stroke-width="11"/>
    <ellipse cx="50" cy="66" rx="26" ry="22" fill="none" stroke="url(#rng)" stroke-width="7"/>
    <path d="M34 40 L66 40 L58 52 L42 52 Z" fill="url(#rng)" stroke="#7a5e1f" stroke-width="1.5"/>
    <path d="M50 24 L64 38 L50 56 L36 38 Z" fill="url(#rngd)" stroke="#2a6aa6" stroke-width="2"/>
    <path d="M50 24 L64 38 L50 42 L36 38 Z" fill="#e8f6ff"/>
    <path d="M50 42 L64 38 L50 56 Z" fill="#6cb0e6" opacity="0.7"/>
    <path d="M40 30 L48 30 L45 36 Z" fill="#fff" opacity="0.85"/>
    <ellipse cx="34" cy="58" rx="3" ry="6" fill="#fffbe6" opacity="0.6"/>`,
  horseshoe: `
    <defs>
      <linearGradient id="hrs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6cf"/><stop offset="45%" stop-color="#f0cf6c"/><stop offset="80%" stop-color="#d9a52d"/><stop offset="100%" stop-color="#9a7322"/></linearGradient>
    </defs>
    <path d="M26 84 C16 60 18 30 50 28 C82 30 84 60 74 84 L60 84 C70 62 70 40 50 40 C30 40 30 62 40 84 Z" fill="url(#hrs)" stroke="#6b521b" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M32 78 C24 56 26 34 50 33" fill="none" stroke="#fffbe6" stroke-width="2.5" opacity="0.55" stroke-linecap="round"/>
    <g fill="#6b521b">
      <circle cx="36" cy="46" r="2.2"/><circle cx="64" cy="46" r="2.2"/>
      <circle cx="31" cy="58" r="2.2"/><circle cx="69" cy="58" r="2.2"/>
      <circle cx="30" cy="72" r="2.2"/><circle cx="70" cy="72" r="2.2"/>
    </g>
    <path d="M70 26 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5 Z" fill="#fffbe6"/>`,
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
    // Render the emoji inside the same 0 0 100 100 viewBox as the real symbols
    // so it scales to its box (a fixed font-size overflowed small cells).
    return (
      <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <text x="50" y="54" textAnchor="middle" dominantBaseline="central" fontSize="68">
          {glyph ?? '❔'}
        </text>
      </svg>
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
