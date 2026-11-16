// Puts this worktree's commits on main: rebase them on the latest main, then
// push. The push hook checks exactly what is pushed. If another agent landed
// first, main has moved and the push is refused, so it rebases and tries again.
// Running it again is always safe.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const git = (...args: ReadonlyArray<string>) => {
  const result = spawnSync("git", args, { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
};
const run = (...args: ReadonlyArray<string>) =>
  spawnSync("git", args, { stdio: "inherit" }).status === 0;

const stop = (message: string): never => {
  console.error(`\nNot landed: ${message}`);
  process.exit(1);
};

for (const busy of [
  "rebase-merge",
  "rebase-apply",
  "MERGE_HEAD",
  "CHERRY_PICK_HEAD",
  "REVERT_HEAD",
]) {
  const path = git("rev-parse", "--path-format=absolute", "--git-path", busy);
  if (path !== null && existsSync(path)) stop(`finish or abort the ${busy} in progress first.`);
}
const status = git("status", "--porcelain");
if (status !== "") stop(`commit every change first, new files included:\n${status}`);

for (let attempt = 1; attempt <= 3; attempt++) {
  if (!run("fetch", "--quiet", "origin", "main")) stop("could not fetch main.");
  const base = git("rev-parse", "origin/main");
  if (git("rev-list", "--count", "origin/main..HEAD") === "0") {
    console.log("Nothing to land: main already has these commits.");
    process.exit(0);
  }
  if (!run("rebase", "--quiet", "origin/main")) {
    const clashes = git("diff", "--name-only", "--diff-filter=U") ?? "";
    run("rebase", "--abort");
    stop(
      `your commits clash with what landed on main, in:\n${clashes}\nRun \`git rebase origin/main\`, resolve the clash, read the commits that landed in those files, and land again.`,
    );
  }
  const landing = git("log", "--format=%h %s", "origin/main..HEAD");
  if (run("push", "--quiet", "origin", "HEAD:main")) {
    console.log(`\nLanded on main:\n${landing}`);
    console.log("\nGitHub builds main again: `gh run list --workflow ci --branch main --limit 1`.");
    process.exit(0);
  }
  if (git("ls-remote", "origin", "refs/heads/main")?.split(/\s/)[0] === base) {
    stop("the push was refused; the reason is above.");
  }
  console.log("Another change landed first. Rebasing on it and trying again.");
}
stop("main kept moving. Land again.");
