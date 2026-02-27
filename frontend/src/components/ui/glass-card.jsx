export function GlassCard({ children, className = '' }) {
  return (
    <div className={`rounded-xl border border-white/10 bg-black/20 backdrop-blur-sm ${className}`}>
      {children}
    </div>
  )
}

