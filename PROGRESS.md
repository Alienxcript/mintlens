# MINTLENS — Project Progress

**Last updated:** 2026-03-10 (Session 3)
**Status:** Feature-complete MVP. Full frontend redesign + creator profile + holder/analysis data fixes applied. Ready for deployment.

---

## Project Structure

```
mintlens/
├── backend/
│   ├── server.js                  # Express entry point, route mounts
│   ├── routes/
│   │   ├── tokens.js              # GET /feed, GET /:mint, share card routes
│   │   ├── analysis.js            # POST /:mint (Claude report), POST /:mint/chat
│   │   ├── leaderboard.js         # GET /leaderboard (ranked by lifetime fees)
│   │   ├── creators.js            # GET /creators/:handle
│   │   ├── watchlist.js           # GET/POST /watchlist (in-memory)
│   │   ├── alerts.js              # POST /alerts/subscribe (web-push + email)
│   │   └── skill.js               # POST /skill/generate (SKILL.md download)
│   └── services/
│       ├── bagsService.js         # All Bags.fm REST API calls
│       ├── heliusService.js       # Helius DAS + Enhanced Transactions
│       ├── claudeService.js       # Anthropic SDK — report, summary, chat
│       ├── alertService.js        # web-push + nodemailer subscriptions
│       └── shareCardService.js    # node-canvas 1200×675 PNG generation
│
├── frontend/
│   └── src/
│       ├── App.jsx                # Routes: /, /token/:mint, /creator/:handle, /wallet, /leaderboard
│       ├── main.jsx               # PrivyProvider wraps BrowserRouter
│       ├── lib/api.js             # Axios client, all API namespaces
│       ├── pages/
│       │   ├── Home.jsx           # Hero, live feed, trending, alert modal
│       │   ├── TokenReport.jsx    # Full token analysis page
│       │   ├── Leaderboard.jsx    # Fee leaderboard with stats bar
│       │   ├── CreatorProfile.jsx # Creator detail page
│       │   └── Wallet.jsx         # Privy wallet auth page
│       ├── components/
│       │   ├── TokenCard.jsx      # Compact feed card (name, score, fees, holders)
│       │   ├── MetricsDashboard.jsx # 7-tile metric grid (lifetime fees USD, days active, holders, top-10 conc, creator, royalty, supply)
│       │   ├── AnalysisReport.jsx # Claude report: score + horizontal bars, verdict, breakdown, flags, sections
│       │   ├── FeeShareholdersList.jsx # Ranked shareholder list with % share + earned SOL
│       │   ├── FollowUpChat.jsx   # Chat UI with suggested questions, formatted responses
│       │   ├── ScoreBadge.jsx     # Animated SVG score ring (sm/md/lg)
│       │   ├── ShareCard.jsx      # HTML canvas share card preview
│       │   ├── WatchlistButton.jsx # Star/unstar token
│       │   └── CreatorCard.jsx    # Creator detail card
│       └── hooks/
│           ├── useTokenData.js    # Fetches GET /api/tokens/:mint
│           ├── useAnalysis.js     # Calls POST /api/analysis/:mint, exposes analyze()
│           └── useWatchlist.js    # GET/POST /api/watchlist
│
├── mcp/
│   └── index.js                   # Standalone MCP server (StdioServerTransport)
│                                  # Tools: analyze_token, get_token_feed, get_creator_profile,
│                                  #        get_token_holders, compare_tokens
│
├── skill/
│   └── SKILL.md                   # Static Claude Skill definition
│
├── CLAUDE.md                      # Claude Code project instructions
├── PROGRESS.md                    # This file
└── .env.example                   # Template for backend/.env
```

---

## Environment Variables

All in `backend/.env` (copy from `.env.example`):

