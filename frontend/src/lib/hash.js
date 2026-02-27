import { ethers } from 'ethers'

export function keccak256Utf8(value) {
  return ethers.keccak256(ethers.toUtf8Bytes(String(value ?? '')))
}

export function uuidToBytes32(value) {
  const clean = String(value || '').replace(/-/g, '')
  const hex = clean.startsWith('0x') ? clean.slice(2) : clean
  if (!hex) return ethers.ZeroHash
  const padded = (hex + '0'.repeat(64)).slice(0, 64)
  return `0x${padded}`
}

