import { Dota } from "dotakit";

import { startWatcher } from "./app.js";
import { parseConfig } from "./config.js";

async function main() {
  const config = parseConfig(process.env);
  const app = await startWatcher(config, { loginDota: Dota.login });
  console.log(`Dark Reef service listening on http://${config.http.host}:${config.http.port}`);
  console.log(JSON.stringify(app.getStatus()));

  const stop = async () => {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    await app.stop();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

main().catch((error) => {
  const name = error instanceof Error ? error.name : "UnknownError";
  console.error(`Dark Reef failed to start (${name}).`);
  process.exitCode = 1;
});
