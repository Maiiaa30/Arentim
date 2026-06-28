import type { JSX } from 'react';

/**
 * A small hairline icon set drawn in the same stroke style as the brand mark, so
 * the app speaks one visual language instead of borrowing OS emoji for its UI.
 * All icons share a 0 0 24 24 box and stroke `currentColor`, so colour + size are
 * controlled by the caller (`className`).
 */
export type UiIconName =
  | 'gift'
  | 'request'
  | 'duel'
  | 'trophy'
  | 'sparkle'
  | 'userPlus'
  | 'check'
  | 'bell'
  | 'arrowRight';

const PATHS: Record<UiIconName, JSX.Element> = {
  gift: (
    <>
      <rect x="4" y="10" width="16" height="10" rx="1" />
      <path d="M3 7h18v3H3z" />
      <path d="M12 7v13" />
      <path d="M12 7C11 4 7 4 7 6.2 7 7.7 9.5 7.7 12 7Z" />
      <path d="M12 7c1-3 5-3 5-.8 0 1.5-2.5 1.5-5 .8Z" />
    </>
  ),
  request: (
    <>
      <path d="M4 13a8 4 0 0 0 16 0" />
      <path d="M4 13v1a8 4 0 0 0 16 0v-1" />
      <circle cx="12" cy="6.5" r="2.5" />
      <path d="M12 9v2.4" />
    </>
  ),
  duel: (
    <>
      <path d="M4 4l9 9" />
      <path d="M20 4l-9 9" />
      <path d="M9 13l-2.2 2.2L8.3 16.7l2.2-2.2" />
      <path d="M15 13l2.2 2.2-1.5 1.5-2.2-2.2" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v4a4 4 0 0 1-8 0z" />
      <path d="M8 6H5.2a2 2 0 0 0 3.8.6" />
      <path d="M16 6h2.8a2 2 0 0 1-3.8.6" />
      <path d="M12 12v3" />
      <path d="M9.5 19h5" />
      <path d="M10 19l.4-4h3.2l.4 4" />
    </>
  ),
  sparkle: <path d="M12 3l1.6 6.4L20 11l-6.4 1.6L12 19l-1.6-6.4L4 11l6.4-1.6z" />,
  userPlus: (
    <>
      <circle cx="10" cy="8" r="3" />
      <path d="M4 20a6 6 0 0 1 12 0" />
      <path d="M18 8v6" />
      <path d="M15 11h6" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </>
  ),
  bell: (
    <>
      <path d="M12 3a6 6 0 0 0-6 6c0 3.5-1 5-2 6h16c-1-1-2-2.5-2-6a6 6 0 0 0-6-6Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
};

export function UiIcon({ name, className = 'h-4 w-4' }: { name: UiIconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
