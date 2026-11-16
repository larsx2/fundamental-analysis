# Working in this repo

Every change lands on `main` the same day, in small commits, through `bun run land`. There are no long-lived branches and no pull requests. CONTRIBUTING.md explains why, and covers anything not written here.

## Starting

- Never edit in the main checkout. Start a worktree of your own, with a short lowercase name using hyphens and no slash:
  `git fetch origin main && git worktree add .worktrees/<name> -b <name> origin/main && cd .worktrees/<name> && bun install --frozen-lockfile`
- To build on what landed since: `git fetch origin main && git rebase origin/main`. Never `git pull`.
- Never use port 4100, which is the owner's. Start the dev server on a free port: `bun run dev --port $(bun scripts/free-port.ts)`. `task screens` picks a free port by itself.
- The first `bun run dev` in a worktree builds its database with nine companies saved in the repo, the ones on the home page and in the evals. Work with those. Collecting another company asks the SEC, so do it only when the task needs it.

## Landing

- Keep each change small enough to work on `main` by itself. A large rename or move goes in its own commit.
- Commit every file, new ones included. The push to main is refused while anything is uncommitted.
- Before landing, start a sub-agent that has not seen your work, and give it only the task and `git diff origin/main...HEAD`. Fix what it finds, or say in your report why not. If the code changes after the review, have the new diff reviewed again.
- Land with `bun run land`. It rebases on main and pushes; the push hook first runs everything CI runs, pictures of the screens included, on exactly what is pushed. It takes about a minute. If another change landed first, it rebases and tries again by itself.
- If it does not land, do what its message says. If the same reason comes back three times, stop and tell the owner.
- If you meant to change how a screen looks, look at the new pictures and save them with `task screens:update` in the same commit.
- A test that fails and then passes with nothing changed is flaky. Fix it, or skip it with the date and why, in its own `test:` commit before your change.

## When main is broken

- If main's last build on GitHub failed (`gh run list --workflow ci --branch main --limit 1`), fixing it comes before anything else. If a revert or fix has already landed, wait for its build. Otherwise revert the commit from a new worktree, never from the one holding your work: `git worktree add .worktrees/revert-<sha> -b revert-<sha> origin/main`, then in it `bun install --frozen-lockfile && git revert --no-edit <sha> && bun run land`.
- `git push --no-verify` skips the checks. Use it only to push such a revert when the checks cannot pass, and say why in the commit message. A revert needs no review.

## Bigger changes

- Replacing something that already works, over several landings, goes behind a flag in `src/server/flags.ts`, read only in `src/server/runtime.ts`, with tests for each of its values. New work that nothing links to yet needs no flag. CONTRIBUTING.md has the steps.
- Making the new version the default is its own commit. The old version and the flag are deleted only when the owner asks.
- If the only failure is an overdue flag your change does not touch, stop and tell the owner. Never move a flag's date or delete a flag inside another change.
- Change stored data in steps that each land on their own: add the new shape and copy the rows into it, move the code over, and remove the old shape last. Never edit, revert or renumber a migration that has landed; add a new one, and pick its number after rebasing.

## Finishing

- From the main checkout: `git worktree remove .worktrees/<name> && git branch -d <name>`. If `-d` refuses, some commits did not land: say so instead of forcing it.
- End with the hash and message of each commit that landed, the review's findings, how main's build went (`gh run list --workflow ci --branch main --limit 1`), and anything left undone.
- Commit messages start with `feat:`, `fix:`, `refactor:`, `test:`, `docs:` or `style:`, except reverts, which keep git's `Revert "..."` message. No co-author lines.
