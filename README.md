# 3CX Queue Dashboard

A simple dashboard that polls 3CX, shows queue login state, phone status, calls today and how long each agent has remained signed in or out.

## Live dashboard

Lovable project: https://lovable.dev/projects/89c885f9-4f4d-4d89-a9ce-f7117dea27a5

Published dashboard: https://threecx-queue-watcher.lovable.app

The hosted dashboard currently uses mock data. Your 3CX server should be accessed by the local Node connector because browsers and hosted frontends commonly cannot reach a private PBX directly.

## Run the local connector

Requires Node.js 20 or newer.

```bash
git clone https://github.com/Qkrwogud/aoinokaze.git
cd aoinokaze
cp .env.example .env
node --env-file=.env server.js
```

Open `http://localhost:3030`.

The default is **mock mode**, so it works immediately without a 3CX connection.

## Connect 3CX

Set these values in `.env`:

```env
THREECX_MODE=live
THREECX_BASE_URL=https://your-pbx.example.com
THREECX_TOKEN=replace-me
THREECX_AGENTS_PATH=/xapi/v1/Users
THREECX_QUEUE_PATH=/xapi/v1/Queues
```

The default XAPI paths are placeholders because the exact exposed schema can differ by 3CX version and configuration. Confirm the users, queues and membership endpoints available on your server, then adjust the paths or the `normalise3cx` function in `server.js`.

The elapsed timer is calculated locally. Each poll compares the current queue state with the previous state and records the timestamp when it changes.

## Test

```bash
npm test
```

## Future Teams alerts

The next version can add a check after each poll that:

1. Runs only during configured business hours
2. Finds agents whose signed out duration exceeds a threshold
3. Suppresses duplicate alerts until the state changes
4. Sends an Adaptive Card through a Teams Workflow webhook or Microsoft Graph

Keep webhook URLs and API tokens in `.env`, not GitHub.