| Variable | Required | Description |
|----------|----------|-------------|
| `BAGS_API_KEY` | Yes | Bags.fm REST API key (`bags_prod_...`) |
| `HELIUS_API_KEY` | Yes | Helius DAS + Enhanced Transactions key |
| `ANTHROPIC_API_KEY` | Yes | Anthropic Claude API key (`sk-ant-api03-...`) |
| `PRIVY_APP_ID` | Optional | Privy wallet auth app ID |
| `VAPID_PUBLIC_KEY` | Optional | Web push VAPID public key |
| `VAPID_PRIVATE_KEY` | Optional | Web push VAPID private key |
| `ALERT_EMAIL_USER` | Optional | SMTP username for email alerts |
| `ALERT_EMAIL_PASS` | Optional | SMTP password for email alerts |

Frontend: `frontend/.env.local`

| Variable | Description |
|----------|-------------|
| `VITE_PRIVY_APP_ID` | Privy app ID (same value as backend) |

---

## How to Start

```bash
# Backend (localhost:3001)
cd backend && npm run dev

# Frontend (localhost:5173)
cd frontend && npm run dev

# MCP server (stdio, for Claude Code integration)
node mcp/index.js
```

Vite proxies all `/api/*` requests to `localhost:3001` — no CORS config needed in development.

---

## What's Working ✅

### Core Flow
- **Token search**: paste any Solana mint address on the home page → redirects to token report
- **Token report**: loads metadata, holders, fees, creators, pool data in parallel; falls back gracefully if any source fails
- **Claude analysis**: generates a scored JSON report (0–100) with verdict, 5 sections, red/green flags, score breakdown. Cached 10 min per mint.
- **Follow-up chat**: multi-turn conversation with Claude using token context. Suggested questions, formatted responses (bold lead-in, bullet lists, paragraph breaks).

### Feed & Navigation
- **Live feed**: 20 newest Bags tokens, refreshed every 30s. Pool list cached server-side for 5 min to avoid re-downloading 168k records on every tick.
- **Trending strip**: top 6 tokens by score from current feed.
- **Filter tabs**: All / High Score (≥70) / New (<3h) / Flagged (<40).

### Leaderboard (`/leaderboard`)
- Samples 60 tokens spread across the full Bags ecosystem (oldest + evenly distributed), fetches lifetime fees, ranks by fees descending.
- Stats bar: tokens tracked / total ecosystem size, total fees, top token fees, total holders.
- Cache: 15 min, full enriched set stored — limit applied at response time (no cache-slicing bug).

### Token Report Page
- **Metrics dashboard**: 8 tiles always filled — Price, Market Cap, Total Supply (fallback when no volume), Holders, Lifetime Fees, Top-10 Concentration, Creator, Royalty.
- **Fee Shareholders section**: ranked list of creators/shareholders with avatar, @handle, % share, estimated earned SOL. Hidden if no creator data.
- **Score ring**: animated SVG ring (thicker strokes: sm=5px, md=7px, lg=10px). Color: green ≥70, yellow ≥40, red <40.
- **Share card**: HTML Canvas preview + backend PNG endpoint (`/api/tokens/:mint/share-card.png`).
- **Export Skill**: downloads SKILL.md via `/api/skill/generate`.
- **Watchlist**: in-memory star/unstar per session.

### Infrastructure
- **MCP server**: 5 tools registered, usable via `claude mcp add mintlens -- node /path/to/mcp/index.js`
- **Web push alerts**: VAPID guard (only activates if keys are real length/format)
- **Share card PNG**: node-canvas 1200×675, confirmed working (48 KB output)

---

## What's Not Working / Known Issues ⚠️

### 1. Price and Market Cap show `—` for small tokens (MEDIUM)
**Root cause**: Helius `getAsset` only returns `price_info` for tokens that are listed on a major exchange or indexed by Birdeye. Newly launched Bags tokens are unlisted.

**Fallback implemented**: `GET /trade/quote?inputMint=TOKEN&outputMint=SOL&amount=10^decimals` on the Bags API returns a SOL price. This is wired up in `tokens.js` — if Helius has no USD price, the backend calls the trade quote and sets `priceInSol` and `marketCapSol` on the metadata object. MetricsDashboard renders these with a `◎` prefix and "Price (SOL)" / "Mkt Cap (SOL)" labels.

