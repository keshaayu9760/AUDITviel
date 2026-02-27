export async function issueCredential(payload) {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000'
  const res = await fetch(`${base}/api/issueCredential`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || `Issue failed (${res.status})`)
  return data
}

export async function generateProof(payload) {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000'
  const res = await fetch(`${base}/api/proofs/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || `Proof generation failed (${res.status})`)
  return data
}

