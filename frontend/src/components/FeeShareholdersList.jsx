/**
 * FeeShareholdersList — shows fee shareholders for a token.
 * Props: creators (array), claimStats (array), lifetimeFees (object)
 *
 * Data sources:
 *   creators[]:   { wallet, providerUsername, provider, pfp, royaltyBps, isCreator, bagsUsername }
 *   claimStats[]: { wallet, totalClaimed, ... } — earnings per wallet in lamports
 *   lifetimeFees: { totalFees (SOL), totalFeesLamports }
 */
export default function FeeShareholdersList({ creators = [], claimStats = [], lifetimeFees, mint }) {
  if (!creators.length) return null

  const totalFeesSol = lifetimeFees?.totalFees ?? null

  // Build a map from wallet → claimed (SOL)
  const claimedByWallet = {}
  for (const stat of claimStats) {
    if (stat.wallet) {
      const lamports = Number(stat.totalClaimed ?? stat.claimed ?? stat.amount ?? 0)
      claimedByWallet[stat.wallet] = lamports / 1e9
    }
  }

  // Sort: creator first, then by royaltyBps desc
  const sorted = [...creators].sort((a, b) => {
    if (a.isCreator && !b.isCreator) return -1
    if (!a.isCreator && b.isCreator) return 1
    return (b.royaltyBps ?? 0) - (a.royaltyBps ?? 0)
  })

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text-primary">Fee Shareholders</h2>
        {totalFeesSol != null && (
          <span className="text-sm text-text-muted font-mono">
            Total: <span className="text-score-green font-semibold">{totalFeesSol.toFixed(4)} SOL</span>
          </span>
        )}
      </div>

      <div className="card overflow-hidden divide-y divide-border">
        {sorted.map((c, i) => {
          const handle = c.providerUsername || null
          const pct = c.royaltyBps != null ? (c.royaltyBps / 100).toFixed(1) : null
          const earned = claimedByWallet[c.wallet] ?? null
          const wallet = c.wallet

          return (
            <div key={wallet || i} className="flex items-center gap-3 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4">
              {/* Rank */}
              <span className="w-6 text-center text-sm font-mono text-text-muted shrink-0">
                {i + 1}
              </span>

              {/* Avatar */}
              <Avatar pfp={c.pfp} handle={handle} />

              {/* Identity */}
              <div className="flex-1 min-w-0">
                {handle ? (
                  <a
                    href={`/creator/${handle}${mint ? `?hint=${mint}` : ''}`}
                    className="text-sm font-medium text-text-primary hover:text-primary transition-colors truncate block"
                  >
                    @{handle}
                  </a>
                ) : (
                  <span className="text-sm font-medium text-text-primary truncate block">
                    Unknown
                  </span>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  {c.isCreator && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(132,204,22,0.15)', color: '#84CC16' }}>Creator</span>
                  )}
                  {wallet && (
                    <span className="text-xs text-text-muted font-mono">{truncateWallet(wallet)}</span>
                  )}
                </div>
              </div>

              {/* Earnings */}
              <div className="text-right shrink-0 space-y-0.5">
                {pct != null && (
                  <div className="text-sm font-mono font-semibold text-text-primary">{pct}%</div>
                )}
                {earned != null ? (
                  <div className="text-xs font-mono text-score-green">{earned.toFixed(4)} SOL</div>
                ) : pct != null && totalFeesSol != null ? (
                  <div className="text-xs font-mono text-text-muted">
                    ~{Math.abs((c.royaltyBps / 10000) * totalFeesSol).toFixed(4)} SOL est.
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Avatar({ pfp, handle }) {
  if (pfp) {
    return (
      <img
        src={pfp}
        alt={handle || ''}
        className="w-9 h-9 rounded-full shrink-0 object-cover bg-surface"
        onError={(e) => { e.currentTarget.style.display = 'none' }}
      />
    )
  }
  const letter = handle ? handle[0].toUpperCase() : '?'
  return (
    <div
      className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-sm font-semibold"
      style={{ backgroundColor: 'rgba(132,204,22,0.2)', color: '#84CC16' }}
    >
      {letter}
    </div>
  )
}

function truncateWallet(addr) {
  if (!addr) return '—'
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}
