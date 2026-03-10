# MINTLENS

**AI-powered Bags.fm token intelligence platform** — Bags Hackathon 2026 submission, Claude Skills track.

Paste any Bags.fm token address and get a deep Claude AI due-diligence report in seconds: creator credibility, holder health, fee traction, risk signals, and a 0-100 score.

---

## What's Inside

| Surface | Description |
|---|---|
| **Web App** | React + Express full-stack app with live feed, token reports, chat, share cards |
| **MCP Server** | Standalone MCP server — use MINTLENS tools directly inside Claude |
| **SKILL.md** | Downloadable Claude Code skill for ad-hoc token analysis anywhere |

---

## Setup

### Prerequisites
- Node.js 20+
- API keys: Bags.fm, Helius, Anthropic, (optional) Privy

### 1. Configure environment
```bash
cp .env.example backend/.env
# Edit backend/.env with your real keys
```

### 2. Start the backend
```bash
cd backend
npm install
npm run dev
# → http://localhost:3001
```

### 3. Start the frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `BAGS_API_KEY` | Yes | Bags.fm API key |
| `HELIUS_API_KEY` | Yes | Helius RPC + DAS access |
| `ANTHROPIC_API_KEY` | Yes | Claude AI (analysis + chat) |
| `PRIVY_APP_ID` | Optional | Wallet authentication |
| `VAPID_PUBLIC_KEY` | Optional | Web push notifications (`npx web-push generate-vapid-keys`) |
| `VAPID_PRIVATE_KEY` | Optional | Web push notifications |
| `EMAIL_FROM` | Optional | Alert email sender address |
| `SMTP_HOST/PORT/USER/PASS` | Optional | Email delivery for alerts |

---

## MCP Server

Use MINTLENS tools directly in Claude Code or Claude.ai:

```bash
cd mcp
npm install
# Add to Claude Code:
claude mcp add mintlens -- node /absolute/path/to/mintlens/mcp/index.js
```

**Available tools:** `analyze_token`, `get_token_feed`, `get_creator_profile`, `get_token_holders`, `compare_tokens`

See [mcp/README.md](mcp/README.md) for full setup instructions.

---

## SKILL.md — Claude Code Skill

Download a `SKILL.md` from any Token Report page (click "Export Skill"), or use the static version at `skill/SKILL.md`.

Install in Claude Code:
```bash
# Add to your project's .claude/skills/ directory
cp skill/SKILL.md /your/project/.claude/skills/mintlens-token-analysis.md
```

Once installed, just ask Claude: *"Analyse this Bags token: [mint address]"*

---

## API Reference

| Endpoint | Description |
|---|---|
| `GET /api/ping` | Health check |
| `GET /api/health` | Service connectivity status |
| `GET /api/tokens/feed` | Live Bags.fm pool feed |
| `GET /api/tokens/:mint` | Full token data (Bags + Helius) |
| `POST /api/analysis/:mint` | Generate Claude report (cached 10 min) |
| `POST /api/analysis/:mint/chat` | Follow-up chat about a token |
| `GET /api/tokens/:mint/share-card.png` | Generated share card PNG |
| `GET /api/creators/:handle` | Creator profile |
| `POST /api/skill/generate` | Download customised SKILL.md |
| `POST /api/alerts/subscribe` | Subscribe to launch alerts |

---

## Bags Hackathon 2026 Submission

- **Track:** Claude Skills
- **Claude integrations:** Web app analysis, MCP server (5 tools), SKILL.md download
- **Model:** `claude-sonnet-4-20250514`
- **Scoring rubric:** Fee traction 25%, Holder health 20%, Creator credibility 20%, Volume/Liquidity 20%, Risk signals 15%
