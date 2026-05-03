# For the Cult — MCP (Model Context Protocol)

Use **MCP** when you want assistants (Cursor, Claude, VS Code, Codex, etc.) to call **named tools** instead of hand-writing REST for every step. This guide complements the storefront page at **https://forthecult.store/mcp** and the REST overview in **[AI agents](./ai-agents.md)**.

---

## At a glance

| What | Detail |
|------|--------|
| **Hosted MCP (HTTPS)** | Streamable HTTP at **`POST https://mcp.forthecult.store/mcp`**. |
| **Health (browser)** | **`GET https://mcp.forthecult.store/healthz`** — small JSON; use this to prove reachability. |
| **Local (stdio)** | **`npx -y @forthecult/mcp`** — optional env **`FORTHECULT_API_BASE_URL`** (default `https://forthecult.store/api`). |
| **npm package** | **`@forthecult/mcp`** (binary `forthecult-mcp`). |
| **Implementation repo** | Private **`bythecult/mcp-railway-deploy`** (Railway + release automation). |
| **Public examples** | **`github.com/forthecult/mcp`** |

---

## Why the `/mcp` URL is not a “website”

The stream URL is an **API endpoint for MCP clients**. A normal browser tab issues **GET** and expects HTML — you will see an error if you paste the MCP URL into Chrome. That is **expected**. Use:

- the **health** URL for a quick browser check, and  
- the **MCP URL** only inside your IDE / agent host configuration.

---

## Remote vs local

### Hosted (recommended default)

- **Pros:** nothing to install; same URL for the whole team; easy in CI.  
- **Cons:** requires outbound HTTPS to `mcp.forthecult.store`; must trust the hosted process with whatever tools expose.

### Local stdio

- **Pros:** runs entirely on your machine; easy to pin npm version; good when HTTP MCP is blocked.  
- **Cons:** you manage `npx`, Node version, and outbound calls to the storefront API base.

---

## Canonical values

```http
POST https://mcp.forthecult.store/mcp
```

```http
GET https://mcp.forthecult.store/healthz
```

```bash
npx -y @forthecult/mcp
```

---

## Client snippets (starting points)

> **Warning:** every vendor renames fields between releases. Treat these as **templates** — adjust keys to match the JSON schema your build accepts.

### Cursor — HTTP MCP (`mcp.json`)

```json
{
  "mcpServers": {
    "forthecult": {
      "type": "http",
      "url": "https://mcp.forthecult.store/mcp"
    }
  }
}
```

### Claude Code — HTTP

```json
{
  "mcpServers": {
    "forthecult": {
      "type": "http",
      "url": "https://mcp.forthecult.store/mcp"
    }
  }
}
```

### Claude Desktop — stdio (typical)

```json
{
  "mcpServers": {
    "forthecult": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@forthecult/mcp"],
      "env": {
        "FORTHECULT_API_BASE_URL": "https://forthecult.store/api"
      }
    }
  }
}
```

### VS Code / Copilot

Use the MCP panel your channel documents; payload shape varies (`mcp`, `chat.mcp`, Insiders-only keys). Start from the Cursor block and map fields per Microsoft’s release notes.

### Codex / OpenCode-style CLIs

Prefer an HTTP transport block with the same URL as Cursor. Validate JSON (no trailing commas) before reload.

---

## Operator checklist

1. **Confirm health** — `curl -sS https://mcp.forthecult.store/healthz` returns JSON with `ok: true`.  
2. **Configure the IDE** — paste HTTP URL or stdio command; reload tools.  
3. **List tools** — ensure `tools/list` succeeds before write-capable tools.  
4. **Watch rate limits** — MCP shares the same public API limits as REST ([capabilities](https://forthecult.store/api/agent/capabilities)).  
5. **Payments** — MCP does **not** bypass wallet / x402 rules documented on **For AI Agents**.

---

## Troubleshooting

| Symptom | Likely cause | What to try |
|---------|----------------|-------------|
| Browser error on `/mcp` | Treated URL like a webpage | Use `/healthz` for GET checks; keep `/mcp` for MCP clients only. |
| No tools in IDE | Stale cache / bad JSON | Reload MCP; remove trailing commas; restart IDE. |
| SSL errors | MITM proxy or custom CA | Trust chain or use stdio mode from a trusted network. |
| Stdio cannot reach API | Blocked egress / wrong base | Set `FORTHECULT_API_BASE_URL`; confirm https-only allowlist on server. |

---

## Where to read more

| Resource | URL |
|----------|-----|
| **Storefront MCP guide** | https://forthecult.store/mcp |
| **For AI Agents (REST + summary)** | https://forthecult.store/for-agents |
| **OpenAPI** | https://forthecult.store/api/openapi.json |
| **Public MCP examples repo** | https://github.com/forthecult/mcp |

---

## Limitations

- MCP tools wrap the **same public** agent API as REST — catalog limits, checkout rules, and observability all apply.  
- **Payment authorization** is never bypassed by MCP; autonomous flows still follow x402 / wallet requirements on **For AI Agents**.
