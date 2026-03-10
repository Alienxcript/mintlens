/**
 * analysis.js — Claude analysis routes
 * POST /api/analysis/:mint       → generate Claude report (cached 10 min)
 * POST /api/analysis/:mint/chat  → continue conversation
 */
import { Router } from 'express'
import * as bags from '../services/bagsService.js'
import * as helius from '../services/heliusService.js'
import * as claude from '../services/claudeService.js'

const router = Router()

// ─── Simple in-memory cache ───────────────────────────────────────────────────
const cache = new Map() // mint → { report, expiresAt }
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

function getCached(mint) {
  const entry = cache.get(mint)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(mint)
    return null
  }
  return entry.report
}

function setCache(mint, report) {
  cache.set(mint, { report, expiresAt: Date.now() + CACHE_TTL })
}

// Exported so other routes (creators, leaderboard) can read cached scores
export function getCachedScore(mint) {
  const cached = getCached(mint)
  return cached?.report?.score ?? null
}

// ─── Generate report ─────────────────────────────────────────────────────────

router.post('/:mint', async (req, res, next) => {
  try {
    const { mint } = req.params

    if (!isValidBase58(mint)) {
      return res.status(400).json({ error: 'Invalid token mint address' })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' })
    }

    // Return cached result if fresh
    const cached = getCached(mint)
    if (cached) {
      return res.json({ ...cached, cached: true })
    }

    // Use tokenData provided by the frontend (already fetched by GET /tokens/:mint)
    // if it has valid holder data. Otherwise fetch fresh to ensure completeness.
    const provided = req.body?.tokenData
    const useProvided =
      provided &&
      provided.mint === mint &&
      provided.holders?.totalHolders != null &&
      provided.holders.totalHolders > 0

    let tokenData
    if (useProvided) {
      tokenData = {
        mint,
        metadata: provided.metadata || {},
        holders: provided.holders,
        transactions: provided.transactions || [],
        lifetimeFees: provided.lifetimeFees ?? null,
        creators: provided.creators || [],
        claimStats: provided.claimStats || [],
        pool: provided.pool ?? null,
      }
    } else {
      // Fetch all data fresh — fallback when no valid tokenData was passed
      const [metadata, holders, transactions, lifetimeFees, creators, claimStats, pool] =
        await Promise.allSettled([
          helius.getTokenMetadata(mint),
          helius.getTokenHolders(mint),
          helius.getTokenTransactions(mint, 20),
          bags.getTokenLifetimeFees(mint),
          bags.getTokenCreators(mint),
          bags.getTokenClaimStats(mint),
          bags.getBagsPool(mint),
        ]).then((results) => results.map((r) => (r.status === 'fulfilled' ? r.value : null)))

      tokenData = {
        mint,
        metadata: metadata || {},
        holders: holders || {},
        transactions: transactions || [],
        lifetimeFees,
        creators: creators || [],
        claimStats: claimStats || [],
        pool,
      }
    }

    const report = await claude.generateTokenReport(tokenData)

    const result = {
      mint,
      report,
      tokenData,
      generatedAt: new Date().toISOString(),
    }

    setCache(mint, result)
    res.json(result)
  } catch (err) {
    next(err)
  }
})

// ─── Follow-up chat ───────────────────────────────────────────────────────────

router.post('/:mint/chat', async (req, res, next) => {
  try {
    const { mint } = req.params
    const { messages, tokenContext } = req.body

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' })
    }

    const reply = await claude.continueChat(messages, tokenContext)
    res.json({ reply, timestamp: new Date().toISOString() })
  } catch (err) {
    next(err)
  }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isValidBase58(str) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(str)
}

export default router
