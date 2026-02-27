'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity, Clock3, Gauge, RefreshCw, TrendingUp, Zap, CheckCircle2, AlertTriangle
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid, Tooltip as RechartsTooltip, XAxis, YAxis
} from 'recharts'
import { GlassCard } from '@/components/ui/glass-card'

function resolveBackendBaseUrl() {
  const raw = (process.env.NEXT_PUBLIC_BACKEND_URL || '').trim()
  const invalid = !raw || raw === 'undefined' || raw === 'null'
  if (!invalid) return raw.replace(/\/+$/, '')
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
  return 'http://localhost:10000'
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchMetrics = async () => {
    setLoading(true)
    setError(null)
    try {
      const base = resolveBackendBaseUrl()
      const candidates = [`${base}/metrics`, `${base}/api/metrics`]
      let data = null
      let responseStatus = null
      let retryAfterSeconds = null

      for (const url of candidates) {
        try {
          const res = await fetch(url, { cache: 'no-store' })
          responseStatus = res.status
          if (res.status === 429) {
            const header = res.headers.get('retry-after')
            const parsed = header ? Number(header) : NaN
            retryAfterSeconds = Number.isFinite(parsed) ? parsed : null
          }
          if (res.ok) {
            data = await res.json()
            break
          }
        } catch (_err) {
          // Try next candidate path.
        }
      }

      if (!data) {
        if (responseStatus === 429) {
          throw new Error(`Rate limited. Please retry in ${retryAfterSeconds || 30}s`)
        }
        throw new Error(`Failed to fetch metrics (${responseStatus ?? 'network error'})`)
      }

      setMetrics(data)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Metrics fetch failed', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 30000)
    return () => clearInterval(interval)
  }, [])

  const proofTrend = useMemo(() => {
    if (!metrics?.proofVerification?.recent) return []
    return metrics.proofVerification.recent.map((item) => ({
      timestamp: new Date(item.timestamp || Date.now()).toLocaleTimeString(),
      gas: Number(item.gasUsed || 0),
      latency: Number(item.latencyMs || 0)
    }))
  }, [metrics])

  const generationTrend = useMemo(() => {
    if (!metrics?.proofGeneration?.recent) return []
    return metrics.proofGeneration.recent.map((item) => ({
      timestamp: new Date(item.timestamp || Date.now()).toLocaleTimeString(),
      duration: Number(item.durationMs || 0)
    }))
  }, [metrics])

  const summaryCards = useMemo(() => {
    if (!metrics?.summary) return []
    return [
      { title: 'Proof Time', value: `${metrics.summary.proof_time_ms || 0}ms`, icon: Clock3 },
      { title: 'Verify Gas', value: metrics.summary.verify_gas ? `${metrics.summary.verify_gas}` : '0', icon: Gauge },
      { title: 'Success Rate', value: `${metrics.summary.success_rate || 0}%`, icon: CheckCircle2 },
    ]
  }, [metrics])

  return (
    <div className="space-y-6">
      {/* Header — left-aligned with refresh */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Network Metrics</h1>
          <p className="text-sm text-white/40 mt-1">Live instrumentation — proof latency, gas costs, system health</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[11px] text-white/20">
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/40 bg-white/[0.03] border border-white/[0.06] rounded-lg hover:text-white/70 hover:border-white/10 disabled:opacity-30 transition-all"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          <span className="text-xs text-red-300/70">{error}</span>
        </div>
      )}

      {/* Tight 3-col stat cards (previously had icons and descriptions, now compact) */}
      <div className="grid grid-cols-3 gap-3">
        {summaryCards.map((card, i) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-3.5 h-3.5 text-white/20" />
                <span className="text-[11px] text-white/30 uppercase tracking-wider">{card.title}</span>
              </div>
              <div className="text-2xl font-bold text-white">{card.value}</div>
            </motion.div>
          )
        })}
      </div>

      {/* 2-col chart grid */}
      <div className="grid md:grid-cols-2 gap-4">
        <GlassCard className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Proof Generation</h2>
              <p className="text-[11px] text-white/25 mt-0.5">Median latency across recent events</p>
            </div>
            <Zap className="w-4 h-4 text-white/10" />
          </div>
          <div className="h-48">
            {generationTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={generationTrend}>
                  <defs>
                    <linearGradient id="colorDuration" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#b06a3d" stopOpacity={0.38} />
                      <stop offset="95%" stopColor="#b06a3d" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(78, 94, 112, 0.18)" />
                  <XAxis dataKey="timestamp" stroke="rgba(78, 94, 112, 0.45)" tick={{ fill: '#4e5e70', fontSize: 10 }} />
                  <YAxis stroke="rgba(78, 94, 112, 0.45)" tick={{ fill: '#4e5e70', fontSize: 10 }} />
                  <RechartsTooltip content={<ChartTooltip label="Duration" unit="ms" />} />
                  <Area type="monotone" dataKey="duration" stroke="#8a4f2a" strokeWidth={2.2} dot={{ r: 2.5, fill: '#8a4f2a' }} activeDot={{ r: 4 }} fillOpacity={1} fill="url(#colorDuration)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={Clock3} message="Waiting for proof events" />
            )}
          </div>
        </GlassCard>

        <GlassCard className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Verification Gas</h2>
              <p className="text-[11px] text-white/25 mt-0.5">Gas usage across verification calls</p>
            </div>
            <Activity className="w-4 h-4 text-white/10" />
          </div>
          <div className="h-48">
            {proofTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={proofTrend}>
                  <defs>
                    <linearGradient id="colorGas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2f7a62" stopOpacity={0.36} />
                      <stop offset="95%" stopColor="#2f7a62" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(78, 94, 112, 0.18)" />
                  <XAxis dataKey="timestamp" stroke="rgba(78, 94, 112, 0.45)" tick={{ fill: '#4e5e70', fontSize: 10 }} />
                  <YAxis stroke="rgba(78, 94, 112, 0.45)" tick={{ fill: '#4e5e70', fontSize: 10 }} />
                  <RechartsTooltip content={<ChartTooltip label="Gas" unit="gas" />} />
                  <Area type="monotone" dataKey="gas" stroke="#1e5e49" strokeWidth={2.2} dot={{ r: 2.5, fill: '#1e5e49' }} activeDot={{ r: 4 }} fillOpacity={1} fill="url(#colorGas)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={Gauge} message="Waiting for verification events" />
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}

function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null
  const data = payload[0]
  return (
    <div className="px-3 py-2 bg-black/95 border border-white/10 rounded-md text-xs text-white/70">
      <div className="font-semibold text-white">{label}</div>
      <div className="flex items-center justify-between gap-6 pt-1">
        <span>{data.payload.timestamp}</span>
        <span className="font-mono text-white">{Number(data.value).toFixed(0)} {unit}</span>
      </div>
    </div>
  )
}

function EmptyState({ icon: Icon = Clock3, message }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <Icon className="w-6 h-6 text-white/10 mb-2" />
      <p className="text-xs text-white/25">{message}</p>
    </div>
  )
}
