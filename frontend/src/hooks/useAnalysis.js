import { useState, useCallback } from 'react'
import { analysisApi } from '../lib/api.js'

export function useAnalysis(mint) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const analyze = useCallback(async (tokenData) => {
    if (!mint) return
    setLoading(true)
    setError(null)
    try {
      const data = await analysisApi.analyze(mint, tokenData)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [mint])

  return { result, loading, error, analyze }
}
