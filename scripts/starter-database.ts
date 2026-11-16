import { existsSync, linkSync, readdirSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { Effect, Layer } from "effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import { Collect } from "../src/server/collect";
import { Companies } from "../src/server/companies";
import { databaseFile, databaseLayer } from "../src/server/database";
import { ReportedNumbers } from "../src/server/reported-numbers";
import { Sec } from "../src/server/sec";
import { Settings } from "../src/server/settings";
import {
  fillStarter,
  readSavedAnswers,
  recordingSec,
  type SavedAnswers,
  savedAnswersFile,
  savedSec,
  starterCompanies,
  writeSavedAnswers,
} from "../src/server/starter";

// `bun run dev` runs this first. When there is no database yet, as in a new
// copy of the tool or a new worktree, it builds one holding the starter
// companies, from the SEC answers saved in the repo. Nothing reaches the SEC.
//
// With --record it asks the SEC again and saves its answers in place of the
// old ones. It uses the SEC contact in this copy's database, or in
// SEC_CONTACT_NAME and SEC_CONTACT_EMAIL.

const today = new Date().toLocaleDateString("en-CA");
const collecting = <E>(sec: Layer.Layer<Sec, E>) =>
  Layer.mergeAll(Collect.layer, Companies.layer).pipe(
    Layer.provideMerge(ReportedNumbers.layer),
    Layer.provide(sec),
  );

if (process.argv.includes("--record")) {
  const answers: SavedAnswers = { savedOn: today, json: {}, text: {} };
  // The real SEC client reads the contact from this copy's database, and
  // shares its limit of requests with any copy of the tool running on it.
  const sec = recordingSec(answers).pipe(
    Layer.provide(Sec.layer),
    Layer.provide(Settings.layer),
    Layer.provide(databaseLayer(existsSync(databaseFile) ? databaseFile : ":memory:")),
    Layer.provide(FetchHttpClient.layer),
  );
  await Effect.runPromise(
    fillStarter(today).pipe(
      Effect.provide(collecting(sec).pipe(Layer.provideMerge(databaseLayer(":memory:")))),
    ),
  );
  await writeSavedAnswers(answers);
  console.log(`${savedAnswersFile}: the SEC's answers for ${starterCompanies.length} companies`);
} else if (!existsSync(databaseFile)) {
  // Built under a name of its own and linked into place at the end, so a
  // build that stops halfway never leaves a database that looks finished, and
  // two starts at once never mix. The first to finish is kept.
  const building = `${databaseFile}.building-${process.pid}`;
  // A build that was stopped, as by Ctrl-C, leaves its files behind. Those of
  // a process that has ended are removed.
  const running = (pid: number) => {
    try {
      return process.kill(pid, 0);
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === "EPERM";
    }
  };
  const leftOver = new RegExp(
    `^${basename(databaseFile).replaceAll(".", "\\.")}\\.building-(\\d+)`,
  );
  const folder = dirname(databaseFile);
  for (const name of existsSync(folder) ? readdirSync(folder) : []) {
    const pid = leftOver.exec(name)?.[1];
    if (pid !== undefined && !running(Number(pid))) rmSync(join(folder, name), { force: true });
  }
  try {
    const answers = await readSavedAnswers();
    await Effect.runPromise(
      fillStarter(answers.savedOn).pipe(
        Effect.provide(
          collecting(savedSec(answers)).pipe(Layer.provideMerge(databaseLayer(building))),
        ),
      ),
    );
    linkSync(building, databaseFile);
    console.log(
      `${databaseFile}: a new database, with ${starterCompanies.length} companies as the SEC gave them on ${answers.savedOn}`,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  } finally {
    for (const suffix of ["", "-shm", "-wal"]) rmSync(`${building}${suffix}`, { force: true });
  }
}
