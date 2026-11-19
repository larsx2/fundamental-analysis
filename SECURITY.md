# Security

## Reporting a vulnerability

Email Eduardo Urias at [edw.urias@gmail.com](mailto:edw.urias@gmail.com). Do not open a public issue or post an exploit before discussing it privately.

Include the affected commit, operating system, Bun version, steps to reproduce, and what an attacker could read or change. Use a minimal example without credentials, your database, or personal contact details. If a credential has already been exposed, revoke it rather than sending it in the report.

## Supported version and scope

Security fixes target the latest `main`. Older commits are not maintained separately; update before checking whether a problem is still present.

This is an early-stage, single-user tool for the computer running it. It binds to loopback and checks request origins; it has no user authentication. Public hosting, shared access and exposing the port through a reverse proxy are not supported.

The tool uses the reader's Codex sign-in. Questions and the figures looked up to answer them are sent to OpenAI. Keep Codex credentials and the local database private. See [the README](./README.md#where-it-runs) for the data flow.
