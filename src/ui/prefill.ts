import { type KeyboardEvent, useState } from "react";
import type { Mention } from "./mention-input";

type Box = { readonly text: string; readonly mentions: ReadonlyArray<Mention> };

export const usePrefill = (
  now: Box,
  set: (text: string, mentions: ReadonlyArray<Mention>) => void,
) => {
  const [filled, setFilled] = useState<{
    readonly text: string;
    readonly before: Box;
  } | null>(null);
  const pending = filled !== null && filled.text === now.text;
  const fill = (text: string, mentions: ReadonlyArray<Mention>) => {
    setFilled({ text, before: pending ? filled.before : now });
    set(text, mentions);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || event.defaultPrevented || !pending) return;
    event.preventDefault();
    set(filled.before.text, filled.before.mentions);
    setFilled(null);
  };
  return { fill, pending, onKeyDown };
};
