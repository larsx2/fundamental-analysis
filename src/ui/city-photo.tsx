import { useEffect, useRef } from "react";
import photo from "../assets/home-city.jpg";
import { useStill } from "./motion";

// A city at night, graded into the app's blues. The photo is shipped under
// the Unsplash licence, not MIT; src/assets/LICENCES.md says so.
export function CityPhoto() {
  const still = useStill();
  const scene = useRef<HTMLDivElement>(null);

  // The city breathes slowly and shifts a little with the pointer.
  useEffect(() => {
    if (still || scene.current === null) return;
    const element = scene.current;
    let target = { x: 0, y: 0 };
    let at = { x: 0, y: 0 };
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      target = {
        x: (event.clientX / innerWidth - 0.5) * -14,
        y: (event.clientY / innerHeight - 0.5) * -10,
      };
    };
    const tick = (time: number) => {
      at = {
        x: at.x + (target.x - at.x) * 0.04,
        y: at.y + (target.y - at.y) * 0.04,
      };
      const zoom = 1.02 + Math.sin(time / 9000) * 0.02;
      element.style.transform = `translate3d(${at.x.toFixed(2)}px, ${at.y.toFixed(2)}px, 0) scale(${zoom.toFixed(4)})`;
      frame = requestAnimationFrame(tick);
    };
    addEventListener("pointermove", onMove);
    frame = requestAnimationFrame(tick);
    return () => {
      removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, [still]);

  return (
    <>
      <div
        className="scene"
        ref={scene}
        aria-hidden="true"
        style={{ backgroundImage: `url(${photo})` }}
      />
      <div className="shade" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
    </>
  );
}
