'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/glass-card';
import ReputationCard from '@/components/reputation-card';
import AuditorBadge from '@/components/auditor-badge';
import CredibilityScore from '@/components/credibility-score';
import { Input } from '@/components/ui/input';
import { GradientButton } from '@/components/ui/gradient-button';
import { Search, ArrowLeft, ExternalLink, Github, Shield, Bug, FileCode, CheckCircle } from 'lucide-react';

const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://polygonscan.com';

function AuditorReputationContent() {
  const searchParams = useSearchParams();
  const [address, setAddress] = useState(searchParams.get('address') || '');
  const [auditorData, setAuditorData] = useState(null);
  const [reputationData, setReputationData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (address && address.length === 42) {
      fetchAuditorData();
    }
  }, [address]);

  const fetchAuditorData = async () => {
    setLoading(true);
    setError(null);

    try {
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';
      const [auditorResponse, reputationResponse] = await Promise.all([
        fetch(`${BACKEND_URL}/api/auditors/${address}`),
        fetch(`${BACKEND_URL}/api/auditors/${address}/reputation`)
      ]);

      const auditorResult = await auditorResponse.json();
      const reputationResult = await reputationResponse.json();

      if (auditorResult.success) {
        setAuditorData(auditorResult.auditor);
      } else {
        throw new Error('Auditor not found');
      }

      if (reputationResult.success) {
        setReputationData(reputationResult.reputation);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (address && address.length === 42) {
      fetchAuditorData();
    }
  };

  const formatAddress = (addr) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getTimeAgo = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    if (days < 30) return `${days} days ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
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
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Auditor Reputation
        </h1>
        <p className="text-white/60 text-lg">
          Explore auditor credibility scores and external platform achievements
        </p>
      </motion.div>

      {/* Search Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <GlassCard className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                placeholder="Enter auditor address (0x...)"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="bg-white/5 border-white/20 focus:border-white/40 text-white"
              />
            </div>
            <GradientButton
              onClick={handleSearch}
              disabled={!address || address.length !== 42}
              className="px-6"
            >
              <Search className="w-4 h-4 mr-2" />
              Search
            </GradientButton>
          </div>
        </GlassCard>
      </motion.div>

      {/* Loading State */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white/60">Loading auditor data...</p>
        </motion.div>
      )}

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <GlassCard className="p-6 text-center">
            <div className="text-red-400 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold mb-2">Error Loading Data</h3>
            <p className="text-white/60 mb-4">{error}</p>
            <GradientButton onClick={fetchAuditorData} className="mx-auto">
              Try Again
            </GradientButton>
          </GlassCard>
        </motion.div>
      )}

      {/* Auditor Data */}
      {auditorData && !loading && (
        <div className="space-y-8">
          {/* Overview Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <GlassCard className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold text-white">
                      {formatAddress(address)}
                    </h2>
                    <AuditorBadge address={address} showScore={true} />
                  </div>
                  <p className="text-white/60">
                    Approved {getTimeAgo(auditorData.approvedAt)}
                  </p>
                </div>
                <CredibilityScore address={address} size="lg" showBreakdown={true} />
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-white/5 rounded-lg">
                  <div className="text-2xl font-bold text-white mb-1">
                    {auditorData.credentialCount}
                  </div>
                  <div className="text-sm text-white/60">Credentials</div>
                </div>

                <div className="text-center p-4 bg-white/5 rounded-lg">
                  <div className="text-2xl font-bold text-white mb-1">
                    {reputationData?.github?.count || 0}
                  </div>
                  <div className="text-sm text-white/60">GitHub Repos</div>
                </div>

                <div className="text-center p-4 bg-white/5 rounded-lg">
                  <div className="text-2xl font-bold text-white mb-1">
                    {reputationData?.code4rena?.count || 0}
                  </div>
                  <div className="text-sm text-white/60">C4 Findings</div>
                </div>

                <div className="text-center p-4 bg-white/5 rounded-lg">
                  <div className="text-2xl font-bold text-white mb-1">
                    {reputationData?.immunefi?.count || 0}
                  </div>
                  <div className="text-sm text-white/60">Immunefi Bounties</div>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          {/* Detailed Reputation Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <ReputationCard address={address} />
          </motion.div>

          {/* Platform Details */}
          {reputationData && (
            <div className="grid md:grid-cols-3 gap-6">
              {/* GitHub Details */}
              {reputationData.github && reputationData.github.repos && reputationData.github.repos.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <GlassCard className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Github className="w-6 h-6 text-white" />
                      <h3 className="text-lg font-semibold text-white">GitHub Activity</h3>
                    </div>
                    <div className="space-y-3">
                      {reputationData.github.repos.slice(0, 5).map((repo, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                          <div>
                            <div className="text-white font-medium">{repo.name}</div>
                            <div className="text-white/60 text-sm">{repo.description || 'No description'}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-white text-sm">⭐ {repo.stars}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                </motion.div>
              )}

              {/* Code4rena Details */}
              {reputationData.code4rena && reputationData.code4rena.findings && reputationData.code4rena.findings.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                >
                  <GlassCard className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Shield className="w-6 h-6 text-white" />
                      <h3 className="text-lg font-semibold text-white">Code4rena Findings</h3>
                    </div>
                    <div className="space-y-3">
                      {reputationData.code4rena.findings.slice(0, 5).map((finding, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                          <div>
                            <div className="text-white font-medium">{finding.contest}</div>
                            <div className="text-white/60 text-sm">{finding.title}</div>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm px-2 py-1 rounded ${finding.severity === 'HIGH' ? 'bg-red-500/20 text-red-300' :
                              finding.severity === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-300' :
                                'bg-blue-500/20 text-blue-300'
                              }`}>
                              {finding.severity}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                </motion.div>
              )}

              {/* Immunefi Details */}
              {reputationData.immunefi && reputationData.immunefi.submissions && reputationData.immunefi.submissions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                >
                  <GlassCard className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Bug className="w-6 h-6 text-white" />
                      <h3 className="text-lg font-semibold text-white">Immunefi Bounties</h3>
                    </div>
                    <div className="space-y-3">
                      {reputationData.immunefi.submissions.slice(0, 5).map((submission, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                          <div>
                            <div className="text-white font-medium">{submission.project}</div>
                            <div className="text-white/60 text-sm">{submission.title}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-green-300 text-sm">${submission.reward}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                </motion.div>
              )}
            </div>
          )}

          {/* Contracts Worked On - Auto-detected from work history */}
          {reputationData?.contractsWorkedOn && reputationData.contractsWorkedOn.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
            >
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <FileCode className="w-6 h-6 text-white" />
                    <h3 className="text-xl font-semibold text-white">Contracts Worked On</h3>
                    <span className="px-3 py-1 bg-green-500/20 text-green-300 text-xs font-medium rounded-full">
                      {reputationData.contractCount || reputationData.contractsWorkedOn.length} contracts
                    </span>
                  </div>
                  <div className="text-sm text-white/50">
                    Auto-detected from work history
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {reputationData.contractsWorkedOn.slice(0, 10).map((contract, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * index }}
                      className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        {contract.verified ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <FileCode className="w-5 h-5 text-white/50" />
                        )}
                        <div>
                          <div className="font-mono text-sm text-white font-medium">
                            {contract.address.slice(0, 6)}...{contract.address.slice(-4)}
                          </div>
                          <div className="text-xs text-white/50">
                            {contract.source === 'work-history' ? 'From work history' : 'Verified'}
                          </div>
                        </div>
                      </div>
                      <a
                        href={`${explorerUrl}/address/${contract.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 text-white/60 hover:text-white" />
                      </a>
                    </motion.div>
                  ))}
                </div>

                {reputationData.contractsWorkedOn.length > 10 && (
                  <div className="mt-4 text-center text-sm text-white/50">
                    + {reputationData.contractsWorkedOn.length - 10} more contracts
                  </div>
                )}
              </GlassCard>
            </motion.div>
          )}

          {/* Credibility Credential Display */}
          {auditorData?.isApproved && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
            >
              <GlassCard className="p-6 border-2 border-green-400/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Credibility Credential</h3>
                    <p className="text-sm text-white/60">Issued upon approval - proves auditor trustworthiness</p>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-white/50 mb-1">Credibility Level</div>
                    <div className="text-lg font-bold text-white">
                      {auditorData.credibilityScore >= 800 ? 'Elite' :
                        auditorData.credibilityScore >= 600 ? 'Expert' :
                          auditorData.credibilityScore >= 400 ? 'Experienced' :
                            auditorData.credibilityScore >= 200 ? 'Emerging' : 'New'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-white/50 mb-1">Score</div>
                    <div className="text-lg font-bold text-green-400">{auditorData.credibilityScore}</div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* Back Button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="text-center"
          >
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default function AuditorReputationPage() {
  return (
    <Suspense fallback={<div className="text-white/60 text-center py-10">Loading reputation page...</div>}>
      <AuditorReputationContent />
    </Suspense>
  );
}
