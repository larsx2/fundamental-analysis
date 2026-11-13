import type { StatementYear } from "../../functions/company";
import { valueOf } from "../../shared/figures";
import { money, signedPercent, yearOverYear } from "../../shared/format";
import { GapMark } from "../marks";
import { Term } from "../term";

export function YearsTable({
  years,
  year,
  onChoose,
}: {
  readonly years: ReadonlyArray<StatementYear>;
  readonly year: StatementYear;
  readonly onChoose: (fiscalYear: number) => void;
}) {
  const change = (point: StatementYear, key: "revenue" | "netIncome") => {
    const before = years.find((each) => each.fiscalYear === point.fiscalYear - 1);
    const delta =
      before === undefined
        ? null
        : yearOverYear(valueOf(point.terms[key]), valueOf(before.terms[key]));
    return delta === null ? "" : signedPercent(delta);
  };
  return (
    <div className="table-scroll">
      <table className="figures years-table">
        <thead>
          <tr>
            <th scope="col">
              <Term name="Fiscal year" />
            </th>
            <th scope="col">
              <Term name="Revenue" />
            </th>
            <th scope="col">Change</th>
            <th scope="col">
              <Term name="Net income" />
            </th>
            <th scope="col">Change</th>
          </tr>
        </thead>
        <tbody>
          {years.map((point) => {
            const revenue = valueOf(point.terms.revenue);
            const net = valueOf(point.terms.netIncome);
            return (
              <tr key={point.fiscalYear} aria-current={point === year ? "true" : undefined}>
                <th scope="row">
                  <button
                    type="button"
                    className="link-button no-underline"
                    onClick={() => onChoose(point.fiscalYear)}
                  >
                    Fiscal {point.fiscalYear}
                  </button>
                </th>
                <td className="text-text-1">{revenue === null ? <GapMark /> : money(revenue)}</td>
                <td>
                  <span className="change">{change(point, "revenue")}</span>
                </td>
                <td className="text-text-1">{net === null ? <GapMark /> : money(net)}</td>
                <td>
                  <span className="change">{change(point, "netIncome")}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
