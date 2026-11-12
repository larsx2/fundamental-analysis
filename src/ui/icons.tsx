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
      <path d="M3 20h18" />
      <path d="M5 20V5.5A1.5 1.5 0 0 1 6.5 4h5A1.5 1.5 0 0 1 13 5.5V20" />
      <path d="M13 10h4.5a1.5 1.5 0 0 1 1.5 1.5V20" />
      <path d="M8 8h2M8 12h2M8 16h2" />
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
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6.5 12h.01M17.5 12h.01" />
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
      <path d="M3 19h18" />
      <path d="M6 19v-9M12 19v-4M18 19v-11" />
      <circle cx="6" cy="8" r="2" />
      <circle cx="12" cy="13" r="2" />
      <circle cx="18" cy="6" r="2" />
    </>
  ),
  glossary: (
    <>
      <path d="M12 6.5C10.2 5.2 7.5 4.5 3.5 4.5V18c4 0 6.7.7 8.5 2 1.8-1.3 4.5-2 8.5-2V4.5c-4 0-6.7.7-8.5 2z" />
      <path d="M12 6.5V20" />
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
  more: (
    <>
      <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
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
