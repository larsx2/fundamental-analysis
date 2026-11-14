import {
  answers,
  anyOf,
  atLeast,
  type Check,
  noFiguresAdded,
  percentsIn,
  says,
  saysInLead,
  saysItCannot,
  saysNot,
  showsAPassage,
  states,
  statesCents,
  statesPercent,
} from "./checks";

const billion = 1e9;
const million = 1e6;

type Report = {
  readonly revenue: number;
  readonly growth: number;
  readonly growthBefore: number;
  readonly netIncome: number;
  readonly costCents: number;
  readonly netCents: number;
  readonly netMargin: number;
  readonly operatingCashFlow: number;
  readonly capex: number;
  readonly debt: number;
  readonly assets: number;
  readonly liabilities: number;
  readonly dividends: number | null;
  readonly buybacks: number | null;
  readonly research: number | null;
  readonly returnBeforeTax: number;
  readonly business: RegExp;
  readonly sources: RegExp;
  readonly rivals: Check;
  readonly risks: ReadonlyArray<RegExp>;
  readonly year: RegExp;
};

// Read from each company's latest annual report (10-K): figures from its tagged
// statements, words from its business section, risk factors and management's
// discussion. Changes and shares are worked out from those figures.
const reports: Readonly<Record<string, Report>> = {
  AAPL: {
    revenue: 478.834 * billion,
    growth: 15.1,
    growthBefore: 6.4,
    netIncome: 132.175 * billion,
    costCents: 51,
    netCents: 28,
    netMargin: 27.6,
    operatingCashFlow: 145.097 * billion,
    capex: 9.041 * billion,
    debt: (1.997 + 9.906 + 68.208) * billion,
    assets: 404.548 * billion,
    liabilities: 292.455 * billion,
    dividends: 15.721 * billion,
    buybacks: 86.39 * billion,
    research: 45.765 * billion,
    returnBeforeTax: 82.2,
    business: /smartphone|iPhone|personal computer|\bMac\b/i,
    sources: /iPhone|Services|Greater China|Americas|Europe/,
    rivals: saysNot(
      "a rival the report does not name",
      /Samsung|Microsoft|Huawei|Xiaomi|Dell|Lenovo|Amazon|\bMeta\b/,
    ),
    risks: [
      /compet/i,
      /supply|supplier|component|outsourc|manufactur/i,
      /tariff|trade/i,
      /cyber|security|data/i,
      /legal|law|regulat|antitrust|investigation/i,
      /currenc|exchange rate/i,
      /econom/i,
      /artificial intelligence|\bAI\b/,
    ],
    year: /iPhone|Pro models|advertising|cloud services|\bMac\b|tariff|memory/i,
  },
  COST: {
    revenue: 303.154 * billion,
    growth: 10.1,
    growthBefore: 8.2,
    netIncome: 9.226 * billion,
    costCents: 87,
    netCents: 3,
    netMargin: 3.0,
    operatingCashFlow: 15.817 * billion,
    capex: 6.435 * billion,
    debt: (2.248 + 3.914) * billion,
    assets: 89.045 * billion,
    liabilities: 53.242 * billion,
    dividends: 2.458 * billion,
    buybacks: 0.848 * billion,
    research: null,
    returnBeforeTax: 27.8,
    business: /warehouse/i,
    sources: /core merchandise|foods|gasoline|membership fee|United States|Canada/i,
    rivals: atLeast(1, "the rivals the report names", [
      /Walmart|Sam['’]s Club|BJ['’]s|Target|Kroger|Amazon/,
    ]),
    risks: [
      /compet/i,
      /member/i,
      /supplier|merchandise|supply/i,
      /cyber|IT system|security|data/i,
      /econom|inflation/i,
      /tariff|trade/i,
      /law|regulat|legal/i,
    ],
    year: /comparable sales|new warehouses|gasoline|membership fee/i,
  },
  MSFT: {
    revenue: 331.839 * billion,
    growth: 17.8,
    growthBefore: 14.9,
    netIncome: 133.749 * billion,
    costCents: 32,
    netCents: 40,
    netMargin: 40.3,
    operatingCashFlow: 182.935 * billion,
    capex: 115.948 * billion,
    debt: (9.227 + 31.067) * billion,
    assets: 758.376 * billion,
    liabilities: 315.989 * billion,
    dividends: 26.445 * billion,
    buybacks: 22.271 * billion,
    research: 35.562 * billion,
    returnBeforeTax: 32.2,
    business: /cloud|software|Azure|Microsoft 365|Windows/i,
    sources: /Azure|Microsoft Cloud|Microsoft 365|Intelligent Cloud|LinkedIn|Xbox|Windows/i,
    rivals: saysNot(
      "a rival the report does not name",
      /Amazon|AWS|Google|Alphabet|Apple|Oracle|Salesforce|Sony|Nintendo|\bMeta\b|IBM/,
    ),
    risks: [
      /compet/i,
      /cloud|\bAI\b|artificial intelligence|invest/i,
      /cyber|security/i,
      /regulat|legal|law/i,
      /datacenter|infrastructure|supply|supplier/i,
    ],
    year: /Azure|cloud|Microsoft 365|AI infrastructure/i,
  },
  NVDA: {
    revenue: 215.938 * billion,
    growth: 65.5,
    growthBefore: 114.2,
    netIncome: 120.067 * billion,
    costCents: 29,
    netCents: 56,
    netMargin: 55.6,
    operatingCashFlow: 102.718 * billion,
    capex: 6.042 * billion,
    debt: 8.468 * billion,
    assets: 206.803 * billion,
    liabilities: 49.51 * billion,
    dividends: 0.974 * billion,
    buybacks: 40.086 * billion,
    research: 18.497 * billion,
    returnBeforeTax: 78.7,
    business: /GPU|accelerated computing|data center|chip|graphics/i,
    sources:
      /Data Center|Compute & Networking|Graphics|Gaming|Automotive|Professional Visualization|United States|Taiwan|China|Singapore/i,
    rivals: anyOf(
      "names a rival the report names, or describes its rivals",
      atLeast(1, "the rivals the report names", [
        /AMD|Advanced Micro|Intel|Broadcom|Qualcomm|Huawei|Amazon|Alphabet|Microsoft|Cisco/,
      ]),
      says("the kinds of rival the report describes", /GPU|CPU|accelerat|interconnect/i),
    ),
    risks: [
      /compet/i,
      /supply|supplier|foundry|manufactur|TSMC/i,
      /export|China|geopolit/i,
      /demand|customer/i,
      /regulat|legal|law/i,
      /\bAI\b|artificial intelligence/,
    ],
    year: /data center|Blackwell|compute|networking|AI/i,
  },
  NET: {
    revenue: 2167.937 * million,
    growth: 29.8,
    growthBefore: 28.8,
    netIncome: -102.267 * million,
    costCents: 25,
    netCents: 5,
    netMargin: -4.7,
    operatingCashFlow: 603.114 * million,
    capex: 315.617 * million,
    debt: (1291.281 + 1974.12) * million,
    assets: 6036.256 * million,
    liabilities: 4577.133 * million,
    dividends: null,
    buybacks: null,
    research: 512.489 * million,
    returnBeforeTax: -4.4,
    business: /network|security|cloud|internet|website|connectivity/i,
    sources: /United States|EMEA|APAC|Asia|Europe|subscription/i,
    rivals: saysNot(
      "a rival the report does not name",
      /Akamai|Zscaler|Fastly|Palo Alto|Amazon|AWS|Google|Okta|Netskope|Imperva/,
    ),
    risks: [
      /compet/i,
      /customer/i,
      /cyber|attack|security|breach/i,
      /econom|recession|inflation/i,
      /outage|disruption|network/i,
      /regulat|privacy|legal|law/i,
      /loss|profitab/i,
    ],
    year: /customers|revenue increased/i,
  },
  GOOGL: {
    revenue: 402.836 * billion,
    growth: 15.1,
    growthBefore: 13.9,
    netIncome: 132.17 * billion,
    costCents: 40,
    netCents: 33,
    netMargin: 32.8,
    operatingCashFlow: 164.713 * billion,
    capex: 91.447 * billion,
    debt: (1.996 + 46.547) * billion,
    assets: 595.281 * billion,
    liabilities: 180.016 * billion,
    dividends: 10.049 * billion,
    buybacks: 45.709 * billion,
    research: 61.087 * billion,
    returnBeforeTax: 27.8,
    business: /search|advertis|Google|YouTube|cloud/i,
    sources: /Search|YouTube|Google Cloud|advertising|subscriptions|United States|EMEA|APAC/i,
    rivals: saysNot(
      "a rival the report does not name",
      /Microsoft|Amazon|\bMeta\b|OpenAI|Apple|TikTok|ByteDance|Bing/,
    ),
    risks: [
      /compet/i,
      /advertis/i,
      /regulat|antitrust|legal|law|privacy/i,
      /\bAI\b|artificial intelligence/,
      /security|cyber/i,
      /econom/i,
    ],
    year: /Search|YouTube|Cloud|search queries/i,
  },
  INTC: {
    revenue: 52.853 * billion,
    growth: -0.5,
    growthBefore: -2.1,
    netIncome: -0.267 * billion,
    costCents: 65,
    netCents: 1,
    netMargin: -0.5,
    operatingCashFlow: 9.697 * billion,
    capex: 14.646 * billion,
    debt: (2.499 + 44.086) * billion,
    assets: 211.429 * billion,
    liabilities: (211.429 - 126.36) * billion,
    dividends: null,
    buybacks: null,
    research: 13.774 * billion,
    returnBeforeTax: -1.3,
    business: /chip|processor|semiconductor|CPU|foundry|\bPC|data center/i,
    sources:
      /Client Computing|CCG|Data Center|DCAI|Foundry|Altera|Mobileye|United States|China|Taiwan|Singapore/i,
    rivals: atLeast(1, "the rivals the report names", [
      /AMD|Advanced Micro|NVIDIA|Nvidia|TSMC|Samsung|Qualcomm|\bArm\b/,
    ]),
    risks: [
      /compet/i,
      /manufactur|foundry|process technolog/i,
      /China|geopolit|trade|tariff|export/i,
      /demand|customer/i,
      /debt|capital|liquidity|fund/i,
      /regulat|legal|law/i,
    ],
    year: /CCG|DCAI|server|client|\bPC|data center|flat/i,
  },
  CRM: {
    revenue: 41.525 * billion,
    growth: 9.6,
    growthBefore: 8.7,
    netIncome: 7.457 * billion,
    costCents: 22,
    netCents: 18,
    netMargin: 18.0,
    operatingCashFlow: 14.996 * billion,
    capex: 0.594 * billion,
    debt: (4.0 + 10.439) * billion,
    assets: 112.305 * billion,
    liabilities: 53.163 * billion,
    dividends: 1.587 * billion,
    buybacks: 12.596 * billion,
    research: 5.993 * billion,
    returnBeforeTax: 11.3,
    business: /CRM|customer relationship|software|cloud|Agentforce|Slack|\bAI\b/i,
    sources:
      /subscription|support|professional services|Americas|Europe|Asia|Sales|Service|Platform|Slack|Marketing|Commerce|Integration|Analytics/i,
    rivals: saysNot(
      "a rival the report does not name",
      /Microsoft|Oracle|\bSAP\b|HubSpot|ServiceNow|Adobe|Workday|Google|Amazon/,
    ),
    risks: [
      /compet/i,
      /security|breach|cyber/i,
      /\bAI\b|artificial intelligence/,
      /acquisition/i,
      /econom|macro/i,
      /regulat|privacy|law/i,
    ],
    year: /new business|new customers|upgrades|subscription/i,
  },
};

