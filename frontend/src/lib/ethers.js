import { ethers } from 'ethers'

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc-amoy.polygon.technology'
const PROOF_VERIFIER_ADDRESS = process.env.NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS

const proofVerifierAbi = [
  'function isVerified(address project) view returns (bool)',
  'function getAuditor(address project) view returns (address)'
]

export function getBrowserProvider() {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('Wallet not found')
  }
  return new ethers.BrowserProvider(window.ethereum)
}

export async function getSigner() {
  const provider = getBrowserProvider()
  await provider.send('eth_requestAccounts', [])
  return provider.getSigner()
}

export function getReadOnlyContract() {
  if (!PROOF_VERIFIER_ADDRESS) throw new Error('Missing NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS')
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  return new ethers.Contract(PROOF_VERIFIER_ADDRESS, proofVerifierAbi, provider)
}

export async function getContractWithSigner() {
  if (!PROOF_VERIFIER_ADDRESS) throw new Error('Missing NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS')
  const signer = await getSigner()
  return new ethers.Contract(PROOF_VERIFIER_ADDRESS, proofVerifierAbi, signer)
}

