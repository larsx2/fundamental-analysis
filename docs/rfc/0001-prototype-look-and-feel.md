---
status: exploring
opened: 2026-11-11
closed:
---

# What the prototype should look and feel like

## Question

How should the first prototype help a beginner understand a company's finances, without assuming they already know the field?

## Why it matters

The whole point of the tool is that using it is enough to learn how a company's finances fit together. The look and feel carries that. A style chosen only because it is beautiful could make the numbers harder to learn from.

## What we know

The prototype needs readable figures, clear statement tables, labelled charts and sources beside written analysis.

## Options

**Borrow**

- The near-black surface with a glow in the company's brand colour. Settled on 11 November 2026: the prototype is dark only, with no light version.
- Hairline panels and the white-and-grey text scale.
- One company per screen, with nothing competing for attention.
- The statement table: tabs for the three statements, one quarterly and annual switch, the latest column tinted, calculated lines in grey under their parent.
- Thin chart lines that end in a value label.
- The sources column beside any text the agent writes.
- The floating bar and keyboard keys.

**Change**

- Revenue and where it goes should be the largest thing on a company page. Share price is not the focus of this tool.
- Every term on screen should open its glossary entry, and every number should be able to show where it came from in the filing.
- A learner reads slowly and looks things up, so type must be readable and contrast strong.
- This tool follows fiscal years, so its range should run across ten years or more.
- Table labels come from the glossary only.

**Leave out**

- Analyst ratings, price targets and estimates. This tool does not forecast.
- Portfolio, watchlist, screener and sharing. They serve people who are already investing.
- Live price movement during the day.

**Specific to this tool**

- One timeline that holds the reported numbers, capital allocation, corporate events and the three kinds of context together.
- A view of where each dollar of revenue goes, following common-size analysis.

### Settled on 11 November 2026, from the mocks of "Where the money goes"

Local mocks were built with the real collected numbers and approved step by step. They are not committed.

- **Two drawings of the same numbers, one switch.** Stacked bars compare ten fiscal years, with net income on the baseline and a row of cents kept under the years. Bands follow one year's dollar from revenue to net income. A two-icon switch in the corner of the chart swaps them, and the choice lives in the address bar like the fiscal year. Bars open by default. Bands alone failed for a company like Costco, where nearly every dollar is cost of revenue; bars alone lose the feeling of following a dollar.
- **In the bands, each bar is a tinted block holding its own label.** Bands run only between blocks, so a label never sits on a band. This was checked by measurement for every fiscal year of Apple, Costco and Microsoft.
- **A sentence before the chart.** "Of each dollar Apple brought in, it spent 56¢ on cost of revenue … It kept 25¢ as net income." Under the chart title, a factual line in plain words, such as the cents kept at the two ends of ten years. Never a judgement.
- **Year-over-year change on every line of the figures table**, against the fiscal year before.
- **The fiscal year is a ruler.** One tick per fiscal year, a white marker on the chosen one, draggable, with the arrow keys, Home and End. A native range input does the work, so it is announced properly and works by touch.
- **Companies are switched with Command K.** The search panel is frosted glass, lists the ready companies with their logos, tickers and as of dates, and lists the screens of the company shown. The top of every company screen shows only the company's logo and ticker, which opens the same search. The mocks use the real logos locally; where the published tool gets them is still the open point below.
- **Navigation is a small bar centred at the bottom of the screen,** with no borders. Only the icon under the pointer grows a little; the others stay still. Names show as tooltips. A row of names along the top and a box beside the content were tried and set aside.
- **Six colours, one per part of a dollar,** always the same part on every screen, checked as a set for colour blindness and contrast against the near-black surface: blue for cost of revenue, orange for research and development, aqua for selling, general and administrative, yellow for other operating expenses, magenta for the step from operating income to net income, green for net income.
- **All text passes the strictest contrast level (AAA)** on the surface: white for main figures, two greys for the rest, the smallest text 14 pixels.

### Settled later on 11 November 2026, from the mocks of every screen

