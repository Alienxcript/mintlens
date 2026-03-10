import { Link } from 'react-router-dom'
import ScoreBadge from './ScoreBadge.jsx'

/**
 * Compact card for the feed.
 * Props: token { mint, metadata, score, verdict, lifetimeFees, holders, pool, createdAt }
 */
export default function TokenCard({ token }) {
  const { mint, metadata = {}, score, verdict, lifetimeFees, holders, pool } = token

  const borderColor =
    score >= 70 ? '#84CC16' : score >= 40 ? '#FFB800' : score != null ? '#FF4757' : '#1E1E2E'

  const age = token.createdAt
    ? formatAge(new Date(token.createdAt))
    : token.launchDate
    ? formatAge(new Date(token.launchDate))
    : null

  const fees = lifetimeFees?.totalFees ?? lifetimeFees?.total ?? null
  const holderCount = holders?.totalHolders ?? null

  return (
    <Link
      to={`/token/${mint}`}
      className="block card hover:border-primary transition-all duration-200 hover:-translate-y-0.5"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <TokenLogo uri={metadata.logoURI} name={metadata.name} size={40} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-text-primary truncate">
                  {metadata.name || truncateMint(mint)}
                </span>
                {metadata.symbol && (
                  <span className="text-xs text-text-muted font-mono shrink-0">
                    {metadata.symbol}
                  </span>
                )}
              </div>
              {age && <div className="text-xs text-text-muted mt-0.5">{age}</div>}
            </div>
          </div>
          {score != null && <ScoreBadge score={score} size="sm" />}
        </div>

        {/* Verdict */}
        {verdict && (
          <p className="text-sm text-text-muted italic mb-3 line-clamp-2">{verdict}</p>
        )}

        {/* Micro stats */}
        <div className="grid grid-cols-2 gap-2">
          <MicroStat label="Fees" value={fees != null ? formatSol(fees) : '—'} />
          <MicroStat label="Holders" value={holderCount != null ? holderCount.toLocaleString() : '—'} />
        </div>
      </div>
    </Link>
  )
}

function MicroStat({ label, value }) {
  return (
    <div className="bg-bg rounded-lg p-2 text-center">
      <div className="text-xs text-text-muted mb-0.5">{label}</div>
      <div className="font-mono text-xs text-text-primary font-medium">{value}</div>
    </div>
  )
}

function TokenLogo({ uri, name, size }) {
  if (uri) {
    return (
      <img
        src={uri}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
        onError={(e) => {
          e.target.style.display = 'none'
          e.target.nextSibling.style.display = 'flex'
        }}
      />
    )
  }
  return <GeneratedAvatar name={name} size={size} />
}

function GeneratedAvatar({ name, size }) {
  const colors = ['#84CC16', '#00D4AA', '#FFB800', '#FF4757', '#4ECDC4']
  const idx = (name?.charCodeAt(0) || 0) % colors.length
  const bg = colors[idx]
  const letter = (name || '?')[0].toUpperCase()
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"DM Mono", monospace',
        fontWeight: 700,
        fontSize: size * 0.4,
        color: '#0A0A0F',
        flexShrink: 0,
      }}
    >
      {letter}
    </div>
  )
}

function truncateMint(mint) {
  if (!mint) return '—'
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`
}

function formatAge(date) {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatSol(val) {
  const n = Number(val)
  if (isNaN(n)) return '—'
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k SOL`
  return `${n.toFixed(2)} SOL`
}

