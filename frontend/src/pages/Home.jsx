import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { TrendingUp, AlertTriangle, Bell } from 'lucide-react'
import { tokenApi, alertsApi } from '../lib/api.js'
import TokenCard from '../components/TokenCard.jsx'

const FILTERS = ['All', 'High Score', 'New', 'Flagged']
const REFRESH_INTERVAL = 30_000

export default function Home() {
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [searchInput, setSearchInput] = useState('')
  const [showAlertModal, setShowAlertModal] = useState(false)
  const [noKeys, setNoKeys] = useState(false)
  const navigate = useNavigate()

  const fetchFeed = useCallback(async () => {
    try {
      const data = await tokenApi.getFeed({ limit: 20 })
      if (data.placeholder) setNoKeys(true)
      setTokens(data.tokens || [])
    } catch {
      setTokens([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFeed()
    const id = setInterval(fetchFeed, REFRESH_INTERVAL)
    return () => clearInterval(id)
  }, [fetchFeed])

  function handleSearch(e) {
    e.preventDefault()
    const val = searchInput.trim()
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(val)) {
      navigate(`/token/${val}`)
    }
  }

  const filtered = tokens.filter((t) => {
    if (filter === 'High Score') return (t.score ?? 0) >= 70
    if (filter === 'New') {
      const dateStr = t.createdAt || t.launchDate
      const ms = dateStr ? Date.now() - new Date(dateStr).getTime() : Infinity
      return ms < 24 * 60 * 60 * 1000
    }
    if (filter === 'Flagged') return (t.score ?? 100) < 40
    return true
  })

  const trending = [...tokens].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 6)

  return (
    <div className="min-h-screen bg-bg">
      {/* Sticky nav */}
      <header className="sticky top-0 z-10 bg-[#0A0A0F] border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src="/favicon.png" alt="Mintlens" className="w-8 h-8 shrink-0" />
            <span className="text-xl font-mono font-bold text-gradient hidden sm:block">MINTLENS</span>
          </Link>
          <div className="flex-1" />
          <Link
            to="/leaderboard"
            className="text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 rounded-lg text-text-muted hover:text-text-primary border border-border hover:border-primary transition-all shrink-0"
          >
            Leaderboard
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 70% 60% at 50% -10%, rgba(132,204,22,0.14) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', top: '40%', left: '10%', width: 320, height: 320,
          background: 'radial-gradient(circle, rgba(0,212,170,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div className="max-w-3xl mx-auto px-4 pt-12 sm:pt-20 pb-10 sm:pb-16 text-center relative z-10">
          <div
            className="inline-flex items-center gap-2 border rounded-full px-4 py-1.5 text-xs font-mono mb-6 sm:mb-8 tracking-wider"
            style={{ backgroundColor: 'rgba(132,204,22,0.08)', borderColor: 'rgba(132,204,22,0.25)', color: '#84CC16' }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#84CC16' }} />
            LIVE · Bags.fm Intelligence
          </div>

          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-4 sm:mb-5"
            style={{
              background: 'linear-gradient(135deg, #F0F0FF 30%, #84CC16 65%, #00D4AA 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            See clearly.<br />Buy confidently.
          </h1>

          <p className="text-text-muted text-base sm:text-lg mb-8 sm:mb-10">
            AI-powered intelligence for every Bags.fm token launch
          </p>

          <form onSubmit={handleSearch} className="flex gap-2 w-full max-w-xl mx-auto">
            <input
              className="flex-1 bg-surface border border-border rounded-xl px-5 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-primary transition-colors font-mono shadow-lg"
              placeholder="Paste a token mint address to analyse…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn-primary px-6 py-3 text-sm shrink-0">
              Analyse
            </button>
          </form>

          <p className="text-xs text-text-muted mt-4 font-mono">
            Or browse the live feed below ↓
          </p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 pt-12 pb-8 space-y-10">
        {/* No API keys banner */}
        {noKeys && (
          <div className="rounded-xl p-4 border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 text-sm flex items-center gap-3">
            <AlertTriangle size={16} className="shrink-0" />
            <span>
              Configure <span className="font-mono">BAGS_API_KEY</span> and <span className="font-mono">HELIUS_API_KEY</span> in <span className="font-mono">backend/.env</span> to load live data.
            </span>
          </div>
        )}

        {/* Alert subscribe banner */}
        <div
          className="rounded-xl p-4 border flex flex-wrap items-center justify-between gap-3"
          style={{ borderColor: 'rgba(132,204,22,0.3)', backgroundColor: 'rgba(132,204,22,0.07)' }}
        >
          <p className="text-sm text-text-primary flex items-center gap-2 min-w-0">
            <Bell size={15} className="shrink-0" style={{ color: '#84CC16' }} />
            <span>Get notified when new Bags tokens score above your threshold</span>
          </p>
          <button
            className="btn-primary text-sm shrink-0"
            onClick={() => setShowAlertModal(true)}
          >
            Set Alert
          </button>
        </div>

        {/* Trending */}
        {trending.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <TrendingUp size={18} style={{ color: '#84CC16' }} />
              Trending
              <span className="text-xs text-text-muted font-normal">Highest scored today</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {trending.map((token) => (
                <TokenCard key={token.mint} token={token} />
              ))}
            </div>
          </section>
        )}

        {/* Live Feed */}
        <section>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#84CC16' }} />
              <h2 className="text-lg font-semibold text-text-primary">Live Feed</h2>
              <span className="text-xs text-text-muted">Updates every 30s</span>
            </div>
            {/* Filter tabs */}
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                    filter === f
                      ? 'text-[#0A0A0F] font-medium'
                      : 'text-text-muted hover:text-text-primary border border-border hover:border-primary'
                  }`}
                  style={filter === f ? { backgroundColor: '#84CC16' } : {}}
                >
                  {f === 'Flagged' && <AlertTriangle size={11} />}
                  {f}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <SkeletonGrid count={12} />
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((token) => (
                <TokenCard key={token.mint} token={token} />
              ))}
            </div>
          ) : (
            <EmptyState filter={filter} />
          )}
        </section>
      </main>

      {showAlertModal && <AlertModal onClose={() => setShowAlertModal(false)} />}
    </div>
  )
}

function SkeletonGrid({ count }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4 h-40 skeleton" />
      ))}
    </div>
  )
}

function EmptyState({ filter }) {
  return (
    <div className="card p-12 text-center">
      <p className="text-text-muted">No tokens found{filter !== 'All' ? ` for filter "${filter}"` : ''}.</p>
    </div>
  )
}

function AlertModal({ onClose }) {
  const [threshold, setThreshold] = useState(70)
  const [type, setType] = useState('push')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState(null)
  const [subscribed, setSubscribed] = useState(false)

  async function subscribe() {
    try {
      if (type === 'push') {
        if (!('Notification' in window)) return setStatus('Push notifications not supported in this browser.')
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return setStatus('Notification permission denied.')
        setStatus('Push subscription saved! (Service worker setup needed for production.)')
        setSubscribed(true)
      } else {
        if (!email) return setStatus('Please enter your email.')
        await alertsApi.subscribe({ type: 'email', threshold, email })
        setStatus('Email alert saved! You will be notified when tokens exceed your threshold.')
        setSubscribed(true)
      }
    } catch (err) {
      setStatus(`Error: ${err.message}`)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-text-primary">Launch Alerts</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xl">×</button>
        </div>

        <div>
          <label className="text-sm text-text-muted mb-2 block">
            Notify me when score ≥ <span className="font-mono" style={{ color: '#84CC16' }}>{threshold}</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-text-muted mt-1">
            <span>0</span><span>50</span><span>100</span>
          </div>
        </div>

        <div className="flex gap-2">
          {['push', 'email'].map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 py-2 rounded-xl text-sm border transition-all ${
                type === t
                  ? 'text-[#0A0A0F] font-medium'
                  : 'border-border text-text-muted'
              }`}
              style={type === t ? { borderColor: '#84CC16', backgroundColor: '#84CC16' } : {}}
            >
              {t === 'push' ? 'Browser Push' : 'Email'}
            </button>
          ))}
        </div>

        {type === 'email' && (
          <input
            className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-primary"
            placeholder="your@email.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}

        {status && <p className="text-sm" style={{ color: '#84CC16' }}>{status}</p>}

        <button
          onClick={subscribe}
          disabled={subscribed}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {subscribed ? 'Subscribed ✓' : 'Subscribe'}
        </button>
      </div>
    </div>
  )
}
