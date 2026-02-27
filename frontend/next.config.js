/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_AUDITOR_REGISTRY_ADDRESS: process.env.NEXT_PUBLIC_AUDITOR_REGISTRY_ADDRESS || '',
    NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS: process.env.NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS || '',
    NEXT_PUBLIC_ZK_VERIFIER_ADDRESS: process.env.NEXT_PUBLIC_ZK_VERIFIER_ADDRESS || '',
    NEXT_PUBLIC_GROTH16_VERIFIER_ADDRESS: process.env.NEXT_PUBLIC_GROTH16_VERIFIER_ADDRESS || '',
    NEXT_PUBLIC_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '',
    NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc-amoy.polygon.technology',
    NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID || '80002',
    NEXT_PUBLIC_EXPLORER_URL: process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://amoy.polygonscan.com',
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000',
  },
  webpack: (config) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false,
      'lokijs': false,
      '@metamask/sdk': false,
      '@walletconnect/ethereum-provider': false,
    }
    return config
  },
}

module.exports = nextConfig
