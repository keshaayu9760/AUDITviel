'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { GlassCard } from '@/components/ui/glass-card';
import { GradientButton } from '@/components/ui/gradient-button';
import { Input } from '@/components/ui/input';
import { FileText, Github, Shield, Bug, Wallet, Send, CheckCircle, XCircle, Clock, ArrowRight } from 'lucide-react';
import { useAccount } from 'wagmi';

const inputStyle = {
  background: 'rgba(8,8,20,0.7)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '10px',
  color: '#e4e4f0',
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
}

export default function ApplyPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    walletAddress: '', githubHandle: '', code4renaHandle: '', immunefiHandle: '', message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  useEffect(() => { setMounted(true); if (address) setFormData(prev => ({ ...prev, walletAddress: address })); }, [address]);
  useEffect(() => { if (mounted && isConnected && address) { setFormData(prev => ({ ...prev, walletAddress: address })); checkApplicationStatus(address); } }, [mounted, isConnected, address]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.walletAddress || formData.walletAddress.length !== 42 || !formData.walletAddress.startsWith('0x')) { toast.error('Please enter a valid wallet address (0x...)'); return; }
    if (!formData.githubHandle && !formData.code4renaHandle && !formData.immunefiHandle) { toast.error('Please provide at least one platform handle'); return; }
    setLoading(true);
    try {
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';
      const response = await fetch(`${BACKEND_URL}/api/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      const data = await response.json();
      if (response.ok && data.success) { setSubmitted(true); setApplicationStatus('pending'); toast.success('Application submitted successfully!'); }
      else {
        const errorMsg = data.error || 'Failed to submit application';
        if (data.alreadyApproved || errorMsg.includes('already approved')) { toast.success('You are already an approved auditor! Redirecting...', { duration: 3000 }); setTimeout(() => { window.location.href = '/auditor'; }, 2000); return; }
        else if (errorMsg.includes('already pending')) { toast.error('You already have a pending application.', { duration: 5000 }); }
        else { toast.error(errorMsg, { duration: 5000 }); }
        throw new Error(errorMsg);
      }
    } catch (error) { console.error(error); toast.error(error.message || 'Failed to submit.'); }
    finally { setLoading(false); }
  };

  const checkApplicationStatus = async (walletAddr) => {
    if (!walletAddr) return; setCheckingStatus(true);
    try {
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';
      const response = await fetch(`${BACKEND_URL}/api/apply/${walletAddr}`);
      const data = await response.json();
      setApplicationStatus(data.success && data.hasApplication ? data.status : null);
    } catch { /* silent */ } finally { setCheckingStatus(false); }
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto py-20">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <GlassCard className="p-10 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(139,92,246,0.15))', border: '1px solid rgba(139,92,246,0.35)' }}
            >
              <CheckCircle className="w-8 h-8 text-brand-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Application Submitted</h2>
            <p className="text-sm text-white/40 mb-6">We'll review your work history and respond within 24–48 hours.</p>

            <div className="space-y-2 text-xs text-white/30 text-left mb-6 p-4 rounded-xl" style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.1)' }}>
              {['Admin reviews your application', 'GitHub, Code4rena, Immunefi history verified', 'Credibility score calculated', 'Approval notification sent'].map((item, i) => (
                <div key={i} className="flex items-center gap-2"><span className="text-brand-400">✓</span>{item}</div>
              ))}
            </div>

            <div className="flex gap-3">
              <GradientButton onClick={() => { setSubmitted(false); setFormData({ walletAddress: address || '', githubHandle: '', code4renaHandle: '', immunefiHandle: '', message: '' }); }} className="flex-1">New Application</GradientButton>
              <button onClick={() => router.push('/')} className="px-4 py-2.5 text-sm text-white/40 rounded-xl transition-colors hover:text-white/70" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>Home</button>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    );
  }

  const statusConfig = {
    approved: { label: 'Approved', icon: CheckCircle, color: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.2)' },
    rejected: { label: 'Rejected', icon: XCircle, color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)' },
    pending: { label: 'Pending Review', icon: Clock, color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)' },
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-brand-400/70 font-semibold mb-2">Auditor Program</div>
          <h1 className="text-3xl font-bold text-white">Apply as Auditor</h1>
          <p className="text-sm text-white/40 mt-1">Join as a verified security auditor on AuditViel</p>
        </div>

        {applicationStatus && (() => {
          const cfg = statusConfig[applicationStatus] || statusConfig.pending;
          const StatusIcon = cfg.icon;
          return (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
              <StatusIcon className="w-3.5 h-3.5" />{cfg.label}
            </div>
          )
        })()}
      </div>

      {/* Layout */}
      <div className="grid md:grid-cols-5 gap-6">

        {/* Sidebar */}
        <div className="md:col-span-2 space-y-4">
          <div className="text-[11px] uppercase tracking-widest text-white/25 font-medium mb-1">Why become verified?</div>
          {[
            { icon: Shield, title: 'Credibility Tracking', desc: 'Build reputation with verified work history' },
            { icon: FileText, title: 'Issue Credentials', desc: 'Create ZK-verifiable audit credentials' },
            { icon: Github, title: 'Work Verification', desc: 'GitHub, Code4rena, Immunefi verified' },
            { icon: Bug, title: 'On-Chain Recognition', desc: 'Permanent blockchain approval record' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl transition-all duration-200 group"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.065)' }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.15)' }}>
                <item.icon className="w-3.5 h-3.5 text-brand-400" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white/70">{item.title}</div>
                <div className="text-[11px] text-white/30 mt-0.5">{item.desc}</div>
              </div>
            </div>
          ))}

          <div className="p-3.5 rounded-xl text-[11px] text-white/30 leading-relaxed"
            style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.12)' }}>
            <span className="text-brand-400/70 font-semibold">Note: </span>
            Provide at least one platform handle. Work history is verified and credibility score calculated automatically.
          </div>
        </div>

        {/* Form */}
        <div className="md:col-span-3">
          <GlassCard className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">

              <div>
                <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">Wallet Address *</label>
                <Input
                  name="walletAddress"
                  placeholder="0x..."
                  value={mounted ? formData.walletAddress : ''}
                  onChange={handleChange}
                  required
                  disabled={mounted && isConnected}
                  className="font-mono text-sm"
                  style={inputStyle}
                />
                {mounted && isConnected && <p className="text-[10px] text-brand-400/60 mt-1">✓ Connected wallet auto-filled</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: 'githubHandle', label: 'GitHub', placeholder: 'username' },
                  { name: 'code4renaHandle', label: 'Code4rena', placeholder: 'username' },
                ].map(field => (
                  <div key={field.name}>
                    <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">{field.label}</label>
                    <Input name={field.name} placeholder={field.placeholder} value={formData[field.name]} onChange={handleChange} className="text-sm" style={inputStyle} />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">Immunefi</label>
                <Input name="immunefiHandle" placeholder="username" value={formData.immunefiHandle} onChange={handleChange} className="text-sm" style={inputStyle} />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">Message <span className="text-white/20 normal-case">(optional)</span></label>
                <textarea
                  name="message"
                  placeholder="Tell us about your experience..."
                  value={formData.message}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white placeholder:text-white/15 resize-none focus:outline-none transition-all"
                  style={inputStyle}
                />
              </div>

              <GradientButton
                type="submit"
                isLoading={loading}
                disabled={loading || !formData.walletAddress || applicationStatus === 'pending' || applicationStatus === 'approved'}
                className="w-full"
              >
                {loading ? 'Submitting...' : applicationStatus === 'pending' ? 'Application Pending' : applicationStatus === 'approved' ? 'Already Approved' : 'Submit Application'}
              </GradientButton>

              {formData.walletAddress && !applicationStatus && (
                <button type="button" onClick={() => checkApplicationStatus(formData.walletAddress)} disabled={checkingStatus}
                  className="w-full px-3 py-2.5 text-xs text-white/30 rounded-xl hover:text-white/60 transition-colors flex items-center justify-center gap-2"
                  style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {checkingStatus ? 'Checking...' : 'Check Application Status'}
                </button>
              )}

              {!isConnected && <p className="text-[10px] text-yellow-400/50 text-center">Connect wallet to auto-fill address</p>}
            </form>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
