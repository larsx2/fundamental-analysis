import { useEffect, useRef } from "react";
import { useStill } from "../motion";

export function HomeBackdrop() {
  const still = useStill();
  const field = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = field.current;
    if (node === null || still) return;
    let frame = 0;
    const tick = (now: number) => {
      const seconds = now / 1000;
      const x =
        window.innerWidth * (0.66 + 0.2 * Math.sin(seconds / 17) + 0.06 * Math.sin(seconds / 7.3));
      const y =
        window.innerHeight * (0.3 + 0.14 * Math.cos(seconds / 13) + 0.05 * Math.sin(seconds / 5.9));
      node.style.setProperty("--x", `${x.toFixed(1)}px`);
      node.style.setProperty("--y", `${y.toFixed(1)}px`);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [still]);

  return (
    <div className="home-backdrop" aria-hidden="true">
      <div className="home-light high" />
      <div className="home-light low" />
      <div className="home-field" />
      <div className="home-field lit" ref={field} />
      <div className="home-field wave" />
      <div className="home-drift">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="grain" />
    </div>
  );
}