- **Seven screens.** Home, Companies, Overview, Where the money goes, Statements, Timeline and Glossary. The bottom bar holds Home, Companies, the four company screens, Glossary and search, in that order. The home has no bar.
- **Home.** "Follow the money." over a night city photo graded into the app's blues, breathing slowly and shifting a little with the pointer. One composer: what you type on top, three example chips and a send button underneath, and its placeholder types real example questions until you type. It reads companies, tickers, glossary terms, screens and years, and says what Enter will open before you press it: "Where does Costco's money go?" opens Costco's money flow, "What is gross profit?" opens the glossary, a company that is not collected opens Companies to collect it. It is not the agent; it is the box the agent will grow into. Ready companies sit under it as logo chips.
- **Where the money goes has three drawings of the same numbers:** bars for ten fiscal years (the default), bands for one year, and the figures table. A switch in the corner of the chart picks one, and the choice lives in the address bar. Bands hide on a screen too narrow for their four columns of labels.
- **Glossary is two panes.** The list of sections stays fixed on the left; the right shows only the chosen section, which fades in. Filtering shows matches from every section. A link to a term opens its section with the term highlighted. Clicking a term there opens no card, because its explanation is already on screen.
- **One content width and one pair of side margins on every screen:** 1240 pixels at most, 24 pixels at each side, 16 on a phone. No screen overrides it.
- **Motion.** On arrival a screen's sections settle in one after another, 80 milliseconds apart, from the first paint so nothing shows before its entrance. Changing company or year crossfades the screen. Bars grow from the baseline; bands sweep in from revenue on the left and glide between years. Everything moving has a reduced-motion version that does not move.
- **Content fades and softens as it scrolls under the bottom bar,** solid behind the bar and fading above it, so nothing collides with the icons.
- **Numbers on a term card.** Every term on every screen opens its card with the definition, the example and this company's figure. The card knows every glossary term.

### Ideas from the analysis-screen research, on 11 November 2026

Looked at: financial stats, comparing financial metrics, comparing stock metrics, peer analysis, and search. Each idea is adapted to teaching, not copied.

- **The statements table.** Fiscal years as columns, the newest one tinted and labelled, lines grouped into blocks with space between, a missing value written in words. Here the word is "gap", from the glossary, and calculated lines sit in grey under the line they come from.
- **Select lines, then compare.** Ticking lines in a statement and pressing return draws them together across the fiscal years. While a line is selected, the change from one year to the next shows between the columns. That teaches year-over-year change in place.
- **A comparison chart with a summary table under it.** Each line ends in a label with its latest value, and the table gives each line's lowest, average and highest value and its change over the range.
- **A factual sentence under a chart title.** The words are worked out from the numbers, not an investment judgement.
- **Search that lists a company's screens as well as companies.** Typing a company offers its overview, statements and timeline directly.
- **Peer comparison is not in the first version.** A later comparison could mark the company's own row, use small bars to show where it sits among peers, and let the reader edit the list of peers.

### Settled on 11 November 2026, while building the screens

- **Logos.** Company logos are trademarks, so the tool shows a tile with the first letter of the company's name, as the mocks did for companies without a logo. The open point on logos below stays open: a published source for them may still be found.
- **The home picture.** The night city is drawn by the tool itself, as layers of buildings with lit windows, graded into the app's blues. The mock's photo was under the Unsplash licence, not MIT, so it is not shipped.
- **The fiscal year ruler widens with history.** Apple has twenty fiscal years. Each year keeps room for its label, and on a phone only every few years are named, plus the chosen one.
- **Timeline.** The interest rate is a solid line and inflation a dashed one, each named with its latest value at its end. Axis labels sit in a margin the bars never enter. Bars for years not chosen are solid colours of at least 3 to 1 against the panel, and so is the recession hatch. On a narrow screen the timeline box fades at the edge that scrolls and opens at the chosen month. It covers every fiscal year collected, and its corporate events reach back as far, because the SEC's older pages of filings are read too.
- **The term card knows every number.** Every term of the three statements, the margins, free cash flow and net debt open their card with this company's figure for the fiscal year shown, and where it came from.
- **The step between operating income and net income** is now the glossary term "Interest, other income and tax".
- **Overview.** The big sentence is worked out from the numbers, such as "Apple brought in $478.8 billion in fiscal 2026 and kept 28¢ of each dollar". The mock's plain description of the business was written by hand, which the tool cannot do for any company. The company's own words come from the opening of the business description in its latest annual report (10-K), with a link.
- **Collecting progress** is shown by step, out of three, rather than as a percentage the tool cannot know.

## Open points

- Settled on 11 November 2026: the look is settled on one real screen, not on a separate mock-up. The first slice's screen, "Where the money goes", is taken to finished quality and later screens reuse its colours, type, spacing and movement. See [Which screens the first version needs](./0002-first-version-site-structure.md).
- How large can the type get before the statement table stops fitting ten fiscal years on one screen?
- Should a company's brand colour also colour its chart lines, or only the background glow?
- What does a glossary entry look like when opened from a term on screen: a small card beside the term, or a side panel?
- The result must be our own design. Third-party screens, names, logos and wording are not assets to copy into the tool. Reference screenshots stay local and uncommitted; typefaces and icons need licences that permit distribution.
- Company logos and brand colours belong to each company. Can the tool show a company's colour as a background glow without shipping its logo, and where would the colour come from?

## Outcome
