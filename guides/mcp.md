# For the Cult — MCP integration

Integrate via the **Model Context Protocol** in addition to raw REST ([AI agents guide](./ai-agents.md)).

## Canonical endpoints

| Mode | How |
|------|-----|
| **Remote (HTTPS)** | Base URL **`https://mcp.forthecult.store`** — MCP streamable HTTP at **`POST /mcp`**. Liveness: **`GET /healthz`**. |
| **Local (stdio)** | **`npx -y @forthecult/mcp`** — optional env **`FORTHECULT_API_BASE_URL`** (default `https://forthecult.store/api`). |

## Where to read more

- **Storefront guide:** [https://forthecult.store/help/mcp](https://forthecult.store/help/mcp)
- **Public docs + client examples:** [github.com/forthecult/mcp](https://github.com/forthecult/mcp)
- **REST / OpenAPI:** [https://forthecult.store/api/openapi.json](https://forthecult.store/api/openapi.json)
- **Agent overview:** [https://forthecult.store/for-agents](https://forthecult.store/for-agents)

## npm package

The runnable server is published as **`@forthecult/mcp`** (stdio binary `forthecult-mcp`). Source and release automation live in the private **`bythecult/mcp-railway-deploy`** repository; this **`forthecult/api`** repo stays documentation-only for HTTP contracts.

## Limitations

- MCP tools wrap the **same public** commerce API: rate limits and checkout rules apply ([capabilities](https://forthecult.store/api/agent/capabilities)).
- **Payment authorization** is not bypassed by MCP; autonomous flows still follow x402 / wallet rules documented on for-agents.
