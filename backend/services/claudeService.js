/**
 * claudeService.js — Anthropic Claude integration
 * Model: claude-sonnet-4-20250514
 */
import Anthropic from '@anthropic-ai/sdk'
import 'dotenv/config'

let _client = null
function client() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

const SYSTEM_PROMPT = `You are MINTLENS, an expert Solana token analyst specialising in Bags.fm launches.
You analyse tokens with the precision of a seasoned crypto researcher: objective, data-driven, and concise.
When you detect red flags you call them out clearly. When fundamentals are strong you highlight them.
Always respond with valid JSON only — no markdown fences, no prose outside the JSON.`

/**
 * Generate a full due-diligence report for a token.
 * @param {object} tokenData — aggregated data from bagsService + heliusService
 * Returns the parsed Claude JSON report object.
 */
export async function generateTokenReport(tokenData) {
  const prompt = buildReportPrompt(tokenData)

  const msg = await client().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = msg.content[0]?.text || '{}'
  try {
    return JSON.parse(text)
  } catch {
    // Attempt to extract JSON from response if it contains surrounding text
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    throw new Error('Claude returned invalid JSON for token report')
  }
}

/**
 * Generate a 2-3 sentence creator summary.
 * @param {object} creatorData — { handle, tokens, totalFees, avgScore, ... }
 */
export async function generateCreatorSummary(creatorData) {
  const msg = await client().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Summarise this Bags.fm creator in 2-3 sentences. Be objective and data-driven.
Return a JSON object: { "summary": "...", "sentiment": "positive|neutral|negative" }

Creator data:
${JSON.stringify(creatorData, null, 2)}`,
      },
    ],
  })

  const text = msg.content[0]?.text || '{}'
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    return { summary: 'Unable to generate creator summary.', sentiment: 'neutral' }
  }
}

/**
 * Continue a conversation about a specific token.
 * @param {Array} messages — chat history [{ role: 'user'|'assistant', content: string }]
 * @param {object} tokenContext — brief token context to keep Claude grounded
 */
export async function continueChat(messages, tokenContext) {
  const contextNote = tokenContext
    ? `Token context: ${JSON.stringify(tokenContext)}\n\n`
    : ''

  const systemWithContext = `${SYSTEM_PROMPT}

${contextNote}Answer follow-up questions naturally and helpfully. You may use plain prose (no JSON required for chat).`

  const msg = await client().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    system: systemWithContext,
    messages,
  })

  return msg.content[0]?.text || 'Unable to generate response.'
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildReportPrompt(tokenData) {
  const {
    metadata = {},
    holders = {},
    transactions = [],
    lifetimeFees = null,
    creators = [],
    claimStats = [],
    pool = null,
    quote = null,
  } = tokenData

  return `Analyse this Bags.fm token and return a JSON report.

TOKEN DATA:
Name: ${metadata.name || 'Unknown'} (${metadata.symbol || '?'})
Price: ${metadata.price ?? quote?.price ?? 'N/A'}
Market Cap: ${metadata.marketCap ?? 'N/A'}
Supply: ${metadata.supply ?? 'N/A'}
Decimals: ${metadata.decimals ?? 9}

HOLDERS:
Total holders: ${holders.totalHolders != null ? holders.totalHolders : 'unknown (fetch failed — do not assume zero)'}
Top-10 concentration: ${holders.top10Concentration != null ? `${holders.top10Concentration}%` : 'unknown'}
Top holders (first 5):
${(holders.holderList || []).slice(0, 5).map(h => `  #${h.rank} ${h.address?.slice(0, 8)}… ${h.percentage}%`).join('\n') || '  (data unavailable)'}

FEES & REVENUE:
Lifetime fees: ${JSON.stringify(lifetimeFees)}
Claim stats (first 5): ${JSON.stringify(claimStats.slice(0, 5))}
Pool state: ${JSON.stringify(pool)}

CREATORS (${creators.length} total):
${creators.slice(0, 3).map(c => `  @${c.username || c.providerUsername || 'unknown'} via ${c.provider || 'unknown'} — royalty ${c.royaltyBps ?? '?'} bps`).join('\n') || '  (none)'}

RECENT TRANSACTIONS: ${transactions.length} fetched

Return ONLY this JSON (no markdown fences):
{
  "score": <integer 0-100>,
  "verdict": "<one sentence summary>",
  "sections": {
    "summary": "<paragraph>",
    "creatorCredibility": "<paragraph>",
    "holderHealth": "<paragraph>",
    "revenueTraction": "<paragraph>",
    "riskSignals": "<paragraph>"
  },
  "redFlags": ["<specific red flag>", ...],
  "greenFlags": ["<specific green flag>", ...],
  "scoreBreakdown": {
    "feeTraction": <0-25>,
    "holderHealth": <0-20>,
    "creatorCredibility": <0-20>,
    "volumeLiquidity": <0-20>,
    "riskSignals": <0-15>
  }
}

Scoring rubric:
- feeTraction (0-25): Is the token generating real fees? Velocity, total, claim activity.
- holderHealth (0-20): Holder count, concentration risk, distribution quality.
- creatorCredibility (0-20): Known creator, track record, social proof.
- volumeLiquidity (0-20): Trading volume, pool depth, price stability.
- riskSignals (0-15): Red flags subtract; green fundamentals add. Start at 10.`
}

export default {
  generateTokenReport,
  generateCreatorSummary,
  continueChat,
}
