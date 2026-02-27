'use client'

import { useEffect, useState } from 'react'

export default function CredibilityScore({ address, size = 'md', showBreakdown = false }) {
  const [score, setScore] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!address) return
      try {
        const base = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000'
        const res = await fetch(`${base}/api/auditors/${address}/reputation`)
        const data = await res.json()
        if (!cancelled && data?.success) {
          setScore(data.reputation?.credibilityScore ?? data.reputation?.score ?? 0)
        }
      } catch {
        if (!cancelled) setScore(0)
      }
    }
    load()
    return () => { cancelled = true }
  }, [address])

  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm'
  return (
    <div className={`inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 ${textSize}`}>
      Score: {score ?? '...'}
      {showBreakdown ? <span className="ml-2 text-white/40">(reputation)</span> : null}
    </div>
  )
}

