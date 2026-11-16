// Run by the pre-push hook. A push to main must carry exactly the checked-out
// commit, with nothing left uncommitted, and pass every check CI runs. Other
// pushes are left alone. `git push --no-verify` skips this: only to push a
// revert while main is broken, saying why in the commit message.
import { spawnSync } from "node:child_process";
import { writeFileSync, appendFileSync } from "node:fs";
import { flags } from "../src/server/flags";
import { isDoc } from "./docs-only";

const git = (...args: ReadonlyArray<string>) =>
  spawnSync("git", args, { encoding: "utf8" }).stdout.trim();

const refuse = (message: string): never => {
  console.error(`\nPush refused: ${message}`);
  process.exit(1);
};

const updates = (await Bun.stdin.text())
  .split("\n")
  .map((line) => line.split(" "))
  .filter(([, , remoteRef]) => remoteRef === "refs/heads/main");
if (updates.length === 0) process.exit(0);

for (const [, localSha = ""] of updates) {
  if (/^0+$/.test(localSha)) refuse("main is never deleted.");
  if (localSha !== git("rev-parse", "HEAD")) {
    refuse("push the commit you have checked out: `git push origin HEAD:main`.");
  }
}
const status = git("status", "--porcelain");
if (status !== "") refuse(`commit every change first, new files included:\n${status}`);

const log = git("rev-parse", "--path-format=absolute", "--git-path", "push-checks.log");
writeFileSync(log, "");
const port = spawnSync("bun", ["scripts/free-port.ts"], { encoding: "utf8" }).stdout.trim();
// Checks run with every flag at its default, whatever this shell has set.
const env = {
  ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("FLAG_"))),
  SCREENS_PORT: port,
};

// A push that only changes docs needs only the formatting check. Anything git
// cannot answer plainly means the full checks.
const docsOnly = (() => {
  const [update] = updates;
  const remoteSha = update?.[3] ?? "";
  if (updates.length !== 1 || /^0*$/.test(remoteSha)) return false;
  const ask = (...args: ReadonlyArray<string>) => spawnSync("git", args, { encoding: "utf8" });
  if (ask("cat-file", "-e", `${remoteSha}^{commit}`).status !== 0) return false;
  if (ask("merge-base", "--is-ancestor", remoteSha, "HEAD").status !== 0) return false;
  const diff = ask("diff", "--no-renames", "--name-only", "-z", remoteSha, "HEAD");
  if (diff.status !== 0) return false;
  const changed = diff.stdout.split("\0").filter((file) => file !== "");
  return changed.length > 0 && changed.every(isDoc);
})();
if (docsOnly) console.log("Only docs changed, so only the formatting check runs.");

const checks: ReadonlyArray<ReadonlyArray<string>> = docsOnly
  ? [["bun", "run", "check"]]
  : [
      ["bun", "install", "--frozen-lockfile"],
      ["bun", "run", "check"],
      ["bun", "run", "test"],
      ["bun", "run", "build"],
      ["bunx", "playwright", "test"],
    ];

const run = (command: ReadonlyArray<string>) => {
  const [program = "bun", ...args] = command;
  const result = spawnSync(program, args, { encoding: "utf8", env, maxBuffer: 1 << 28 });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  appendFileSync(log, `\n> ${command.join(" ")}\n${output}`);
  return { ok: result.status === 0, output };
};

const flaky: Array<string> = [];
for (const command of checks) {
  const name = command.join(" ");
  const started = Date.now();
  let result = run(command);
  if (!result.ok) {
    result = run(command);
    if (result.ok) flaky.push(name);
  }
  if (!result.ok) {
    const tail = result.output.trim().split("\n").slice(-30).join("\n");
    refuse(`\`${name}\` failed:\n${tail}\n\nThe full output is in ${log}.`);
  }
  console.log(`${name}: passed (${Math.round((Date.now() - started) / 1000)}s)`);
}

for (const name of flaky) {
  console.log(
    `\n\`${name}\` failed once, then passed with nothing changed: a test is flaky. Fix it, or skip it with the date and why, in its own \`test:\` commit.`,
  );
}
const soon = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
for (const [name, flag] of Object.entries(flags) as Array<[string, { removeBy: string }]>) {
  if (flag.removeBy <= soon) console.log(`\n${name} must be removed by ${flag.removeBy}.`);
}
