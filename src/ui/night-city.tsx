import { useEffect, useMemo, useRef } from "react";
import { useStill } from "./motion";

// A city at night, drawn by the tool itself so it can be shared under the
// project's own licence. The same seed always draws the same skyline.
const random = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

type Building = {
  x: number;
  width: number;
  height: number;
  windows: Array<[number, number, string]>;
};

const skyline = (seed: number, count: number, low: number, high: number, lit: number) => {
  const next = random(seed);
  const buildings: Array<Building> = [];
  let x = -20;
  for (let index = 0; index < count && x < 1620; index++) {
    const width = 30 + next() * 90;
    const height = low + next() ** 1.6 * (high - low);
    const windows: Array<[number, number, string]> = [];
    for (let wy = 10; wy < height - 8; wy += 11) {
      for (let wx = 6; wx < width - 6; wx += 9) {
        if (next() < lit) {
          const warm = next() < 0.55;
          windows.push([x + wx, 900 - height + wy, warm ? "#f2c98a" : "#a9c4ff"]);
        }
      }
    }
    buildings.push({ x, width, height, windows });
    x += width + 2 + next() * 10;
  }
  return buildings;
};

export function NightCity() {
  const still = useStill();
  const scene = useRef<HTMLDivElement>(null);
  const layers = useMemo(
    () => [
      {
        buildings: skyline(7, 60, 160, 520, 0.05),
        fill: "#0d1424",
        window: 0.35,
      },
      {
        buildings: skyline(19, 50, 120, 380, 0.09),
        fill: "#0a0f1b",
        window: 0.55,
      },
      {
        buildings: skyline(31, 40, 60, 240, 0.12),
        fill: "#06090f",
        window: 0.75,
      },
    ],
    [],
  );

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
      <div className="scene" ref={scene} aria-hidden="true">
        <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" width="100%" height="100%">
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#03050b" />
              <stop offset="0.55" stopColor="#0b1428" />
              <stop offset="1" stopColor="#16223d" />
            </linearGradient>
            <radialGradient id="haze" cx="0.5" cy="1" r="0.7">
              <stop offset="0" stopColor="#3d5a8f" stopOpacity="0.35" />
              <stop offset="1" stopColor="#3d5a8f" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="1600" height="900" fill="url(#sky)" />
          <rect width="1600" height="900" fill="url(#haze)" />
          {layers.map((layer, index) => (
            <g key={index}>
              {layer.buildings.map((building) => (
                <rect
                  key={building.x}
                  x={building.x}
                  y={900 - building.height}
                  width={building.width}
                  height={building.height}
                  fill={layer.fill}
                />
              ))}
              {layer.buildings.flatMap((building) =>
                building.windows.map(([x, y, color]) => (
                  <rect
                    key={`${x}-${y}`}
                    x={x}
                    y={y}
                    width={3}
                    height={4}
                    fill={color}
                    opacity={layer.window}
                  />
                )),
              )}
            </g>
          ))}
        </svg>
      </div>
      <div className="shade" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
    </>
  );
}
