// Prints a port nothing is listening on, so several agents can run servers
// side by side.
const server = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
console.log(server.port);
server.stop(true);
