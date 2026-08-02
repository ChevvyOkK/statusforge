# StatusForge

Live status dashboard for every deployed service in this portfolio —
[SkillForge](https://github.com/ChevvyOkK/skillforge),
[EvoSim](https://github.com/ChevvyOkK/evosim),
[AetherAgency](https://github.com/ChevvyOkK/aether-agency),
[NexusPC](https://github.com/ChevvyOkK/nexuspc),
[SwarmArena](https://github.com/ChevvyOkK/swarm-arena-server), and the
portfolio site itself. No server, no database.

## Why no server

Building a monitoring *service* that itself needs monitoring — another free
web service that spins down after 15 minutes of inactivity, same as
everything it's supposed to watch — felt like the wrong shape for this
problem, not a deeper one.

Instead: a GitHub Actions workflow pings every service every ~10 minutes,
appends the result to `data/history.json`, and commits it. The dashboard is
a static page that fetches that file straight from
`raw.githubusercontent.com` client-side. Git is the datastore, GitHub
Actions is the cron. Nothing to keep alive, nothing to pay for, nothing that
can itself go down independently of GitHub being up.

## What counts as "up"

Any HTTP response at all — including a 4xx — counts as **up**. A 401 from
an auth-gated endpoint means the server is alive and doing its job
correctly; it isn't a failure. Only a 5xx counts as **degraded**, and only
a timeout or connection failure counts as **down**.

The timeout is 60 seconds, not the usual few seconds you'd expect from a
health check. [SkillForge's API](https://github.com/ChevvyOkK/skillforge)
and [SwarmArena's server](https://github.com/ChevvyOkK/swarm-arena-server)
both run on Render's free tier, which spins down after inactivity and can
take up to ~50 seconds to wake back up — a short timeout here would
misreport "asleep" as "down" on every single check, since a monitor that
pings every 10 minutes is, by definition, exactly frequent enough to never
let a free-tier service go idle long enough to *actually* need waking, and
just frequent enough to sometimes catch it a few minutes after it fell
asleep anyway.

## Running the pinger locally

```bash
node scripts/ping.mjs
```

Reads `services.json`, writes/updates `data/history.json`.

## Adding a service

Add an entry to `services.json`:

```json
{ "id": "my-service", "name": "My Service", "url": "https://...", "project": "https://github.com/..." }
```

The next scheduled run picks it up automatically — no other changes needed.
