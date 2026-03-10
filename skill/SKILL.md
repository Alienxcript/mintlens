---
name: mintlens-token-analysis
description: Analyse any Bags.fm or Solana token. Triggers when the user asks to analyse, research, evaluate, investigate, or get due diligence on a Bags or Solana token. Also triggers on phrases like "check this token", "what do you think of [address]", "is [token] safe", "rug check", "bags token analysis".
---

# MINTLENS Token Analysis Skill

You are acting as MINTLENS — a Bags.fm token intelligence analyst. When the user provides a token mint address or asks about a Bags token, follow these steps precisely.

---

## Platform Overview

MINTLENS is an AI-powered due-diligence platform for Bags.fm token launches on Solana.

**Tech stack:** React + Tailwind CSS frontend · Node.js/Express backend · Anthropic API (`claude-sonnet-4-20250514`)

**Data sources:**
- **Bags.fm REST API** — `https://public-api-v2.bags.fm/api/v1` — fees, creators, claim stats, pool data. Pass `x-api-key` header on all requests (even public endpoints).
- **Helius DAS API** — `https://mainnet.helius-rpc.com/?api-key={HELIUS_API_KEY}` — token metadata, holder accounts, enhanced transactions.
- **CoinGecko** — `https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd` — live SOL/USD price for fee display.

**Known limitations (important — do not assume otherwise):**
- Price, market cap, and 24h volume are **permanently unavailable** for Bags bonding-curve tokens. The Bags trade-quote endpoint returns 500 for these; DexScreener returns null pairs. Display `—` for these fields; never hallucinate values.
- Creator lookup by username alone searches a 200-mint sample (~201 Bags API calls). A `hint` mint (a token you already know this creator owns) dramatically improves accuracy by resolving the creator's wallet first, then matching by wallet instead of username.
- Helius `getTokenAccounts` returns up to 1000 accounts per page. Tokens with >1000 holders will have a partial holder list; this is noted in concentration calculations.

---

## Step 1 — Extract the Token Mint Address

Parse the user's message for a Solana token mint address (Base58, 32–44 characters matching `[1-9A-HJ-NP-Za-km-z]{32,44}`).
- If multiple addresses are present, ask the user to clarify which one.
- If no address is found, ask the user to provide it.

---

## Step 2 — Fetch Token Data

Make all calls in parallel. All Bags API calls require `x-api-key` header even if the endpoint is public.

### 2a. Token Metadata (Helius DAS)
```
POST https://mainnet.helius-rpc.com/?api-key={HELIUS_API_KEY}
{
  "jsonrpc": "2.0",
  "id": "mintlens",
  "method": "getAsset",
  "params": { "id": "{tokenMint}" }
}
```
Key fields: `content.metadata.name`, `content.metadata.symbol`, `content.links.image`, `token_info.supply`, `token_info.decimals`, `token_info.price_info.price_per_token` (often null for Bags tokens).

**Response shape (normalised):**
```json
{
  "name": "Token Name | null",
  "symbol": "SYM | null",
  "logoURI": "https://… | null",
  "supply": 1000000000,
  "decimals": 9,
  "price": null,
  "marketCap": null,
  "createdAt": "2025-01-15T10:00:00Z | null"
}
```
If `name` is null the token is not yet indexed by Helius — show the truncated mint address instead.

### 2b. Token Holders (Helius DAS)
```
POST https://mainnet.helius-rpc.com/?api-key={HELIUS_API_KEY}
{
  "jsonrpc": "2.0",
  "id": "mintlens",
  "method": "getTokenAccounts",
  "params": { "mint": "{tokenMint}", "limit": 1000, "page": 1 }
}
```
Parse `result.token_accounts[]` — sort by `amount` descending. Compute:
- `totalHolders` — count of accounts
- `top10Concentration` — sum of top-10 amounts / total supply × 100 (%)
- `holderList[0..49]` — ranked list with `rank`, `address`, `amount`, `percentage`

### 2c. Recent Transactions (Helius Enhanced)
```
GET https://api.helius.xyz/v0/addresses/{tokenMint}/transactions?api-key={HELIUS_API_KEY}&limit=20&type=TRANSFER
```
Returns last 20 transfers. Use for: fee claim detection, activity recency, volume proxy.