const noDividend =
  /\$0 in dividends|dividends were \$0|no dividend|not pa(y|id)|never (paid|declared)|does not pay|did not pay|has not paid|suspend|stopped|no longer pa/i;
const noBuybacks =
  /no purchases|repurchased no shares|bought back no shares|buybacks were \$0|\$0 in share buybacks|no (share )?buyback|did not buy back|not (buy|bought) back|no repurchase|cannot tell|does not collect/i;
const rose = /rose|risen|grew|increased|higher|did not (fall|drop|stop|shrink)/i;

const twenty = (report: Report, ticker: string, question: number): ReadonlyArray<Check> => {
  const freeCashFlow = report.operatingCashFlow - report.capex;
  switch (question) {
    case 1:
      return [answers, says("what the business is", report.business)];
    case 2:
      return [
        anyOf(
          "names where revenue comes from, or says the tool does not hold it",
          saysItCannot,
          says("sources", report.sources),
        ),
      ];
    case 3:
      return [states("revenue", report.revenue), statesPercent("revenue growth", report.growth)];
    case 4:
      return [
        says(
          "whether growth was steady",
          /steady|every year|each year|varied|uneven|not steady|in \d+ of \d+/i,
        ),
        {
          name: "states a yearly change of revenue, or how many years it rose",
          pass: (output) => {
            const sentences = output.answer?.sentences.join(" ") ?? "";
            return percentsIn(sentences).length > 0 || /in \d+ of \d+/.test(sentences);
          },
        },
      ];
    case 5:
      return [
        statesCents("cost of revenue's share", report.costCents),
        report.netIncome < 0
          ? anyOf(
              "states what is left, a loss",
              statesCents("net loss's share", report.netCents),
              states("net loss", report.netIncome),
            )
          : statesCents("net income's share", report.netCents),
      ];
    case 6:
      return [
        anyOf(
          "states net income's share of revenue, or the loss",
          statesPercent("net margin", report.netMargin),
          statesCents("net income's share", report.netCents),
          ...(report.netIncome < 0 ? [states("net loss", report.netIncome)] : []),
        ),
        says(
          "whether margins rose or fell",
          /rose|risen|rising|increase|higher|fell|fallen|falling|lower|decrease|flat|unchanged|similar|direction|mixed/i,
        ),
      ];
    case 7:
      return [
        states("free cash flow", freeCashFlow),
        states("net income", report.netIncome),
        ...(report.operatingCashFlow < report.netIncome
          ? [
              saysNot(
                "that all of its net income turned into cash",
                /all of (its )?net income|fully|every dollar/i,
              ),
            ]
          : []),
      ];
    case 8:
      return [states("debt", report.debt)];
    case 9:
      return [states("assets", report.assets), states("liabilities", report.liabilities)];
    case 10:
      return [
        states("capital expenditure", report.capex),
        report.dividends === null
          ? says("that it pays no dividend", noDividend)
          : states("dividends", report.dividends),
        report.buybacks === null
          ? says("that it bought back no shares", noBuybacks)
          : states("share buybacks", report.buybacks),
      ];
    case 11:
      if (report.dividends === null) return [says("that it pays no dividend", noDividend)];
      return ticker === "COST"
        ? [
            anyOf(
              "states the dividends paid",
              states("dividends", report.dividends),
              says("the dividend for each share, from the report", /\$5\.54/),
            ),
            saysInLead(
              "that dividends grew, or that special dividends make totals swing",
              /grew|grown|increased|special/i,
            ),
          ]
        : [states("dividends", report.dividends)];
    case 12:
      return report.buybacks === null
        ? [says("that it bought back no shares", noBuybacks)]
        : [
            anyOf(
              "states share buybacks",
              states("share buybacks", report.buybacks),
              ...(ticker === "NVDA"
                ? [states("shares repurchased, from the report", 40.4 * billion)]
                : ticker === "AAPL"
                  ? [states("shares repurchased, from the report", 85.8 * billion)]
                  : []),
            ),
          ];
    case 13:
      return report.research === null
        ? [states("capital expenditure", report.capex)]
        : [
            states("research and development", report.research),
            states("capital expenditure", report.capex),
          ];
    case 14:
      return [
        statesPercent("operating income as a share of debt and equity", report.returnBeforeTax),
      ];
    case 15:
      return [
        answers,
        noFiguresAdded,
        showsAPassage,
        report.rivals,
        says("how it competes, in its own words", /compet/i),
      ];
    case 16:
      return [
        answers,
        noFiguresAdded,
        showsAPassage,
        atLeast(2, "the risks its report lists", report.risks),
      ];
    case 17:
      return [
        answers,
        noFiguresAdded,
        showsAPassage,
        says("what drove its year, from its report", report.year),
      ];
    case 18:
      return [says("interest rates or inflation", /interest rate|inflation/i)];
    case 19:
      return [
        says("a recession or a rise in rates", /recession|interest rates? rose|rising interest/i),
      ];
    case 20:
      return [
        says("how its figures are marked", /reported/i),
        says("what is calculated or missing", /calculated|gap|missing|doubtful/i),
      ];
    default:
      return [];
  }
};

