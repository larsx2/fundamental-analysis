# Contributing

Most changes here are written by coding agents, often a dozen at once, and directed by one owner. They all work the same way, which this file describes. `AGENTS.md` holds the rules agents read every session; this file gives the reasons and the longer steps.

## One branch

Every change lands on `main`, in small commits, the same day it is started. Nobody keeps a branch for days, and there are no pull requests.

Two changes made side by side always meet in the end. When each lands within hours, they meet while they are small, and whoever finds a clash still remembers what they did. A branch kept for days hides its work until the merge, when the clash is large and both sides have moved on.

`main` must always work: anything on it could be what someone runs next.

## The loop for one change

1. **Start a worktree.** Each agent works in its own folder under `.worktrees/`, which git ignores, so two agents never edit the same files on disk:

   ```sh
   git fetch origin main
   git worktree add .worktrees/<name> -b <name> origin/main
   cd .worktrees/<name>
   bun install --frozen-lockfile
   ```

   The branch exists only on this computer and lives for minutes or hours. `bun run land` puts its commits on `main`; the branch itself is never pushed.

2. **Keep up with `main`** while you work: `git fetch origin main && git rebase origin/main`. Never `git pull`, which makes merge commits.

3. **Change one thing**, small enough to work on `main` by itself: a fix, a step of a feature, a rename. A large rename or move goes in a commit of its own, so it is easy to read and to take in.

4. **Have it reviewed.** A sub-agent that has not seen the work gets only the task and `git diff origin/main...HEAD`, and looks for mistakes, missing tests, and whether the change does what it says. An agent reviewing its own work is not a review. The writer fixes what the reviewer finds or says why not, and has the diff reviewed again if the code changes after.

5. **Land it** with `bun run land`. It rebases the commits on the latest `main` and pushes them. Before the push leaves this computer, the repo's push hook:
   - refuses it unless it carries exactly the checked-out commit, with nothing uncommitted, new files included;
   - runs everything CI runs on it: install, `check`, `test`, `build`, and the browser tests with pictures of the screens compared, on a free port and with every flag at its default;
   - reads every commit for a secret with gitleaks, when it is installed here, because a secret a later commit removes is still in the history;
   - refuses it if any of them fails, showing the end of the output.

   If another agent landed first, `main` has moved and GitHub refuses the push. `bun run land` then rebases on the new `main` and pushes again, so the checks run once more on the new combination. Running it again is always safe. A check that fails once and passes when run again is reported as flaky.

6. **Clean up** from the main checkout: `git worktree remove .worktrees/<name> && git branch -d <name>`. If `-d` refuses, some commits did not land.

7. **Report**: the commits that landed, the review's findings, how `main`'s build went, and anything left undone.

## Checks before and after landing

There are two builds, and neither replaces the other:

- **Before:** the push hook runs every check on exactly what is pushed. A push that changes only the docs listed in `scripts/docs-only.ts` runs only the formatting check. A push is only accepted by GitHub if it moves `main` forward from where it was checked, so every version of `main` was checked as it stands. Never push to find out whether something passes.
- **After:** GitHub builds `main` again after every landing, on Linux. It also reads every commit for a secret, with the same gitleaks, so a leak is caught even from a machine without it. It catches what differs from this computer.

Changes land without a lock or a queue. When two agents push at once, the second is refused, rebases and runs its checks again. That wastes a minute now and then, but there is nothing to wait for or clean up.

`git push --no-verify` skips the hook. It is only for pushing a revert while `main` is broken and the checks cannot pass, with the reason in the commit message.

## Ports

Agents share this computer, so they never take a fixed port. Port 4100 is the owner's dev server. An agent starts its own on a free port with `bun run dev --port $(bun scripts/free-port.ts)`, and `task screens` and the push hook pick a free port for the browser tests by themselves.

## Pictures of the screens

The push hook compares the pictures of the company screens with the saved ones, on this computer. A change meant to alter how a screen looks saves new pictures with `task screens:update`, after looking at them, in the same commit. GitHub runs the browser tests without comparing pictures, because they differ by operating system.

## Flaky tests

A test that fails and then passes with nothing changed is fixed, or skipped with the date and the reason, in its own `test:` commit, landed before other work. Leaving it makes every landing a coin toss.

## When main is broken

Every landing was checked on this computer, so a failed build of `main` on GitHub means something differs there, or a test is flaky. Fixing it comes before anything else:

1. If a revert or fix of the failing commit has already landed, wait for its build.
2. Otherwise revert it from a new worktree, never from one holding other work:

   ```sh
   git worktree add .worktrees/revert-<sha> -b revert-<sha> origin/main
   cd .worktrees/revert-<sha>
   bun install --frozen-lockfile
   git revert --no-edit <sha>
   bun run land
   ```

