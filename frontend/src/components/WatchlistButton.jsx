import { useState, useEffect } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { watchlistApi } from '../lib/api.js'

/**
 * Props: mint (string), name (string)
 */
export default function WatchlistButton({ mint, name }) {
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Check local storage for optimistic state
    const list = JSON.parse(localStorage.getItem('mintlens_watchlist') || '[]')
    setSaved(list.includes(mint))
  }, [mint])

  async function toggle() {
    if (loading) return
    setLoading(true)
    try {
      if (!saved) {
        await watchlistApi.add({ type: 'token', mint, name })
        const list = JSON.parse(localStorage.getItem('mintlens_watchlist') || '[]')
        localStorage.setItem('mintlens_watchlist', JSON.stringify([...list, mint]))
        setSaved(true)
      } else {
        // Remove from local store (API doesn't have DELETE yet)
        const list = JSON.parse(localStorage.getItem('mintlens_watchlist') || '[]')
        localStorage.setItem('mintlens_watchlist', JSON.stringify(list.filter((m) => m !== mint)))
        setSaved(false)
      }
    } catch (err) {
      console.error('Watchlist error:', err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`btn-ghost text-sm flex items-center gap-2 ${saved ? 'border-primary text-primary' : ''}`}
    >
      {saved ? <><Eye size={14} /> Watching</> : <><EyeOff size={14} /> Watch</>}
    </button>
  )
}