**Actual problem**: The trade quote call is also frequently returning null because:
- The token has no active liquidity pool (e.g., MOGMODE has a null pool)
- The Bags API returns a 429 or empty response for the quote endpoint under rate limit pressure

**Fix needed**: Retry the trade quote with exponential backoff, or surface a clearer "No liquidity" state in the UI rather than `—`.

### 2. 24h Volume always hidden (LOW)
**Root cause**: The Bags pool object returned by `getBagsPool` and `getAllBagsPools` contains only `{ tokenMint, dbcConfigKey, dbcPoolKey, dammV2PoolKey }` — no volume data. The Bags API has no documented volume endpoint.

**Current behaviour**: When volume is null, the Total Supply tile renders instead (keeping the grid at 8 tiles). The Volume tile is never shown.

**Fix needed**: Either find a volume source (Birdeye API, on-chain AMM state) or accept that volume is unavailable and document it.

### 3. Rate limit exhaustion (HIGH in burst scenarios)
**Limit**: 1000 req/hr on the Bags API.

**Risk points**:
- Leaderboard first load: ~61 calls (1 pool list + 60 fee fetches + up to 60 enrichment calls)
- Feed: ~61 calls per 30s refresh cycle if pool cache is cold (1 pool list + 20×3 enrichment)
- Token report: ~6 calls per mint

**Mitigation in place**:
- Pool list cached 5 min in `tokens.js` — avoids re-downloading 168k records every 30s
- Leaderboard cached 15 min — only ~121 calls on first load, then 0 for 15 min
- Analysis cached 10 min per token

**Still a risk**: If a user opens many token reports in quick succession, each triggers 6 Bags API calls. No global rate-limit counter or queue exists.

### 4. Watchlist and Alerts are in-memory only (LOW)
Both reset on server restart. No persistence layer (database, file, Redis) implemented.

### 5. Creator profile page is minimal (LOW)
`CreatorProfile.jsx` renders basic creator data. No historical performance, no list of all tokens launched, no social links beyond what the Bags API returns.

### 6. No mobile layout testing done (LOW)
All dev and screenshots done at 1440px. Tailwind responsive classes are present but not verified at 375px / 768px.

---

## API Endpoints — Backend

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/ping` | Health ping | ✅ |
| GET | `/api/health` | Key presence check | ✅ |
| GET | `/api/tokens/feed` | 20 newest tokens enriched | ✅ |
| GET | `/api/tokens/:mint` | Full token data + price fallback | ✅ |
| GET | `/api/tokens/:mint/share-card-data` | Lightweight card data | ✅ |
| GET | `/api/tokens/:mint/share-card.png` | node-canvas PNG | ✅ |
| POST | `/api/analysis/:mint` | Claude report (cached 10 min) | ✅ |
| POST | `/api/analysis/:mint/chat` | Follow-up chat turn | ✅ |
| GET | `/api/leaderboard` | Top tokens by lifetime fees | ✅ |
| GET | `/api/creators/:handle` | Creator profile + token history | ✅ |
| GET | `/api/watchlist` | In-memory watchlist | ✅ |
| POST | `/api/watchlist` | Add to watchlist | ✅ |
| POST | `/api/alerts/subscribe` | Subscribe to launch alerts | ✅ |
| POST | `/api/skill/generate` | Generate SKILL.md download | ✅ |

---

## External APIs Used

### Bags.fm (`https://public-api-v2.bags.fm/api/v1`)
Auth: `x-api-key` header. Limit: 1000 req/hr.

| Endpoint | Used for |
|----------|----------|
| `GET /solana/bags/pools` | Full pool list (168k entries, no params supported) |
| `GET /solana/bags/pools/token-mint?tokenMint=X` | Pool state for one token |
| `GET /token-launch/lifetime-fees?tokenMint=X` | Fees in lamports (string) |
| `GET /token-launch/creator/v3?tokenMint=X` | Creator array |
| `GET /token-launch/claim-stats?tokenMint=X` | Per-wallet fee claims |
| `GET /token-launch/claim-events?tokenMint=X` | Individual claim events |
| `GET /trade/quote?inputMint=X&outputMint=SOL&amount=N` | SOL price via swap quote |

