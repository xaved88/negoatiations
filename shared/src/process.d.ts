// Minimal type shim for process.env, used in constants.ts.
// On the server this is Node's real process; on the client Vite replaces
// process.env.* references at build time.
declare const process: { env: Record<string, string | undefined> };