const falsePremise: Readonly<Record<string, ReadonlyArray<Check>>> = {
  AAPL: [says("revenue did not fall", rose), statesPercent("revenue growth", reports.AAPL!.growth)],
  COST: [
    says("Costco still pays a dividend", /did not stop|still pa|paid/i),
    states("dividends", 2.458 * billion),
  ],
  MSFT: [says("net income did not drop", rose), states("net income", reports.MSFT!.netIncome)],
  NVDA: [
    says("revenue did not shrink", rose),
    statesPercent("revenue growth", reports.NVDA!.growth),
  ],
  NET: [
    says(
      "Cloudflare made a loss",
      /loss|not profitable|below zero|negative|not (report )?positive|−\$/i,
    ),
    states("net loss", reports.NET!.netIncome),
  ],
  GOOGL: [
    says(
      "Alphabet still buys back shares",
      /did not stop|not stopped|still|bought back|repurchased/i,
    ),
    states("share buybacks", reports.GOOGL!.buybacks!),
  ],
  INTC: [
    says(
      "revenue did not jump",
      /did not (jump|rise|grow|increase)|fell|declined|decreased|lower|down/i,
    ),
    statesPercent("revenue change", reports.INTC!.growth),
  ],
  CRM: [says("net income did not fall", rose), states("net income", reports.CRM!.netIncome)],
};

