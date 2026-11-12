import { useSyncExternalStore } from "react";

// A term explains itself until its card has been opened once. After that it
// reads as plain text, and the glossary still holds it. The list is kept in
// this browser only; without it every term stays underlined.
const key = "learned-terms";
const listeners = new Set<() => void>();
const none: ReadonlySet<string> = new Set();
let cached: { raw: string | null; set: ReadonlySet<string> } = { raw: null, set: none };

const read = (): ReadonlySet<string> => {
  let raw: string | null = null;
  try {
    raw = globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return none;
  }
  if (raw === cached.raw) return cached.set;
  let set = none;
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    if (Array.isArray(value))
      set = new Set(value.filter((each): each is string => typeof each === "string"));
  } catch {
    set = none;
  }
  cached = { raw, set };
  return set;
};

const write = (names: ReadonlySet<string>) => {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify([...names]));
  } catch {
    // Private windows and blocked storage simply forget.
  }
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useLearnedTerms = () => useSyncExternalStore(subscribe, read, () => none);

export const learnTerm = (name: string) => {
  const names = read();
  if (!names.has(name)) write(new Set([...names, name]));
};

export const forgetLearnedTerms = () => write(none);
