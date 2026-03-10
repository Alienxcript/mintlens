import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useTokenData } from '../hooks/useTokenData.js'
import { useAnalysis } from '../hooks/useAnalysis.js'
import { skillApi } from '../lib/api.js'
import MetricsDashboard from '../components/MetricsDashboard.jsx'
import FeeShareholdersList from '../components/FeeShareholdersList.jsx'
import AnalysisReport from '../components/AnalysisReport.jsx'
import FollowUpChat from '../components/FollowUpChat.jsx'
import ShareCard from '../components/ShareCard.jsx'
import WatchlistButton from '../components/WatchlistButton.jsx'

export default function TokenReport() {
  const { mint } = useParams()
  const navigate = useNavigate()
  const { data: tokenData, loading: tokenLoading, error: tokenError } = useTokenData(mint)
  const { result: analysisResult, loading: analysisLoading, error: analysisError, analyze } = useAnalysis(mint)
  const [showShareCard, setShowShareCard] = useState(false)
  const [exportingSkill, setExportingSkill] = useState(false)
  const [searchVal, setSearchVal] = useState('')

  function handleSearch(e) {
    e.preventDefault()
    const val = searchVal.trim()
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(val)) {
      setSearchVal('')
      navigate(`/token/${val}`)
    }
  }

  useEffect(() => {
    if (tokenData && !analysisResult && !analysisLoading) {
      analyze(tokenData)
    }
  }, [tokenData])

  async function downloadSkill() {
    setExportingSkill(true)
    try {
      const res = await skillApi.generate({ verbosity: 'detailed', focus: 'balanced' })
      const blob = typeof res === 'string'
        ? new Blob([res], { type: 'text/markdown' })
        : new Blob([JSON.stringify(res)], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'SKILL.md'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(`Could not generate SKILL.md: ${err.message}`)
    } finally {
      setExportingSkill(false)
    }
  }

  const report = analysisResult?.report
  const metadata = tokenData?.metadata || {}
  const holders = tokenData?.holders || {}
  const creators = tokenData?.creators || []
  const claimStats = tokenData?.claimStats || []
  const lifetimeFees = tokenData?.lifetimeFees
  const pool = tokenData?.pool
  const tokenContext = report
    ? { mint, name: metadata.name, symbol: metadata.symbol, score: report.score, verdict: report.verdict }
    : null

  const topSignal = report?.redFlags?.[0]
    ? { text: report.redFlags[0], type: 'red' }
    : report?.greenFlags?.[0]
    ? { text: report.greenFlags[0], type: 'green' }
    : null

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border" style={{ backgroundColor: '#0A0A0F' }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src="/favicon.png" alt="Mintlens" className="w-8 h-8 shrink-0" />
            <span className="font-mono font-bold text-gradient hidden sm:block">MINTLENS</span>
          </Link>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex-1 flex gap-2 max-w-md">
            <input
              className="flex-1 bg-surface border border-border rounded-xl px-4 py-1.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-primary transition-colors font-mono"
              placeholder="Mint address or symbol…"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
            />
            <button type="submit" className="btn-primary px-4 py-1.5 text-sm shrink-0">
              Go
            </button>
          </form>

          <div className="flex items-center gap-2 shrink-0">
            <WatchlistButton mint={mint} name={metadata.name} />
            <button onClick={() => setShowShareCard((s) => !s)} className="btn-ghost text-sm hidden lg:block">
              Share
            </button>
            <button onClick={() => shareOnX({ mint, metadata, report, lifetimeFees })} className="btn-ghost text-sm hidden sm:block">
              Share on X
            </button>
            <button
              onClick={downloadSkill}
              disabled={exportingSkill}
              className="btn-ghost text-sm disabled:opacity-50 hidden lg:block"
            >
              {exportingSkill ? '…' : 'Export Skill'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6">
        {/* Full-page error state when token data fails to load */}
        {tokenError && !tokenData && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="card p-8 max-w-md w-full text-center space-y-4">
              <p className="font-mono text-xs text-text-muted">{truncate(mint)}</p>
              <p className="text-red-400 text-sm">{tokenError}</p>
              <button onClick={() => window.location.reload()} className="btn-primary w-full">
                Retry
              </button>
              <Link to="/" className="block text-sm text-text-muted hover:text-text-primary transition-colors">
                ← Back to Feed
              </Link>
            </div>
          </div>
        )}

        {/* Token title */}
        {tokenLoading ? (
          <div className="h-12 w-64 skeleton rounded-xl" />
        ) : tokenError ? null : (
          <div className="flex items-center gap-3 sm:gap-4">
            {metadata.logoURI && (
              <img src={metadata.logoURI} alt="" className="w-10 h-10 sm:w-14 sm:h-14 rounded-full shrink-0" />
            )}
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-text-primary truncate">
                {metadata.name || truncate(mint)}
              </h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {metadata.symbol && (
                  <span className="text-text-muted font-mono text-sm">{metadata.symbol}</span>
                )}
                <a
                  href={`https://bags.fm/${mint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm flex items-center gap-1 transition-colors font-medium"
                  style={{ color: '#84CC16' }}
                >
                  View on Bags.fm
                  <ExternalLinkIcon />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Everything below is hidden when token data completely failed */}
        {/* Share card modal */}
        {!tokenError && showShareCard && (
          <ShareCardModal onClose={() => setShowShareCard(false)}>
            <ShareCard
              token={{ name: metadata.name, symbol: metadata.symbol, mint }}
              score={report?.score}
              verdict={report?.verdict}
              stats={{
                fees: tokenData?.lifetimeFees?.totalFees,
                holders: holders.totalHolders,
                volume: pool?.volume24h,
              }}
              topSignal={topSignal}
            />
          </ShareCardModal>
        )}

        {/* Metrics dashboard — 8 tiles */}
        {(tokenError && !tokenData) ? null : tokenLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-20 skeleton rounded-xl" />
            ))}
          </div>
        ) : (
          <MetricsDashboard
            metadata={metadata}
            holders={holders}
            lifetimeFees={lifetimeFees}
            creators={creators}
            mint={mint}
            launchDate={
              metadata?.createdAt ||
              (() => {
                const txs = tokenData?.transactions
                if (!txs?.length) return null
                const oldest = txs[txs.length - 1]?.timestamp
                return oldest ? new Date(oldest * 1000).toISOString() : null
              })()
            }
          />
        )}

        {/* Analysis + Fee Shareholders — two columns */}
        {(tokenError && !tokenData) ? null : <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
          {/* Left: Claude Analysis */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-text-primary">Claude Analysis</h2>
              {analysisResult?.cached && (
                <Clock
                  size={14}
                  title="Analysis cached · updates every 10 min"
                  className="text-text-muted cursor-help"
                />
              )}
            </div>
            {analysisLoading ? (
              <AnalysisSkeleton />
            ) : analysisError ? (
              <ErrorBanner message={analysisError} />
            ) : report ? (
              <AnalysisReport report={report} />
            ) : null}
          </section>

          {/* Right: Fee Shareholders */}
          {!tokenLoading && creators.length > 0 && (
            <FeeShareholdersList
              creators={creators}
              claimStats={claimStats}
              lifetimeFees={lifetimeFees}
              mint={mint}
            />
          )}
        </div>}

        {/* Follow-up chat */}
        {!(tokenError && !tokenData) && (report || analysisError) && (
          <FollowUpChat mint={mint} tokenContext={tokenContext} />
        )}
      </main>
    </div>
  )
}

function AnalysisSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="card p-6">
        <div className="flex gap-6 items-center">
          <div className="w-28 h-24 skeleton rounded-xl shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-4 w-3/4 skeleton rounded" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-3 skeleton rounded" />)}
            </div>
          </div>
        </div>
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-12 skeleton rounded-xl" />
      ))}
    </div>
  )
}

function ErrorBanner({ message }) {
  return (
    <div className="card p-4 border-red-500/30 bg-red-500/10 text-red-400 text-sm">
      {message}
    </div>
  )
}

function ExternalLinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

function shareOnX({ mint, metadata, report, lifetimeFees }) {
  const name = metadata?.name || 'Token'
  const symbol = metadata?.symbol ? ` ($${metadata.symbol})` : ''
  const score = report?.score
  const verdict = report?.verdict ? report.verdict.slice(0, 80) : null
  const fees = lifetimeFees?.totalFees != null ? `${Number(lifetimeFees.totalFees).toFixed(2)} SOL` : null
  const emoji = score >= 70 ? '🟢' : score >= 40 ? '🟡' : score != null ? '🔴' : ''

  const lines = [
    `${name}${symbol} — Mintlens Score: ${score != null ? `${score}/100` : '?'}`,
    fees ? `Fees: ${fees}` : null,
    verdict ? `${emoji} ${verdict}` : null,
    `https://mintlens-alpha.vercel.app/token/${mint}`,
    `@Mintlens_xyz #Bags #Solana`,
  ].filter(Boolean)

  const text = encodeURIComponent(lines.join('\n'))
  window.open(`https://x.com/intent/tweet?text=${text}`, '_blank', 'noopener,noreferrer')
}

function ShareCardModal({ onClose, children }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="card p-6 w-full max-w-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-text-primary">Share Card</h3>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary leading-none"
            style={{ fontSize: 22, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function truncate(str) {
  if (!str) return '—'
  return `${str.slice(0, 6)}…${str.slice(-4)}`
}
