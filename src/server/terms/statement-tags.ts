// The terms of the balance sheet and the cash flow statement, and the ones
// worked out from them, beside the eight terms of the money flow.

export const balanceKeys = [
  "cash",
  "receivables",
  "inventory",
  "propertyPlantAndEquipment",
  "goodwill",
  "assets",
  "debt",
  "netDebt",
  "liabilities",
  "equity",
] as const;
export type BalanceKey = (typeof balanceKeys)[number];

export const cashFlowKeys = [
  "operatingCashFlow",
  "depreciationAndAmortization",
  "stockBasedCompensation",
  "capitalExpenditure",
  "freeCashFlow",
  "acquisitions",
  "dividends",
  "shareBuybacks",
  "debtRaised",
  "debtRepaid",
] as const;
export type CashFlowKey = (typeof cashFlowKeys)[number];

export const ratioKeys = ["grossMargin", "operatingMargin", "netMargin"] as const;
export type RatioKey = (typeof ratioKeys)[number];

// As with the eight terms, the first tag in a list with a value is used, so
// a newer tag comes before an older one.
export const balanceTags: Record<Exclude<BalanceKey, "debt" | "netDebt">, ReadonlyArray<string>> = {
  cash: ["CashAndCashEquivalentsAtCarryingValue"],
  receivables: ["AccountsReceivableNetCurrent", "ReceivablesNetCurrent"],
  inventory: ["InventoryNet"],
  propertyPlantAndEquipment: ["PropertyPlantAndEquipmentNet"],
  goodwill: ["Goodwill"],
  assets: ["Assets"],
  liabilities: ["Liabilities"],
  equity: [
    "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    "StockholdersEquity",
  ],
};

export const cashIncludingRestrictedCash = {
  name: "Cash including restricted cash",
  tags: [
    "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
    "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsIncludingDisposalGroupAndDiscontinuedOperations",
  ],
} as const;

export const cashOfBusinessesBeingSold = {
  name: "Cash of businesses being sold",
  tags: ["DisposalGroupIncludingDiscontinuedOperationCashAndCashEquivalents"],
  includedIn:
    "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsIncludingDisposalGroupAndDiscontinuedOperations",
} as const;

export const restrictedCashParts = [
  {
    name: "Short-term restricted cash",
    tags: [
      "RestrictedCashCurrent",
      "RestrictedCashAndCashEquivalentsCurrent",
      "RestrictedCashAndCashEquivalentsAtCarryingValue",
    ],
  },
  {
    name: "Longer-term restricted cash",
    tags: ["RestrictedCashNoncurrent", "RestrictedCashAndCashEquivalentsNoncurrent"],
  },
] as const;

export const restrictedCashTotal = {
  name: "Restricted cash",
  tags: ["RestrictedCash", "RestrictedCashAndCashEquivalents"],
} as const;

// Debt is never one line. It is the short-term part plus the longer-term
// debt due within a year and after it. The names are said in plain words.
export const debtParts = [
  { name: "Short-term debt", tags: ["ShortTermBorrowings", "CommercialPaper"] },
  {
    name: "Longer-term debt due within a year",
    tags: ["LongTermDebtCurrent", "ConvertibleDebtCurrent"],
  },
  {
    name: "Longer-term debt due after a year",
    tags: ["LongTermDebtNoncurrent", "ConvertibleDebtNoncurrent"],
  },
] as const;

// Used only when a company files neither part of its longer-term debt.
export const longTermDebtTotalTags = ["LongTermDebt"];

export const liabilitiesAndEquityTags = ["LiabilitiesAndStockholdersEquity"];

export const cashFlowTags: Record<Exclude<CashFlowKey, "freeCashFlow">, ReadonlyArray<string>> = {
  operatingCashFlow: [
    "NetCashProvidedByUsedInOperatingActivities",
    "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
  ],
  depreciationAndAmortization: [
    "DepreciationDepletionAndAmortization",
    "DepreciationAndAmortization",
  ],
  stockBasedCompensation: ["ShareBasedCompensation", "AllocatedShareBasedCompensationExpense"],
  // Some companies, NVIDIA among them, report property and intangible
  // assets bought on one line.
  capitalExpenditure: [
    "PaymentsToAcquirePropertyPlantAndEquipment",
    "PaymentsToAcquireProductiveAssets",
  ],
  acquisitions: [
    "PaymentsToAcquireBusinessesNetOfCashAcquired",
    "PaymentsToAcquireBusinessesGross",
  ],
  dividends: ["PaymentsOfDividends", "PaymentsOfDividendsCommonStock"],
  shareBuybacks: ["PaymentsForRepurchaseOfCommonStock"],
  debtRaised: [
    "ProceedsFromIssuanceOfLongTermDebt",
    "ProceedsFromDebtMaturingInMoreThanThreeMonths",
  ],
  debtRepaid: ["RepaymentsOfLongTermDebt", "RepaymentsOfDebtMaturingInMoreThanThreeMonths"],
};

export const incomeTaxTags = ["IncomeTaxExpenseBenefit"];

export const earningsPerShareTags = [
  "EarningsPerShareDiluted",
  "EarningsPerShareBasicAndDiluted",
  "EarningsPerShareBasic",
];

export const statementTags: ReadonlyArray<string> = [
  ...Object.values(balanceTags).flat(),
  ...cashIncludingRestrictedCash.tags,
  ...cashOfBusinessesBeingSold.tags,
  ...restrictedCashParts.flatMap((part) => part.tags),
  ...restrictedCashTotal.tags,
  ...debtParts.flatMap((part) => part.tags),
  ...longTermDebtTotalTags,
  ...liabilitiesAndEquityTags,
  ...Object.values(cashFlowTags).flat(),
  ...earningsPerShareTags,
  ...incomeTaxTags,
];
