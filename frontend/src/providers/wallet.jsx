'use client'

import { WagmiProvider, createConfig, http } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { injected } from 'wagmi/connectors'
import { defineChain } from 'viem'

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 80002)
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc-amoy.polygon.technology'

const customChain = defineChain({
  id: chainId,
  name: chainId === 137 ? 'Polygon' : 'Polygon Amoy',
  network: chainId === 137 ? 'polygon' : 'polygon-amoy',
  nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] }, public: { http: [rpcUrl] } }
})

const config = createConfig({
  chains: [customChain],
  connectors: [injected()],
  transports: { [customChain.id]: http(rpcUrl) }
})

const queryClient = new QueryClient()

export function WalletProvider({ children }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}

