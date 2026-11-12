export const termKeys = [
  "revenue",
  "costOfRevenue",
  "grossProfit",
  "researchAndDevelopment",
  "sellingGeneralAndAdministrative",
  "otherOperatingExpenses",
  "operatingIncome",
  "netIncome",
] as const;
export type TermKey = (typeof termKeys)[number];

export const termNames: Record<TermKey, string> = {
  revenue: "Revenue",
  costOfRevenue: "Cost of revenue",
  grossProfit: "Gross profit",
  researchAndDevelopment: "Research and development",
  sellingGeneralAndAdministrative: "Selling, general and administrative",
  otherOperatingExpenses: "Other operating expenses",
  operatingIncome: "Operating income",
  netIncome: "Net income",
};

// For each fiscal year, the first tag in the list with a value is used, so
// newer tags come first: a restatement often arrives under the newer tag.
// A tag means only what a company files under it. `SalesRevenueNet` is all
// of Apple's revenue but leaves out Costco's membership fees, and
// `CostOfGoodsSold` is Microsoft's products only, so both come last.
export const termTags: Record<TermKey, ReadonlyArray<string>> = {
  revenue: ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"],
  costOfRevenue: ["CostOfGoodsAndServicesSold", "CostOfRevenue", "CostOfGoodsSold"],
  grossProfit: ["GrossProfit"],
  researchAndDevelopment: ["ResearchAndDevelopmentExpense"],
  sellingGeneralAndAdministrative: ["SellingGeneralAndAdministrativeExpense"],
  otherOperatingExpenses: [],
  operatingIncome: ["OperatingIncomeLoss"],
  netIncome: ["NetIncomeLoss"],
};

export const partTags = {
  sellingAndMarketing: ["SellingAndMarketingExpense"],
  generalAndAdministrative: ["GeneralAndAdministrativeExpense"],
  operatingExpensesTotal: ["OperatingExpenses"],
  costsAndExpensesTotal: ["CostsAndExpenses"],
} as const;

// Tags that cover only part of a term. They are never used for the term.
export const partialTags: ReadonlyArray<string> = [
  "SalesRevenueGoodsNet",
  "SalesRevenueServicesNet",
  "RevenueFromContractWithCustomerIncludingAssessedTax",
  "CostOfGoodsAndServicesSoldDepreciation",
  "CostOfReimbursableExpense",
  "ProfitLoss",
];

// A tag whose name starts like these but is on no list above is reported,
// so the lists can grow.
export const relatedTagPrefixes: Record<TermKey, ReadonlyArray<string>> = {
  revenue: ["Revenues", "RevenueFrom", "SalesRevenue"],
  costOfRevenue: ["CostOf"],
  grossProfit: ["GrossProfit"],
  researchAndDevelopment: ["ResearchAndDevelopment"],
  sellingGeneralAndAdministrative: [
    "SellingGeneralAndAdministrative",
    "SellingAndMarketing",
    "GeneralAndAdministrative",
  ],
  otherOperatingExpenses: [
    "OtherCostAndExpenseOperating",
    "RestructuringCharges",
    "GoodwillImpairmentLoss",
  ],
  operatingIncome: ["OperatingIncome"],
  netIncome: ["NetIncome", "ProfitLoss"],
};
