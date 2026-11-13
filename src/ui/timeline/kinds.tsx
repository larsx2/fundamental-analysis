import type { ReactNode } from "react";
import type { FigureKey } from "../../shared/figure-keys";
import { Term } from "../term";

export const kinds: ReadonlyArray<{
  readonly key: FigureKey;
  readonly label: ReactNode;
  readonly plain: string;
  readonly inline: ReactNode;
}> = [
  {
    key: "capitalExpenditure",
    label: <Term name="Capital expenditure" />,
    plain: "capital expenditure",
    inline: <Term name="Capital expenditure">capital expenditure</Term>,
  },
  {
    key: "acquisitions",
    label: <Term name="Acquisition" />,
    plain: "acquisitions",
    inline: <Term name="Acquisition">acquisitions</Term>,
  },
  {
    key: "shareBuybacks",
    label: <Term name="Share buyback" />,
    plain: "share buybacks",
    inline: <Term name="Share buyback">share buybacks</Term>,
  },
  {
    key: "dividends",
    label: <Term name="Dividend" />,
    plain: "dividends",
    inline: <Term name="Dividend">dividends</Term>,
  },
  {
    key: "debtRaised",
    label: (
      <>
        <Term name="Debt" /> raised
      </>
    ),
    plain: "debt raised",
    inline: (
      <>
        raising <Term name="Debt">debt</Term>
      </>
    ),
  },
  {
    key: "debtRepaid",
    label: (
      <>
        <Term name="Debt" /> repaid
      </>
    ),
    plain: "debt repaid",
    inline: (
      <>
        repaying <Term name="Debt">debt</Term>
      </>
    ),
  },
];
