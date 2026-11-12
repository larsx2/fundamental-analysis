const dayInMilliseconds = 24 * 60 * 60 * 1000;

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / dayInMilliseconds);

// Every ready company is checked at least once a month, because current
// reports and corrected annual reports can arrive at any time.
export const usualCheckDays = 30;

// Around its next annual report, a company is checked every week.
export const nearReportCheckDays = 7;

// The next fiscal year ends 364 to 371 days after the last one. The annual
// report is due 60, 75 or 90 days after that, depending on the company's
// size, and a company may ask for 15 days more.
const reportWindowFrom = 364;
const reportWindowTo = 371 + 90 + 15;

export const isDueForCheck = (company: {
  readonly lastCheckedOn: string | null;
  readonly yearEndOn: string | null;
  readonly today: string;
}) => {
  if (company.lastCheckedOn === null) return true;
  const sinceCheck = daysBetween(company.lastCheckedOn, company.today);
  if (sinceCheck >= usualCheckDays) return true;
  if (company.yearEndOn === null) return false;
  const sinceYearEnd = daysBetween(company.yearEndOn, company.today);
  const nearReport = sinceYearEnd >= reportWindowFrom && sinceYearEnd <= reportWindowTo;
  return nearReport && sinceCheck >= nearReportCheckDays;
};
