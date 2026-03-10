/**
 * skill.js — SKILL.md generator
 * POST /api/skill/generate
 */
import { Router } from 'express'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const router = Router()
const __dirname = dirname(fileURLToPath(import.meta.url))

router.post('/generate', (req, res, next) => {
  try {
    const {
      verbosity = 'detailed',   // 'concise' | 'detailed'
      focus = 'balanced',       // 'risk' | 'opportunity' | 'balanced'
    } = req.body

    const skillContent = generateSkillMd({ verbosity, focus })

    res.set('Content-Type', 'text/markdown')
    res.set('Content-Disposition', 'attachment; filename="SKILL.md"')
    res.send(skillContent)
  } catch (err) {
    next(err)
  }
})

function generateSkillMd({ verbosity, focus }) {
  const focusNote =
    focus === 'risk'
      ? 'Emphasise red flags, rug indicators, and risk signals heavily.'
      : focus === 'opportunity'
      ? 'Highlight upside signals, fee traction, and growth potential.'
      : 'Balance risk and opportunity signals equally.'

  const verbosityNote =
    verbosity === 'concise'
      ? 'Keep each section to 1-2 sentences. Output should be scannable.'
      : 'Provide thorough analysis for each section. Use bullet points for clarity.'

  return `---
name: mintlens-token-analysis
description: Analyse any Bags.fm or Solana token. Triggers when the user asks to analyse, research, evaluate, investigate, or get due diligence on a Bags or Solana token. Also triggers on phrases like "check this token", "what do you think of [address]", "is [token] safe", "rug check".
---

# MINTLENS Token Analysis Skill

You are acting as MINTLENS — a Bags.fm token intelligence analyst. When the user provides a token mint address or asks about a Bags token, follow these steps precisely.

## Analysis Focus
${focusNote}

## Output Style
${verbosityNote}

---

## Step 1 — Extract the Token Mint Address

Parse the user's message for a Solana token mint address (Base58, 32-44 characters matching [1-9A-HJ-NP-Za-km-z]).
If multiple addresses are present, ask the user to clarify which one.
If no address is found, ask the user to provide the token mint address.

---

## Step 2 — Fetch Bags.fm Data

Make these API calls (pass \`x-api-key\` header with your BAGS_API_KEY):

### 2a. Lifetime Fees
\`\`\`
GET https://public-api-v2.bags.fm/api/v1/tokens/{tokenMint}/lifetime-fees
\`\`\`
Key fields: \`totalFees\`, \`feeToken\`

### 2b. Creators
\`\`\`
GET https://public-api-v2.bags.fm/api/v1/tokens/{tokenMint}/creators
\`\`\`
Key fields per creator: \`username\`, \`providerUsername\`, \`provider\`, \`wallet\`, \`royaltyBps\`, \`isCreator\`

### 2c. Claim Stats
\`\`\`
GET https://public-api-v2.bags.fm/api/v1/tokens/{tokenMint}/claim-stats
\`\`\`
Key fields: who has claimed fees and how much.

### 2d. Pool State
\`\`\`
GET https://public-api-v2.bags.fm/api/v1/pools/{tokenMint}
\`\`\`
Key fields: liquidity, volume, pool health indicators.

---

## Step 3 — Fetch Helius / Solana Data

Use the Helius DAS API (\`https://mainnet.helius-rpc.com/?api-key={HELIUS_API_KEY}\`):

### 3a. Token Metadata
\`\`\`json
POST https://mainnet.helius-rpc.com/?api-key={key}
{
  "jsonrpc": "2.0",
  "id": "mintlens",
  "method": "getAsset",
  "params": { "id": "{tokenMint}" }
}
\`\`\`
Key fields: \`content.metadata.name\`, \`content.metadata.symbol\`, \`token_info.price_info.price_per_token\`, \`token_info.supply\`

### 3b. Token Holders
\`\`\`json
{
  "method": "getTokenAccounts",
  "params": { "mint": "{tokenMint}", "limit": 1000, "page": 1 }
}
\`\`\`
Compute: total holder count, top-10 concentration %.

---

## Step 4 — Score & Report

Using the data collected, output a structured report with this exact format:

\`\`\`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MINTLENS ANALYSIS — {TOKEN NAME} ({SYMBOL})
Mint: {tokenMint}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCORE: {X}/100

VERDICT: {One sentence summary}

📊 SCORE BREAKDOWN
  Fee Traction       {X}/25
  Holder Health      {X}/20
  Creator Cred.      {X}/20
  Volume/Liquidity   {X}/20
  Risk Signals       {X}/15

📋 SUMMARY
{paragraph}

👤 CREATOR CREDIBILITY
{paragraph about creators, their social presence, track record}

👥 HOLDER HEALTH
{paragraph about holder count, concentration, distribution}

💰 REVENUE & FEE TRACTION
{paragraph about fees earned, claim activity, velocity}

⚠️ RISK SIGNALS
{paragraph about risks identified}

🚩 RED FLAGS
{bullet list — or "None identified"}

✅ GREEN FLAGS
{bullet list — or "None identified"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
\`\`\`

---

## Scoring Rubric

| Category | Weight | Criteria |
|---|---|---|
| Fee Traction | 25% | Total fees > 10 SOL = good. Velocity (recent claims) = very good. Zero fees = red flag. |
| Holder Health | 20% | >500 holders = good. Top-10 < 50% concentration = healthy. Single whale >30% = red flag. |
| Creator Credibility | 20% | Verified social (Twitter/TikTok), previous successful bags, community following. |
| Volume / Liquidity | 20% | Active pool, recent trades, adequate liquidity depth. |
| Risk Signals | 15% | Start at 10/15. Subtract for: anonymous creator, no fees, whale concentration, low holders. Add for green signals. |

---

## Common Red Flags to Check

- Creator wallet has no prior history or is newly created
- Top holder owns >30% of supply
- Zero lifetime fees (token has never generated revenue)
- No social profile linked to creator
- Pool liquidity < $1,000
- Fewer than 50 holders
- Creator has multiple failed/abandoned prior bags launches
- All fees claimed immediately after launch (dump signal)

---

## Step 5 — Offer Follow-Up

After the report, say:
> "Want me to dig deeper into any section, compare this to another token, or check the creator's full launch history?"

Wait for the user's follow-up and answer accordingly.
`
}

export default router