const followUp: Readonly<Record<string, ReadonlyArray<Check>>> = {
  AAPL: [statesPercent("fiscal 2025 revenue growth", reports.AAPL!.growthBefore)],
  COST: [
    says("capital expenditure was more", /yes|more than|exceed/i),
    states("capital expenditure", reports.COST!.capex),
    states("dividends", 2.458 * billion),
  ],
  MSFT: [
    says("operating margin was lower", /lower/i),
    // From Microsoft's fiscal 2021 annual report: $69.916 billion of operating
    // income on $168.088 billion of revenue.
    statesPercent("fiscal 2021 operating margin", 41.6),
  ],
  NVDA: [statesPercent("fiscal 2025 revenue growth", reports.NVDA!.growthBefore)],
  NET: [
    says("it brings in cash", /yes|positive|brought in|generated/i),
    anyOf(
      "states its cash from operations or free cash flow",
      states("operating cash flow", reports.NET!.operatingCashFlow),
      states("free cash flow", reports.NET!.operatingCashFlow - reports.NET!.capex),
    ),
  ],
  GOOGL: [statesPercent("fiscal 2024 revenue growth", reports.GOOGL!.growthBefore)],
  INTC: [statesPercent("fiscal 2024 revenue change", reports.INTC!.growthBefore)],
  CRM: [statesPercent("fiscal 2025 revenue growth", reports.CRM!.growthBefore)],
};

