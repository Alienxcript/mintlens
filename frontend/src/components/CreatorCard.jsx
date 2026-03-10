import { Link } from 'react-router-dom'

/**
 * Props: creator { handle, provider, pfp, wallet, stats: { totalTokens, totalFees, avgScore } }
 */
export default function CreatorCard({ creator }) {
  const { handle, provider, pfp, wallet, stats = {} } = creator

  return (
    <Link to={`/creator/${handle}`} className="block card hover:border-primary p-4 transition-all">
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-border flex items-center justify-center">
          {pfp ? (
            <img src={pfp} alt={handle} className="w-full h-full object-cover" />
          ) : (
            <span className="font-mono font-bold text-primary text-lg">
              {(handle || '?')[0].toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-text-primary">@{handle}</span>
            {provider && (
              <span className="text-xs bg-surface border border-border px-2 py-0.5 rounded-full text-text-muted capitalize">
                {provider}
              </span>
            )}
          </div>
          {wallet && (
            <div className="text-xs font-mono text-text-muted mt-0.5">
              {wallet.slice(0, 6)}…{wallet.slice(-4)}
            </div>
          )}
        </div>
      </div>
      {(stats.totalTokens != null || stats.totalFees != null) && (
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="text-center">
            <div className="text-xs text-text-muted">Tokens</div>
            <div className="font-mono font-medium text-text-primary">{stats.totalTokens ?? '—'}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-text-muted">Total Fees</div>
            <div className="font-mono font-medium text-score-green">
              {stats.totalFees != null ? `${Number(stats.totalFees).toFixed(1)} SOL` : '—'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-text-muted">Avg Score</div>
            <div className="font-mono font-medium text-primary">{stats.avgScore ?? '—'}</div>
          </div>
        </div>
      )}
    </Link>
  )
}
