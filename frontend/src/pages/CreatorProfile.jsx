import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { creatorsApi } from '../lib/api.js'

export default function CreatorProfile() {
  const { handle } = useParams()
  const [searchParams] = useSearchParams()
  const hint = searchParams.get('hint')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [solPrice, setSolPrice] = useState(null)

  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
      .then((r) => r.json())
      .then((d) => setSolPrice(d?.solana?.usd ?? null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    creatorsApi.getProfile(handle, hint)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [handle])

  if (loading) return <LoadingSkeleton handle={handle} />
  if (error) return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-10 bg-bg/90 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src="/favicon.png" alt="Mintlens" className="w-8 h-8 shrink-0" />
            <span className="font-mono font-bold text-gradient hidden sm:block">MINTLENS</span>
          </Link>
          <span className="text-border">|</span>
          <span className="text-sm text-text-muted font-mono truncate">@{handle}</span>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-16 flex items-center justify-center">
        <div className="card p-8 text-center space-y-4 max-w-md w-full">
          <p className="text-red-400 text-sm">{error}</p>
          <Link to="/" className="btn-ghost text-sm">← Back to Feed</Link>
        </div>
      </main>
    </div>
  )

  const { wallet, pfp, stats = {}, tokens = [] } = data
  const totalFeesUsd = stats.totalFeesSol != null && solPrice != null
    ? formatUsd(stats.totalFeesSol * solPrice)
    : stats.totalFeesSol != null
    ? `${Number(stats.totalFeesSol).toFixed(2)} SOL`
    : '—'

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-10 bg-bg/90 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src="/favicon.png" alt="Mintlens" className="w-8 h-8 shrink-0" />
            <span className="font-mono font-bold text-gradient hidden sm:block">MINTLENS</span>
          </Link>
          <span className="text-border">|</span>
          <span className="text-sm text-text-muted font-mono truncate">@{handle}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Creator header card */}
        <div className="card p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
          {/* Avatar */}
          <div
            className="w-16 h-16 rounded-full shrink-0 overflow-hidden flex items-center justify-center"
            style={{ backgroundColor: 'rgba(132,204,22,0.15)' }}
          >
            {pfp ? (
              <img
                src={pfp}
                alt={handle}
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            ) : (
              <span className="font-mono font-bold text-2xl" style={{ color: '#84CC16' }}>
                {handle[0].toUpperCase()}
              </span>
            )}
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-text-primary">@{handle}</h1>
            {wallet && (
              <p className="font-mono text-xs text-text-muted mt-1">
                {wallet.slice(0, 6)}…{wallet.slice(-4)}
              </p>
            )}
            <a
              href={`https://bags.fm/${handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs mt-2 font-medium transition-colors"
              style={{ color: '#84CC16' }}
            >
              View on Bags.fm
              <ExternalLinkIcon />
            </a>
          </div>

          {/* Total fees */}
          <div className="sm:text-right sm:shrink-0 mt-1 sm:mt-0">
            <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Total Fees</div>
            <div className="font-mono text-xl font-bold" style={{ color: '#84CC16' }}>
              {totalFeesUsd}
            </div>
            {stats.totalFeesSol != null && solPrice != null && (
              <div className="text-xs text-text-muted font-mono mt-0.5">
                {Number(stats.totalFeesSol).toFixed(2)} SOL
              </div>
            )}
          </div>
        </div>

        {/* Token list */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-text-primary">
              Tokens Launched
              <span className="text-sm font-normal text-text-muted ml-2">({tokens.length})</span>
            </h2>
            {stats.avgScore != null && (
              <span className="text-xs text-text-muted">
                Avg score:{' '}
                <span
                  className="font-mono font-semibold"
                  style={{ color: stats.avgScore >= 70 ? '#84CC16' : stats.avgScore >= 40 ? '#FFB800' : '#FF4757' }}
                >
                  {stats.avgScore}
                </span>
              </span>
            )}
          </div>

          {tokens.length === 0 ? (
            <div className="card p-8 text-center text-text-muted">No tokens found.</div>
          ) : (
            <div className="card overflow-hidden divide-y divide-border">
              {tokens.map((t, i) => (
                <TokenRow key={t.mint || i} token={t} solPrice={solPrice} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function TokenRow({ token, solPrice }) {
  const { mint, metadata = {}, lifetimeFees, creator, score } = token
  const feesSol = lifetimeFees?.totalFees ?? lifetimeFees?.total ?? null
  const feesDisplay = feesSol != null && solPrice != null
    ? formatUsd(feesSol * solPrice)
    : feesSol != null
    ? `${Number(feesSol).toFixed(2)} SOL`
    : '—'
  const scoreColor = score != null
    ? score >= 70 ? '#84CC16' : score >= 40 ? '#FFB800' : '#FF4757'
    : null

  return (
    <Link
      to={`/token/${mint}`}
      className="flex items-center gap-3 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4 hover:bg-surface/50 transition-colors"
    >
      {/* Logo */}
      <div
        className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center overflow-hidden text-xs font-bold"
        style={{ backgroundColor: 'rgba(132,204,22,0.15)', color: '#84CC16' }}
      >
        {metadata.logoURI ? (
          <img
            src={metadata.logoURI}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          (metadata.symbol || '?')[0].toUpperCase()
        )}
      </div>

      {/* Name + symbol + mint */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-text-primary truncate">
            {metadata.name || `${mint?.slice(0, 8)}…`}
          </span>
          {metadata.symbol && (
            <span className="text-xs text-text-muted font-mono shrink-0">{metadata.symbol}</span>
          )}
          {creator?.isCreator ? (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full shrink-0"
              style={{ backgroundColor: 'rgba(132,204,22,0.15)', color: '#84CC16' }}
            >
              Creator
            </span>
          ) : (
            <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0 border border-border text-text-muted">
              Fee Share
            </span>
          )}
        </div>
        <div className="text-xs text-text-muted font-mono mt-0.5">
          {mint ? `${mint.slice(0, 6)}…${mint.slice(-4)}` : '—'}
        </div>
      </div>

      {/* Fees */}
      <div className="text-right shrink-0">
        <div className="text-sm font-mono font-semibold" style={{ color: '#84CC16' }}>
          {feesDisplay}
        </div>
        {feesSol != null && solPrice != null && (
          <div className="text-xs font-mono text-text-muted">{Number(feesSol).toFixed(2)} SOL</div>
        )}
      </div>

      {/* Score */}
      <div className="w-10 text-right shrink-0">
        {score != null ? (
          <span className="font-mono text-sm font-bold" style={{ color: scoreColor }}>{score}</span>
        ) : (
          <span className="text-text-muted text-xs">—</span>
        )}
      </div>
    </Link>
  )
}

function formatUsd(n) {
  const val = Number(n)
  if (isNaN(val)) return '—'
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function ExternalLinkIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

function LoadingSkeleton({ handle }) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-10 bg-bg/90 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src="/favicon.png" alt="Mintlens" className="w-8 h-8 shrink-0" />
            <span className="font-mono font-bold text-gradient hidden sm:block">MINTLENS</span>
          </Link>
          {handle && <>
            <span className="text-border">|</span>
            <span className="text-sm text-text-muted font-mono truncate">@{handle}</span>
          </>}
        </div>
      </header>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-pulse">
        <div className="card p-6 h-28 skeleton rounded-xl" />
        <div className="card overflow-hidden divide-y divide-border">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="w-9 h-9 rounded-full skeleton shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 skeleton rounded" />
                <div className="h-3 w-24 skeleton rounded" />
              </div>
              <div className="h-4 w-16 skeleton rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
