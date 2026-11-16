import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { screensPort } from "./port";

const file = fileURLToPath(new URL("../data/no-network.log", import.meta.url));

export const readNetworkLog = () => (existsSync(file) ? readFileSync(file, "utf8") : "");

export default function requireFakeNetwork() {
  if (!readNetworkLog().includes(`listening on port ${screensPort} with the fake`)) {
    throw new Error(
      `The test server on port ${screensPort} is not running with screens/no-network.ts, so no test may run: one could reach the SEC, Wikidata or FRED.`,
    );
  }
}
