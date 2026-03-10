/**
 * leaderboard.js — Leaderboard routes
 * GET /api/leaderboard?limit=20
 *
 * Strategy for finding high-fee tokens:
 *   New pools (tail of list) have zero fees — we must sample across the
 *   FULL 168k list to find established tokens that have accumulated fees.
 *
 *   We take 60 tokens spread evenly across the full list (every N-th entry)
 *   plus 10 from the very start (oldest, most established) to maximise the
 *   chance of hitting tokens with real fee history.
 *
 *   Total API calls: 1 (pool list) + ~300 (fees) + top20 * 3 (enrich) = ~361
 *   Cache: 15 min TTL. The full enriched set is cached; limit is applied at
 *   response time so different limit values work correctly off the same cache.
 */
import { Router } from 'express'
import * as bags from '../services/bagsService.js'
import * as helius from '../services/heliusService.js'

const router = Router()

// Cache stores the full enriched list — limit applied at response time
let _cachedTokens = null   // full array
let _cachedStats  = null   // stats object (based on full set)
let _cacheAt      = 0
const CACHE_TTL   = 15 * 60 * 1000

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50)

    if (_cachedTokens && Date.now() - _cacheAt < CACHE_TTL) {
      return res.json({
        tokens: _cachedTokens.slice(0, limit),
        stats: _cachedStats,
        cached: true,
        fetchedAt: new Date(_cacheAt).toISOString(),
      })
    }

    // 1. Fetch the full pool list (one API call, returns all ~168k mints)
    const allPools = await bags.getAllBagsPools({ limit: 168000, newest: false })
    const totalEcosystem = allPools.length
    if (!totalEcosystem) {
      return res.json({ tokens: [], stats: { totalEcosystem: 0, totalFeesSol: 0, totalHolders: 0 }, cached: false })
    }

    // 2. Build a sample biased toward established (older) tokens.
    //    Oldest entries are at the START of the list — these have had the most
    //    time to accumulate fees. New tokens (end) almost always have $0 fees.
    //    Strategy: first 200 (oldest) + 100 spread across the rest = 300 total.
    //    The Bags API rate limit is 1000 req/hr; 300 parallel fee calls is safe.
    const sampled = new Map()

    // Take the first 200 (oldest, most established)
    const OLDEST_COUNT = Math.min(200, totalEcosystem)
    for (let i = 0; i < OLDEST_COUNT; i++) {
      const mint = allPools[i].tokenMint || allPools[i].mint || allPools[i].id
      if (mint) sampled.set(mint, allPools[i])
    }

    // Add 100 more evenly distributed across the remaining list
    const remaining = allPools.slice(OLDEST_COUNT)
    const step = Math.max(1, Math.floor(remaining.length / 100))
    for (let i = 0; i < remaining.length && sampled.size < 300; i += step) {
      const mint = remaining[i].tokenMint || remaining[i].mint || remaining[i].id
      if (mint && !sampled.has(mint)) sampled.set(mint, remaining[i])
    }

    const candidates = [...sampled.entries()].map(([mint, pool]) => ({ mint, pool }))

    // 3. Fetch lifetime fees for all candidates in parallel
    const withFees = (
      await Promise.allSettled(
        candidates.map(async ({ mint, pool }) => {
          const fees = await bags.getTokenLifetimeFees(mint)
          return { mint, pool, fees }
        })
      )
    )
      .filter((r) => r.status === 'fulfilled' && r.value)
      .map((r) => r.value)

    // 4. Sort by fees descending — tokens with actual fee history rise to top
    withFees.sort((a, b) => (b.fees?.totalFees ?? 0) - (a.fees?.totalFees ?? 0))

    // 5. Enrich top 20 with metadata + creator + holders
    const TOP = 20
    const top = withFees.slice(0, TOP)

    const enriched = (
      await Promise.allSettled(
        top.map(async ({ mint, fees }, idx) => {
          const [meta, creators, holderData] = await Promise.allSettled([
            helius.getTokenMetadata(mint),
            bags.getTokenCreators(mint),
            helius.getHolderCountQuick(mint),
          ]).then((r) => r.map((x) => (x.status === 'fulfilled' ? x.value : null)))

          const primaryCreator = Array.isArray(creators)
            ? creators.find((c) => c.isCreator) || creators[0] || null
            : null

          return {
            rank: idx + 1,
            mint,
            name: meta?.name || null,
            symbol: meta?.symbol || null,
            logoURI: meta?.logoURI || null,
            lifetimeFeesSol: fees?.totalFees ?? 0,
            holders: holderData?.totalHolders ?? null,
            creator: primaryCreator
              ? (() => {
                  const isValidHandle = (h) => h && !h.includes('…') && !h.includes('...')
                  const handle =
                    (isValidHandle(primaryCreator.providerUsername) && primaryCreator.providerUsername) ||
                    (isValidHandle(primaryCreator.bagsUsername) && primaryCreator.bagsUsername) ||
                    (isValidHandle(primaryCreator.username) && primaryCreator.username) ||
                    null
                  return handle
                    ? { handle, provider: primaryCreator.provider || null, pfp: primaryCreator.pfp || null }
                    : null
                })()
              : null,
          }
        })
      )
    )
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value)

    // Re-rank after any dropped entries
    enriched.forEach((t, i) => { t.rank = i + 1 })

    const totalFeesSol = enriched.reduce((s, t) => s + (t.lifetimeFeesSol ?? 0), 0)
    const totalHolders = enriched.reduce((s, t) => s + (t.holders ?? 0), 0)

    const stats = {
      totalEcosystem,
      sampleSize: candidates.length,
      totalFeesSol,
      totalHolders,
      topTokenFeesSol: enriched[0]?.lifetimeFeesSol ?? 0,
    }

    // Cache the full enriched set — limit is applied at response time
    _cachedTokens = enriched
    _cachedStats  = stats
    _cacheAt      = Date.now()

    res.json({
      tokens: enriched.slice(0, limit),
      stats,
      cached: false,
      fetchedAt: new Date().toISOString(),
    })
  } catch (err) {
    next(err)
  }
})

export default router
