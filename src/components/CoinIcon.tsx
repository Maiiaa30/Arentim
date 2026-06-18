interface CoinIconProps {
  className?: string;
  title?: string;
}

/** The Tostão coin mark — a simple gold coin used alongside amounts. */
export function CoinIcon({ className = 'h-4 w-4', title = 'Tostões' }: CoinIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-label={title}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="10" fill="#D4A24A" />
      <circle cx="12" cy="12" r="7.5" fill="none" stroke="#0B0C10" strokeOpacity="0.25" strokeWidth="1" />
      <path
        d="M12 7.2c-1.9 0-3.2 1-3.2 2.5 0 3.4 5.9 2 5.9 4.4 0 1-1 1.6-2.7 1.6-1.3 0-2.4-.4-3.2-1"
        stroke="#0B0C10"
        strokeOpacity="0.55"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M12 6v12" stroke="#0B0C10" strokeOpacity="0.55" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
