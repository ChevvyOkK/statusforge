// Pings every service in services.json and appends one entry per service to
// data/history.json. Run on a schedule by .github/workflows/ping.yml - no
// server, no database, git is the datastore.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const MAX_ENTRIES_PER_SERVICE = 500;
// Render's free tier spins down after inactivity and can take ~50s to wake
// back up (see envcheck and swarm-arena-server's READMEs for exactly this).
// A short timeout here would misreport "asleep" as "down".
const TIMEOUT_MS = 60000;

const services = JSON.parse(readFileSync("services.json", "utf8"));

let history = {};
if (existsSync("data/history.json")) {
  history = JSON.parse(readFileSync("data/history.json", "utf8"));
}

const now = new Date().toISOString();

for (const svc of services) {
  const start = Date.now();
  let status = "down";
  let httpStatus = null;

  try {
    const res = await fetch(svc.url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
    });
    httpStatus = res.status;
    // Any response at all means the server is alive and reachable. A 4xx
    // (auth required, not found) is still "up" - the failure mode this
    // tracks is unreachable/crashed/asleep, not "every route returns 200".
    status = res.status >= 500 ? "degraded" : "up";
  } catch {
    status = "down";
  }

  const latencyMs = Date.now() - start;

  if (!history[svc.id]) history[svc.id] = [];
  history[svc.id].push({ t: now, status, latencyMs, httpStatus });
  if (history[svc.id].length > MAX_ENTRIES_PER_SERVICE) {
    history[svc.id] = history[svc.id].slice(-MAX_ENTRIES_PER_SERVICE);
  }

  console.log(`${svc.id}: ${status} (${httpStatus ?? "no response"}, ${latencyMs}ms)`);
}

mkdirSync("data", { recursive: true });
writeFileSync("data/history.json", JSON.stringify(history, null, 2) + "\n");
