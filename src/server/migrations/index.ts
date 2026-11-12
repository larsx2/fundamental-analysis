import settings from "./0001_settings";
import secRequestSlot from "./0002_sec_request_slot";
import companies from "./0003_companies";
import reportedNumbers from "./0004_reported_numbers";
import companyCollection from "./0005_company_collection";
import filingsAndContext from "./0006_filings_and_context";

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
};
