import type { ReactNode } from "react";

const paths = {
  home: (
    <>
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6.5 10v9h11v-9" />
      <path d="M10 19v-4.5h4V19" />
    </>
  ),
  companies: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 4h5M16 9h5M18 14h3" />
    </>
  ),
  overview: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  money: (
    <>
      <path d="M4 6h6c3 0 4 2 5 4s2 4 5 4" />
      <path d="M4 6h16" />
      <path d="M4 18h6c3 0 4-2 5-4" />
    </>
  ),
  statements: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 10h18M3 15h18M9 4v16" />
    </>
  ),
  timeline: (
    <>
      <path d="M3 12h18" />
      <circle cx="7" cy="12" r="2" />
      <circle cx="14" cy="12" r="2" />
      <path d="M7 5v3M14 16v3M19 5v3" />
    </>
  ),
  glossary: (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
      <path d="M4 19V5" />
      <path d="M9 7h6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  bars: <path d="M5 20V11M12 20V4M19 20v-6" />,
  bands: (
    <>
      <path d="M3 5h18" />
      <path d="M3 5c6 0 7 7 11 7h7" />
      <path d="M3 5c7 0 8 14 12 14h6" />
    </>
  ),
  table: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <path d="M14 6v12" />
    </>
  ),
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  external: <path d="M8 16 16 8M10 8h6v6" />,
  left: <path d="m15 6-6 6 6 6" />,
  right: <path d="m9 6 6 6-6 6" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

export function Icon({
  name,
  className,
}: {
  readonly name: IconName;
  readonly className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}