const comparisons: Readonly<Record<string, ReadonlyArray<Check>>> = {
  "AAPL+MSFT-research": [
    says("Apple spends more", /Apple (spends|spent) more/i),
    states("Apple's research and development", reports.AAPL!.research!),
    states("Microsoft's research and development", reports.MSFT!.research!),
  ],
  "COST+AAPL-margins": [
    says("Apple keeps more", /Apple (had|kept|keeps|has) more/i),
    anyOf("states Apple's share kept", statesCents("28¢", 28), statesPercent("27.6%", 27.6)),
    anyOf("states Costco's share kept", statesCents("3¢", 3), statesPercent("3.0%", 3.0)),
  ],
  "NVDA+NET-size": [
    says(
      "NVIDIA brings in more",
      /NVIDIA (brings|brought|had|has) (in )?more|NVIDIA['’]s revenue (was|is) (larger|higher|bigger)/i,
    ),
    states("NVIDIA's revenue", reports.NVDA!.revenue),
    states("Cloudflare's revenue", reports.NET!.revenue),
  ],
  "GOOGL+CRM-research": [
    says("Alphabet spends more", /Alphabet (spends|spent) more/i),
    states("Alphabet's research and development", reports.GOOGL!.research!),
    states("Salesforce's research and development", reports.CRM!.research!),
  ],
};

export const keyFor = (id: string): ReadonlyArray<Check> => {
  const ticker = id.split("-")[0]!;
  const report = reports[ticker];
  if (comparisons[id] !== undefined) return comparisons[id];
  if (report === undefined) return [];
  if (id.endsWith("-false-premise")) return falsePremise[ticker] ?? [];
  if (id.endsWith("-follow-up")) return followUp[ticker] ?? [];
  if (id.includes("-unanswerable-")) return [saysItCannot, noFiguresAdded];
  return twenty(report, ticker, Number(id.split("-")[1]));
};
