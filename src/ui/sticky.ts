import { type RefObject, useEffect } from "react";

// A side panel taller than the window would need a scroller of its own to
// show its end. Instead it scrolls with the page until its end is in view,
// then stays there. Its style reads the place from --sticky-top.
export const useStickyTop = (panel: RefObject<HTMLElement | null>, gap: number) => {
  useEffect(() => {
    const element = panel.current;
    if (element === null) return;
    const place = () => {
      element.style.setProperty(
        "--sticky-top",
        `${Math.min(gap, innerHeight - element.offsetHeight - gap)}px`,
      );
    };
    place();
    const watch = new ResizeObserver(place);
    watch.observe(element);
    addEventListener("resize", place);
    return () => {
      watch.disconnect();
      removeEventListener("resize", place);
    };
  }, [panel, gap]);
};
