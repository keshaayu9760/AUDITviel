'use client'

import { useAccount, useConnect, useDisconnect } from 'wagmi'

export default function ConnectButton() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected) {
    return (
      <button
        type="button"
        onClick={() => disconnect()}
        className="inline-flex items-center rounded-xl border-2 border-[#8a4f2a] bg-[#fff7ef] px-4 py-2 text-sm font-semibold text-[#6d3e20] shadow-sm hover:bg-[#fdeedc] transition-colors"
        title={address}
      >
        {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => connect({ connector: connectors?.[0] })}
      disabled={isPending || !connectors?.length}
      className="inline-flex items-center rounded-xl border-2 border-[#8a4f2a] bg-[#8a4f2a] px-4 py-2 text-sm font-bold text-white shadow-[0_4px_12px_rgba(138,79,42,0.35)] hover:bg-[#734022] disabled:opacity-50 transition-colors"
    >
      {isPending ? 'Connecting...' : 'Connect Wallet'}
    </button>
  )
}
