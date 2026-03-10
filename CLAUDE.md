# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MINTLENS — AI-powered Bags.fm token intelligence platform. Bags Hackathon 2026 submission, Claude Skills track.

Users paste a token address or browse a live feed of Bags.fm launches and get a Claude-powered due diligence report. Three Claude integration surfaces: web app, MCP server, and downloadable SKILL.md.

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS (localhost:5173)
- **Backend:** Node.js + Express (localhost:3001)
- **AI:** Anthropic API — model `claude-sonnet-4-20250514`
- **Bags data:** Bags REST API — `https://public-api.bags.fm/api/v1/` with `x-api-key` header
- **Solana data:** Helius DAS API + Enhanced Transactions
- **Wallet:** Privy
- **MCP:** `@modelcontextprotocol/sdk` (StdioServerTransport)
- **Share cards:** node-canvas (backend), HTML Canvas (frontend)
- **Alerts:** web-push + nodemailer

## Monorepo Structure

```
mintlens/
├── frontend/          # Vite React app
├── backend/           # Express API server
├── mcp/               # Standalone MCP server
└── skill/             # SKILL.md for Claude Code
```

## Commands

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && npm install && npm run dev

# MCP server (standalone)
node mcp/index.js
```

## Architecture

**Data flow for token analysis:**
1. Frontend calls `POST /api/analysis/:mint`
2. Backend aggregates data from `bagsService` (fees, creators, claims, pool) and `heliusService` (metadata, holders, transactions)
3. Combined data passed to `claudeService.generateTokenReport()`
4. Claude returns structured JSON (score 0-100, verdict, sections, flags, scoreBreakdown)
5. Results cached in-memory for 10 minutes per token

**Key backend services:**
- `bagsService.js` — all Bags API calls (fees, creators, claims, pool data)
- `heliusService.js` — Helius DAS (getAsset for metadata/price, getTokenAccounts for holders, Enhanced Transactions)
- `claudeService.js` — report generation, creator summary, follow-up chat
- `alertService.js` — in-memory subscriptions, web-push + email notifications
- `shareCardService.js` — node-canvas PNG generation (1200×675)

**Claude report JSON shape:**
```json
{
  "score": 0-100,
  "verdict": "string",
  "sections": { "summary", "creatorCredibility", "holderHealth", "revenueTraction", "riskSignals" },
  "redFlags": [],
  "greenFlags": [],
  "scoreBreakdown": { "feeTraction": 0-25, "holderHealth": 0-20, "creatorCredibility": 0-20, "volumeLiquidity": 0-20, "riskSignals": 0-15 }
}
```

**Scoring rubric:** fee traction 25%, holder health 20%, creator credibility 20%, volume/liquidity 20%, risk signals 15%

**MCP tools:** `analyze_token`, `get_token_feed`, `get_creator_profile`, `get_token_holders`, `compare_tokens`

## Design System

- Background: `#0A0A0F`, Surface: `#12121A`, Border: `#1E1E2E`
- Primary: `#6C63FF` (purple), Score green: `#00D4AA`, yellow: `#FFB800`, red: `#FF4757`
- Text: `#F0F0FF` primary, `#6B6B8A` muted
- Fonts: `DM Mono` (numbers/scores/addresses), `Inter` (body) — Google Fonts

## Key Rules

- Never hardcode API keys — always `process.env`
- Cache Claude analysis 10 min per token (simple Map with TTL)
- If Bags API fails, still show Helius data (and vice versa) — graceful degradation
- If Helius price unavailable, fall back to Bags trade quote endpoint
- Feed works with no API keys — show placeholder data + "Configure API keys" banner
- Validate token addresses as Base58 (Solana)
- Bags analytics endpoints (getTokenCreators, getTokenLifetimeFees, getTokenClaimStats) pass API key header even though they are public
