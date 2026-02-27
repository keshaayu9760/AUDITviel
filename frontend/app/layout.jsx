import { Manrope, Cormorant_Garamond } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { WalletProvider } from '@/providers/wallet'
import { Toaster } from 'react-hot-toast'
import { ErrorBoundary } from '@/components/error-boundary'

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', weight: ['400', '500', '600', '700', '800'] })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], variable: '--font-display', weight: ['500', '600', '700'] })

export const metadata = {
  title: 'AuditViel | Verifiable Smart Contract Audit Credentials',
  description: 'Privacy-first audit verification on Polygon with zero-knowledge proofs.',
  keywords: 'blockchain, audit, verification, zk, credentials, smart contracts, polygon',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${cormorant.variable} font-sans`}>
        <ErrorBoundary>
          <WalletProvider>
            <div className="relative min-h-screen overflow-x-hidden">
              <div
                className="fixed inset-0 -z-20 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle at 15% -10%, rgba(231, 205, 177, 0.45) 0%, transparent 42%), radial-gradient(circle at 85% 10%, rgba(216, 229, 206, 0.45) 0%, transparent 38%), linear-gradient(180deg, #faf8f4 0%, #f5f1ea 100%)',
                }}
              />

              <div
                className="fixed inset-0 -z-10 pointer-events-none opacity-[0.05]"
                style={{
                  backgroundImage:
                    'linear-gradient(90deg, rgba(110, 90, 67, 0.08) 1px, transparent 1px), linear-gradient(180deg, rgba(110, 90, 67, 0.08) 1px, transparent 1px)',
                  backgroundSize: '64px 64px',
                }}
              />

              <Navbar />
              <main className="relative max-w-7xl mx-auto px-6 py-10">{children}</main>
              <Footer />
            </div>
          </WalletProvider>
        </ErrorBoundary>

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#fffdf9',
              color: '#1f2a37',
              border: '1px solid #d6cfbf',
              borderRadius: '12px',
              padding: '12px 14px',
              boxShadow: '0 10px 30px rgba(57, 42, 29, 0.12)',
              fontSize: '13px',
              fontWeight: '600',
            },
            success: { iconTheme: { primary: '#2f7a62', secondary: '#fff' } },
            error: { iconTheme: { primary: '#c3574a', secondary: '#fff' } },
          }}
        />
      </body>
    </html>
  )
}