### Helius (`https://mainnet.helius-rpc.com/?api-key=KEY`)
JSON-RPC 2.0 POST.

| Method | Used for |
|--------|----------|
| `getAsset` | Token metadata, USD price (large tokens only), supply, decimals, logo |
| `getTokenAccounts` | Holder list + concentration (paginated) |
| `getTokenAccounts` (page 1 only) | Quick holder count for feed cards |
| `searchAssets` | Creator token history |
| `getSignaturesForAddress` + `getTransaction` | Recent transactions |

### Anthropic (`claude-sonnet-4-20250514`)
- `messages.create` — report generation (max 1500 tokens), creator summary (800 tokens), follow-up chat (800 tokens per turn)

---

## Claude Report JSON Shape

```json
{
  "score": 0-100,
  "verdict": "one-line summary string",
  "sections": {
    "summary": "...",
    "creatorCredibility": "...",
    "holderHealth": "...",
    "revenueTraction": "...",
    "riskSignals": "..."
  },
  "redFlags": ["string", ...],
  "greenFlags": ["string", ...],
  "scoreBreakdown": {
    "feeTraction": 0-25,
    "holderHealth": 0-20,
    "creatorCredibility": 0-20,
    "volumeLiquidity": 0-20,
    "riskSignals": 0-15
  }
}
```

---

## Scoring Rubric

| Category | Weight | Measures |
|----------|--------|----------|
| Fee Traction | 25% | Lifetime fees, claim activity |
| Holder Health | 20% | Holder count, top-10 concentration |
| Creator Credibility | 20% | Verified identity, track record |
| Volume / Liquidity | 20% | Pool state, trading activity |
| Risk Signals | 15% | Red flag deductions |

---

## Caching Summary

| Cache | Location | TTL | Stores |
|-------|----------|-----|--------|
| Analysis reports | `routes/analysis.js` Map | 10 min | Full Claude JSON per mint |
| Pool list | `routes/tokens.js` module var | 5 min | 50 newest pool objects |
| Leaderboard | `routes/leaderboard.js` module var | 15 min | Full enriched top-20 array + stats |

All caches are in-memory and reset on server restart.

---

## Next Steps (Priority Order)

### High Priority
1. ~~Fix price/market cap~~ — **Removed** (no viable data source; tiles removed from UI)

2. **Deploy** — Backend to Railway, frontend to Vercel, push public GitHub repo, submit to bags.fm/hackathon.

3. **Mobile layout QA** — Test all pages at 375px. Known risk areas: leaderboard 6-column grid will overflow (switch to stacked card layout), metric tile grid (already 2-col on mobile but untested), chat input sticky bar.

### Medium Priority
4. **MCP server production path** — Replace hardcoded `http://localhost:3001` with `MINTLENS_API_URL` env var in `mcp/index.js`.

5. **Persist watchlist + alerts** — Add SQLite or JSON-file store so data survives server restarts.

### Low Priority
6. **Share card PNG quality** — `node-canvas` share card is functional but minimal. Add token logo, score bar rendering.

7. **Creator search coverage** — Creators who launched tokens in the middle of the 168k pool list may not be found. Could expand sample or add a manual mint-hint input on the profile page.

---

## Session 2 — Frontend Redesign (2026-03-09)

### Completed ✅

**Design System Overhaul**
- Switched accent color from purple (`#6C63FF`) to lime green (`#84CC16`) throughout all components
- Updated `tailwind.config.js` `primary` color, `index.css` gradients/scrollbar/btn-primary
- Updated `main.jsx` Privy `accentColor`, `ScoreBadge.jsx` ring color, `TokenCard.jsx` border/avatar colors, `ShareCard.jsx` canvas bar color

