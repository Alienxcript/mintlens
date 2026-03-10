/**
 * heliusService.js — Helius DAS API + Enhanced Transactions
 * RPC URL: https://mainnet.helius-rpc.com/?api-key=<KEY>
 */
import axios from 'axios'
import 'dotenv/config'

function rpcUrl() {
  return `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
}

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

    return {
      name: meta.name || token_info.symbol || null,
      symbol: meta.symbol || token_info.symbol || '',
      decimals: token_info.decimals ?? 9,
      supply: token_info.supply ?? 0,
      price: price_info.price_per_token ?? null,
      marketCap: price_info.total_price ?? null,
      logoURI: content?.links?.image || content?.files?.[0]?.uri || null,
      description: meta.description || null,
      createdAt: result?.created_at ?? null,
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

    // Sort by amount descending
    allAccounts.sort((a, b) => (b.amount || 0) - (a.amount || 0))

    const totalSupply = allAccounts.reduce((sum, a) => sum + (Number(a.amount) || 0), 0)
    const top10 = allAccounts.slice(0, 10)
    const top10Sum = top10.reduce((sum, a) => sum + (Number(a.amount) || 0), 0)
    const top10Concentration = totalSupply > 0 ? (top10Sum / totalSupply) * 100 : 0

    const holderList = allAccounts.slice(0, 50).map((a, i) => ({
      rank: i + 1,
      address: a.address || a.owner,
      amount: Number(a.amount),
      percentage: totalSupply > 0 ? ((Number(a.amount) / totalSupply) * 100).toFixed(2) : '0.00',
    }))

    return {
      totalHolders: allAccounts.length,
      top10Concentration: Math.round(top10Concentration * 100) / 100,
      holderList,
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
