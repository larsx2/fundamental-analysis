import { percent, signedPercent, signedPoints, yearOverYear } from "../../shared/format";

export type TileKind = "money" | "perShare" | "ratio";

const unchangedBelow = 0.0005;

export const changeOf = (kind: TileKind, now: number | null, then: number | null) => {
  const move =
    kind === "ratio"
      ? now === null || then === null
        ? null
        : now - then
      : yearOverYear(now, then);
  if (move === null) return null;
  if (Math.abs(move) < unchangedBelow) return "unchanged";
  return kind === "ratio" ? signedPoints(move * 100) : signedPercent(move);
};

export const grewText = (now: number | null, then: number | null) => {
  const delta = yearOverYear(now, then);
  if (delta === null) return null;
  if (Math.abs(delta) < unchangedBelow) return "stayed the same";
  return `${delta > 0 ? "grew" : "fell"} ${percent(Math.abs(delta))}`;
};

// A loss on either side makes a growth rate meaningless, so the sentence
// says what happened instead.
export const netIncomeMove = (now: number | null, then: number | null) => {
  if (now === null || then === null) return null;
  if (now > 0 && then > 0) return grewText(now, then);
  if (now > 0) return "turned positive after a loss";
  if (then > 0) return "turned to a loss";
  return "was a loss again";
};
