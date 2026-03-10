/**
 * tokens.js — Token data routes
 * GET  /api/tokens/feed              → list of recent Bags pools with metadata
 * GET  /api/tokens/:mint             → full token data (Bags + Helius combined)
 * GET  /api/tokens/:mint/share-card-data
 * GET  /api/tokens/:mint/share-card.png
 */
import { Router } from 'express'
import * as bags from '../services/bagsService.js'
import * as helius from '../services/heliusService.js'
import { getCachedScore } from './analysis.js'

const router = Router()

// Cache the full pool list for 5 min — avoids re-downloading 168k records on every 30s feed refresh
let _poolsCache = null
let _poolsCacheAt = 0
const POOLS_TTL = 5 * 60 * 1000

async function getCachedPools() {
  if (_poolsCache && Date.now() - _poolsCacheAt < POOLS_TTL) return _poolsCache
  const pools = await bags.getAllBagsPools({ limit: 50, newest: true })
  _poolsCache = pools
  _poolsCacheAt = Date.now()
  return pools
}

// ─── Symbol / name search ─────────────────────────────────────────────────────
// GET /api/tokens/search?q=SYMBOL
// Searches the newest 100 pools by token symbol or name.
// Returns { mint } of the best match, or 404.

router.get('/search', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim().toLowerCase().replace(/^\$/, '')
    if (!q) return res.status(400).json({ error: 'q is required' })

    // Use a larger slice for search than for the feed
    const allPools = await bags.getAllBagsPools({ limit: 100, newest: true })

    // Fetch metadata in parallel, tolerate failures
    const enriched = await Promise.allSettled(
      allPools.map(async (pool) => {
        const mint = pool.tokenMint || pool.mint || pool.id
        if (!mint) return null
        const meta = await helius.getTokenMetadata(mint).catch(() => null)
        return { mint, symbol: (meta?.symbol || '').toLowerCase(), name: (meta?.name || '').toLowerCase() }
      })
    ).then((r) => r.filter((x) => x.status === 'fulfilled' && x.value).map((x) => x.value))

    // Exact symbol match first, then name-contains
    const exact = enriched.find((t) => t.symbol === q)
    const partial = enriched.find((t) => t.symbol.includes(q) || t.name.includes(q))
    const match = exact || partial

    if (!match) return res.status(404).json({ error: `No token found matching "${q}"` })

    res.json({ mint: match.mint })
  } catch (err) {
    next(err)
  }
})

// ─── Feed ────────────────────────────────────────────────────────────────────

router.get('/feed', async (req, res, next) => {
  try {
    const { limit = 20 } = req.query

    // Check if API keys are configured
    if (!process.env.BAGS_API_KEY && !process.env.HELIUS_API_KEY) {
      return res.json({
        tokens: [],
        placeholder: true,
        message: 'Configure BAGS_API_KEY and HELIUS_API_KEY to load live feed',
      })
    }

    const pools = await getCachedPools()

    // Enrich each pool with metadata (Helius), fees (Bags), and holder count (Helius)
    const enriched = await Promise.allSettled(
      pools.slice(0, Number(limit)).map(async (pool) => {
        const mint = pool.tokenMint || pool.mint || pool.id
        if (!mint) return pool

        const [meta, fees, holderData] = await Promise.allSettled([
          helius.getTokenMetadata(mint),
          bags.getTokenLifetimeFees(mint),
          helius.getHolderCountQuick(mint),
        ]).then((r) => r.map((x) => (x.status === 'fulfilled' ? x.value : null)))

        const cachedScore = getCachedScore(mint)
        return {
          ...pool,
          mint,
          metadata: meta || {},
          lifetimeFees: fees,
          holders: holderData || {},
          // pool shape from getAllBagsPools has no volume — expose the keys we do have
          pool: { tokenMint: mint, dbcConfigKey: pool.dbcConfigKey, dbcPoolKey: pool.dbcPoolKey },
          // Expose createdAt at top level for feed filter (source: Helius DAS created_at)
          createdAt: meta?.createdAt || null,
          // Inject cached analysis score/verdict if available (enables High Score / Flagged filters)
          ...(cachedScore != null ? { score: cachedScore } : {}),
        }
      })
    )

    const tokens = enriched
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value)

    res.json({ tokens, count: tokens.length })
  } catch (err) {
    next(err)
  }
})

// ─── Full token data ─────────────────────────────────────────────────────────

router.get('/:mint', async (req, res, next) => {
  try {
    const { mint } = req.params

    if (!isValidBase58(mint)) {
      return res.status(400).json({ error: 'Invalid token mint address' })
    }

    // Fetch all data sources in parallel; individual failures are tolerated
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

    res.json({
      mint,
      metadata: metadata || {},
      holders: holders || {},
      transactions: transactions || [],
      lifetimeFees,
      creators: creators || [],
      claimStats: claimStats || [],
      pool,
      fetchedAt: new Date().toISOString(),
    })
  } catch (err) {
    next(err)
  }
})

// ─── Share card data ─────────────────────────────────────────────────────────

router.get('/:mint/share-card-data', async (req, res, next) => {
  try {
    const { mint } = req.params
    if (!isValidBase58(mint)) {
      return res.status(400).json({ error: 'Invalid token mint address' })
    }

    const [metadata, holders, lifetimeFees] = await Promise.allSettled([
      helius.getTokenMetadata(mint),
      helius.getTokenHolders(mint),
      bags.getTokenLifetimeFees(mint),
    ]).then((r) => r.map((x) => (x.status === 'fulfilled' ? x.value : null)))

    res.json({ mint, metadata, holders, lifetimeFees })
  } catch (err) {
    next(err)
  }
})

// ─── Share card PNG ───────────────────────────────────────────────────────────

router.get('/:mint/share-card.png', async (req, res, next) => {
  try {
    const { mint } = req.params
    if (!isValidBase58(mint)) {
      return res.status(400).json({ error: 'Invalid token mint address' })
    }

    // Dynamic import so server starts even without canvas installed
    let generateShareCard
    try {
      const mod = await import('../services/shareCardService.js')
      generateShareCard = mod.generateShareCard
    } catch {
      return res.status(501).json({ error: 'Share card generation requires node-canvas. Run: npm install canvas' })
    }

    const [metadata, holders, lifetimeFees] = await Promise.allSettled([
      helius.getTokenMetadata(mint),
      helius.getTokenHolders(mint),
      bags.getTokenLifetimeFees(mint),
    ]).then((r) => r.map((x) => (x.status === 'fulfilled' ? x.value : null)))

    const png = await generateShareCard({ mint, metadata, holders, lifetimeFees, report: null })

    res.set('Content-Type', 'image/png')
    res.set('Content-Disposition', `inline; filename="mintlens-${mint.slice(0, 8)}.png"`)
    res.send(png)
  } catch (err) {
    next(err)
  }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isValidBase58(str) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(str)
}

export default router
