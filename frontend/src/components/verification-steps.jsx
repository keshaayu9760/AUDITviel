'use client'

export default function VerificationSteps({ proofHash, onVerificationComplete }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
      Verifying proof {proofHash ? `${proofHash.slice(0, 10)}...` : ''}
      {typeof onVerificationComplete === 'function' ? null : null}
    </div>
  )
}

