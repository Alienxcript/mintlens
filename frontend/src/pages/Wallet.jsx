import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet as WalletIcon } from 'lucide-react'
import ScoreBadge from '../components/ScoreBadge.jsx'

/**
 * Wallet page — shows connected wallet's Bags holdings with scores.
 * Uses Privy for wallet connection (stub if PRIVY_APP_ID not configured).
 */
export default function Wallet() {
  const [connected, setConnected] = useState(false)
  const [address, setAddress] = useState(null)

  // Privy integration placeholder — swap with usePrivy() when PRIVY_APP_ID configured
  function connect() {
    // Stub connection — in production replace with Privy hook
    const stubAddress = 'DemoWa11etAddressForMintLensDev1111111111'
    setAddress(stubAddress)
    setConnected(true)
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-10 bg-bg/90 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src="/favicon.png" alt="Mintlens" className="w-8 h-8 shrink-0" />
            <span className="font-mono font-bold text-gradient hidden sm:block">MINTLENS</span>
          </Link>
          <div className="flex-1" />
          <Link
            to="/leaderboard"
            className="text-sm px-3 py-1.5 rounded-lg text-text-muted hover:text-text-primary border border-border hover:border-primary transition-all"
          >
            Leaderboard
          </Link>
          <span
            className="text-sm px-3 py-1.5 rounded-lg font-medium"
            style={{ backgroundColor: '#84CC16', color: '#0A0A0F' }}
          >
            Wallet
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-16">
        {!connected ? (
          <div className="card p-12 text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
              <WalletIcon size={28} style={{ color: '#84CC16' }} />
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">Connect Your Wallet</h2>
            <p className="text-text-muted text-sm mb-8">
              See scores for all Bags tokens you hold and get risk alerts.
            </p>
            <button onClick={connect} className="btn-primary w-full">
              Connect Wallet
            </button>
            <p className="text-xs text-text-muted mt-4">
              Powered by <a href="https://privy.io" target="_blank" rel="noopener noreferrer" className="hover:text-text-primary transition-colors">Privy</a>
            </p>
          </div>
        ) : (
          <ConnectedWallet address={address} />
        )}
      </main>
    </div>
  )
}

function ConnectedWallet({ address }) {
  // In production: fetch holdings via Helius getTokenAccounts filtered to Bags tokens
  // and run scores for each
  const stubHoldings = []

  return (
    <div className="space-y-6">
      <div className="card p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          <WalletIcon size={18} style={{ color: '#84CC16' }} />
        </div>
        <div>
          <div className="text-sm text-text-muted">Connected</div>
          <div className="font-mono text-text-primary text-sm">
            {address.slice(0, 6)}…{address.slice(-4)}
          </div>
        </div>
      </div>

      <div className="card p-8 text-center">
        <p className="text-text-muted text-sm">
          Portfolio analysis requires a configured Helius API key to scan holdings.
          Add <span className="font-mono">HELIUS_API_KEY</span> to your <span className="font-mono">backend/.env</span>.
        </p>
      </div>
    </div>
  )
}
