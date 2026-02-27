"use client"

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { GlassCard } from '@/components/ui/glass-card'
import { AnimatedBadge } from '@/components/ui/animated-badge'
import AuditorBadge from '@/components/auditor-badge'
import CredibilityScore from '@/components/credibility-score'
import VerificationSteps from '@/components/verification-steps'
import { getReadOnlyContract } from '@/lib/ethers'
import { EXPLORER_URL } from '@/config'

const explorerBase = process.env.NEXT_PUBLIC_EXPLORER_URL || EXPLORER_URL
import { Search, ExternalLink, Shield, CheckCircle2, XCircle, User, Hash } from 'lucide-react'

export default function VerifyPage() {
  const [address, setAddress] = useState('')
  const [proofHash, setProofHash] = useState('')
  const [verificationMode, setVerificationMode] = useState('address')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [auditor, setAuditor] = useState(null)
  const [auditorData, setAuditorData] = useState(null)
  const [showSteps, setShowSteps] = useState(false)
  const openExplorer = (url) => {
    window.location.assign(url)
  }

  async function handleVerify() {
    const inputValue = verificationMode === 'address' ? address : proofHash;
    if (!inputValue) {
      toast.error(`Please enter a ${verificationMode === 'address' ? 'project address' : 'proof hash'}`)
      return
    }
    setIsLoading(true)
    setResult(null)
    setAuditor(null)
    setAuditorData(null)
    setShowSteps(true)
    try {
      if (verificationMode === 'address') {
        await verifyByAddress(inputValue)
      } else {
        await verifyByProofHash(inputValue)
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to check verification status')
    } finally {
      setIsLoading(false)
    }
  }

  async function verifyByAddress(projectAddress) {
    const contract = getReadOnlyContract()
    const isVerified = await contract.isVerified(projectAddress)
    setResult(isVerified)
    if (isVerified) {
      const auditorAddr = await contract.getAuditor(projectAddress)
      setAuditor(auditorAddr)
      try {
        const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';
        const response = await fetch(`${BACKEND_URL}/api/auditors/${auditorAddr}`)
        const data = await response.json()
        if (data.success) setAuditorData(data.auditor)
      } catch (err) {
        console.error('Error fetching auditor data:', err)
      }
      toast.success('✅ Project verification found!')
    } else {
      toast.error('❌ No verification found')
    }
  }
  async function verifyByProofHash(hash) {
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000'
    const response = await fetch(`${BACKEND_URL}/api/proofs/status/${hash}`)
    const data = await response.json()

    if (!response.ok || !data.success) {
      setResult(false)
      toast.error('Proof record not found')
      return
    }

    setResult(Boolean(data.validatedOnChain))
    setAuditor(data.auditor || null)
    if (data.project) {
      setAddress(data.project)
    }

    if (data.validatedOnChain) {
      toast.success('Proof verification found')
    } else {
      toast.error('Proof exists but is not verified on-chain')
    }
  }

  const handleVerificationComplete = (verificationResult) => {
    console.log('Verification completed:', verificationResult)
  }

  return (
    <div className="space-y-6">
      {/* Header — left-aligned with inline mode toggle */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Verify Audit Status</h1>
          <p className="text-sm text-white/40 mt-1">Check on-chain verification for any project</p>
        </div>

        {/* Mode Toggle — inline tabs */}
        <div className="flex items-center gap-0.5 p-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
          <button
            onClick={() => setVerificationMode('address')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${verificationMode === 'address'
                ? 'bg-white text-black'
                : 'text-white/40 hover:text-white/70'
              }`}
          >
            <User className="w-3 h-3" />
            Address
          </button>
          <button
            onClick={() => setVerificationMode('proof')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${verificationMode === 'proof'
                ? 'bg-white text-black'
                : 'text-white/40 hover:text-white/70'
              }`}
          >
            <Hash className="w-3 h-3" />
            Proof Hash
          </button>
        </div>
      </div>

      {/* Full-width search bar — no wrapping card */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input
            type="text"
            placeholder={verificationMode === 'address' ? '0x... project wallet address' : 'Enter proof hash...'}
            value={verificationMode === 'address' ? address : proofHash}
            onChange={(e) => verificationMode === 'address' ? setAddress(e.target.value) : setProofHash(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleVerify()}
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors"
          />
        </div>
        <button
          onClick={handleVerify}
          disabled={isLoading || (verificationMode === 'address' ? !address : !proofHash)}
          className="px-5 py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? 'Checking...' : 'Verify'}
        </button>
      </div>

      {/* Verification Steps (proof-hash mode only) */}
      <AnimatePresence>
        {showSteps && verificationMode === 'proof' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <VerificationSteps
              proofHash={proofHash}
              auditorAddress={null}
              onVerificationComplete={handleVerificationComplete}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results — Split Layout */}
      <AnimatePresence mode="wait">
        {result !== null && (
          <motion.div
            key={result ? 'verified' : 'unverified'}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className={`grid md:grid-cols-5 gap-4 rounded-xl border p-px ${result ? 'border-green-500/20' : 'border-red-500/20'}`}>
              {/* Left: Status verdict (2 cols) */}
              <div className={`md:col-span-2 p-6 rounded-xl ${result ? 'bg-green-500/5' : 'bg-red-500/5'}`}>
                <div className="flex flex-col items-center text-center h-full justify-center gap-4">
                  <div className={`p-4 rounded-full ${result ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    {result ? (
                      <CheckCircle2 className="h-10 w-10 text-green-400" />
                    ) : (
                      <XCircle className="h-10 w-10 text-red-400" />
                    )}
                  </div>
                  <div>
                    <div className={`text-xl font-bold ${result ? 'text-green-400' : 'text-red-400'}`}>
                      {result ? 'Audit Verified' : 'Not Verified'}
                    </div>
                    <div className="text-xs text-white/30 mt-1">
                      {result ? 'On-chain verification confirmed' : 'No record found'}
                    </div>
                  </div>
                  <AnimatedBadge status={result ? 'verified' : 'unverified'} />
                </div>
              </div>

              {/* Right: Details (3 cols) */}
              <div className="md:col-span-3 p-6 space-y-4 bg-white/[0.02] rounded-xl">
                {/* Project address */}
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-white/25 mb-1">Project</div>
                  <a
                    href={`${explorerBase}/address/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      openExplorer(`${explorerBase}/address/${address}`)
                    }}
                    className="font-mono text-xs text-white/70 break-all underline hover:text-white cursor-pointer"
                    style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                  >
                    {address}
                  </a>
                </div>

                {/* Auditor info */}
                {result && auditor && (
                  <>
                    <div className="h-px bg-white/[0.04]" />
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-wider text-white/25 mb-1">Auditor</div>
                        <div className="font-mono text-xs text-white/70 break-all mb-2">{auditor}</div>
                        <div className="flex items-center gap-2">
                          <AuditorBadge address={auditor} showScore={true} />
                        </div>
                      </div>
                      <CredibilityScore address={auditor} size="sm" showBreakdown={false} />
                    </div>

                    {/* Trust banner */}
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                      <Shield className="h-3.5 w-3.5 text-green-400 shrink-0" />
                      <span className="text-xs text-green-300/70">Approved Auditor — Credibility Verified</span>
                    </div>

                    {auditorData && (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {auditorData.credentialCount && (
                          <div>
                            <div className="text-white/25">Credentials Issued</div>
                            <div className="text-white/70 font-medium">{auditorData.credentialCount}</div>
                          </div>
                        )}
                        {auditorData.githubHandle && (
                          <div>
                            <div className="text-white/25">GitHub</div>
                            <a
                              href={`https://github.com/${auditorData.githubHandle}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-white/50 hover:text-white transition-colors"
                            >
                              @{auditorData.githubHandle}
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Links row */}
                    <div className="flex items-center gap-4 pt-1">
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          openExplorer(`${explorerBase}/address/${auditor}`)
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          openExplorer(`${explorerBase}/address/${auditor}`)
                        }}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          openExplorer(`${explorerBase}/address/${auditor}`)
                        }}
                        className="relative z-50 inline-flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                        style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open on PolygonScan
                      </button>
                      <input
                        readOnly
                        value={`${explorerBase}/address/${auditor}`}
                        onFocus={(e) => e.target.select()}
                        className="w-full max-w-[360px] px-2 py-1 text-[10px] bg-white/5 border border-white/10 rounded font-mono"
                        style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
                      />
                      <a
                        href={`/auditor/reputation?address=${auditor}`}
                        className="inline-flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/60 transition-colors"
                      >
                        <Shield className="h-3 w-3" />
                        Full Reputation
                      </a>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* How it works — collapsed when no results */}
      {result === null && !showSteps && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.04] rounded-xl overflow-hidden"
        >
          {[
            { n: '01', t: 'Auditors issue credentials to projects' },
            { n: '02', t: 'Projects generate zero-knowledge proofs' },
            { n: '03', t: 'Status recorded immutably on Polygon' },
            { n: '04', t: 'Anyone verifies via wallet address' },
          ].map((s, i) => (
            <div key={i} className="bg-black p-5">
              <div className="text-xs font-mono text-white/15 mb-1.5">{s.n}</div>
              <div className="text-xs text-white/30 leading-relaxed">{s.t}</div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
