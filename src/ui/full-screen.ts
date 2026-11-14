import { type RefObject, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useStill } from "./motion";

export function useFullScreen(
  panel: RefObject<HTMLElement | null>,
  toggleButton: RefObject<HTMLElement | null>,
) {
  const still = useStill();
  const [full, setFullNow] = useState(false);
  const latest = useRef<ViewTransition | null>(null);

  const setFull = (next: boolean) => {
    const element = panel.current;
    if (still || element === null || document.startViewTransition === undefined) {
      setFullNow(next);
      return;
    }
    element.style.viewTransitionName = "full-panel";
    const transition = document.startViewTransition(() => flushSync(() => setFullNow(next)));
    latest.current = transition;
    void transition.finished.finally(() => {
      if (latest.current === transition) element.style.viewTransitionName = "";
    });
  };

  const toggle = useRef(setFull);
  toggle.current = setFull;

  useEffect(() => {
    const element = panel.current;
    const button = toggleButton.current;
    if (!full || element === null) return;
    const root = document.documentElement;
    root.classList.add("is-locked");
    const quieted: Array<HTMLElement> = [];
    for (let node: HTMLElement | null = element; node !== null && node !== document.body;) {
      const parent: HTMLElement | null = node.parentElement;
      for (const sibling of parent?.children ?? []) {
        if (
          sibling !== node &&
          sibling instanceof HTMLElement &&
          !sibling.inert &&
          !sibling.classList.contains("panel-scrim")
        ) {
          sibling.inert = true;
          quieted.push(sibling);
        }
      }
      node = parent;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target;
      if (target instanceof Element && !element.contains(target) && target !== document.body) {
        return;
      }
      toggle.current(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      root.classList.remove("is-locked");
      window.removeEventListener("keydown", onKey);
      for (const sibling of quieted) sibling.inert = false;
      if (document.activeElement === document.body || document.activeElement === null) {
        button?.focus({ preventScroll: true });
      }
    };
  }, [full, panel, toggleButton]);

  return [full, setFull] as const;
}
