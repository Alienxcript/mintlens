/**
 * bagsService.js — Bags.fm REST API integration
 * Base URL: https://public-api-v2.bags.fm/api/v1
 * Auth: x-api-key header
 *
 * Correct endpoint paths (verified against docs.bags.fm):
 *   List pools:    GET /solana/bags/pools
 *   Pool by mint:  GET /solana/bags/pools/token-mint?tokenMint=<MINT>
 *   Lifetime fees: GET /token-launch/lifetime-fees?tokenMint=<MINT>
 *   Creators:      GET /token-launch/creator/v3?tokenMint=<MINT>
 *   Claim stats:   GET /token-launch/claim-stats?tokenMint=<MINT>
 *   Claim events:  GET /token-launch/claim-events?tokenMint=<MINT>
 *   DexScreener:   GET https://api.dexscreener.com/latest/dex/tokens/<MINT>
 */
import axios from 'axios'
import 'dotenv/config'

const BASE = 'https://public-api-v2.bags.fm/api/v1'

function headers() {
  return { 'x-api-key': process.env.BAGS_API_KEY || '' }
}

async function get(path, params = {}) {
  const url = `${BASE}${path}`
  const res = await axios.get(url, { headers: headers(), params, timeout: 10000 })
  return res.data
}

/**
 * Total fees earned by the token over its lifetime.
 * API returns: { success: true, response: "<lamports as string>" }
 * We normalise to: { totalFees: <SOL number>, totalFeesLamports: string }
 */
export async function getTokenLifetimeFees(tokenMint) {
  try {
    const data = await get('/token-launch/lifetime-fees', { tokenMint })
    const lamports = data.response ?? data.totalFees ?? data
    const totalFeesLamports = String(lamports)
    const totalFees = Number(totalFeesLamports) / 1e9   // convert lamports → SOL
    return { totalFees, totalFeesLamports, raw: data }
  } catch (err) {
    console.error(`[bags] getTokenLifetimeFees(${tokenMint}):`, err.message)
    return null
  }
}

/**
 * Creators associated with the token.
 * Returns: array of { username, providerUsername, provider, wallet, pfp, royaltyBps, isCreator, bagsUsername }
 */
export async function getTokenCreators(tokenMint) {
  try {
    const data = await get('/token-launch/creator/v3', { tokenMint })
    const arr = data.response ?? data
    return Array.isArray(arr) ? arr : []
  } catch (err) {
    console.error(`[bags] getTokenCreators(${tokenMint}):`, err.message)
    return []
  }
}

/**
 * Claim stats per user (who has claimed fees and how much).
 */
export async function getTokenClaimStats(tokenMint) {
  try {
    const data = await get('/token-launch/claim-stats', { tokenMint })
    const arr = data.response ?? data
    return Array.isArray(arr) ? arr : []
  } catch (err) {
    console.error(`[bags] getTokenClaimStats(${tokenMint}):`, err.message)
    return []
  }
}

/**
 * Recent fee claim events for the token.
 */
export async function getTokenClaimEvents(tokenMint) {
  try {
    const data = await get('/token-launch/claim-events', { tokenMint })
    const arr = data.response ?? data.events ?? data
    return Array.isArray(arr) ? arr : []
  } catch (err) {
    console.error(`[bags] getTokenClaimEvents(${tokenMint}):`, err.message)
    return []
  }
}

/**
 * Pool state for a specific token mint.
 * Returns: { tokenMint, dbcConfigKey, dbcPoolKey, dammV2PoolKey }
 */
export async function getBagsPool(tokenMint) {
  try {
    const data = await get('/solana/bags/pools/token-mint', { tokenMint })
    return data.response ?? data
  } catch (err) {
    console.error(`[bags] getBagsPool(${tokenMint}):`, err.message)
    return null
  }
}

// Module-level cache for the full raw pool list (168k entries).
// One download shared by feed, leaderboard, creator search, and ticker search.
let _rawPoolsCache = null
let _rawPoolsCacheAt = 0
const RAW_POOLS_TTL = 30 * 60 * 1000 // 30 min

async function getRawPools() {
  if (_rawPoolsCache && Date.now() - _rawPoolsCacheAt < RAW_POOLS_TTL) {
    return _rawPoolsCache
  }
  const data = await get('/solana/bags/pools')
  const arr = data.response ?? data
  _rawPoolsCache = Array.isArray(arr) ? arr : []
  _rawPoolsCacheAt = Date.now()
  return _rawPoolsCache
}

/**
 * All active Bags pools (for feed).
 * The API returns all ~168k pools at once (no server-side pagination).
 * We slice the tail (newest launches) locally.
 * @param {{ limit?: number, newest?: boolean }} opts
 * Returns array of { tokenMint, dbcConfigKey, dbcPoolKey, dammV2PoolKey }
 */
export async function getAllBagsPools({ limit = 50, newest = true } = {}) {
  try {
    const arr = await getRawPools()
    // Newest launches are appended at the end of the array
    return newest ? arr.slice(-limit).reverse() : arr.slice(0, limit)
  } catch (err) {
    console.error('[bags] getAllBagsPools:', err.message)
    return []
  }
}

/**
 * Returns a sample of mint addresses spread across the full pool list.
 * Used by creator search to cover old and new tokens without fetching all 168k.
 * @param {{ newest?: number, oldest?: number, spread?: number }} opts
 */
export async function getSampledPoolMints({ newest = 100, oldest = 100, spread = 300 } = {}) {
  try {
    const arr = await getRawPools()
    if (!arr.length) return []

    const toMint = (p) => p.tokenMint || p.mint || p.id

    const newestMints = arr.slice(-newest).reverse().map(toMint)
    const oldestMints = arr.slice(0, oldest).map(toMint)

    // Evenly distributed sample from the middle portion
    const middle = arr.slice(oldest, arr.length - newest)
    const spreadMints = []
    if (middle.length > 0 && spread > 0) {
      const step = Math.max(1, Math.floor(middle.length / spread))
      for (let i = 0; i < middle.length && spreadMints.length < spread; i += step) {
        const m = toMint(middle[i])
        if (m) spreadMints.push(m)
      }
    }

    // Deduplicate
    return [...new Set([...newestMints, ...oldestMints, ...spreadMints])].filter(Boolean)
  } catch (err) {
    console.error('[bags] getSampledPoolMints:', err.message)
    return []
  }
}


export default {
  getTokenLifetimeFees,
  getTokenCreators,
  getTokenClaimStats,
  getTokenClaimEvents,
  getBagsPool,
  getAllBagsPools,
  getSampledPoolMints,
}
