import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// A small tooltip that follows the pointer over a chart. Everything it says
// is also reachable without a pointer, in the table or the side panel.
export const useChartTip = () => {
  const [tip, setTip] = useState<{
    x: number;
    y: number;
    content: ReactNode;
  } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(0);

  const show = useCallback((event: { clientX: number; clientY: number }, content: ReactNode) => {
    setTip({ x: event.clientX, y: event.clientY, content });
  }, []);
  const hide = useCallback(() => setTip(null), []);

  useLayoutEffect(() => {
    if (tip === null || box.current === null) return;
    setLeft(Math.max(12, Math.min(tip.x + 14, window.innerWidth - box.current.offsetWidth - 12)));
  }, [tip]);

  const element =
    tip === null || typeof document === "undefined"
      ? null
      : createPortal(
          <div ref={box} className="tooltip" style={{ left, top: tip.y + 14 }} aria-hidden="true">
            {tip.content}
          </div>,
          document.body,
        );

  return { show, hide, element };
};
