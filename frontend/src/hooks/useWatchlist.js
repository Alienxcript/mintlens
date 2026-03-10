import { useState, useEffect } from 'react'
import { watchlistApi } from '../lib/api.js'

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    watchlistApi.get()
      .then((data) => setWatchlist(data.watchlist || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return { watchlist, loading }
}
