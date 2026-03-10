import { useState, useEffect } from 'react'
import { tokenApi } from '../lib/api.js'

export function useTokenData(mint) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!mint) return
    setLoading(true)
    setError(null)
    tokenApi.getToken(mint)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [mint])

  return { data, loading, error }
}
