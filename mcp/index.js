#!/usr/bin/env node
/**
 * MINTLENS MCP Server
 * Exposes Bags.fm token intelligence tools for Claude.ai / Claude Code users.
 *
 * Usage:
 *   node mcp/index.js
 *
 * Add to Claude Code: claude mcp add mintlens -- node /path/to/mcp/index.js
 */
import 'dotenv/config'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import Anthropic from '@anthropic-ai/sdk'
import axios from 'axios'

// ── API helpers ───────────────────────────────────────────────────────────────

const BAGS_BASE = 'https://public-api-v2.bags.fm/api/v1'
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`

function bagsHeaders() {
  return { 'x-api-key': process.env.BAGS_API_KEY || '' }
}

async function bagsGet(path, params = {}) {
  const res = await axios.get(`${BAGS_BASE}${path}`, {
    headers: bagsHeaders(),
    params,
    timeout: 12000,
  })
  return res.data
}

async function heliusRpc(method, params) {
  const res = await axios.post(
    HELIUS_RPC,
    { jsonrpc: '2.0', id: 'mintlens-mcp', method, params },
    { timeout: 15000 }
  )
  if (res.data.error) throw new Error(res.data.error.message)
  return res.data.result
}

// ── Claude client ─────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function claudeAnalyse(tokenData) {
  const prompt = buildReportPrompt(tokenData)
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system:
      'You are MINTLENS, an expert Bags.fm token analyst. Return only valid JSON — no markdown fences.',
    messages: [{ role: 'user', content: prompt }],
  })
  const text = msg.content[0]?.text || '{}'
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    return { score: null, verdict: 'Analysis failed — invalid JSON from model', sections: {}, redFlags: [], greenFlags: [], scoreBreakdown: {} }
  }
}

// ── Data aggregation helpers ──────────────────────────────────────────────────

async function fetchAllTokenData(tokenMint) {
  const settled = await Promise.allSettled([
    heliusRpc('getAsset', { id: tokenMint }),
    heliusRpc('getTokenAccounts', { mint: tokenMint, limit: 1000, page: 1 }),
    bagsGet(`/tokens/${tokenMint}/lifetime-fees`),
    bagsGet(`/tokens/${tokenMint}/creators`),
    bagsGet(`/tokens/${tokenMint}/claim-stats`),
    bagsGet(`/pools/${tokenMint}`),
  ])

  const [assetRes, holdersRes, feesRes, creatorsRes, claimStatsRes, poolRes] = settled.map(
    (r) => (r.status === 'fulfilled' ? r.value : null)
  )

  // Parse asset
  const content = assetRes?.content || {}
  const meta = content?.metadata || {}
  const token_info = assetRes?.token_info || {}
  const price_info = token_info?.price_info || {}
  const metadata = {
    name: meta.name || '',
    symbol: meta.symbol || token_info.symbol || '',
    decimals: token_info.decimals ?? 9,
    supply: token_info.supply ?? 0,
    price: price_info.price_per_token ?? null,
    marketCap: price_info.total_price ?? null,
    logoURI: content?.links?.image || null,
  }

  // Parse holders
  const accounts = holdersRes?.token_accounts || []
  accounts.sort((a, b) => (b.amount || 0) - (a.amount || 0))
  const totalSupply = accounts.reduce((s, a) => s + Number(a.amount || 0), 0)
  const top10Sum = accounts.slice(0, 10).reduce((s, a) => s + Number(a.amount || 0), 0)
  const holders = {
    totalHolders: accounts.length,
    top10Concentration: totalSupply > 0 ? Math.round((top10Sum / totalSupply) * 10000) / 100 : 0,
    holderList: accounts.slice(0, 50).map((a, i) => ({
      rank: i + 1,
      address: a.address || a.owner,
      amount: Number(a.amount),
      percentage: totalSupply > 0 ? ((Number(a.amount) / totalSupply) * 100).toFixed(2) : '0.00',
    })),
  }

  // Normalise arrays
  const creators = Array.isArray(creatorsRes)
    ? creatorsRes
    : creatorsRes?.creators || creatorsRes?.data || []
  const claimStats = Array.isArray(claimStatsRes)
    ? claimStatsRes
    : claimStatsRes?.claimStats || claimStatsRes?.data || []

  return {
    mint: tokenMint,
    metadata,
    holders,
    lifetimeFees: feesRes,
    creators,
    claimStats,
    pool: poolRes,
    transactions: [],
    quote: null,
  }
}

// ── Tool implementations ──────────────────────────────────────────────────────

async function toolAnalyzeToken({ tokenMint }) {
  if (!isValidBase58(tokenMint)) throw new Error('Invalid token mint address')
  const tokenData = await fetchAllTokenData(tokenMint)
  const report = await claudeAnalyse(tokenData)
  return { tokenMint, report, metadata: tokenData.metadata, holders: tokenData.holders, lifetimeFees: tokenData.lifetimeFees, creators: tokenData.creators }
}

async function toolGetTokenFeed({ limit = 20, minScore }) {
  const pools = await bagsGet('/pools', { limit }).catch(() => [])
  const list = Array.isArray(pools) ? pools : pools.pools || pools.data || []
  return {
    tokens: list.slice(0, limit).map((p) => ({
      mint: p.tokenMint || p.mint || p.id,
      name: p.name,
      symbol: p.symbol,
      createdAt: p.createdAt || p.launchDate,
    })),
    count: list.length,
  }
}

async function toolGetCreatorProfile({ handle }) {
  const pools = await bagsGet('/pools', { limit: 100 }).catch(() => [])
  const list = Array.isArray(pools) ? pools : pools.pools || pools.data || []

  const matches = []
  for (const pool of list) {
    const mint = pool.tokenMint || pool.mint || pool.id
    if (!mint) continue
    const creators = await bagsGet(`/tokens/${mint}/creators`).catch(() => [])
    const arr = Array.isArray(creators) ? creators : creators.creators || []
    const match = arr.find(
      (c) =>
        c.username?.toLowerCase() === handle.toLowerCase() ||
        c.providerUsername?.toLowerCase() === handle.toLowerCase()
    )
    if (match) matches.push({ mint, creator: match })
  }

  if (!matches.length) return { handle, error: 'Creator not found', tokens: [] }

  const tokens = await Promise.allSettled(
    matches.map(async ({ mint }) => {
      const fees = await bagsGet(`/tokens/${mint}/lifetime-fees`).catch(() => null)
      return { mint, lifetimeFees: fees }
    })
  ).then((r) => r.filter((x) => x.status === 'fulfilled').map((x) => x.value))

  const totalFees = tokens.reduce(
    (s, t) => s + Number(t.lifetimeFees?.totalFees || 0),
    0
  )
  return { handle, stats: { totalTokens: tokens.length, totalFees }, tokens }
}

async function toolGetTokenHolders({ tokenMint }) {
  if (!isValidBase58(tokenMint)) throw new Error('Invalid token mint address')
  const result = await heliusRpc('getTokenAccounts', { mint: tokenMint, limit: 1000, page: 1 })
  const accounts = result?.token_accounts || []
  accounts.sort((a, b) => Number(b.amount) - Number(a.amount))
  const totalSupply = accounts.reduce((s, a) => s + Number(a.amount || 0), 0)
  const top10Sum = accounts.slice(0, 10).reduce((s, a) => s + Number(a.amount || 0), 0)
  return {
    tokenMint,
    totalHolders: accounts.length,
    top10Concentration: totalSupply > 0 ? Math.round((top10Sum / totalSupply) * 10000) / 100 : 0,
    holderList: accounts.slice(0, 50).map((a, i) => ({
      rank: i + 1,
      address: a.address || a.owner,
      amount: Number(a.amount),
      pct: totalSupply > 0 ? ((Number(a.amount) / totalSupply) * 100).toFixed(2) : '0.00',
    })),
  }
}

async function toolCompareTokens({ tokenMintA, tokenMintB }) {
  if (!isValidBase58(tokenMintA) || !isValidBase58(tokenMintB)) {
    throw new Error('Invalid token mint address(es)')
  }
  const [dataA, dataB] = await Promise.all([
    fetchAllTokenData(tokenMintA),
    fetchAllTokenData(tokenMintB),
  ])
  const [reportA, reportB] = await Promise.all([
    claudeAnalyse(dataA),
    claudeAnalyse(dataB),
  ])

  // Ask Claude for a comparison verdict
  const compareMsg = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    messages: [
      {
        role: 'user',
        content: `Compare these two Bags.fm tokens and give a verdict:

