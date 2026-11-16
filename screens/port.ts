// The port of the browser tests' own server. `bun run land` gives its run a
// port of its own, so an agent's test run cannot collide with a landing.
export const screensPort = Number(process.env.SCREENS_PORT ?? "4120");
