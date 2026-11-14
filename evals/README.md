# Evals

The Ask agent is judged against a fixed set of questions with an answer key written from the companies' annual reports, never from the tool's output.

- `questions.ts`: the twenty questions of [RFC 0009](../docs/rfc/0009-the-twenty-questions-the-agent-answers-first.md) for each company, plus questions the reports cannot answer, false premises, follow-ups and comparisons.
- `key.ts`: what a right answer holds, as yes-or-no checks. Figures come from each report's tagged statements; words from its business section, risk factors and management's discussion.
- `checks.ts`: the checks every answer must pass, such as every number coming from a lookup and no judgement of the company.
- `harness.ts`: asks the running app through `/api/ask`, as the Ask screen does.

## Running

The app must be running (`task dev`). Each run uses the reader's ChatGPT plan: about 1.5 million input tokens, most of them cached, and two minutes.

```sh
bun run eval --outputFile.json=evals/results/tuning-1.json
EVAL_SET=held-out bun run eval --outputFile.json=evals/results/held-out-1.json
EVAL_ONLY=COST-15,COST-16 bun run eval --outputFile.json=evals/results/costco.json
```

Apple, Costco, Microsoft, NVIDIA and Cloudflare are the tuning set: changes to the agent may be shaped by their answers. Alphabet, Intel and Salesforce are held out: their answers judge a change, and are never used to shape one. Once a held-out company's answers have shaped a change, it moves to the tuning set and a new company is held out.

## Reading results

```sh
bun evals/score.ts evals/results/tuning-1.json
bun evals/compare.ts before=a.json,b.json after=c.json,d.json
bunx vitest-evals serve evals/results/
```

Each answer also records its round trips to the model and its input tokens, which `compare.ts` shows for the text questions.

A change counts as better only when its gain is larger than the difference between two runs of the same code, about three answers.

## When the grader is wrong

Read the failures before trusting a score. A check that fails a right answer, or passes a wrong one, is fixed here and noted in the commit. Every wrong answer a reader finds becomes a case.
