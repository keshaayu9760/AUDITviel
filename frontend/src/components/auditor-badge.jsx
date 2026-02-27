export default function AuditorBadge({ address, showScore = false, size = 'md' }) {
  if (!address) return null
  const compact = `${address.slice(0, 6)}...${address.slice(-4)}`
  const pad = size === 'sm' ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1 text-xs'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 text-white/70 ${pad}`}>
      Auditor {compact}{showScore ? ' • Trusted' : ''}
    </span>
  )
}