A revert needs no review. If its checks cannot pass, push it with `git push --no-verify origin HEAD:main` and say why in the commit message.

## Replacing something over several days

A flag is for replacing something that already works, when the replacement takes more than one landing. New work that nothing links to yet, such as a screen at a route no menu shows, needs no flag.

The new version is built next to the old one, on `main`, while the old one stays in use:

1. **Make one place where the old and new versions are swapped.** In this repo that is an Effect service, with one layer per version. Pick the service at the level of what is being replaced. To replace Codex with the AI SDK, the service is "answer a question", with `ask` and `warm`, and not `Agent`, whose job is to run Codex. Today's code becomes the Codex layer of that service, and the route calls only the service.
2. **Add a flag** in `src/server/flags.ts` whose first value, the default, is the old version.
3. **Build the new version behind the flag**, one small landing at a time, each with tests. The old version keeps working throughout.
4. **Compare them** before switching: run the evals against a dev server with each value of the flag (`FLAG_AGENT=ai-sdk bun run dev --port <port>`, with `ASK_URL` pointing at it) and compare the results with `bun evals/compare.ts`. A replacement fails by answering worse, not only by failing tests.
5. **Make the new version the default** in one small commit, easy to undo.
6. **Delete the old version and the flag** once the owner has used the new default for a few days and asks for it, before the remove-by date.

Do not keep unfinished work out of `main` on a branch, and do not take finished commits back out because they are not ready. Unready work stays switched off by its flag.

## Flags

`src/server/flags.ts` lists every flag, named `FLAG_<WHAT>`, with what it is for, the values it accepts (the first is the default), the day it was added, and the day it must be removed by, at most 45 days later:

```ts
export const flags = {
  FLAG_AGENT: {
    purpose: "Answers questions with the AI SDK instead of Codex.",
    values: ["codex", "ai-sdk"],
    added: "2026-11-16",
    removeBy: "2026-12-31",
  },
} as const satisfies Readonly<Record<`FLAG_${string}`, Flag>>;
```

- **Read in one place.** `src/server/runtime.ts` reads a flag with `flag("FLAG_AGENT")`, whose type lists its values, and picks a layer with a `switch` over them. When a value is removed, the `switch` stops compiling until its layer is removed too. No other code reads a flag or its environment variable; a test fails if any does.
- **Switched at startup.** A flag's value comes from the environment variable of the same name, such as `FLAG_AGENT=ai-sdk bun run dev`, and is read when the tool starts. Restart the dev server to switch. A value that is not listed stops the tool with an error. The push hook ignores any `FLAG_` variable, so it always checks the defaults.
- **Tested for each value.** One set of tests describes what every version must do, and runs once for each layer. Each layer takes what it depends on as a parameter, such as the model for the AI SDK version, so tests can give it a stand-in. Tests pick a flag's value with `ConfigProvider.layer(ConfigProvider.fromUnknown({ FLAG_AGENT: "ai-sdk" }))`, never by changing `process.env`, which would leak into later tests.
- **Few at a time.** At most three flags are open, and two open flags never switch services that depend on each other, so testing each with the others at their defaults is enough.
- **Removed on time.** A test fails once a flag is past its remove-by date, and the push hook warns a week before. Only the owner moves a date, in a commit of its own that says why.

## Changes to stored data

The database on each reader's computer may hold data written by any older version. Migrations live in `src/server/migrations/`, one file each, and run for every value of every flag.

- Change a shape in steps, each landed on its own:
  1. Add the new shape, and copy the existing rows into it in the same migration.
  2. Move the code to write and read the new shape.
  3. Remove the old shape once nothing uses it, and only after any flag covering the change is gone.
- Never edit, revert, renumber or delete a migration that has landed. Databases that ran it would not run it again. Roll forward with a new one.
- Pick a new migration's number after rebasing. If `bun run land` stops on a clash in `migrations/index.ts`, renumber yours.
- Test each migration on a database filled by the ones before it, as `migrations/index.test.ts` does. To try one by hand on a filled database, start `bun run dev` once before adding the migration. A new worktree's first start builds its database with the nine saved companies, using the migrations that exist at that moment.

## For the owner

- **Reading what landed:** `git log --oneline seen..origin/main`, then `git tag -f seen origin/main` to mark the point.
- **Clearing up after sessions that stopped early:** `git worktree list` shows their worktrees. Remove them once their commits have landed or are not wanted.
- **Branches from before this way of working:** land them with `bun run land`, or delete them.

## Commits

- One change per commit, with a message that starts with `feat:`, `fix:`, `refactor:`, `test:`, `docs:` or `style:` and says what changed and why. Reverts keep git's `Revert "..."` message.
- No co-author lines.
