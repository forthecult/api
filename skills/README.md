# For the Cult — Agentic Commerce Skills

This directory contains [Agent Skills](https://agentskills.io/specification)-compatible skill packages that enable **Agentic Commerce** — AI agents (Molt, OpenClaw, Claude, ChatGPT, and other compatible runtimes) autonomously shopping the For the Cult store, placing orders, and tracking shipments on behalf of users.

## Skills

| Skill | Version | Description |
|-------|---------|-------------|
| **[agentic-commerce-forthecult](./agentic-commerce-forthecult/)** | 2.0 | Agentic Commerce: browse lifestyle, wellness, and longevity products, semantic search, product details and variants, multi-chain checkout (8+ blockchains), CULT holder discounts, order tracking from payment to delivery. |

## Installation

### ClawHub (recommended)

```bash
clawhub install agentic-commerce-forthecult
```

Or browse [clawhub.com/skills/agentic-commerce-forthecult](https://clawhub.com/skills/agentic-commerce-forthecult).

### Workspace (any AgentSkills-compatible runtime)

Drop this `skills` folder into your agent workspace:

```
<workspace>/skills/agentic-commerce-forthecult/SKILL.md
```

Molt, OpenClaw, and other runtimes that support workspace-level skills will discover and load `agentic-commerce-forthecult` automatically.

### Local / machine-wide (OpenClaw)

Copy the skill to your local skills directory:

```bash
cp -r agentic-commerce-forthecult ~/.openclaw/skills/
```

All OpenClaw agents on the machine will have access.

## Skill structure

```
agentic-commerce-forthecult/
├── SKILL.md                         # Main instructions (loaded when skill activates)
└── references/
    ├── API.md                       # Complete endpoint reference with response shapes
    ├── CHECKOUT-FIELDS.md           # Checkout request body spec with examples
    └── ERRORS.md                    # Error codes, recovery patterns, rate limiting
```

The skill follows [progressive disclosure](https://agentskills.io/specification#progressive-disclosure): metadata is loaded at startup (~100 tokens), the full `SKILL.md` is loaded on activation, and reference files are loaded only when the agent needs deeper detail.

## API

No API key required. Base URL: **https://forthecult.store/api**

See the [API README](../README.md) and [OpenAPI spec](../openapi.yaml) for the machine-readable specification.

## Links

| Resource | URL |
|----------|-----|
| Store | https://forthecult.store |
| Agent entry point | https://forthecult.store/for-agents |
| API base | https://forthecult.store/api |
| OpenAPI spec | [openapi.yaml](../openapi.yaml) |
| Support | weare@forthecult.store |
| Agent Skills spec | https://agentskills.io/specification |
