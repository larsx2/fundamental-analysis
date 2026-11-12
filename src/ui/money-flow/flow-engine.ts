export type FlowNode = {
  readonly id: string;
  readonly col: number;
  readonly color: string;
  readonly total?: boolean;
  readonly hero?: boolean;
};

export type FlowLink = { readonly source: string; readonly target: string };

export type FlowValues = Readonly<Record<string, number>>;

type Place = { readonly x: number; readonly y: number; readonly o?: number };
export type Layout = (
  width: number,
  height: number,
  lane: number,
  values: FlowValues,
) => { readonly k: number; readonly at: Readonly<Record<string, Place>> };

export type FlowSpec = {
  readonly nodes: ReadonlyArray<FlowNode>;
  readonly links: ReadonlyArray<FlowLink>;
  readonly layouts: readonly [Layout, Layout];
  readonly label: (id: string, values: FlowValues) => string;
  readonly describe: (values: FlowValues) => string;
};

export type FlowHandlers = {
  readonly onPick: (id: string | null) => void;
};

const ns = "http://www.w3.org/2000/svg";
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const ease = (t: number) => 1 - Math.pow(1 - t, 4);

const minBand = 3;
const visible = (h: number) => (h <= 0 ? 0 : Math.max(h, Math.min(minBand, h * 20)));

export const labelRoom = 62;
const short = (h: number) => h < 72;

type Placed = Record<string, { x: number; y: number }>;

export function stack(
  ids: ReadonlyArray<string>,
  x: number,
  y0: number,
  k: number,
  values: FlowValues,
  gap: number,
  at: Placed,
) {
  let y = y0;
  ids.forEach((id, index) => {
    const h = visible((values[id] ?? 0) * k);
    const room = short(h) ? labelRoom * Math.min(1, h * 2) : 0;
    if (index > 0) y += Math.max(gap * Math.min(1, h * 2), room);
    else y = Math.max(y, room);
    at[id] = { x, y };
    y += h;
  });
  return y;
}

export function stackUp(
  ids: ReadonlyArray<string>,
  x: number,
  bottom: number,
  k: number,
  values: FlowValues,
  gap: number,
  at: Placed,
) {
  const height = stack(ids, x, 0, k, values, gap, {});
  return stack(ids, x, bottom - height, k, values, gap, at);
}

export function fitScale(height: (k: number) => number, total: number, available: number) {
  if (total <= 0) return 0;
  // A smaller scale makes more parts short, and short parts need room for
  // their labels, so the answer is searched for rather than worked out.
  let low = 0;
  let high = available / total;
  if (height(high) <= available) return high;
  for (let step = 0; step < 32; step++) {
    const middle = (low + high) / 2;
    if (height(middle) <= available) low = middle;
    else high = middle;
  }
  return low;
}

export const columnsHeight =
  (columns: ReadonlyArray<ReadonlyArray<string>>, values: FlowValues, gap: number) => (k: number) =>
    Math.max(...columns.map((ids) => stack(ids, 0, 0, k, values, gap, {})));

const bandValue = (link: FlowLink, values: FlowValues) =>
  values[`${link.source}>${link.target}`] ?? values[link.target] ?? 0;

