import { type RefObject, useEffect } from "react";

const following = { on: true };

export function useFollowBottom(target: RefObject<HTMLElement | null>, restartOn: unknown) {
  useEffect(() => {
    following.on = true;
  }, [restartOn]);

  useEffect(() => {
    const leave = () => {
      const gap = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      following.on = gap < 80;
    };
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY < 0) following.on = false;
      else requestAnimationFrame(leave);
    };
    const onKey = (event: KeyboardEvent) => {
      if (["ArrowUp", "PageUp", "Home"].includes(event.key)) following.on = false;
    };
    const onTouch = () => requestAnimationFrame(leave);
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchmove", onTouch, { passive: true });
    const element = target.current;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior = still ? "auto" : "smooth";
    const pageTop = (each: Element) => each.getBoundingClientRect().top + window.scrollY;
    const follow = new ResizeObserver(() => {
      if (!following.on) return;
      const turn = element?.querySelectorAll(".ask-turn");
      const last = turn?.[turn.length - 1];
      const lead = last?.querySelector(".ask-lead");
      const question = last?.querySelector(".ask-question");
      if (lead == null || question == null) {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
        return;
      }
      following.on = false;
      const start = pageTop(question);
      const begins = pageTop(lead);
      const top = begins - start < window.innerHeight / 3 ? start : begins;
      window.scrollTo({ top: top - 32, behavior });
    });
    if (element !== null) follow.observe(element);
    return () => {
      follow.disconnect();
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchmove", onTouch);
    };
  }, [target]);
}
