import Link from 'next/link'
import ConnectButton from '@/components/connect-button'

export function Navbar() {
  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-[#faf8f4]/80 border-b border-[#d6cfbf]">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold text-slate-800">AuditViel</Link>
        <nav className="flex items-center gap-4 text-sm text-slate-600">
          <Link href="/apply">Apply</Link>
          <Link href="/auditor">Auditor</Link>
          <Link href="/project">Project</Link>
          <Link href="/verify">Verify</Link>
          <Link href="/metrics">Metrics</Link>
          <Link href="/admin">Admin</Link>
          <ConnectButton />
        </nav>
      </div>
    </header>
  )
}
