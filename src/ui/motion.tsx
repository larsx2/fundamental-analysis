import { animate, useReducedMotion } from "motion/react";
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";

// Motion's own check of the reduced motion setting, so movement driven from
// JavaScript stops too, not only CSS.
export const useStill = () => useReducedMotion() === true;

export const glide = { duration: 0.45, ease: [0.65, 0, 0.35, 1] } as const;

// A number that rolls from its old value to its new one. Screen readers get
// the final text only.
export function RollingNumber({
  value,
  format,
  className,
}: {
  readonly value: number;
  readonly format: (value: number) => string;
  readonly className?: string;
}) {
  const still = useStill();
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (still || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const controls = animate(from.current, value, {
      ...glide,
      onUpdate: (latest) => setShown(latest),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, still]);

  return (
    <span className={className}>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="visually-hidden">{format(value)}</span>
    </span>
  );
}

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export const useWidth = (ref: RefObject<HTMLElement | null>, fallback = 960) => {
  const [width, setWidth] = useState(fallback);
  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
};

// Charts are drawn in the browser only: their size comes from the screen, and
// their first movement starts from the baseline once they are there.
export const useMounted = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
};

export const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const list = window.matchMedia(query);
    setMatches(list.matches);
    const onChange = () => setMatches(list.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);
  return matches;
};
