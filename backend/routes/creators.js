/**
 * creators.js — Creator profile route
 * GET /api/creators/:handle?hint=<tokenMint>
 *
 * Fast path (hint provided):
 *   1. Call getTokenCreators(hint) → extract the creator's wallet address
 *   2. Sample 200 mints (50 newest + 50 oldest + 100 spread) from the cached pool list
 *   3. For each sampled mint, call getTokenCreators() and match by wallet (not username)
 *      → wallet match is reliable; username can be missing or inconsistent
 *
 * Slow path (no hint):
 *   Same 200-mint sample but match by providerUsername / username instead of wallet.
 *
 * Results cached per handle for 30 min.
 */
import { Router } from 'express'
import * as bags from '../services/bagsService.js'
import * as helius from '../services/heliusService.js'
import { getCachedScore } from './analysis.js'

const router = Router()

// Per-handle result cache (30 min)
const _cache = new Map()
const CACHE_TTL = 30 * 60 * 1000

function getCached(handle) {
  const entry = _cache.get(handle.toLowerCase())
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { _cache.delete(handle.toLowerCase()); return null }
  return entry.data
}

function setCache(handle, data) {
  _cache.set(handle.toLowerCase(), { data, expiresAt: Date.now() + CACHE_TTL })
}

router.get('/:handle', async (req, res, next) => {
  try {
    const { handle } = req.params
    const { hint } = req.query   // optional: a token mint we already know this creator owns
    const handleLower = handle.toLowerCase()

    const cached = getCached(handle)
    if (cached) return res.json({ ...cached, cached: true })

    // ── Step 1: resolve wallet from hint mint ─────────────────────────────────
    let knownWallet = null
    if (hint && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(hint)) {
      try {
        const hintCreators = await bags.getTokenCreators(hint)
        const match = hintCreators.find(
          (c) =>
            c.providerUsername?.toLowerCase() === handleLower ||
            c.username?.toLowerCase() === handleLower
        )
        if (match?.wallet) knownWallet = match.wallet
      } catch { /* ignore — fall back to username search */ }
    }

    // ── Step 2: sample 200 mints across full pool history ────────────────────
    const mints = await bags.getSampledPoolMints({ newest: 50, oldest: 50, spread: 100 })

    // ── Step 3: search by wallet (fast path) or username (slow path) ──────────
    const creatorResults = await Promise.allSettled(
      mints.map(async (mint) => {
        const creators = await bags.getTokenCreators(mint).catch(() => [])
        const match = knownWallet
          ? creators.find((c) => c.wallet === knownWallet)
          : creators.find(
              (c) =>
                c.providerUsername?.toLowerCase() === handleLower ||
                c.username?.toLowerCase() === handleLower
            )
        return match ? { mint, creator: match } : null
      })
    )

    const tokenMints = creatorResults
      .filter((r) => r.status === 'fulfilled' && r.value)
      .map((r) => r.value)

    // Also include the hint token itself if not already found
    if (hint && knownWallet) {
      const alreadyFound = tokenMints.some((t) => t.mint === hint)
      if (!alreadyFound) {
        try {
          const hintCreators = await bags.getTokenCreators(hint)
          const match = hintCreators.find((c) => c.wallet === knownWallet)
          if (match) tokenMints.push({ mint: hint, creator: match })
        } catch { /* ignore */ }
      }
    }

    if (tokenMints.length === 0) {
      return res.status(404).json({
        error: `Creator @${handle} not found${knownWallet ? ' (wallet not found in sampled tokens)' : ' (username not matched in sampled tokens)'}.`,
      })
    }

    // ── Step 4: enrich matched tokens (metadata + fees, no holders) ───────────
    const tokens = await Promise.allSettled(
      tokenMints.map(async ({ mint, creator }) => {
        const [metadata, lifetimeFees] = await Promise.allSettled([
          helius.getTokenMetadata(mint),
          bags.getTokenLifetimeFees(mint),
        ]).then((r) => r.map((x) => (x.status === 'fulfilled' ? x.value : null)))
        const score = getCachedScore(mint)
        return { mint, creator, metadata: metadata || {}, lifetimeFees, score }
      })
    ).then((r) => r.filter((x) => x.status === 'fulfilled').map((x) => x.value))

    // Sort: primary creator tokens first, then by fees desc
    tokens.sort((a, b) => {
      if (a.creator.isCreator && !b.creator.isCreator) return -1
      if (!a.creator.isCreator && b.creator.isCreator) return 1
      return Number(b.lifetimeFees?.totalFees || 0) - Number(a.lifetimeFees?.totalFees || 0)
    })

    // ── Step 5: aggregate stats ───────────────────────────────────────────────
    const totalFeesSol = tokens.reduce(
      (sum, t) => sum + Number(t.lifetimeFees?.totalFees || 0), 0
    )
    const scoredTokens = tokens.filter((t) => t.score != null)
    const avgScore = scoredTokens.length
      ? Math.round(scoredTokens.reduce((s, t) => s + t.score, 0) / scoredTokens.length)
      : null

    const creatorInfo = tokenMints[0]?.creator || {}

    const result = {
      handle,
      provider: creatorInfo.provider,
      providerUsername: creatorInfo.providerUsername,
      wallet: creatorInfo.wallet || knownWallet,
      pfp: creatorInfo.pfp,
      stats: { totalTokens: tokens.length, totalFeesSol, avgScore },
      tokens,
    }

    setCache(handle, result)
    res.json(result)
  } catch (err) {
    next(err)
  }
})

export default router
