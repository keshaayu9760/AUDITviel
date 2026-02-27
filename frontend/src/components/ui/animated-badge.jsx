export function AnimatedBadge({ status = 'pending', className = '' }) {
  const styles = status === 'verified'
    ? 'bg-green-500/15 text-green-300 border-green-500/30'
    : status === 'unverified'
      ? 'bg-red-500/15 text-red-300 border-red-500/30'
      : 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'

  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${styles} ${className}`}>{status}</span>
}

