'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ShieldCheck, Lock, Search, ArrowRight, CheckCircle2, Globe, Users, FileCheck2 } from 'lucide-react'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.6, delay },
})

function Section({ children, className = '' }) {
  return <section className={`relative py-20 ${className}`}>{children}</section>
}

export default function HomePage() {
  return (
    <div className="space-y-4">
      <Section className="pt-10 sm:pt-16">
        <div className="grid lg:grid-cols-12 gap-8 items-center">
          <motion.div className="lg:col-span-7" {...fadeUp(0)}>
            <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold text-[#8a4f2a] bg-[#f3e6d9] border border-[#e4c7ac]">
              Premium Proof Infrastructure
            </p>
            <h1 className="mt-6 text-5xl sm:text-6xl lg:text-7xl font-bold leading-[0.95] text-balance">
              Audit confidence,
              <span className="gradient-text"> without report exposure.</span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
              AuditViel turns private smart contract audits into publicly verifiable proof. Teams keep sensitive findings private while users still get trust they can independently validate on-chain.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/apply" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#a8653f] text-white text-sm font-semibold hover:bg-[#955937] transition-colors">
                Apply as Auditor <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/verify" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#fffdf9] text-slate-700 text-sm font-semibold border border-[#d7cec1] hover:bg-[#f9f4ed] transition-colors">
                Verify a Project <Search className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>

          <motion.div className="lg:col-span-5" {...fadeUp(0.12)}>
            <div className="rounded-3xl border border-[#d9d0c4] bg-[#fffdf9]/90 p-6 sm:p-8 shadow-[0_16px_40px_rgba(44,31,20,0.10)]">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Storyline</p>
              <div className="mt-5 space-y-4">
                {[
                  { title: 'Problem', body: 'Audits happen, but raw reports are too sensitive to publish.' },
                  { title: 'Method', body: 'ZK proofs confirm authenticity without exposing report details.' },
                  { title: 'Result', body: 'Anyone can verify a project in seconds with on-chain evidence.' },
                ].map((item, i) => (
                  <div key={item.title} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#efe4d7] text-[#8a4f2a] text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                      <p className="text-sm text-slate-600 leading-relaxed">{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </Section>

      <Section>
        <div className="rounded-3xl border border-[#d7cec1] bg-[#fffdf9]/90 p-7 sm:p-10">
          <motion.p className="text-xs uppercase tracking-[0.2em] text-slate-500" {...fadeUp(0)}>
            Chapter 01
          </motion.p>
          <motion.h2 className="mt-3 text-4xl sm:text-5xl font-bold" {...fadeUp(0.08)}>
            Trust needs proof, not promises.
          </motion.h2>
          <motion.div className="mt-8 grid sm:grid-cols-3 gap-4" {...fadeUp(0.16)}>
            {[
              { icon: Lock, title: 'Private by default', desc: 'Full audit reports remain confidential to teams.' },
              { icon: Globe, title: 'Publicly verifiable', desc: 'Verification status is anchored on Polygon.' },
              { icon: Users, title: 'Auditor credibility', desc: 'Issuer history is linked to identity and reputation.' },
            ].map((card) => (
              <div key={card.title} className="rounded-2xl border border-[#ded6ca] bg-[#fcfaf6] p-5">
                <card.icon className="w-5 h-5 text-[#a8653f]" />
                <h3 className="mt-3 text-lg font-semibold text-slate-800">{card.title}</h3>
                <p className="mt-1 text-sm text-slate-600 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </Section>

      <Section>
        <motion.div className="text-center" {...fadeUp(0)}>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Chapter 02</p>
          <h2 className="mt-3 text-4xl sm:text-5xl font-bold">How verification flows</h2>
        </motion.div>

        <div className="mt-10 grid md:grid-cols-2 gap-4">
          {[
            { step: '01', title: 'Issue credential', desc: 'Auditor signs a verifiable audit credential.' },
            { step: '02', title: 'Generate ZK proof', desc: 'Project creates proof from the private credential.' },
            { step: '03', title: 'Anchor on Polygon', desc: 'Proof metadata is recorded immutably on-chain.' },
            { step: '04', title: 'Verify instantly', desc: 'Anyone checks status from wallet address or hash.' },
          ].map((item) => (
            <motion.div key={item.step} className="rounded-2xl border border-[#d8cfc2] bg-[#fffdf9] p-6" {...fadeUp(0.06)}>
              <p className="text-xs font-bold tracking-[0.2em] text-[#a8653f]">{item.step}</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-800">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      <Section className="pb-8">
        <div className="rounded-3xl border border-[#d8cfc2] bg-gradient-to-br from-[#fffdf9] to-[#f4ede3] p-8 sm:p-12 text-center">
          <motion.p className="text-xs uppercase tracking-[0.2em] text-slate-500" {...fadeUp(0)}>
            Chapter 03
          </motion.p>
          <motion.h2 className="mt-4 text-4xl sm:text-6xl font-bold" {...fadeUp(0.08)}>
            Security proof you can present with confidence.
          </motion.h2>
          <motion.p className="mt-5 text-base text-slate-600 max-w-2xl mx-auto" {...fadeUp(0.16)}>
            Teams gain a premium trust signal for users, investors, and partners while retaining complete control over private audit data.
          </motion.p>
          <motion.div className="mt-8 flex flex-wrap justify-center gap-3" {...fadeUp(0.22)}>
            <Link href="/project" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1f2a37] text-white text-on-dark text-sm font-semibold hover:bg-[#263444] transition-colors">
              Start in Project Dashboard <FileCheck2 className="w-4 h-4" />
            </Link>
            <Link href="/metrics" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-[#cbbfaf] bg-[#fffdf9] text-slate-700 text-sm font-semibold hover:bg-[#f7f2ea] transition-colors">
              View Network Metrics <CheckCircle2 className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </Section>
    </div>
  )
}
