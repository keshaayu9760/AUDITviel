"use client"

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { GlassCard } from '@/components/ui/glass-card'
import { GradientButton } from '@/components/ui/gradient-button'
import { Input } from '@/components/ui/input'
import { AnimatedBadge } from '@/components/ui/animated-badge'
import AuditorBadge from '@/components/auditor-badge'
import CredibilityScore from '@/components/credibility-score'
import { issueCredential } from '@/lib/airkit'
import { getContractWithSigner, getSigner } from '@/lib/ethers'
import { keccak256Utf8, uuidToBytes32 } from '@/lib/hash'
import { ethers } from 'ethers'
import { FileSignature, Anchor, CheckCircle2, AlertCircle, ExternalLink, Shield } from 'lucide-react'

export default function AuditorPage() {
  const { address } = useAccount()
  const [mounted, setMounted] = useState(false)
  const [project, setProject] = useState("")
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [status, setStatus] = useState("Verified - No Critical Issues")
  const [isIssuing, setIsIssuing] = useState(false)
  const [isAnchoring, setIsAnchoring] = useState(false)
  const [credential, setCredential] = useState(null)
  const [isAnchored, setIsAnchored] = useState(false)
  const [isApproved, setIsApproved] = useState(false)
  const [checkingApproval, setCheckingApproval] = useState(true)
  const activeAddress = mounted ? address : null

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const cached = localStorage.getItem('auditviel:lastCredential')
    if (cached) setCredential(JSON.parse(cached))
  }, [])

  useEffect(() => {
    const checkAuditorApproval = async () => {
      if (!address) { setCheckingApproval(false); return }
      try {
        const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';
        const approvalResponse = await fetch(`${BACKEND_URL}/api/auditors/${address}/is-approved`)
        const approvalData = await approvalResponse.json()
        if (approvalData.success) {
          setIsApproved(approvalData.isApproved)
          if (approvalData.isApproved) {
            const auditorResponse = await fetch(`${BACKEND_URL}/api/auditors/${address}`)
            const auditorData = await auditorResponse.json()
          }
        }
      } catch (error) {
        console.error('Error checking auditor approval:', error)
      } finally {
        setCheckingApproval(false)
      }
    }
    checkAuditorApproval()
  }, [address])

  function getAdminAuthHeaders() {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('auditviel:adminToken') : null
    if (!token) {
      return null
    }
    return { Authorization: `Bearer ${token}` }
  }

  async function handleIssueCredential() {
    if (!activeAddress) { toast.error('Please connect your wallet as auditor'); return }
    if (!isApproved) { toast.error('Only approved auditors can issue credentials'); return }
    if (!project) { toast.error('Please enter project address'); return }
    if (!summary) { toast.error('Please enter audit summary'); return }

    setIsIssuing(true)
    try {
      const summaryHash = keccak256Utf8(`${title}|${summary}`)
      const signer = await getSigner()
      const issuerSignature = await signer.signMessage(ethers.getBytes(summaryHash))
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000'
      const endpoint = `${BACKEND_URL}/api/issueCredential`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issuer: activeAddress, subject: project, summaryHash, status, issuerSignature })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || data?.details?.[0]?.msg || `Issue failed (${res.status})`)
      }
      const data = await res.json()
      const cred = {
        ...data,
        id: data.credential_id || data.id,
        onChainId: data.on_chain_id || null,
        issuer: activeAddress,
        subject: project,
        summaryHash,
        status,
        issuedAt: data.issued_at || new Date().toISOString(),
        serverSignature: data.server_signature || null
      }
      setCredential(cred)
      setIsAnchored(false)
      localStorage.setItem('auditviel:lastCredential', JSON.stringify(cred))
      toast.success('âœ… Credential issued successfully!')
    } catch (e) {
      console.error('[Auditor] Issue failed', e)
      toast.error(`âŒ Failed to issue credential: ${e.message}`)
    } finally {
      setIsIssuing(false)
    }
  }

  async function handleAnchorOnChain() {
    if (!credential) { toast.error('Please issue a credential first'); return }
    if (!activeAddress) { toast.error('Please connect your wallet'); return }
    toast('Generate proof and submit on /project (this now does anchor + verify together).')
    window.location.href = '/project'
  }

  return (
    <div className="space-y-6">
      {/* Top bar â€” left title, right metadata */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Auditor Dashboard</h1>
          <p className="text-sm text-white/40 mt-1">Issue credentials and anchor them on-chain</p>
        </div>

        {activeAddress && (
          <div className="flex items-center gap-3">
            <CredibilityScore address={activeAddress} size="sm" showBreakdown={false} />
            <AuditorBadge address={activeAddress} showScore={true} size="sm" />
            <a
              href={`/auditor/reputation?address=${activeAddress}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/40 bg-white/[0.03] border border-white/[0.06] rounded-lg hover:text-white/70 hover:border-white/10 transition-all"
            >
              <ExternalLink className="w-3 h-3" />
              Reputation
            </a>
          </div>
        )}
      </div>

      {/* Approval Banner â€” compact inline */}
      {activeAddress && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {checkingApproval ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white/40" />
              <span className="text-xs text-white/40">Checking approval status...</span>
            </div>
          ) : isApproved ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/10">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                <span className="text-xs text-green-300/70">Verified Trusted Auditor â€” approved to issue credentials</span>
              </div>
              <div className="hidden sm:flex items-center gap-3 text-[10px] text-white/30">
                <span>âœ“ Admin approved</span>
                <span>âœ“ Credibility verified</span>
                <span>âœ“ Work history confirmed</span>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-3.5 w-3.5 text-yellow-400" />
                <span className="text-xs text-yellow-300/70">Approval required â€” contact admin to get verified</span>
              </div>
              <div className="text-[10px] text-white/25 flex gap-4">
                <span>1. Provide GitHub/Code4rena/Immunefi handles</span>
                <span>2. Admin verifies work history</span>
                <span>3. Credibility credential issued</span>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Single-column workflow */}
      <div className="space-y-4">
        {/* Step 1: Issue Credential */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <GlassCard className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-white/10 text-[10px] font-bold text-white/50">1</div>
              <h2 className="text-sm font-semibold text-white">Issue Credential</h2>
              <span className="text-[11px] text-white/25">via AIR Kit SDK</span>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-white/30 uppercase tracking-wider mb-1.5">Project Address</label>
                <Input
                  placeholder="0x..."
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  className="bg-white/[0.03] border-white/[0.06] focus:border-white/20 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-white/30 uppercase tracking-wider mb-1.5">Audit Title</label>
                <Input
                  placeholder="Security Audit Q4 2024"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-white/[0.03] border-white/[0.06] focus:border-white/20 text-white text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-white/30 uppercase tracking-wider mb-1.5">Audit Summary</label>
                <textarea
                  placeholder="Brief summary of audit findings..."
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] focus:border-white/20 focus:outline-none text-white text-sm placeholder-white/20 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-white/30 uppercase tracking-wider mb-1.5">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-black border border-white/[0.06] focus:border-white/20 focus:outline-none text-white text-sm transition-colors"
                >
                  <option value="Verified - No Critical Issues">Verified - No Critical Issues</option>
                  <option value="Verified - Minor Issues">Verified - Minor Issues</option>
                  <option value="Verified - Major Issues Fixed">Verified - Major Issues Fixed</option>
                  <option value="Pending Review">Pending Review</option>
                </select>
              </div>
              <div className="flex items-end">
                <GradientButton
                  onClick={handleIssueCredential}
                  isLoading={isIssuing}
                  disabled={!activeAddress || !isApproved}
                  className="w-full"
                >
                  {isIssuing ? 'Issuing...' : 'Issue Credential'}
                </GradientButton>
              </div>
            </div>

            {/* Status messages */}
            {!activeAddress && (
              <div className="mt-3 flex items-center gap-2 text-yellow-400/70 text-xs p-2.5 bg-yellow-500/5 rounded-lg">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Connect wallet to continue</span>
              </div>
            )}
            {activeAddress && !isApproved && (
              <div className="mt-3 flex items-center gap-2 text-red-400/70 text-xs p-2.5 bg-red-500/5 rounded-lg">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Only verified auditors can issue credentials</span>
              </div>
            )}
            {activeAddress && isApproved && (
              <div className="mt-3 flex items-center gap-2 text-green-400/70 text-xs p-2.5 bg-green-500/5 rounded-lg">
                <Shield className="h-3.5 w-3.5" />
                <span>âœ“ Auditor status verified</span>
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Step 2: Credential Preview + Anchor */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <GlassCard className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-white/10 text-[10px] font-bold text-white/50">2</div>
              <h2 className="text-sm font-semibold text-white">Anchor On-Chain</h2>
              <span className="text-[11px] text-white/25">Polygon Amoy</span>
            </div>

            {credential ? (
              <div className="space-y-4">
                {/* Credential details */}
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <div className="text-white/20 uppercase tracking-wider text-[10px] mb-1">Credential ID</div>
                    <div className="font-mono text-white/60 break-all">{credential.id}</div>
                  </div>
                  <div>
                    <div className="text-white/20 uppercase tracking-wider text-[10px] mb-1">Summary Hash</div>
                    <div className="font-mono text-white/60 break-all">{credential.summaryHash}</div>
                  </div>
                  <div>
                    <div className="text-white/20 uppercase tracking-wider text-[10px] mb-1">Issued</div>
                    <div className="text-white/60">{new Date(credential.issuedAt).toLocaleString()}</div>
                  </div>
                </div>

                <div className="h-px bg-white/[0.04]" />

                {isAnchored ? (
                  <AnimatedBadge status="verified" className="w-full justify-center" />
                ) : (
                  <div className="flex items-center gap-3">
                    <GradientButton
                      onClick={handleAnchorOnChain}
                      isLoading={isAnchoring}
                      disabled={!activeAddress}
                      className="flex-1"
                    >
                      {isAnchoring ? 'Opening...' : 'Continue in Project Dashboard'}
                    </GradientButton>
                    <div className="flex items-center gap-1.5 text-[11px] text-white/25 max-w-[200px]">
                      <CheckCircle2 className="h-3 w-3 shrink-0 text-green-400/50" />
                      Only hashes stored on-chain
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-center">
                <div>
                  <Anchor className="h-8 w-8 text-white/10 mx-auto mb-2" />
                  <p className="text-xs text-white/25">Issue a credential first</p>
                </div>
              </div>
            )}
          </GlassCard>
        </motion.div>
      </div>
    </div>
  )
}

