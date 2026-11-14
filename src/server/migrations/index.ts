import settings from "./0001_settings";
import secRequestSlot from "./0002_sec_request_slot";
import companies from "./0003_companies";
import reportedNumbers from "./0004_reported_numbers";
import companyCollection from "./0005_company_collection";
import filingsAndContext from "./0006_filings_and_context";
import companyLogos from "./0007_company_logos";
import fiscalYearByEndLessAWeek from "./0008_fiscal_year_by_end_less_a_week";
import unexpectedNumbers from "./0009_unexpected_numbers";
import reportText from "./0010_report_text";

// Each migration lives in its own file, named `<number>_<what it does>.ts`,
// and is listed here. A committed migration is never edited, because
// databases that already ran it would not run it again. Add a new one.
export const migrations = {
  "0001_settings": settings,
  "0002_sec_request_slot": secRequestSlot,
  "0003_companies": companies,
  "0004_reported_numbers": reportedNumbers,
  "0005_company_collection": companyCollection,
  "0006_filings_and_context": filingsAndContext,
  "0007_company_logos": companyLogos,
  "0008_fiscal_year_by_end_less_a_week": fiscalYearByEndLessAWeek,
  "0009_unexpected_numbers": unexpectedNumbers,
  "0010_report_text": reportText,
};
