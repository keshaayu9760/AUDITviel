"use client"

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import confetti from 'canvas-confetti'
import { GlassCard } from '@/components/ui/glass-card'
import { GradientButton } from '@/components/ui/gradient-button'
import { AnimatedBadge } from '@/components/ui/animated-badge'
import { Lock, Send, CheckCircle, FileKey, Sparkles, ArrowLeft, ExternalLink } from 'lucide-react'

const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://amoy.polygonscan.com'

export default function ProjectPage() {
  const { address } = useAccount()
  const [credential, setCredential] = useState(null)
  const [proof, setProof] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [verified, setVerified] = useState(false)
  const [txResult, setTxResult] = useState(null)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    const cached = localStorage.getItem('auditviel:lastCredential')
    if (cached) { setCredential(JSON.parse(cached)); setCurrentStep(1) }
  }, [])

  function getAdminAuthHeaders() {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('auditviel:adminToken') : null
    if (!token) throw new Error('Admin authentication required. Please login in Admin dashboard first.')
    return { Authorization: `Bearer ${token}` }
  }

  async function handleGenerateProof() {
    if (!credential) { toast.error('No credential found.'); return }
    setIsGenerating(true)
    try {
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000'
      const authHeaders = getAdminAuthHeaders()
      const r = await fetch(`${BACKEND_URL}/api/proofs/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ credentialId: credential.credential_id || credential.id })
      })

      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}))
        throw new Error(errorData?.details || errorData?.reason || errorData?.error || `Proof generation failed (${r.status})`)
      }

      const data = await r.json()
      const p = {
        proofId: data.proofId,
        credentialId: data.credentialId || credential.credential_id || credential.id,
        project: data.project,
        auditor: data.auditor,
        status: data.status,
        credential,
        valid: data.success !== false,
        generatedAt: Date.now(),
        proofType: data.proofType,
        zkProofAvailable: data.zkProofAvailable
      }

      setProof(p)
      setCurrentStep(2)
      toast.success('Zero-knowledge proof generated!')
    } catch (e) {
      console.error(e)
      toast.error(`Failed to generate proof: ${e.message}`)
    } finally {
      setIsGenerating(false)
    }
  }
  async function handleSubmitProof() {
    if (!proof) { toast.error('Generate a proof first'); return }
    if (!address) { toast.error('Please connect your wallet'); return }
    setIsSubmitting(true)
    try {
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000'
      const authHeaders = getAdminAuthHeaders()
      toast.loading('Anchoring credential on-chain...', { id: 'anchor' })
      const anchorRes = await fetch(`${BACKEND_URL}/api/proofs/anchor-credential`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: JSON.stringify({ credentialId: proof.credentialId, proofId: proof.proofId }) })
      if (!anchorRes.ok) { const d = await anchorRes.json().catch(() => ({})); toast.dismiss('anchor'); throw new Error(d?.details || d?.reason || d?.error || 'Failed to anchor credential') }
      const anchorData = await anchorRes.json()
      toast.success(anchorData.alreadyAnchored ? 'Already anchored' : 'Anchored successfully', { id: 'anchor' })
      toast.loading('Verifying proof on-chain...', { id: 'verify' })
      const res = await fetch(`${BACKEND_URL}/api/proofs/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: JSON.stringify({ proofId: proof.proofId }) })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.dismiss('verify'); throw new Error(d?.details || d?.reason || d?.error || 'Backend verification failed') }
      const data = await res.json()
      if (!data.success) { toast.dismiss('verify'); throw new Error(data?.details || data?.reason || data?.error || 'Proof verification failed') }
      toast.success('Proof verified!', { id: 'verify' })
      setVerified(true); setTxResult({ txHash: data.txnHash, gasUsed: data.gasUsed }); setCurrentStep(3)
      toast.success('🎉 Verification recorded on-chain!')
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#7c3aed', '#a78bfa', '#c084fc', '#ffffff'] })
    } catch (e) { console.error(e); toast.error(`❌ ${e.message}`); setVerified(false); setTxResult(null) }
    finally { setIsSubmitting(false) }
  }

  const steps = [
    { label: 'Credential', icon: Sparkles },
    { label: 'Proof', icon: FileKey },
    { label: 'Submit', icon: Send },
    { label: 'Done', icon: CheckCircle },
  ]

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-brand-400/70 font-semibold mb-2">ZK Proof Flow</div>
          <h1 className="text-3xl font-bold text-white">Project Dashboard</h1>
          <p className="text-sm text-white/40 mt-1">Generate ZK proofs and verify on-chain</p>
        </div>
        <div className="text-xs text-white/25 font-mono">Step {Math.min(currentStep + 1, 3)} / 3</div>
      </div>

      {/* Step Progress */}
      <div className="flex items-center gap-0">
        {steps.map((step, i) => {
          const isDone = i < currentStep
          const isActive = i === currentStep
          const isFuture = i > currentStep

          return (
            <div key={i} className="flex items-center flex-1">
              <div
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold w-full justify-center transition-all duration-300"
                style={{
                  background: isActive ? 'linear-gradient(135deg, #7c3aed, #8b5cf6)' :
                    isDone ? 'rgba(124,58,237,0.12)' :
                      'rgba(255,255,255,0.025)',
                  border: isActive ? '1px solid rgba(139,92,246,0.5)' :
                    isDone ? '1px solid rgba(124,58,237,0.2)' :
                      '1px solid rgba(255,255,255,0.05)',
                  color: isActive ? '#fff' : isDone ? '#a78bfa' : 'rgba(255,255,255,0.2)',
                  boxShadow: isActive ? '0 0 16px rgba(124,58,237,0.35)' : 'none',
                }}
              >
                <step.icon className="w-3 h-3" />
                <span className="hidden sm:inline">{step.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className="h-px w-3 shrink-0"
                  style={{ background: i < currentStep ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.05)' }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">

        {/* Step 0: No credential */}
        {currentStep === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <GlassCard className="p-10 text-center">
              <div className="py-6">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)' }}>
                  <FileKey className="h-6 w-6 text-brand-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No Credential Found</h3>
                <p className="text-sm text-white/30 max-w-sm mx-auto">
                  Request an audit credential from a verified auditor to get started with proof generation.
                </p>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* Step 1: Generate Proof */}
        {currentStep === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <GlassCard className="p-6">
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-4 p-4 rounded-xl"
                  style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.1)' }}>
                  {[
                    { label: 'Credential ID', value: credential?.id, mono: true },
                    { label: 'Status', value: credential?.status, color: '#4ade80' },
                    { label: 'Issued', value: credential?.issuedAt ? new Date(credential.issuedAt).toLocaleDateString() : '—' },
                  ].map((item, i) => (
                    <div key={i}>
                      <div className="text-[10px] uppercase tracking-wider text-white/25 mb-1">{item.label}</div>
                      <div className={`text-xs ${item.mono ? 'font-mono text-white/50 break-all' : ''}`}
                        style={{ color: item.color || 'rgba(255,255,255,0.55)' }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                <GradientButton onClick={handleGenerateProof} isLoading={isGenerating} disabled={!credential} className="w-full">
                  {isGenerating ? 'Generating…' : 'Generate ZK Proof'}
                </GradientButton>
                <p className="text-[11px] text-white/20 leading-relaxed text-center">
                  The proof verifies your credential without revealing actual audit report contents.
                </p>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* Step 2: Submit Proof */}
        {currentStep === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <GlassCard className="p-6">
              <div className="space-y-5">
                <div className="p-4 rounded-xl" style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.12)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                    <span className="text-xs font-semibold text-green-400/80">Proof Generated</span>
                  </div>
                  <div className="font-mono text-xs text-white/40 break-all">{proof?.proofId}</div>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={() => setCurrentStep(1)}
                    className="px-3.5 py-2.5 text-xs text-white/30 rounded-xl hover:text-white/60 transition-colors"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <ArrowLeft className="w-3 h-3 inline mr-1" />Back
                  </button>
                  <GradientButton onClick={handleSubmitProof} isLoading={isSubmitting} disabled={!address} className="flex-1">
                    {isSubmitting ? 'Submitting…' : 'Submit to Polygon'}
                  </GradientButton>
                </div>

                {!address && <p className="text-[11px] text-yellow-400/50 text-center">Connect your wallet to submit</p>}
                <p className="text-[11px] text-white/20 leading-relaxed text-center">
                  Submitting records your verified audit status on Polygon, visible to all.
                </p>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* Step 3: Done */}
        {currentStep === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <GlassCard className="p-10 text-center">
              <div className="py-4">
                {/* Animated glow ring */}
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-full animate-pulse-glow" style={{ background: 'rgba(124,58,237,0.2)' }} />
                  <div className="relative w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.4), rgba(139,92,246,0.25))', border: '1px solid rgba(139,92,246,0.4)' }}>
                    <CheckCircle className="h-9 w-9 text-brand-300" />
                  </div>
                </div>

                <h3 className="text-2xl font-bold mb-1" style={{ background: 'linear-gradient(135deg, #c084fc, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  Verified On-Chain
                </h3>
                <p className="text-sm text-white/35 mb-5">Your audit status is now permanently recorded on Polygon</p>
                <AnimatedBadge status="verified" className="justify-center mb-5" />

                {txResult && (
                  <div className="inline-flex flex-col items-center gap-1.5 text-xs text-white/30">
                    {txResult.txHash && (
                      <a
                        href={`${explorerUrl}/tx/${txResult.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 hover:text-brand-400 transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {txResult.txHash.slice(0, 10)}...{txResult.txHash.slice(-6)}
                      </a>
                    )}
                    {txResult.txHash && (
                      <button
                        type="button"
                        onClick={() => window.open(`${explorerUrl}/tx/${txResult.txHash}`, '_blank', 'noopener,noreferrer')}
                        className="mt-1 px-3 py-1 rounded-md border border-white/20 hover:border-white/40 text-[11px] text-white/70 hover:text-white transition-colors"
                      >
                        Open on PolygonScan
                      </button>
                    )}
                    {txResult.gasUsed && <span>Gas used: {txResult.gasUsed}</span>}
                  </div>
                )}
              </div>
            </GlassCard>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}

