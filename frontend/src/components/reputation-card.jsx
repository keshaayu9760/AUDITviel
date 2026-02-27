'use client'

import { useEffect, useState } from 'react'
import { GlassCard } from '@/components/ui/glass-card'

export default function ReputationCard({ address }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!address) return
      try {
        const base = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000'
        const res = await fetch(`${base}/api/auditors/${address}/reputation`)
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch {
        if (!cancelled) setData(null)
      }
    }
    load()
    return () => { cancelled = true }
  }, [address])

  return (
    <GlassCard className="p-5">
      <h3 className="text-white font-semibold mb-2">Reputation Snapshot</h3>
      <pre className="text-xs text-white/60 overflow-auto">{JSON.stringify(data, null, 2)}</pre>
    </GlassCard>
  )
}

