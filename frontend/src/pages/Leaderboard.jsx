import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { leaderboardApi } from '../lib/api.js'

export default function Leaderboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    leaderboardApi
      .get({ limit: 50 })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const tokens = data?.tokens || []
  const stats = data?.stats || {}

  return (
    <div className="min-h-screen bg-bg">
      {/* Nav */}
      <header className="sticky top-0 z-10 bg-bg/90 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src="/favicon.png" alt="Mintlens" className="w-8 h-8 shrink-0" />
            <span className="text-xl font-mono font-bold text-gradient hidden sm:block">MINTLENS</span>
          </Link>
          <div className="flex-1" />
          <span
            className="text-sm px-3 py-1.5 rounded-lg font-medium"
            style={{ backgroundColor: '#84CC16', color: '#0A0A0F' }}
          >
            Leaderboard
          </span>
          <Link
            to="/wallet"
            className="text-sm px-3 py-1.5 rounded-lg text-text-muted hover:text-text-primary border border-border hover:border-primary transition-all"
          >
            Wallet
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-1">Fee Leaderboard</h1>
          <p className="text-text-muted text-sm">Top Bags.fm tokens by lifetime fees earned</p>
        </div>

        {/* Stats bar — 3 large cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-28 skeleton rounded-xl" />)}
          </div>
        ) : data && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Total Fees Earned"
              value={stats.totalFeesSol != null ? `${stats.totalFeesSol.toFixed(2)} SOL` : '—'}
              accent
            />
            <StatCard
              label="Holders (tracked)"
              value={stats.totalHolders?.toLocaleString() ?? '—'}
              sub="across tracked tokens"
            />
            <StatCard
              label="Tokens Tracked"
              value={stats.sampleSize?.toLocaleString() ?? stats.total?.toLocaleString() ?? '—'}
              sub={stats.totalEcosystem ? `of ${stats.totalEcosystem.toLocaleString()} total` : null}
            />
          </div>
        )}

        {/* Period toggle */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-1 bg-surface border border-border rounded-xl p-1">
            <button
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-[#0A0A0F]"
              style={{ backgroundColor: '#84CC16' }}
            >
              All Time
            </button>
            <button
              disabled
              title="Coming soon"
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-text-muted opacity-40 cursor-not-allowed"
            >
              1D
            </button>
          </div>
          {data?.cached && (
            <span className="text-xs text-text-muted">Cached · refreshes every 5 min</span>
          )}
          {data?.fetchedAt && !data.cached && (
            <span className="text-xs text-text-muted">
              Updated {new Date(data.fetchedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <LeaderboardSkeleton />
        ) : error ? (
          <div className="card p-6 text-red-400 text-sm">{error}</div>
        ) : tokens.length === 0 ? (
          <div className="card p-12 text-center text-text-muted">No data available</div>
        ) : (
          <div className="card overflow-hidden">
            {/* Column headers: mobile = 4 cols (# | Token | Fees | Holders), sm+ = 6 cols */}
            <div className="grid grid-cols-[36px_1fr_80px_60px] sm:grid-cols-[48px_1fr_140px_110px_80px_80px] gap-3 px-4 sm:px-5 py-3 border-b border-border text-xs text-text-muted uppercase tracking-wider">
              <span>#</span>
              <span>Token</span>
              <span className="hidden sm:block">Creator</span>
              <span className="text-right"><span className="sm:hidden">Fees</span><span className="hidden sm:inline">Fees (SOL)</span></span>
              <span className="text-right">Holders</span>
              <span className="hidden sm:block text-right">Score</span>
            </div>

            <div className="divide-y divide-border">
              {tokens.map((token) => (
                <LeaderboardRow key={token.mint} token={token} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function LeaderboardRow({ token }) {
  return (
    <div className="grid grid-cols-[36px_1fr_80px_60px] sm:grid-cols-[48px_1fr_140px_110px_80px_80px] gap-3 items-center px-4 sm:px-5 py-3 sm:py-4 hover:bg-surface/50 transition-colors">
      {/* Rank — medal for top 3 */}
      <span className="text-sm font-mono font-bold text-center">
        {rankDisplay(token.rank)}
      </span>

      {/* Token */}
      <div className="flex items-center gap-3 min-w-0">
        {token.logoURI ? (
          <img
            src={token.logoURI}
            alt=""
            className="w-9 h-9 rounded-full shrink-0 object-cover bg-surface"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <div
            className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: 'rgba(132,204,22,0.15)', color: '#84CC16' }}
          >
            {token.symbol?.slice(0, 2) || '?'}
          </div>
        )}
        <div className="min-w-0">
          <Link
            to={`/token/${token.mint}`}
            className="text-sm font-semibold text-text-primary hover:text-primary transition-colors truncate block"
          >
            {token.name || truncate(token.mint)}
          </Link>
          {token.symbol && (
            <span className="text-xs text-text-muted font-mono">{token.symbol}</span>
          )}
        </div>
      </div>

      {/* Creator — hidden on mobile */}
      <div className="min-w-0 hidden sm:block">
        {token.creator?.handle ? (
          <Link
            to={`/creator/${token.creator.handle}`}
            className="text-sm text-text-muted hover:text-primary transition-colors truncate block"
          >
            @{token.creator.handle}
          </Link>
        ) : (
          <span className="text-sm text-text-muted">—</span>
        )}
        {token.creator?.provider && (
          <span className="text-xs text-text-muted capitalize">{token.creator.provider}</span>
        )}
      </div>

      {/* Fees */}
      <div className="text-right">
        <span className="text-sm font-mono font-semibold" style={{ color: '#84CC16' }}>
          {token.lifetimeFeesSol > 0 ? token.lifetimeFeesSol.toFixed(4) : '0.0000'}
        </span>
      </div>

      {/* Holders */}
      <div className="text-right">
        <span className="text-sm font-mono text-text-muted">
          {token.holders != null ? token.holders.toLocaleString() : '—'}
        </span>
      </div>

      {/* Score — hidden on mobile */}
      <div className="text-right hidden sm:block">
        {token.score != null ? (
          <span
            className="text-sm font-mono font-semibold"
            style={{ color: token.score >= 70 ? '#84CC16' : token.score >= 40 ? '#FFB800' : '#FF4757' }}
          >
            {token.score}
          </span>
        ) : (
          <Link
            to={`/token/${token.mint}`}
            className="text-xs font-mono hover:underline transition-colors"
            style={{ color: '#84CC16' }}
          >
            Analyse →
          </Link>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, accent, sub }) {
  return (
    <div className="card p-5 flex flex-col gap-2">
      <span className="text-xs text-text-muted uppercase tracking-wider">{label}</span>
      <span
        className="font-mono text-2xl font-bold truncate"
        style={{ color: accent ? '#84CC16' : '#F0F0FF' }}
      >
        {value}
      </span>
      {sub && <span className="text-xs text-text-muted">{sub}</span>}
    </div>
  )
}

function LeaderboardSkeleton() {
  return (
    <div className="card overflow-hidden divide-y divide-border">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="grid grid-cols-[36px_1fr_80px_60px] sm:grid-cols-[48px_1fr_140px_110px_80px_80px] gap-3 items-center px-4 sm:px-5 py-3 sm:py-4">
          <div className="w-6 h-4 skeleton rounded" />
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-full skeleton shrink-0" />
            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="h-4 w-24 skeleton rounded" />
              <div className="h-3 w-14 skeleton rounded" />
            </div>
          </div>
          <div className="hidden sm:block h-4 w-20 skeleton rounded" />
          <div className="h-4 w-14 skeleton rounded justify-self-end" />
          <div className="h-4 w-8 skeleton rounded justify-self-end" />
          <div className="hidden sm:block h-4 w-10 skeleton rounded justify-self-end" />
        </div>
      ))}
    </div>
  )
}

function rankDisplay(rank) {
  if (rank === 1) return <Trophy size={16} style={{ color: '#FFB800' }} />
  if (rank === 2) return <span style={{ color: '#C0C0C0', fontWeight: 700 }}>2</span>
  if (rank === 3) return <span style={{ color: '#CD7F32', fontWeight: 700 }}>3</span>
  return <span className="text-text-muted">{rank}</span>
}

function truncate(str) {
  if (!str) return '—'
  return `${str.slice(0, 6)}…${str.slice(-4)}`
}