**Token Report Page (`TokenReport.jsx`)**
- Two-column bottom layout: Claude Analysis (left, flexible) + Fee Shareholders (right, 360px fixed)
- "View on Bags.fm" link added with correct URL format: `https://bags.fm/<tokenMint>`
- Header: M badge (lime), MINTLENS wordmark, truncated mint address
- Share Card converted from inline collapsible to modal (`ShareCardModal` component) with X button, click-outside-to-close, and Escape key support
- `WatchlistButton` and Export Skill button in header

**Score Display (`AnalysisReport.jsx`)**
- Replaced circular SVG score ring with horizontal progress bars (5 bars, one per scoring category)
- Large score number + "MINTLENS SCORE" label on left; verdict italic above bars on right
- `scoreColor()` helper: ≥70 lime, ≥40 yellow, <40 red
- Green/red flags stacked vertically; accordions start collapsed

**Metrics Dashboard (`MetricsDashboard.jsx`)**
- Removed: Price, Market Cap, 24H Volume (no viable data source for Bags bonding-curve tokens)
- Removed: Daily Fees, Creator Fees, Holder Fees (estimated data, not real API values)
- Added CoinGecko SOL→USD conversion for Lifetime Fees tile (`https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd`)
- Final 7 tiles in two explicit rows: Row 1 (4-col): Lifetime Fees (USD), Days Active, Holders, Top-10 Conc. | Row 2 (3-col): Creator, Royalty, Total Supply
- Creator tile: shows `@providerUsername` or "Unknown Creator" + truncated wallet sub-label (no raw wallet as main label)
- Days Active: falls back to oldest fetched transaction timestamp when `metadata.createdAt` is null

**Fee Shareholders (`FeeShareholdersList.jsx`)**
- Creator handle restricted to `providerUsername` only (removed `bagsUsername`/`username` fallbacks which may contain wallet-derived IDs)
- No handle → shows "Unknown" as display name; truncated wallet always shown in sub-line

**Chat UI (`FollowUpChat.jsx`)**
- User bubbles: lime background (`#84CC16`), dark text (`#0A0A0F`)
- Claude bubbles: dark surface (`#1E1E2E`)
- `applyBold()` parses `**text**` → `<strong>` inline
- SVG send icon button (lime background)

**Home Page (`Home.jsx`)**
- M badge in nav (lime + dark text)
- Hero gradient: lime → teal
- Filter tab active state: lime bg + dark text
- Alert banner: lime border/bg tint

**Leaderboard (`Leaderboard.jsx`)**
- 3 large stat cards: Total Fees Earned, Total Holders, Tokens Tracked
- Score column added to table
- Rank medals: 🥇🥈🥉 for ranks 1–3
- Period toggle active: lime bg + dark text

**Bug Fixes**
- Fixed `bags.getTradeQuote is not a function` error in Claude Analysis: removed stale call from `routes/analysis.js` after function was deleted from `bagsService.js`
- Fixed leaderboard: now samples tokens by lifetime fees, not newest pools; limit applied at response time not before caching (cache-slicing bug)
- `heliusService.js`: added `createdAt: result?.created_at ?? null` to `getTokenMetadata` return

**DexScreener investigation (attempted and abandoned)**
- Integrated DexScreener price API (`/latest/dex/tokens/<mint>`) as price fallback
- Tested `dexId` filters: `"bags"` (no match), `"meteora"` (no match) — DexScreener does not index Bags.fm bonding-curve tokens under any dexId (`pairs: null` for all tested mints)
- Integration removed; no viable price source confirmed

**Price/Market Cap status: permanently unavailable**
- Bags trade quote endpoint (`/trade/quote`) returns HTTP 500 for all tested tokens (no active liquidity pool)
- DexScreener: `pairs: null` for all Bags tokens
- Helius `getAsset`: no `price_info` for unlisted tokens
- Meteora DAMM V2 pool accounts: raw binary PDAs, no standard token account structure
- Accepted `—` as correct display; tiles removed from UI

### Known Issues Remaining ⚠️

