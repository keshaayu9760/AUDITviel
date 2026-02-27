
'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useAccount } from 'wagmi'
import toast from 'react-hot-toast'
import { GlassCard } from '@/components/ui/glass-card'
import { GradientButton } from '@/components/ui/gradient-button'
import { Input } from '@/components/ui/input'
import {
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  Github,
  Bug,
  Wallet,
  ExternalLink,
  RefreshCw,
  Search,
  Filter,
  Lock
} from 'lucide-react'
import { ethers } from 'ethers'
import { getSigner } from '@/lib/ethers'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000'
const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://polygonscan.com'

export default function AdminPage() {
  const { address } = useAccount()
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [approvingAddress, setApprovingAddress] = useState(null)
  const [token, setToken] = useState(null)
  const [authenticating, setAuthenticating] = useState(false)
  const [requiresAuth, setRequiresAuth] = useState(false)
  const [expectedAdminAddress, setExpectedAdminAddress] = useState(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('auditviel:adminToken') : null
    if (stored) {
      setToken(stored)
    } else {
      setRequiresAuth(true)
    }


    // Fetch the configured admin address from backend
    console.log('[Admin Page] Backend URL:', BACKEND_URL)
    fetch(`${BACKEND_URL}/api/admin/address`)
      .then(res => res.json())
      .then(data => {
        if (data.adminAddress) {
          setExpectedAdminAddress(data.adminAddress)
        }
      })
      .catch(err => {
        console.error('[Admin Page] Failed to fetch admin address:', err)
        toast.error('Cannot connect to backend. Check console for details.')
      })
  }, [])

  useEffect(() => {
    fetchApplications()
  }, [filter, token])

  const fetchApplications = async () => {
    setLoading(true)
    try {
      if (token) {
        // Authenticated: fetch from admin endpoint with full data
        const url = filter === 'all'
          ? `${BACKEND_URL}/api/admin/applications`
          : `${BACKEND_URL}/api/admin/applications?status=${filter}`

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        })

        if (res.status === 401) {
          handleUnauthorized()
          return
        }

        const data = await res.json()
        if (data.success) {
          setApplications(data.applications || [])
        }
      } else {
        setApplications([])
      }
    } catch (err) {
      console.error('Error fetching applications:', err)
      toast.error('Failed to load applications')
    } finally {
      setLoading(false)
    }
  }

  const handleUnauthorized = () => {
    setToken(null)
    setRequiresAuth(true)
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('auditviel:adminToken')
    }
    toast.error('Admin authentication expired. Please authenticate again.')
  }

  const signAdminLogin = async () => {
    try {
      if (!address) {
        toast.error('Connect admin wallet first')
        return
      }
      setAuthenticating(true)
      const signer = await getSigner()
      const timestamp = Date.now()
      const bodyHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({})))
      const digest = ethers.solidityPackedKeccak256(
        ['string', 'string', 'string', 'uint256', 'bytes32'],
        ['auditviel-admin', 'POST', '/api/admin/login', timestamp, bodyHash]
      )
      const signature = await signer.signMessage(ethers.getBytes(digest))

      console.log('[Admin Auth] Backend URL:', BACKEND_URL)
      console.log('[Admin Auth] Timestamp:', timestamp)
      console.log('[Admin Auth] Signature:', signature)

      const res = await fetch(`${BACKEND_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp, signature })
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const errorMsg = data?.error || 'Authentication failed'
        if (errorMsg.toLowerCase().includes('invalid') || errorMsg.toLowerCase().includes('mismatch')) {
          const adminHint = (mounted && expectedAdminAddress)
            ? `${expectedAdminAddress.slice(0, 6)}...${expectedAdminAddress.slice(-4)}`
            : 'admin wallet'
          throw new Error(`Wrong wallet connected. Please connect the admin wallet (${adminHint}) and try again.`)
        }
        throw new Error(errorMsg)
      }

      const data = await res.json()
      setToken(data.token)
      setRequiresAuth(false)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('auditviel:adminToken', data.token)
      }
      toast.success('Admin authentication successful')
      fetchApplications()
    } catch (err) {
      console.error('Admin auth error', err)
      toast.error(err.message || 'Failed to authenticate')
    } finally {
      setAuthenticating(false)
    }
  }

  const handleApprove = async (application) => {
    if (!token) {
      toast.error('Admin authentication required')
      setRequiresAuth(true)
      return
    }
    if (!confirm(`Approve auditor ${application.walletAddress}?`)) {
      return
    }

    setApprovingAddress(application.walletAddress)
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/approve-auditor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          auditorAddress: application.walletAddress,
          githubHandle: application.githubHandle,
          code4renaHandle: application.code4renaHandle,
          immunefiHandle: application.immunefiHandle
        })
      })

      if (res.status === 401) {
        handleUnauthorized()
        return
      }

      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to approve auditor')
      }

      toast.success(`Auditor ${application.walletAddress.slice(0, 8)}... approved!`)
      fetchApplications()
    } catch (err) {
      console.error('Error approving auditor:', err)
      toast.error(err.message || 'Failed to approve auditor')
    } finally {
      setApprovingAddress(null)
    }
  }

  const handleReject = async (walletAddress) => {
    if (!token) {
      toast.error('Admin authentication required')
      setRequiresAuth(true)
      return
    }
    if (!confirm(`Reject application for ${walletAddress}?`)) {
      return
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/reject-application`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ walletAddress })
      })

      if (res.status === 401) {
        handleUnauthorized()
        return
      }

      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to reject application')
      }

      toast.success('Application rejected')
      fetchApplications()
    } catch (err) {
      console.error('Error rejecting application:', err)
      toast.error(err.message || 'Failed to reject application')
    }
  }

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        return (
          app.walletAddress.toLowerCase().includes(term) ||
          app.githubHandle?.toLowerCase().includes(term) ||
          app.code4renaHandle?.toLowerCase().includes(term) ||
          app.immunefiHandle?.toLowerCase().includes(term)
        )
      }
      return true
    })
  }, [applications, searchTerm])

  const pendingCount = applications.filter((app) => app.status === 'pending').length
  const approvedCount = applications.filter((app) => app.status === 'approved').length
  const rejectedCount = applications.filter((app) => app.status === 'rejected').length

  const formatDate = (value) => {
    if (!value) return 'N/A'
    return new Date(value).toLocaleString()
  }

  const isAuthenticated = Boolean(token)

  return (
    <div className="max-w-7xl mx-auto space-y-8 py-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-white">
            <Shield className="h-8 w-8 text-white" />
          </div>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Admin Dashboard</h1>
        <p className="text-white/60 text-lg">Review, approve, and audit the AuditViel trust registry</p>
        {!isAuthenticated && (
          <div className="mt-6 flex justify-center">
            <GlassCard className="p-6 max-w-lg w-full">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-red-500">
                  <Lock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Admin Authentication Required</h2>
                  <p className="text-sm text-white/50">
                    {mounted && expectedAdminAddress
                      ? `Connect the admin wallet (${expectedAdminAddress.slice(0, 6)}...${expectedAdminAddress.slice(-4)}) and sign a challenge to unlock moderation actions.`
                      : 'Connect the admin wallet and sign a challenge to unlock moderation actions.'}
                  </p>
                  {address && (
                    <div className="mt-2">
                      <p className="text-xs text-yellow-300/70">
                        Currently connected: {address.slice(0, 6)}...{address.slice(-4)}
                      </p>
                      {mounted && expectedAdminAddress && address.toLowerCase() !== expectedAdminAddress.toLowerCase() && (
                        <p className="text-xs text-red-300 mt-1">⚠️ Wrong wallet. Expected admin address.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <GradientButton onClick={signAdminLogin} isLoading={authenticating} className="w-full">
                  {authenticating ? 'Authenticating...' : 'Authenticate'}
                </GradientButton>
                <p className="text-xs text-white/40 text-left">
                  AuditViel issues a short-lived JWT once your signature is verified via EIP-191. Tokens are stored locally for convenience.
                </p>
              </div>
            </GlassCard>
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <StatsCard label="Pending" value={pendingCount} accent="text-yellow-300" />
        <StatsCard label="Approved" value={approvedCount} accent="text-green-300" />
        <StatsCard label="Rejected" value={rejectedCount} accent="text-red-300" />
        <StatsCard label="Total" value={applications.length} accent="text-white" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <GlassCard className="p-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 w-full">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                <Input
                  placeholder="Search by wallet, GitHub, Code4rena, or Immunefi..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white/5 border-white/20 focus:border-white/40 text-white"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-white/50" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                disabled={!isAuthenticated}
                className="px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-white/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="all">All Applications</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <GradientButton onClick={fetchApplications} isLoading={loading} className="px-6">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </GradientButton>
          </div>
        </GlassCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        {loading ? (
          <GlassCard className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white/60">Loading applications...</p>
          </GlassCard>
        ) : filteredApplications.length === 0 ? (
          <GlassCard className="p-12 text-center">
            <p className="text-white/60 text-lg">
              {!isAuthenticated ? 'Authenticate to view and manage applications.' : 'No applications found matching your filter.'}
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {filteredApplications.map((app, index) => (
              <motion.div
                key={app.walletAddress}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <GlassCard className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <Wallet className="w-5 h-5 text-white/70" />
                        <code className="text-white font-mono text-sm">
                          {app.walletAddress}
                        </code>
                        {getStatusBadge(app.status)}
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        {app.githubHandle && (
                          <HandleLink
                            icon={Github}
                            label={app.githubHandle}
                            href={`https://github.com/${app.githubHandle}`}
                          />
                        )}
                        {app.code4renaHandle && (
                          <HandleLink
                            icon={Shield}
                            label={app.code4renaHandle}
                            href={`https://code4rena.com/@${app.code4renaHandle}`}
                          />
                        )}
                        {app.immunefiHandle && (
                          <HandleLink
                            icon={Bug}
                            label={app.immunefiHandle}
                            href={`https://immunefi.com/profile/${app.immunefiHandle}`}
                          />
                        )}
                      </div>
                      {app.message && (
                        <div className="mt-4 p-3 bg-white/5 rounded-lg">
                          <p className="text-white/70 text-sm">{app.message}</p>
                        </div>
                      )}
                      <div className="mt-4 text-xs text-white/50 space-y-1">
                        <div>Submitted: {formatDate(app.submittedAt)}</div>
                        {app.reviewedAt && <div>Reviewed: {formatDate(app.reviewedAt)}</div>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      {app.status === 'pending' && (
                        <>
                          {!isAuthenticated ? (
                            <div className="px-4 py-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-center">
                              <p className="text-xs text-yellow-300/90 mb-1 font-medium">
                                Authentication Required
                              </p>
                              <p className="text-xs text-yellow-300/60">
                                Connect admin wallet and click "Authenticate" above
                              </p>
                            </div>
                          ) : (
                            <>
                              <GradientButton
                                onClick={() => handleApprove(app)}
                                isLoading={approvingAddress === app.walletAddress}
                                className="px-4 py-2 text-sm"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Approve
                              </GradientButton>
                              <button
                                onClick={() => handleReject(app.walletAddress)}
                                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors text-sm flex items-center justify-center gap-1"
                              >
                                <XCircle className="w-4 h-4" />
                                Reject
                              </button>
                            </>
                          )}
                        </>
                      )}
                      {app.status === 'approved' && (
                        <div className="px-4 py-2 bg-green-500/20 text-green-300 rounded-lg text-sm text-center">
                          ✓ Approved
                        </div>
                      )}
                      {app.status === 'rejected' && (
                        <div className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg text-sm text-center">
                          ✗ Rejected
                        </div>
                      )}
                      <a
                        href={`${EXPLORER_URL}/address/${app.walletAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs text-white/60 hover:text-white"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Explorer
                      </a>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}

function StatsCard({ label, value, accent }) {
  return (
    <GlassCard className="p-6">
      <div className={`text-3xl font-bold ${accent} mb-2`}>{value}</div>
      <div className="text-white/60 text-sm">{label}</div>
    </GlassCard>
  )
}

function HandleLink({ icon: Icon, label, href }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-white/50" />
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-white/70 hover:text-white/60 text-sm"
      >
        {label}
        <ExternalLink className="w-3 h-3 inline ml-1" />
      </a>
    </div>
  )
}

function getStatusBadge(status) {
  switch (status) {
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-500/20 text-yellow-300 rounded-full text-xs font-medium">
          <Clock className="w-3 h-3" />
          Pending
        </span>
      )
    case 'approved':
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-xs font-medium">
          <CheckCircle className="w-3 h-3" />
          Approved
        </span>
      )
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-500/20 text-red-300 rounded-full text-xs font-medium">
          <XCircle className="w-3 h-3" />
          Rejected
        </span>
      )
    default:
      return null
  }
}



