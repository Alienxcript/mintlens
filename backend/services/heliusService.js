/**
 * heliusService.js — Helius DAS API + Enhanced Transactions
 * RPC URL: https://mainnet.helius-rpc.com/?api-key=<KEY>
 */
import axios from 'axios'
import 'dotenv/config'

function rpcUrl() {
  return `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
}

// Token accounts owned by these programs are DEX/AMM pool vaults — not real holders.
// Filter them out before holder analysis so they don't inflate concentration stats.
const DEX_PROGRAM_IDS = new Set([
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium AMM V4
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK', // Raydium CLMM
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',  // Orca Whirlpool
  'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EkAW7vA', // Meteora Dynamic AMM
  'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo', // Meteora DLMM
  'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN', // Meteora DBC (used by Bags.fm)
])

async function rpcCall(method, params) {
  const res = await axios.post(
    rpcUrl(),
    { jsonrpc: '2.0', id: 'mintlens', method, params },
    { timeout: 15000 }
  )
  if (res.data.error) throw new Error(res.data.error.message || 'RPC error')
  return res.data.result
}

/**
 * Fetch the oldest on-chain timestamp for a mint address by paginating
 * getSignaturesForAddress until we reach the beginning of history (cap: 10 pages).
 * Returns an ISO string, or null on failure.
 */
async function fetchOldestMintTimestamp(tokenMint) {
  try {
    const PAGE = 1000
    let before = undefined
    let oldestTime = null
    for (let i = 0; i < 10; i++) {
      const params = [tokenMint, { limit: PAGE, commitment: 'confirmed', ...(before ? { before } : {}) }]
      const sigs = await rpcCall('getSignaturesForAddress', params)
      if (!Array.isArray(sigs) || sigs.length === 0) break
      const last = sigs[sigs.length - 1]
      if (last?.blockTime) oldestTime = last.blockTime
      if (sigs.length < PAGE) break // reached the beginning
      before = last.signature
    }
    return oldestTime ? new Date(oldestTime * 1000).toISOString() : null
  } catch {
    return null
  }
}

/**
 * Token metadata via DAS getAsset.
 * Returns: { name, symbol, price, marketCap, supply, decimals, logoURI }
 */
export async function getTokenMetadata(tokenMint) {
  try {
    const result = await rpcCall('getAsset', { id: tokenMint })

    const content = result?.content || {}
    const meta = content?.metadata || {}
    const token_info = result?.token_info || {}
    const price_info = token_info?.price_info || {}

    const decimals = token_info.decimals ?? 9

    // result?.created_at from Helius DAS is unreliable — fall back to the oldest
    // on-chain signature timestamp which accurately reflects the token mint date.
    const createdAt = await fetchOldestMintTimestamp(tokenMint)

    return {
      name: meta.name || token_info.symbol || null,
      symbol: meta.symbol || token_info.symbol || '',
      decimals,
      // Helius returns supply in raw base units — divide here so all consumers get human-readable
      supply: token_info.supply != null
        ? Math.round(Number(token_info.supply) / Math.pow(10, decimals))
        : 0,
      price: price_info.price_per_token ?? null,
      marketCap: price_info.total_price ?? null,
      logoURI: content?.links?.image || content?.files?.[0]?.uri || null,
      description: meta.description || null,
      createdAt,
      raw: result,
    }
  } catch (err) {
    console.error(`[helius] getTokenMetadata(${tokenMint}):`, err.message)
    return {
      name: null,
      symbol: '',
      decimals: 9,
      supply: 0,
      price: null,
      marketCap: null,
      logoURI: null,
      description: null,
    }
  }
}

/**
 * Quick holder count for feed cards — single page fetch only (≤1000 accounts).
 * Much faster than getTokenHolders; sufficient for displaying a count on a card.
 * Returns: { totalHolders }
 */
export async function getHolderCountQuick(tokenMint) {
  try {
    const result = await rpcCall('getTokenAccounts', {
      mint: tokenMint,
      limit: 1000,
      page: 1,
    })
    const accounts = result?.token_accounts || []
    return { totalHolders: accounts.length }
  } catch (err) {
    console.error(`[helius] getHolderCountQuick(${tokenMint}):`, err.message)
    return { totalHolders: null }
  }
}

/**
 * Token holder data.
 * Returns: { totalHolders, top10Concentration, holderList (top 50) }
 * Uses getTokenAccounts with paginated fetching.
 */
export async function getTokenHolders(tokenMint) {
  try {
    const PAGE_SIZE = 1000
    let page = 1
    let allAccounts = []
    let keepFetching = true

    // Paginate to get full holder list (cap at 5 pages = 5000 accounts for perf)
    while (keepFetching && page <= 5) {
      const result = await rpcCall('getTokenAccounts', {
        mint: tokenMint,
        limit: PAGE_SIZE,
        page,
      })

      const accounts = result?.token_accounts || []
      allAccounts = allAccounts.concat(accounts)

      if (accounts.length < PAGE_SIZE) {
        keepFetching = false
      } else {
        page++
      }
    }

    if (allAccounts.length === 0) {
      return { totalHolders: 0, top10Concentration: 0, holderList: [] }
    }

    // Split into DEX pool vaults vs real holders.
    // totalSupply uses ALL accounts so percentages represent share of full circulating supply.
    const totalSupply = allAccounts.reduce((sum, a) => sum + (Number(a.amount) || 0), 0)

    const dexAccounts = allAccounts.filter(a => DEX_PROGRAM_IDS.has(a.owner))
    const regularAccounts = allAccounts.filter(a => !DEX_PROGRAM_IDS.has(a.owner))

    // Sort real holders by balance descending
    regularAccounts.sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))

    const top10 = regularAccounts.slice(0, 10)
    const top10Sum = top10.reduce((sum, a) => sum + (Number(a.amount) || 0), 0)
    const top10Concentration = totalSupply > 0 ? (top10Sum / totalSupply) * 100 : 0

    // Include owner in holderList so callers can further filter by known pool keys
    const holderList = regularAccounts.slice(0, 50).map((a, i) => ({
      rank: i + 1,
      address: a.address || a.owner,
      owner: a.owner || null,
      amount: Number(a.amount),
      percentage: totalSupply > 0 ? ((Number(a.amount) / totalSupply) * 100).toFixed(2) : '0.00',
    }))

    // Summary of what's pooled in DEX vaults (useful context for Claude)
    const dexPooledAmount = dexAccounts.reduce((sum, a) => sum + (Number(a.amount) || 0), 0)
    const dexPooled = dexPooledAmount > 0
      ? { count: dexAccounts.length, percentage: ((dexPooledAmount / totalSupply) * 100).toFixed(1) }
      : null

    return {
      totalHolders: regularAccounts.length,
      top10Concentration: Math.round(top10Concentration * 100) / 100,
      holderList,
      dexPooled, // e.g. { count: 1, percentage: "89.3" } — passed to Claude as healthy context
    }
  } catch (err) {
    console.error(`[helius] getTokenHolders(${tokenMint}):`, err.message)
    return { totalHolders: 0, top10Concentration: 0, holderList: [] }
  }
}

/**
 * Recent parsed transactions for a token using Enhanced Transactions API.
 * Returns array of parsed tx objects.
 */
export async function getTokenTransactions(tokenMint, limit = 25) {
  try {
    const url = `https://api.helius.xyz/v0/addresses/${tokenMint}/transactions?api-key=${process.env.HELIUS_API_KEY}&limit=${limit}&type=SWAP`
    const res = await axios.get(url, { timeout: 15000 })
    return res.data || []
  } catch (err) {
    console.error(`[helius] getTokenTransactions(${tokenMint}):`, err.message)
    return []
  }
}

export default {
  getTokenMetadata,
  getTokenHolders,
  getTokenTransactions,
}