| Issue | Priority | Notes |
|-------|----------|-------|
| Days Active shows `—` for some tokens | Low | Helius `created_at` often null; transaction fallback also null if no txs fetched |
| Price / Market Cap / Volume unavailable | Blocked | Bags trade quote returns 500; no alternative source found |
| Deployment not done | Medium | App still on localhost; no Railway/Vercel setup yet |

### Next Steps for Session 3

1. **Deploy backend** → Railway (or Render)
2. **Deploy frontend** → Vercel (`npm run build` then import repo)
3. **Push to public GitHub repo** (required for hackathon submission)
4. **Submit at bags.fm/hackathon**
5. **Price tiles** — re-add when Bags fixes their trade quote endpoint. Wire up in `bagsService.getTradeQuote` → `tokens.js` enrichment → `MetricsDashboard` Price/MarketCap tiles (code pattern already established from Session 1)

---

## Session 3 — Polish, Creator Profile, Data Fixes (2026-03-10)

### Completed ✅

**Token Card cleanup**
- Removed Volume column (Bags API doesn't provide volume data; always showed `—`)
- Stats grid changed from `grid-cols-3` to `grid-cols-2`: Fees + Holders only
- Score badge hidden when `score == null` — no red `—` placeholder on unanalysed tokens

**Lucide React icons** (replaced all emoji throughout UI)
- `lucide-react@0.577.0` installed with `--legacy-peer-deps`
- Replaced: 🔥 → `TrendingUp`, ⚠️ → `AlertTriangle`, 🔔 → `Bell` (Home)
- Replaced: 🥇🥈🥉 → `Trophy` (gold) + silver/bronze colored rank numbers (Leaderboard)
- Replaced: ★/☆ → `Eye`/`EyeOff` (WatchlistButton)
- Replaced: 🕐 → `Clock` (cache tooltip, TokenReport)
- Replaced: ✓/⚠ → `CheckCircle`/`AlertCircle` (flag headers, AnalysisReport)
- Replaced: 📋👤👥💰⚠️ → `FileText`/`User`/`Users`/`DollarSign`/`ShieldAlert` (section accordions)

**Search bar added to Token Report header**
- Inline form between logo and action buttons; `max-w-md`, same styling as Home search
- Mint-address only (base58 validation); navigates to `/token/<mint>` on Enter or Go click
- Clears input after navigation

**Subscribe button state (Alert Modal)**
- After successful subscribe (push or email), button changes to "Subscribed ✓" and is disabled
- `subscribed` state added; error paths leave button enabled for retry

**Share on X button (Token Report)**
- Added alongside Share button in header
- Opens `x.com/intent/tweet` with pre-filled text: token name, score, fees, 🟢/🟡/🔴 verdict (≤80 chars), `mintlens.xyz/token/<mint>`, `#Bags #Solana`
- Verdict truncated to 80 chars; no @mintlens tag; fits within 280 chars

**Creator Profile page — full rewrite (`CreatorProfile.jsx`)**
- Header card: Twitter avatar (`pfp`), `@handle`, truncated wallet, "View on Bags.fm" link, Total Fees in USD (CoinGecko SOL price)
- Token list: divide-y rows with logo, name, symbol, truncated mint, Creator/Fee Share badge, fees in USD, score
- Avg score shown inline next to section heading with score-color
- CoinGecko price fetched once on mount (same pattern as MetricsDashboard)
- Loading skeleton matching new layout

**Creator Profile backend — parallel search + wallet-based shortcut**
- `bagsService.js`: added module-level raw pool cache (`_rawPoolsCache`, 30-min TTL) — all routes share one 168k download instead of each downloading independently
- `getAllBagsPools()` now reads from the shared cache
- New `getSampledPoolMints({ newest, oldest, spread })` — draws a deduplicated sample from cached full pool list
- `creators.js`: accepts `?hint=<mint>` query param
  - **Fast path**: resolves creator's wallet from the hint mint (1 API call), then searches 200 sampled tokens by wallet match (exact, reliable)
  - **Slow path** (no hint): searches 200 tokens by providerUsername/username
  - Per-handle result cache (30-min TTL) — repeat visits are instant (0 API calls)
- Reduced sample: 50 newest + 50 oldest + 100 spread = 200 total (down from 500, avoids rate limit exhaustion)
- Token enrichment: metadata + fees only — removed `helius.getHolderCountQuick` (was causing 30s timeout)
- Removed Claude creator summary generation (another slow network call)
- `FeeShareholdersList` and `MetricsDashboard` now pass `mint` prop; creator links include `?hint=<mint>`
- `CreatorProfile.jsx` reads `?hint` from URL via `useSearchParams`, passes to `creatorsApi.getProfile(handle, hint)`
- `api.js`: `creatorsApi.getProfile(handle, hint)` forwards hint as query param

**Bags API creator endpoint investigation**
- Tested `GET /token-launch/creator/v3?username=chaos_vuiton` — Zod validation error: `"Unrecognized key: username"` — endpoint only accepts `tokenMint`
- Tested `GET /creator/chaos_vuiton` — 404 (route does not exist)
- **Conclusion**: No creator-by-username endpoint exists in the Bags API; pool sampling is the only approach

**Claude analysis holder count bug fixed**
- **Root cause**: `GET /api/tokens/:mint` and `POST /api/analysis/:mint` fired simultaneously on page load, both calling `helius.getTokenHolders`. Concurrent paginated calls caused one to time out → analysis got `holders = {}` → Claude saw "Total holders: N/A" → flagged token as ghost
- **Fix**: `analysis.js` now accepts `tokenData` in request body (passed from frontend). If `totalHolders > 0` in provided data, uses it directly — no second Helius call
- `useAnalysis.js`: `analyze(tokenData)` accepts and forwards tokenData
- `TokenReport.jsx`: calls `analyze(tokenData)` once tokenData loads
- `api.js`: `analysisApi.analyze(mint, tokenData)` posts tokenData in body
- `analysis.js`: `useProvided` check — falls back to fresh fetch if tokenData is absent/invalid (MCP calls, direct API calls still work)
- **Prompt hardening**: Changed "N/A" → `"unknown (fetch failed — do not assume zero)"` in Claude prompt to prevent misinterpretation of missing holder data

**Token route data consistency**
- The `GET /api/tokens/:mint` route was already correct (fetches all Bags + Helius data for any mint). Apparent `—` fields on direct search were caused by Bags API rate limit exhaustion from the creator search testing (500 concurrent calls). Rate limit guard: reduced creator sample to 200 and cached results 30 min.

**`getCachedScore` export added to `analysis.js`**
- Exported `getCachedScore(mint)` function for use by other routes (creators.js, leaderboard.js)
- Enables showing cached Mintlens scores on Creator Profile without re-running analysis

### Known Issues Remaining ⚠️

| Issue | Priority | Notes |
|-------|----------|-------|
| Mobile layout not QA'd | Medium | All dev at 1440px. Leaderboard table (6-col grid) will overflow at 375px. Feed grid and metric tiles use responsive classes but untested. |
| Days Active shows `—` for some tokens | Low | Helius `created_at` often null; transaction fallback null if no txs fetched |
| Price / Market Cap / Volume unavailable | Blocked | Bags trade quote returns 500; no alternative source |
| Creator search misses tokens outside 200-sample | Low | Creators who launched early tokens in middle of 168k pool list may not be found |
| Watchlist + alerts in-memory only | Low | Reset on server restart; no persistence |
| Deployment not done | High | App still on localhost |

### Next Steps for Session 4

1. **Deploy backend** → Railway (`npm start`, set env vars in dashboard)
2. **Deploy frontend** → Vercel (`npm run build`, import repo, set `VITE_API_URL`)
3. **Push to public GitHub** (required for hackathon submission)
4. **Submit at bags.fm/hackathon**
5. **Mobile QA** — test Leaderboard, TokenReport, Home at 375px; fix overflow on leaderboard table (switch to card layout on mobile), check chat input sticky bar
6. **MCP production URL** — replace hardcoded `localhost:3001` with `MINTLENS_API_URL` env var in `mcp/index.js`