Token A: ${dataA.metadata.name} (${dataA.metadata.symbol}) — Score: ${reportA.score}/100
${reportA.verdict}

Token B: ${dataB.metadata.name} (${dataB.metadata.symbol}) — Score: ${reportB.score}/100
${reportB.verdict}

Return JSON: { "winner": "A"|"B"|"tie", "verdict": "...", "reasoning": "..." }`,
      },
    ],
  })

  let comparison = { winner: 'tie', verdict: 'Unable to compare', reasoning: '' }
  try {
    const text = compareMsg.content[0]?.text || '{}'
    comparison = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || text)
  } catch {}

  return {
    tokenA: { mint: tokenMintA, ...reportA, metadata: dataA.metadata },
    tokenB: { mint: tokenMintB, ...reportB, metadata: dataB.metadata },
    comparison,
  }
}

// ── MCP Server setup ──────────────────────────────────────────────────────────

const server = new Server(
  { name: 'mintlens', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'analyze_token',
      description:
        'Fetch all data for a Bags.fm token (fees, creators, holders, pool) and generate a Claude AI due-diligence report with a score 0-100, verdict, section analysis, and red/green flags.',
      inputSchema: {
        type: 'object',
        properties: {
          tokenMint: {
            type: 'string',
            description: 'Solana token mint address (Base58, 32-44 chars)',
          },
        },
        required: ['tokenMint'],
      },
    },
    {
      name: 'get_token_feed',
      description:
        'Get recent Bags.fm token launches from the live feed. Returns a list of token mints, names, and launch dates.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of tokens to return (default 20, max 100)', default: 20 },
          minScore: { type: 'number', description: 'Optional minimum score filter (0-100)' },
        },
      },
    },
    {
      name: 'get_creator_profile',
      description:
        'Get a Bags.fm creator profile including all their tokens, total fees earned, and aggregate stats.',
      inputSchema: {
        type: 'object',
        properties: {
          handle: { type: 'string', description: 'Creator username handle (without @)' },
        },
        required: ['handle'],
      },
    },
    {
      name: 'get_token_holders',
      description:
        'Get holder data for a Solana token: total holder count, top-10 wallet concentration %, and ranked holder list.',
      inputSchema: {
        type: 'object',
        properties: {
          tokenMint: {
            type: 'string',
            description: 'Solana token mint address (Base58)',
          },
        },
        required: ['tokenMint'],
      },
    },
    {
      name: 'compare_tokens',
      description:
        'Compare two Bags.fm tokens side-by-side with separate Claude analysis reports and a winner verdict.',
      inputSchema: {
        type: 'object',
        properties: {
          tokenMintA: { type: 'string', description: 'First token mint address' },
          tokenMintB: { type: 'string', description: 'Second token mint address' },
        },
        required: ['tokenMintA', 'tokenMintB'],
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    let result
    switch (name) {
      case 'analyze_token':
        result = await toolAnalyzeToken(args)
        break
      case 'get_token_feed':
        result = await toolGetTokenFeed(args)
        break
      case 'get_creator_profile':
        result = await toolGetCreatorProfile(args)
        break
      case 'get_token_holders':
        result = await toolGetTokenHolders(args)
        break
      case 'compare_tokens':
        result = await toolCompareTokens(args)
        break
      default:
        throw new Error(`Unknown tool: ${name}`)
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true,
    }
  }
})

// ── Start ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // Log to stderr so it doesn't pollute the MCP stdio channel
  process.stderr.write('MINTLENS MCP server running via stdio\n')
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n`)
  process.exit(1)
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidBase58(str) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(str)
}

function buildReportPrompt(tokenData) {
  const { metadata = {}, holders = {}, lifetimeFees, creators = [], claimStats = [], pool } = tokenData
  return `Analyse this Bags.fm token. Return ONLY valid JSON (no markdown fences):

Name: ${metadata.name} (${metadata.symbol})
Price: ${metadata.price ?? 'N/A'} | Market Cap: ${metadata.marketCap ?? 'N/A'}
Holders: ${holders.totalHolders ?? 'N/A'} | Top-10 Conc: ${holders.top10Concentration ?? 'N/A'}%
Lifetime Fees: ${JSON.stringify(lifetimeFees)}
Creators: ${JSON.stringify(creators.slice(0, 3))}
Pool: ${JSON.stringify(pool)}

JSON shape:
{
  "score": 0-100,
  "verdict": "one sentence",
  "sections": { "summary": "", "creatorCredibility": "", "holderHealth": "", "revenueTraction": "", "riskSignals": "" },
  "redFlags": [],
  "greenFlags": [],
  "scoreBreakdown": { "feeTraction": 0-25, "holderHealth": 0-20, "creatorCredibility": 0-20, "volumeLiquidity": 0-20, "riskSignals": 0-15 }
}`
}