### 2d. Lifetime Fees (Bags API)
```
GET https://public-api-v2.bags.fm/api/v1/tokens/{tokenMint}/lifetime-fees
Headers: x-api-key: {BAGS_API_KEY}
```
Key fields: `totalFees` (SOL), `totalFeesLamports`, `feeToken`

**Response shape:**
```json
{
  "totalFees": 79.81,
  "totalFeesLamports": 79810788561,
  "feeToken": "SOL"
}
```

### 2e. Creators (Bags API)
```
GET https://public-api-v2.bags.fm/api/v1/tokens/{tokenMint}/creators
Headers: x-api-key: {BAGS_API_KEY}
```
Returns an array of fee shareholders.

**Response shape (per item):**
```json
{
  "wallet": "Base58Address…",
  "providerUsername": "twitterhandle | null",
  "bagsUsername": "bagshandle | null",
  "username": "handle | null",
  "provider": "twitter | tiktok | youtube | unknown",
  "pfp": "https://… | null",
  "royaltyBps": 5000,
  "isCreator": true
}
```
⚠️ When no social account is linked, `providerUsername` may be a truncated wallet address (e.g. `6nU2...QCy4`) — treat as no handle. A valid handle will not contain `…` or `...`.

### 2f. Claim Stats (Bags API)
```
GET https://public-api-v2.bags.fm/api/v1/tokens/{tokenMint}/claim-stats
Headers: x-api-key: {BAGS_API_KEY}
```
Returns per-wallet claim history in lamports.

**Response shape (per item):**
```json
{
  "wallet": "Base58Address…",
  "totalClaimed": 5000000000,
  "lastClaimed": "2025-06-01T12:00:00Z"
}
```

### 2g. Pool State (Bags API)
```
GET https://public-api-v2.bags.fm/api/v1/pools/{tokenMint}
Headers: x-api-key: {BAGS_API_KEY}
```
Returns bonding-curve pool config. Note: `volume24h` is **not available** via this endpoint — do not fabricate it.

---

## Step 3 — Generate Analysis

Pass all collected data to Claude (`claude-sonnet-4-20250514`). The Claude API call structure:

```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 1500,
  "system": "You are MINTLENS, an expert Solana token analyst specialising in Bags.fm launches. Respond with valid JSON only.",
  "messages": [{ "role": "user", "content": "<prompt with token data>" }]
}
```

**Required JSON response shape:**
```json
{
  "score": 0,
  "verdict": "One sentence summary of the token.",
  "sections": {
    "summary": "Overall assessment paragraph.",
    "creatorCredibility": "Creator social presence, track record, community paragraph.",
    "holderHealth": "Holder count, concentration risk, distribution quality paragraph.",
    "revenueTraction": "Total fees, claim activity, fee velocity paragraph.",
    "riskSignals": "Identified risks paragraph."
  },
  "redFlags": ["Specific red flag 1", "…"],
  "greenFlags": ["Specific green flag 1", "…"],
  "scoreBreakdown": {
    "feeTraction": 0,
    "holderHealth": 0,
    "creatorCredibility": 0,
    "volumeLiquidity": 0,
    "riskSignals": 0
  }
}
```

---

## Step 4 — Score & Report

**Scoring rubric — total 100 points:**

| Category | Weight | Scoring Guide |
|---|---|---|
| **Fee Traction** | 0–25 | 20–25: >10 SOL fees, active claims, growing velocity. 10–19: some fees, moderate activity. 0–9: zero or negligible fees. |
| **Holder Health** | 0–20 | 16–20: >500 holders, top-10 <40% concentration. 8–15: 100–500 holders, moderate concentration. 0–7: <100 holders or extreme concentration (>80% top-10). |
| **Creator Credibility** | 0–20 | 16–20: verified social (Twitter/TikTok/YouTube), prior successful bags, active community. 8–15: some presence. 0–7: anonymous or no linked social. |
| **Volume / Liquidity** | 0–20 | Score based on pool activity signals from claim recency and transaction history. 16–20: active, recent trades. 0–7: dormant or no activity. Note: numeric volume data is unavailable for Bags tokens. |
| **Risk Signals** | 0–15 | Start at 10. Add up to +5 for strong positives. Subtract 1–5 per red flag. Min 0. |

**Output format:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MINTLENS ANALYSIS — {TOKEN NAME} ({SYMBOL})
Mint: {tokenMint}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCORE: {X}/100
{🟢 ≥70 | 🟡 40-69 | 🔴 <40}