export function createFlow(
  host: HTMLElement,
  spec: FlowSpec,
  start: FlowValues,
  handlers: FlowHandlers,
  options: { readonly still: boolean; readonly canHover: boolean },
) {
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("role", "img");
  const defs = document.createElementNS(ns, "defs");
  const clip = document.createElementNS(ns, "clipPath");
  clip.id = `${host.id}-clip`;
  const clipRect = document.createElementNS(ns, "rect");
  clipRect.setAttribute("y", "-20");
  clipRect.setAttribute("height", "4000");
  clipRect.setAttribute("width", "0");
  clip.append(clipRect);
  defs.append(clip);
  const bandLayer = document.createElementNS(ns, "g");
  const blockLayer = document.createElementNS(ns, "g");
  bandLayer.setAttribute("clip-path", `url(#${clip.id})`);
  blockLayer.setAttribute("clip-path", `url(#${clip.id})`);
  svg.append(defs, bandLayer, blockLayer);
  const labelLayer = document.createElement("div");
  labelLayer.className = "flow-labels";
  host.append(svg, labelLayer);

  const byId = new Map(spec.nodes.map((node) => [node.id, node]));
  const colorOf = (node: FlowNode) => (node.total ? "var(--color-flow-total)" : node.color);
  let values: Record<string, number> = { ...start };
  let pinned: ReadonlySet<string> | null = null;

  const lineage = (id: string) => {
    const set = new Set([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const link of spec.links) {
        if (set.has(link.target) && !set.has(link.source)) {
          set.add(link.source);
          grew = true;
        }
      }
    }
    return set;
  };

  const blocks = new Map<
    string,
    {
      block: SVGRectElement;
      stripe: SVGRectElement;
      label: HTMLDivElement;
      html: string;
    }
  >();

  const light = (set: ReadonlySet<string> | null) => {
    for (const node of spec.nodes) {
      const off = set !== null && !set.has(node.id);
      const parts = blocks.get(node.id)!;
      for (const element of [parts.block, parts.stripe, parts.label]) {
        element.classList.toggle("dim", off);
      }
    }
    spec.links.forEach((link, index) => {
      bands[index]!.classList.toggle(
        "dim",
        set !== null && !(set.has(link.source) && set.has(link.target)),
      );
    });
  };

  const hoverable = (element: Element, id: string) => {
    if (!options.canHover) return;
    element.addEventListener("pointerenter", () => light(lineage(id)));
    element.addEventListener("pointerleave", () => light(pinned));
  };

  const pick = (id: string) => (event: Event) => {
    event.stopPropagation();
    handlers.onPick(id);
  };

  for (const node of spec.nodes) {
    const block = document.createElementNS(ns, "rect");
    block.classList.add("flow-block");
    block.setAttribute("rx", "3");
    block.style.fill = colorOf(node);
    block.style.fillOpacity = String(node.hero ? 0.2 : node.total ? 0.07 : 0.12);
    const stripe = document.createElementNS(ns, "rect");
    stripe.setAttribute("width", "4");
    stripe.setAttribute("rx", "3");
    stripe.style.fill = colorOf(node);
    blockLayer.append(block, stripe);
    const label = document.createElement("div");
    label.className = "flow-label";
    label.setAttribute("role", "button");
    labelLayer.append(label);
    blocks.set(node.id, { block, stripe, label, html: "" });
    block.addEventListener("click", pick(node.id));
    label.addEventListener("click", pick(node.id));
    label.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        handlers.onPick(node.id);
      }
    });
    hoverable(block, node.id);
    hoverable(label, node.id);
  }

  const bands = spec.links.map((link, index) => {
    const path = document.createElementNS(ns, "path");
    const gradient = document.createElementNS(ns, "linearGradient");
    gradient.id = `${host.id}-band-${index}`;
    const source = byId.get(link.source)!;
    const target = byId.get(link.target)!;
    gradient.innerHTML = `<stop offset="0" style="stop-color:${colorOf(source)};stop-opacity:${source.total ? 0.24 : 0.4}"/><stop offset="1" style="stop-color:${colorOf(target)};stop-opacity:${target.total ? 0.34 : 0.62}"/>`;
    defs.append(gradient);
    path.style.fill = `url(#${gradient.id})`;
    path.classList.add("flow-band");
    bandLayer.append(path);
    path.addEventListener("click", pick(link.target));
    hoverable(path, link.target);
    return path;
  });

  const onEmpty = () => handlers.onPick(null);
  host.addEventListener("click", onEmpty);

  let width = 0;
  let height = 0;
  let zoom = 0;
  let reveal = 1;
  const lane = () => Math.round(Math.min(200, Math.max(Math.min(118, width / 3.6), width / 5.6)));

  const draw = () => {
    if (width === 0) return;
    const laneWidth = lane();
    const e = ease(zoom);
    const a = spec.layouts[0](width, height, laneWidth, values);
    const b = spec.layouts[1](width, height, laneWidth, values);
    const k = lerp(a.k, b.k, e);
    const at = new Map<string, { x: number; y: number; o: number; h: number }>();
    for (const node of spec.nodes) {
      const p = a.at[node.id] ?? { x: 0, y: 0, o: 0 };
      const q = b.at[node.id] ?? { x: 0, y: 0, o: 0 };
      const h = visible((values[node.id] ?? 0) * k);
      at.set(node.id, {
        x: lerp(p.x, q.x, e),
        y: lerp(p.y, q.y, e),
        o: lerp(p.o ?? 1, q.o ?? 1, e) * Math.min(1, h / 2),
        h,
      });
    }
    const bandHeights = spec.links.map((link) => visible(bandValue(link, values) * k));
    const sumIn = new Map<string, number>();
    const sumOut = new Map<string, number>();
    spec.links.forEach((link, index) => {
      sumOut.set(link.source, (sumOut.get(link.source) ?? 0) + bandHeights[index]!);
      sumIn.set(link.target, (sumIn.get(link.target) ?? 0) + bandHeights[index]!);
    });
    for (const [id, place] of at) {
      place.h = Math.max(place.h, sumIn.get(id) ?? 0, sumOut.get(id) ?? 0);
    }

    const outAt = new Map<string, number>();
    const inAt = new Map<string, number>();
    spec.links.forEach((link, index) => {
      const s = at.get(link.source)!;
      const t = at.get(link.target)!;
      const h = bandHeights[index]!;
      const sy = s.y + (outAt.get(link.source) ?? 0);
      const ty = t.y + (inAt.get(link.target) ?? 0);
      outAt.set(link.source, (outAt.get(link.source) ?? 0) + h);
      inAt.set(link.target, (inAt.get(link.target) ?? 0) + h);
      const x0 = s.x + laneWidth;
      const x1 = t.x;
      const m = (x0 + x1) / 2;
      const band = bands[index]!;
      band.setAttribute(
        "d",
        `M${x0},${sy}C${m},${sy} ${m},${ty} ${x1},${ty}L${x1},${ty + h}C${m},${ty + h} ${m},${sy + h} ${x0},${sy + h}Z`,
      );
      const sourceShown = lerp(a.at[link.source]?.o ?? 1, b.at[link.source]?.o ?? 1, e);
      band.style.setProperty("--o", String(Math.min(sourceShown, Math.min(1, h / 0.6))));
    });

    const columns = new Map<
      number,
      Array<{ id: string; y: number; lh: number; o: number; x: number }>
    >();
    for (const node of spec.nodes) {
      const place = at.get(node.id)!;
      const parts = blocks.get(node.id)!;
      for (const rect of [parts.block, parts.stripe]) {
        rect.setAttribute("x", String(place.x));
        rect.setAttribute("y", String(place.y));
        rect.setAttribute("height", String(Math.max(place.h, place.o > 0.05 ? 2 : 0)));
        rect.style.setProperty("--o", String(place.o));
      }
      parts.block.setAttribute("width", String(laneWidth));
      const html = spec.label(node.id, values);
      if (html !== parts.html) {
        parts.label.innerHTML = html;
        parts.html = html;
      }
      parts.label.style.width = `${laneWidth - 20}px`;
      const lh = parts.label.offsetHeight || 40;
      const inside = place.h >= lh + 6;
      const column = columns.get(node.col) ?? [];
      column.push({
        id: node.id,
        y: inside ? place.y + place.h / 2 - lh / 2 : place.y - lh - 4,
        lh,
        o: place.o,
        x: place.x,
      });
      columns.set(node.col, column);
    }
    for (const items of columns.values()) {
      const shown = items.filter((item) => item.o > 0.5).sort((p, q) => p.y - q.y);
      shown.forEach((item, index) => {
        const above = shown[index - 1];
        item.y = Math.max(item.y, above === undefined ? 0 : above.y + above.lh + 6);
      });
      for (let index = shown.length - 1; index >= 0; index--) {
        const item = shown[index]!;
        const below = shown[index + 1];
        item.y = Math.min(item.y, below === undefined ? height - item.lh : below.y - item.lh - 6);
      }
      for (const item of items) {
        const label = blocks.get(item.id)!.label;
        label.style.transform = `translate(${item.x + 14}px, ${item.y}px)`;
        const revealed = Math.max(0, Math.min(1, (reveal * (width + 40) - item.x) / 120));
        const opacity = Math.max(0, (item.o - 0.5) * 2) * revealed;
        label.style.setProperty("--o", String(opacity));
        label.style.pointerEvents = opacity > 0.5 ? "auto" : "none";
        label.tabIndex = opacity > 0.5 ? 0 : -1;
      }
    }
    svg.setAttribute("aria-label", spec.describe(values));
  };

  const measure = () => {
    width = host.clientWidth;
    height = host.clientHeight;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  };

  const run = (duration: number, step: (k: number) => void) => {
    if (options.still) {
      step(1);
      return () => {};
    }
    const begun = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - begun) / duration));
      step(k);
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  };

  let stopZoom = () => {};
  let stopValues = () => {};
  const observer = new ResizeObserver(() => {
    measure();
    if (reveal === 1) clipRect.setAttribute("width", String(width + 40));
    draw();
  });
  observer.observe(host);
  measure();
  draw();

  return {
    sweep() {
      reveal = 0;
      run(1100, (k) => {
        reveal = ease(k);
        clipRect.setAttribute("width", String(reveal * (width + 40)));
        draw();
      });
    },
    zoomTo(target: number) {
      stopZoom();
      const from = zoom;
      stopZoom = run(700, (k) => {
        zoom = lerp(from, target, k);
        draw();
      });
    },
    setValues(next: FlowValues) {
      stopValues();
      const from = { ...values };
      stopValues = run(650, (k) => {
        const e = ease(k);
        const blended: Record<string, number> = {};
        for (const key of Object.keys(next)) blended[key] = lerp(from[key] ?? 0, next[key]!, e);
        values = blended;
        draw();
      });
    },
    focus(id: string | null) {
      pinned = id === null ? null : lineage(id);
      light(pinned);
    },
    redraw() {
      for (const parts of blocks.values()) parts.html = "";
      draw();
    },
    destroy() {
      stopZoom();
      stopValues();
      observer.disconnect();
      host.removeEventListener("click", onEmpty);
      host.replaceChildren();
    },
  };
}

export type Flow = ReturnType<typeof createFlow>;
