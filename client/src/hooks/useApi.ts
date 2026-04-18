import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'

export function useApi<T>(url: string | null, params?: Record<string, any>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!url) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(url, { params })
      setData(res.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }, [url, JSON.stringify(params)])

  useEffect(() => { fetch() }, [fetch])
  return { data, loading, error, refetch: fetch }
}
