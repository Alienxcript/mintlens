import { useState, useEffect } from 'react'

/**
 * Grid of metric tiles for the token report page.
 * Props: metadata, holders, lifetimeFees, creators, launchDate
 *
 * Tiles: Lifetime Fees (USD), Days Active, Holders, Top-10 Concentration,
 *        Creator, Royalty, Total Supply
 *
 * Lifetime Fees USD = totalFees (SOL) × CoinGecko SOL/USD price.
 * Falls back to SOL display if price fetch fails.
 */
export default function MetricsDashboard({ metadata = {}, holders = {}, lifetimeFees, creators = [], launchDate = null, mint = null }) {
  const [solPrice, setSolPrice] = useState(null)

  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
      .then((r) => r.json())
      .then((d) => setSolPrice(d?.solana?.usd ?? null))
      .catch(() => setSolPrice(null))
  }, [])

  // Lifetime fees
  const totalFeesSol = lifetimeFees?.totalFees ?? lifetimeFees?.total ?? null
  const feesUsdValue = totalFeesSol != null && solPrice != null
    ? formatLargeUsd(totalFeesSol * solPrice)
    : totalFeesSol != null
    ? `${formatSol(totalFeesSol)} SOL`
    : '—'
  const feesSolSub = totalFeesSol != null && solPrice != null
    ? `${formatSol(totalFeesSol)} SOL`
    : null

  // Days Active
  const launchTs = launchDate ? new Date(launchDate).getTime() : null
  const daysActive = launchTs && !isNaN(launchTs)
    ? Math.floor((Date.now() - launchTs) / (1000 * 60 * 60 * 24))
    : null

  // Holders + concentration
  const totalHolders = holders.totalHolders ?? null
  const top10Concentration = holders.top10Concentration ?? null

  // Creator + royalty
  const primaryCreator = creators.find((c) => c.isCreator) || creators[0] || null

  // Total supply
  const supplyRaw = metadata.supply ?? null
  const decimals = metadata.decimals ?? 9
  const supplyWhole = supplyRaw != null ? supplyRaw / Math.pow(10, decimals) : null

  // Creator — only providerUsername is a verified social handle
  const creatorHandle = primaryCreator?.providerUsername || null

  return (
    <div className="space-y-3">
      {/* Row 1 — 2 cols mobile → 3 cols tablet → 4 cols desktop */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <MetricTile
          label="Lifetime Fees"
          value={feesUsdValue}
          sub={feesSolSub}
          accent
        />
        <MetricTile
          label="Days Active"
          value={daysActive != null ? `${daysActive}d` : '—'}
        />
        <MetricTile
          label="Holders"
          value={totalHolders != null ? totalHolders.toLocaleString() : '—'}
        />
        <MetricTile
          label="Top-10 Conc."
          value={top10Concentration != null ? `${top10Concentration}%` : '—'}
          warning={top10Concentration > 60}
        />
      </div>

      {/* Row 2 — 2 cols mobile → 3 cols tablet+ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <MetricTile
          label="Creator"
          value={
            primaryCreator
              ? creatorHandle ? `@${creatorHandle}` : 'Unknown Creator'
              : '—'
          }
          sub={
            primaryCreator
              ? creatorHandle
                ? primaryCreator.provider || null
                : primaryCreator.wallet
                  ? `${primaryCreator.wallet.slice(0, 4)}…${primaryCreator.wallet.slice(-4)}`
                  : null
              : null
          }
          link={creatorHandle ? `/creator/${creatorHandle}${mint ? `?hint=${mint}` : ''}` : null}
        />
        <MetricTile
          label="Royalty"
          value={primaryCreator?.royaltyBps != null ? `${primaryCreator.royaltyBps / 100}%` : '—'}
        />
        <MetricTile
          label="Total Supply"
          value={supplyWhole != null ? formatLargeSupply(supplyWhole) : '—'}
        />
      </div>
    </div>
  )
}

function MetricTile({ label, value, sub, accent, warning, link }) {
  const valueColor = warning ? '#FF4757' : accent ? '#84CC16' : '#F0F0FF'

  const inner = (
    <div className="card p-4 flex flex-col gap-1">
      <span className="text-xs text-text-muted uppercase tracking-wider">{label}</span>
      <span className="font-mono text-lg font-medium truncate" style={{ color: valueColor }}>
        {value}
      </span>
      {sub && <span className="font-mono text-xs text-text-muted truncate">{sub}</span>}
    </div>
  )

  if (link) {
    return (
      <a href={link} className="block hover:scale-[1.02] transition-transform">
        {inner}
      </a>
    )
  }
  return inner
}

function formatSol(n) {
  const val = Number(n)
  if (isNaN(val)) return '—'
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`
  return val.toFixed(4)
}

function formatLargeUsd(n) {
  const val = Number(n)
  if (isNaN(val)) return '—'
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(2)}B`
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatLargeSupply(n) {
  const val = Number(n)
  if (isNaN(val)) return '—'
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}B`
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`
  return val.toFixed(0)
}
