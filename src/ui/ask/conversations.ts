import { useSyncExternalStore } from "react";
import { shortName } from "../logo-tile";
import type { AskState } from "./use-ask";

export type Company = {
  readonly ticker: string;
  readonly cik: number;
  readonly name: string;
};

export type Turn = {
  readonly id: string;
  readonly question: string;
  readonly year: number | null;
  readonly askedAt: number;
  readonly state: AskState;
  readonly ticker?: string;
  readonly cik?: number;
  readonly name?: string;
  readonly companies?: ReadonlyArray<Company>;
};

export type Thread = {
  readonly id: string;
  readonly ticker: string | null;
  readonly cik: number | null;
  readonly name: string | null;
  readonly turns: ReadonlyArray<Turn>;
  readonly updatedAt: number;
};

const key = "ask-threads";
const keptThreads = 40;
const keptTurns = 20;
const none: ReadonlyArray<Thread> = [];
const listeners = new Set<() => void>();
let cached: { raw: string | null; list: ReadonlyArray<Thread> } = {
  raw: null,
  list: none,
};

const isThread = (value: unknown): value is Thread =>
  typeof value === "object" &&
  value !== null &&
  "id" in value &&
  "ticker" in value &&
  "turns" in value &&
  typeof value.id === "string" &&
  Array.isArray(value.turns);

const storage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

const fromEarlierFormat = (store: Storage): ReadonlyArray<Thread> => {
  const threads: Array<Thread> = [];
  for (let index = 0; index < store.length; index += 1) {
    const name = store.key(index);
    if (name === null || !name.startsWith("conversations:")) continue;
    try {
      const value: unknown = JSON.parse(store.getItem(name) ?? "[]");
      if (!Array.isArray(value)) continue;
      for (const old of value as ReadonlyArray<Turn>) {
        if (typeof old?.id !== "string" || typeof old.question !== "string") continue;
        threads.push({
          id: old.id,
          ticker: name.slice("conversations:".length),
          cik: 0,
          name: name.slice("conversations:".length),
          turns: [old],
          updatedAt: old.askedAt,
        });
      }
    } catch {
      continue;
    }
  }
  return threads.sort((a, b) => b.updatedAt - a.updatedAt);
};

const read = (): ReadonlyArray<Thread> => {
  const store = storage();
  if (store === null) return none;
  let raw: string | null = null;
  try {
    raw = store.getItem(key);
  } catch {
    return none;
  }
  if (raw === cached.raw) return cached.list;
  let list = none;
  if (raw === null) {
    list = fromEarlierFormat(store);
  } else {
    try {
      const value: unknown = JSON.parse(raw);
      if (Array.isArray(value)) list = value.filter(isThread);
    } catch {
      list = none;
    }
  }
  cached = { raw, list };
  return list;
};

const notify = () => {
  for (const listener of listeners) listener();
};

const write = (list: ReadonlyArray<Thread>) => {
  const store = storage();
  const sorted = [...list].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, keptThreads);
  for (let count = sorted.length; count >= 0; count -= 1) {
    try {
      store?.setItem(key, JSON.stringify(sorted.slice(0, count)));
      break;
    } catch {
      continue;
    }
  }
  notify();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === key) listener();
  };
  globalThis.addEventListener?.("storage", onStorage);
  return () => {
    listeners.delete(listener);
    globalThis.removeEventListener?.("storage", onStorage);
  };
};

export const companiesOfTurn = (turn: Turn): ReadonlyArray<Company> =>
  turn.companies ??
  (turn.ticker !== undefined && turn.cik !== undefined && turn.name !== undefined
    ? [{ ticker: turn.ticker, cik: turn.cik, name: turn.name }]
    : []);

export const companiesOf = (thread: Thread): ReadonlyArray<Company> => {
  const seen = new Map<number, Company>();
  for (const company of thread.turns.flatMap(companiesOfTurn)) {
    if (!seen.has(company.cik)) seen.set(company.cik, company);
  }
  if (seen.size === 0 && thread.ticker !== null && thread.cik !== null && thread.name !== null) {
    seen.set(thread.cik, { ticker: thread.ticker, cik: thread.cik, name: thread.name });
  }
  return [...seen.values()];
};

export const withoutAt = (question: string, companies: ReadonlyArray<Company>) =>
  companies.reduce((text, company) => {
    const name = shortName(company.name);
    return name === "" ? text : text.replaceAll(`@${name}`, name);
  }, question);

export const useThreads = () => useSyncExternalStore(subscribe, read, () => none);

const ignore = () => () => undefined;

export const useThreadsKnown = () =>
  useSyncExternalStore(
    ignore,
    () => true,
    () => false,
  );

export const startThread = (thread: Omit<Thread, "updatedAt">) => {
  const updatedAt = thread.turns.at(-1)?.askedAt ?? Date.now();
  write([{ ...thread, updatedAt }, ...read().filter((each) => each.id !== thread.id)]);
};

export const addTurn = (threadId: string, turn: Turn) =>
  write(
    read().map((thread) =>
      thread.id === threadId
        ? {
            ...thread,
            turns: [...thread.turns, turn].slice(-keptTurns),
            updatedAt: turn.askedAt,
          }
        : thread,
    ),
  );

export const deleteThread = (threadId: string) =>
  write(read().filter((thread) => thread.id !== threadId));

export const clearThreads = () => {
  const store = storage();
  try {
    store?.setItem(key, "[]");
    const old: Array<string> = [];
    for (let index = 0; index < (store?.length ?? 0); index += 1) {
      const name = store?.key(index);
      if (name?.startsWith("conversations:")) old.push(name);
    }
    for (const name of old) store?.removeItem(name);
  } catch {
    return;
  }
  notify();
};
