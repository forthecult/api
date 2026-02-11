<!-- INTERNAL — DO NOT PUBLISH. Contains deployment details. -->

# Alice (OpenClaw) — Setup & Deployment

> *"It would be so nice if something made sense for a change."*

Alice is the Culture Store's AI guide, powered by [OpenClaw](https://docs.openclaw.ai). Inspired by Lewis Carroll's *Alice in Wonderland*, she leads customers down the rabbit hole — across the website chat widget, Telegram, and Discord — with persistent memory and a curious, whimsical personality.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│            OpenClaw Gateway (Railway)                │
│                                                     │
│  Alice Agent (main)                                 │
│  ├─ SOUL.md      — Wonderland personality & rules   │
│  ├─ AGENTS.md    — behavior config                  │
│  ├─ TOOLS.md     — Culture Store API tool defs      │
│  ├─ MEMORY.md    — long-term memory                 │
│  └─ memory/      — daily memory logs                │
│                                                     │
│  Channels:                                          │
│  ├─ /v1/chat/completions  (website widget)          │
│  ├─ Telegram bot                                    │
│  └─ Discord bot                                     │
│                                                     │
│  Model: Claude 4 Sonnet (fallback: GPT-4o)          │
└──────────────────┬──────────────────────────────────┘
                   │ HTTPS
                   ▼
┌─────────────────────────────────────────────────────┐
│        Culture Store (Next.js on Railway)            │
│  /api/products/semantic-search                      │
│  /api/orders/{id}/status                            │
│  /api/refund/lookup                                 │
│  /api/governance/staked-balance                     │
│  ... (full API)                                     │
└─────────────────────────────────────────────────────┘
```

---

## Where to host OpenClaw

### Option 1: Railway (recommended — you already use it)

OpenClaw has a one-click Railway deploy template. This is the simplest path since your store is already on Railway.

**Pros:** Same platform as the store, zero ops, /setup web wizard, volume for persistence, easy backups.
**Cons:** Railway charges for always-on services (~$5-20/mo depending on usage).
**Cost estimate:** ~$5/mo for the service + volume. Model API costs (Anthropic/OpenAI) are separate.

**Steps:**

1. Go to [OpenClaw Railway template](https://railway.com/deploy/clawdbot-railway-template) and click **Deploy on Railway**
2. In your Railway project, configure the service:
   - **Volume:** mount at `/data`
   - **Port:** `8080` (enable HTTP Proxy)
   - **Variables:**
     ```
     SETUP_PASSWORD=<choose-a-strong-password>
     PORT=8080
     OPENCLAW_STATE_DIR=/data/.openclaw
     OPENCLAW_WORKSPACE_DIR=/data/workspace
     OPENCLAW_GATEWAY_TOKEN=<generate-a-strong-token>
     ```
3. Deploy, then visit `https://<your-openclaw>.up.railway.app/setup`
4. In the setup wizard:
   - Add your **Anthropic API key** (for Claude 4 Sonnet)
   - Add your **Telegram bot token** (from @BotFather)
   - Add your **Discord bot token** (from Discord Developer Portal)
   - Click **Run setup**
5. Copy the OpenClaw config from `openclaw/openclaw.json` in this repo to customize Alice
6. Upload the workspace files (`SOUL.md`, `AGENTS.md`, `TOOLS.md`) to `/data/workspace/`

**Connect to the store — add these env vars to the main Culture Store service:**

```
OPENCLAW_GATEWAY_URL=https://<your-openclaw>.up.railway.app
OPENCLAW_GATEWAY_TOKEN=<same-token-as-above>
OPENCLAW_AGENT_ID=main
```

That's it. The website chat widget will now route through Alice on OpenClaw.

### Option 2: Hetzner VPS (~$4-8/mo)

Best price-to-performance. Run OpenClaw on a dedicated VPS.

**Pros:** Cheapest for always-on, full control, can run local models later.
**Cons:** Requires SSH access, systemd setup, manual updates.

```bash
# On the VPS
npm install -g openclaw@latest
openclaw onboard --install-daemon
openclaw gateway --port 8080
```

