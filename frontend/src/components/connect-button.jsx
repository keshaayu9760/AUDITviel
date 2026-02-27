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
        className="inline-flex items-center rounded-lg border border-[#c9b9a3] px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-[#f2ebe2] transition-colors"
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
      className="inline-flex items-center rounded-lg bg-[#1f2a37] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#263444] disabled:opacity-50 transition-colors"
    >
      {isPending ? 'Connecting...' : 'Connect Wallet'}
    </button>
  )
}