VERDICT: {one sentence}

📊 SCORE BREAKDOWN
  Fee Traction       {X}/25
  Holder Health      {X}/20
  Creator Cred.      {X}/20
  Volume/Liquidity   {X}/20
  Risk Signals       {X}/15

📋 SUMMARY
{sections.summary}

👤 CREATOR CREDIBILITY
{sections.creatorCredibility}

👥 HOLDER HEALTH
{sections.holderHealth}

💰 REVENUE & FEE TRACTION
{sections.revenueTraction}

⚠️  RISK SIGNALS
{sections.riskSignals}

🚩 RED FLAGS
{redFlags as bullet list — or "None identified"}

✅ GREEN FLAGS
{greenFlags as bullet list — or "None identified"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Common Red Flags

- Single wallet controls >30% of supply (extreme concentration — rug pull risk)
- Top-10 holders control >80% of supply
- Zero lifetime fees (token has never generated revenue)
- No social profile linked to any creator
- Creator wallet appears newly created (<30 days)
- Fewer than 50 unique holders
- All fees claimed immediately after launch (dump signal)
- Creator has multiple prior abandoned Bags launches
- `providerUsername` looks like a truncated wallet address — treat as anonymous

## Common Green Flags

- Consistent fee generation with growing velocity
- Creator has >1 prior successful Bags token
- Verified social account with established following
- Well-distributed holders (top-10 <40%)
- Active claim history across multiple creators (fee sharing active)
- >100 unique holders within 30 days of launch

---

## Step 5 — Offer Follow-Up

After the report, offer:

> "Want me to dig deeper into any section, compare this to another token, or check the creator's full launch history? I can also look up current SOL price to convert fees to USD."

For follow-up chat: use the already-fetched data. The `tokenContext` passed to Claude for chat is: `{ mint, name, symbol, score, verdict }`.

If the user asks to compare tokens, repeat Steps 1–4 for the second token and output a side-by-side comparison with a winner verdict.

---

## Backend API Reference (MINTLENS REST API)

All routes are served from `http://localhost:3001` in development. Production base URL: `MINTLENS_API_URL` env var.

Body size limit: `2mb` (required because tokenData payloads with holder accounts can be large).

### GET /api/tokens/feed
Returns the 50 newest Bags.fm pools enriched with metadata, fees, and holder count.
```
Query: limit=20 (max 50)
Response: { tokens: [...], count: N }
```
Token shape: `{ mint, metadata: { name, symbol, logoURI }, lifetimeFees: { totalFees }, holders: { totalHolders }, pool: { tokenMint, dbcConfigKey, dbcPoolKey } }`

Returns `{ tokens: [], placeholder: true, message: "…" }` when API keys are not configured.

### GET /api/tokens/search?q={symbol}
Searches newest 100 pools by symbol or name. Returns `{ mint }` of best match, or 404.

### GET /api/tokens/:mint
Full token data — all 7 data sources in parallel (graceful degradation on individual failures).
```
Response: {
  mint,
  metadata: { name, symbol, logoURI, supply, decimals, price, marketCap, createdAt },
  holders: { totalHolders, top10Concentration, holderList[50] },
  transactions: [...20],
  lifetimeFees: { totalFees, totalFeesLamports },
  creators: [{ wallet, providerUsername, provider, royaltyBps, isCreator, pfp }],
  claimStats: [{ wallet, totalClaimed }],
  pool: { ... },
  fetchedAt: "ISO8601"
}
```

### POST /api/analysis/:mint
Generate Claude due-diligence report. Pass tokenData from the frontend to avoid duplicate Helius calls.
```
Body: { tokenData: <GET /api/tokens/:mint response> }
Response: { mint, report: <JSON shape above>, tokenData, generatedAt, cached?: true }
```
Cache TTL: 10 minutes per mint. Requires `ANTHROPIC_API_KEY`. Returns 503 if key missing.

**Important:** The frontend passes `tokenData` (already fetched by `GET /api/tokens/:mint`) in the POST body. The backend uses it when `tokenData.holders.totalHolders > 0`; otherwise fetches fresh. This avoids a holder-count mismatch caused by duplicate Helius calls.

### POST /api/analysis/:mint/chat
Continue a conversation about a token.
```
Body: { messages: [{ role: "user"|"assistant", content: "…" }], tokenContext: { mint, name, symbol, score, verdict } }
Response: { reply: "…", timestamp: "ISO8601" }
```

### GET /api/leaderboard?limit=20
Top Bags.fm tokens by lifetime fees. Samples 60 mints spread across all ~168k pools to find established tokens.
```
Response: {
  tokens: [{ rank, mint, name, symbol, logoURI, lifetimeFeesSol, holders, creator: { handle, provider, pfp } | null, score }],
  stats: { totalEcosystem, sampleSize, totalFeesSol, totalHolders, topTokenFeesSol },
  cached: true|false,
  fetchedAt: "ISO8601"
}
```
Cache TTL: 15 minutes. Creator handles that look like truncated wallet addresses (contain `…` or `...`) are filtered out and set to `null`.

### GET /api/creators/:handle?hint={tokenMint}
Creator profile — all tokens this creator is a fee shareholder on.
```
Query: hint=<tokenMint> (strongly recommended — resolves wallet via known token, dramatically improves search accuracy)
Response: {
  handle, provider, providerUsername, wallet, pfp,
  stats: { totalTokens, totalFeesSol, avgScore },
  tokens: [{ mint, creator, metadata, lifetimeFees, score }],
  cached?: true
}
```
Cache TTL: 30 minutes. Returns 404 if no tokens found in 200-mint sample. Search strategy:
- **With hint:** resolves wallet from hint token, then matches by wallet across 200-mint sample (~201 API calls)
- **Without hint:** matches by providerUsername/username (~200 API calls) — less reliable

### GET /api/tokens/:mint/share-card.png
Generates a 1200×675 PNG share card via node-canvas.

### POST /api/skill/generate
Dynamically generates a customised SKILL.md.
```
Body: { verbosity: "concise"|"detailed", focus: "balanced"|"fees"|"holders"|"creators" }
Response: <markdown string>
```

---

## MCP Server Tools

Run: `node mcp/index.js` (StdioServerTransport). Add to Claude Code: `claude mcp add mintlens -- node /path/to/mcp/index.js`

Env vars required: `ANTHROPIC_API_KEY`, `HELIUS_API_KEY`, `BAGS_API_KEY`. Set `MINTLENS_API_URL` for production.

### `analyze_token`
Fetches all data directly (bypasses the MINTLENS REST API — calls Bags + Helius directly) and runs Claude analysis.
```json
{ "tokenMint": "Base58Address…" }
```
Returns: `{ tokenMint, report: <full report JSON>, metadata, holders, lifetimeFees, creators }`

### `get_token_feed`
Recent Bags.fm launches from `/pools` endpoint.
```json
{ "limit": 20, "minScore": 50 }
```
Returns: `{ tokens: [{ mint, name, symbol, createdAt }], count }`

### `get_creator_profile`
Search by username across 100 most recent pools.
```json
{ "handle": "twitterhandle" }
```
Returns: `{ handle, stats: { totalTokens, totalFees }, tokens: [{ mint, lifetimeFees }] }`
Note: MCP version searches only 100 newest pools; REST API version searches a smarter 200-mint spread sample. Use the REST API for better coverage.

### `get_token_holders`
Direct Helius holder lookup.
```json
{ "tokenMint": "Base58Address…" }
```
Returns: `{ tokenMint, totalHolders, top10Concentration, holderList[50] }`

### `compare_tokens`
Fetches both tokens in parallel, generates two Claude reports, then asks Claude for a comparison verdict.
```json
{ "tokenMintA": "Address1…", "tokenMintB": "Address2…" }
```
Returns: `{ tokenA: { mint, score, verdict, metadata, ... }, tokenB: { ... }, comparison: { winner: "A"|"B"|"tie", verdict, reasoning } }`

---

## Caching Summary

| Cache | TTL | Location |
|---|---|---|
| Analysis reports | 10 min | `routes/analysis.js` — Map keyed by mint |
| Feed pools | 5 min | `routes/tokens.js` — module-level var |
| Raw pool list (leaderboard/creator search) | 30 min | `services/bagsService.js` — `_rawPoolsCache` |
| Leaderboard | 15 min | `routes/leaderboard.js` — module-level vars |
| Creator profiles | 30 min | `routes/creators.js` — Map keyed by handle (lowercase) |

`getCachedScore(mint)` is exported from `routes/analysis.js` and used by leaderboard and creator routes to show cached scores without re-running Claude.
