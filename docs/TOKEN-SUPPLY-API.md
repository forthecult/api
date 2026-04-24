# CULT Supply API

**Scope:** Public HTTP endpoints that report CULT supply numbers, for
exchange listings (CoinMarketCap, CoinGecko) and public dashboards.
Companion docs: [BUYBACK-BURN.md](BUYBACK-BURN.md),
[TOKEN-GATING.md](TOKEN-GATING.md).

## Purpose

CoinMarketCap and CoinGecko listings require self-reported supply feeds
that return a single number in plain text. The webapp exposes those
feeds (plus a JSON summary) by reading the CULT mint directly from
Solana mainnet on every request (60-second cache).

## Endpoints

Base URL: `https://forthecult.store`

| Endpoint | Method | Content-Type | Purpose |
|----------|--------|--------------|---------|
| `/api/supply`              | GET | `application/json`           | Full snapshot (max, total, circulating, burned, mint) |
| `/api/supply/total`        | GET | `text/plain; charset=utf-8` | Total supply (on-chain, reflects burns) |
| `/api/supply/circulating`  | GET | `text/plain; charset=utf-8` | Circulating supply (total − excluded addresses) |
| `/api/supply/max`          | GET | `text/plain; charset=utf-8` | Max (launch) supply |
| `/api/supply/burned`       | GET | `text/plain; charset=utf-8` | Burned since launch |

Plain-text endpoints return a single number — no quotes, no JSON
wrapping, no trailing newline. They match the format both CMC and
CoinGecko require for self-reported supply URLs.

### Example — JSON

```http
GET /api/supply
```

```json
{
  "symbol": "CULT",
  "mint": "6jCCBeaJD63L62c496VrV4HVPLJF5N3WyTWRwPappump",
  "network": "solana-mainnet",
  "decimals": 6,
  "maxSupply": 1000000000,
  "totalSupply": 991628579.244285,
  "circulatingSupply": 991628579.244285,
  "burnedSupply": 8371420.755715,
  "fetchedAt": 1748000000000,
  "stale": false
}
```

### Example — plain text

```http
GET /api/supply/total
```

```
991628579.244285
```

## How the numbers are computed

- **`totalSupply`** — read from Solana via the `getTokenSupply` RPC
  against the CULT mint. Authoritative and reflects every burn that
  has been confirmed on-chain.
- **`maxSupply`** — the hard cap at launch. Defaults to
  `1,000,000,000` (pump.fun launch amount). Overridable via
  `CULT_MAX_SUPPLY` env var.
- **`burnedSupply`** — `max(0, maxSupply − totalSupply)`. Reflects the
  buyback-and-burn mechanism described in [BUYBACK-BURN.md](BUYBACK-BURN.md).
- **`circulatingSupply`** — `total − Σ(balances of excluded addresses)`.
  Excluded addresses are read from the `CULT_EXCLUDED_ADDRESSES` env
  var (comma-separated SPL token account pubkeys). With no override
  configured, circulating equals total. This is deliberately
  conservative: we would rather slightly over-report circulating
  supply than under-report it.

## Environment variables

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `NEXT_PUBLIC_SOLANA_RPC_URL` | No | Ankr public | Paid RPC for higher QPS; Ankr fine for CMC/CoinGecko polling rates |
| `CULT_MAX_SUPPLY`            | No | `1000000000` | Override launch supply if needed |
| `CULT_EXCLUDED_ADDRESSES`    | No | empty       | Comma-separated SPL token account pubkeys to subtract from total when computing circulating |

## Caching and reliability

- 60 second in-memory cache + 60 second edge cache (`Cache-Control:
  public, s-maxage=60, stale-while-revalidate=300`).
- If the upstream Solana RPC fails, the endpoint serves the last
  successful snapshot and marks `stale: true` in the JSON response.
  Plain-text routes degrade silently (same stale number). If there is
  no cached value yet, endpoints return `503 upstream unavailable`.
- `/api/supply/max` caches for an hour — the max supply does not
  change without an explicit env override.

## Wiring up CMC and CoinGecko

When submitting or updating a listing, use:

- **Total Supply URL** → `https://forthecult.store/api/supply/total`
- **Circulating Supply URL** → `https://forthecult.store/api/supply/circulating`
- **Max Supply URL** (CMC) → `https://forthecult.store/api/supply/max`

Both trackers accept plain-text number responses from these URLs.

## Treasury / excluded addresses

Until the team publishes a formal list of treasury addresses that
should be excluded from circulating, leave `CULT_EXCLUDED_ADDRESSES`
unset. Locked tokens (held in the member-locking vault) count as
circulating — they are locked by users voluntarily, not withheld by
the project.

When you do add excluded addresses:

1. Add each SPL token account (not wallet; the token account that
   holds CULT) to `CULT_EXCLUDED_ADDRESSES` in the deploy environment.
2. Publish the list in this doc so the exchange listing teams and the
   community can audit the circulating supply calculation.
3. Redeploy; the next request will pick up the new set.
