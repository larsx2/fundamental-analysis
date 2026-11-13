import type { StatementYear } from "../../functions/company";
import { type FigureKey, figureOf } from "../../shared/figure-keys";
import { isDoubtful, valueOf } from "../../shared/figures";
import { money, percent } from "../../shared/format";
import type { ReadyCompany } from "../company-frame";
import { shortName } from "../logo-tile";
import { DoubtfulMark } from "../marks";
import { Term } from "../term";
import { statements, type Tab } from "./rows";

export function Lead({
  view,
  year,
  tab,
}: {
  readonly view: ReadyCompany;
  readonly year: StatementYear;
  readonly tab: Tab;
}) {
  const name = shortName(view.name);
  const fy = year.fiscalYear;
  const v = (key: FigureKey) => valueOf(figureOf(year, key));
  const strong = (value: number | null) => (
    <strong>{value === null ? "a gap" : money(value)}</strong>
  );
  const used: Record<Tab, ReadonlyArray<FigureKey>> = {
    income: ["revenue", "netIncome"],
    balance: ["assets", "liabilities", "equity"],
    cash: ["operatingCashFlow", "capitalExpenditure"],
  };
  const doubtful = used[tab].some((key) => isDoubtful(figureOf(year, key)));
  let text;
  if (tab === "income" && v("revenue") !== null && v("netIncome") !== null) {
    const margin = v("netMargin");
    text = (
      <>
        The <Term name="Income statement">income statement</Term> shows that in fiscal {fy} {name}{" "}
        turned {strong(v("revenue"))} of <Term name="Revenue">revenue</Term> into{" "}
        {strong(v("netIncome"))} of <Term name="Net income">net income</Term>
        {margin === null ? (
          ""
        ) : (
          <>
            , a <Term name="Margin">margin</Term> of <strong>{percent(margin)}</strong>
          </>
        )}
        .
      </>
    );
  } else if (
    tab === "balance" &&
    v("assets") !== null &&
    v("liabilities") !== null &&
    v("equity") !== null
  ) {
    text = (
      <>
        The <Term name="Balance sheet">balance sheet</Term> shows that at the end of fiscal {fy}{" "}
        {name} owned {strong(v("assets"))} of <Term name="Asset">assets</Term> and owed{" "}
        {strong(v("liabilities"))} of <Term name="Liability">liabilities</Term>, leaving{" "}
        {strong(v("equity"))} of <Term name="Equity">equity</Term>.
      </>
    );
  } else if (
    tab === "cash" &&
    v("operatingCashFlow") !== null &&
    v("capitalExpenditure") !== null
  ) {
    text = (
      <>
        The <Term name="Cash flow statement">cash flow statement</Term> shows that in fiscal {fy}{" "}
        {name} brought in {strong(v("operatingCashFlow"))} of{" "}
        <Term name="Operating cash flow">operating cash flow</Term> and spent{" "}
        {strong(v("capitalExpenditure"))} on{" "}
        <Term name="Capital expenditure">capital expenditure</Term>, leaving{" "}
        {strong(v("freeCashFlow"))} of <Term name="Free cash flow">free cash flow</Term>.
      </>
    );
  } else {
    text = (
      <>
        The <Term name={statements[tab].title}>{statements[tab].title.toLowerCase()}</Term> of{" "}
        {name}, fiscal year by fiscal year.
      </>
    );
  }
  return (
    <p className="lead-line">
      {text}
      {doubtful && (
        <>
          {" "}
          <DoubtfulMark /> One of these is a <Term name="Doubtful number">doubtful number</Term>.
          Choose a number marked {"⚠"} in the table to see the check it failed.
        </>
      )}
    </p>
  );
}