Use Tailscale or SSH tunnel for secure access. See: [Hetzner guide](https://docs.openclaw.ai/install/hetzner).

### Option 3: Fly.io

Similar to Railway but with edge deployment.

**Pros:** Edge locations, good free tier for small workloads.
**Cons:** More config than Railway.

See: [Fly.io guide](https://docs.openclaw.ai/install/fly).

### Option 4: Docker (anywhere)

Run OpenClaw as a Docker container on any host.

```bash
docker run -d \
  -p 8080:8080 \
  -v openclaw-data:/data \
  -e SETUP_PASSWORD=your-password \
  -e OPENCLAW_STATE_DIR=/data/.openclaw \
  -e OPENCLAW_WORKSPACE_DIR=/data/workspace \
  openclaw/openclaw:latest
```

See: [Docker guide](https://docs.openclaw.ai/install/docker).

### Recommendation

**Start with Railway.** You're already there, it's one click, and you get the web wizard. If costs become an issue or you want to run local models, migrate to Hetzner later — OpenClaw has a backup/export feature at `/setup/export`.

---

## Env vars reference

### On the OpenClaw Gateway (Railway service)

| Variable | Required | Description |
|----------|----------|-------------|
| `SETUP_PASSWORD` | Yes | Password for the /setup wizard |
| `PORT` | Yes | Must be `8080` |
| `OPENCLAW_STATE_DIR` | Yes | `/data/.openclaw` |
| `OPENCLAW_WORKSPACE_DIR` | Yes | `/data/workspace` |
| `OPENCLAW_GATEWAY_TOKEN` | Yes | Auth token for API access |
| `ANTHROPIC_API_KEY` | Yes | For Claude (Alice's brain) |
| `OPENAI_API_KEY` | Optional | Fallback model + embeddings for memory search |
| `TELEGRAM_BOT_TOKEN` | Optional | Telegram channel |
| `DISCORD_BOT_TOKEN` | Optional | Discord channel |
| `CULTURE_STORE_URL` | Yes | `https://forthecult.store` (Alice's tool target) |

### On the Culture Store (main Railway service)

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENCLAW_GATEWAY_URL` | Optional | OpenClaw gateway URL (e.g. `https://openclaw.up.railway.app`) |
| `OPENCLAW_GATEWAY_TOKEN` | Optional | Same token as on the gateway |
| `OPENCLAW_AGENT_ID` | Optional | Agent ID (default: `main`) |

When `OPENCLAW_GATEWAY_URL` is set, the chat widget routes through Alice. When it's not set, the existing direct-to-OpenAI path works as before (via `SUPPORT_CHAT_AI_API_KEY`).

---

## Telegram setup

1. Message **@BotFather** on Telegram
2. Send `/newbot`
3. Name it (e.g. "Alice - Culture Store")
4. Copy the bot token
5. Paste it in the OpenClaw `/setup` wizard or set `TELEGRAM_BOT_TOKEN`
6. Set the bot's description: `/setdescription` → "I'm Alice. I fell down a rabbit hole and ended up at the Culture Store. Ask me about products, orders, or $CULT."

## Discord setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. **New Application** → "Alice"
3. **Bot** → **Add Bot**
4. Enable **MESSAGE CONTENT INTENT** (required)
5. Copy the **Bot Token** and paste into `/setup`
6. Invite to your server: OAuth2 URL Generator → scopes: `bot`, `applications.commands` → permissions: Send Messages, Read Messages, Embed Links

---

## Memory

Alice's memory persists across all channels:

- **`MEMORY.md`** — Long-term curated facts (customer preferences, important decisions)
- **`memory/YYYY-MM-DD.md`** — Daily conversation logs (append-only)
- **Vector search** — Hybrid BM25 + semantic search over all memory files
- **Session transcripts** — Experimental: indexed for recall across conversations

When a customer talks to Alice on Telegram, she remembers the context when they later use the website chat (and vice versa). Memory is flushed automatically before context window compaction.

### What Alice remembers

- Customer preferences (sizes, favorite categories, payment methods)
- Order context within and across sessions
- Explicit "remember this" requests

### What Alice never stores in memory

- Email addresses, wallet addresses, physical addresses (PII)
- Payment details
- Passwords or tokens

---

## Testing

1. **Website widget:** Set the env vars on the store, restart, open the chat widget, and send a message. You should see Alice respond (not the old fallback).
2. **Telegram:** Message the bot directly. Alice should greet you and offer help.
3. **Discord:** DM the bot or mention @Alice in a channel.
4. **Memory test:** Tell Alice "remember that I prefer size L" on Telegram. Then ask "what size do I prefer?" on the website widget. She should recall it.

---

## Fallback behavior

The system is designed to degrade gracefully:

1. **OpenClaw available** → Alice responds with full capabilities (tools, memory)
2. **OpenClaw down, direct API configured** → Falls back to basic OpenAI/compatible API (no memory, no tools)
3. **Nothing configured** → Returns safe fallback message: "A team member will assist you shortly."

---

## Adding more agents later

OpenClaw supports multi-agent setups on a single gateway. The config is additive — to add a new agent:

1. Create a new workspace directory: `openclaw/workspace-{agentId}/`
2. Add `SOUL.md`, `AGENTS.md`, `TOOLS.md` to the workspace
3. Add the agent to `agents.list[]` in `openclaw.json`
4. Add routing `bindings` if the agent handles channel messages
5. Enable `tools.agentToAgent` if agents need to communicate
6. Redeploy

See [OpenClaw Multi-Agent Routing](https://docs.openclaw.ai/concepts/multi-agent) for full docs.

---

## Files in this repo

```
openclaw/
├── openclaw.json              # Gateway configuration
└── workspace/                 # Alice's workspace (→ /data/workspace)
    ├── SOUL.md                # Alice's Wonderland personality and rules
    ├── AGENTS.md              # Agent behavior config
    └── TOOLS.md               # Culture Store API tool definitions
```

These files are the source of truth. After deploying OpenClaw, upload the workspace files to the gateway's `/data/workspace/` directory (or use the Control UI to edit them).
