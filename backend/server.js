/**
 * AuditViel — Polygon Amoy | Auditable Zero-Knowledge Verification Layer
 * 
 * Express.js API server for credential issuance, proof generation, and verification.
 * Handles admin authentication, reputation scoring, and metrics collection.
 */

// Load environment variables FIRST, before any other requires that depend on them
const path = require("path");
const envPath = path.join(__dirname, ".env");
const result = require("dotenv").config({ path: envPath });

if (result.error) {
  // .env file not found - this is OK in production (Render uses environment variables)
  if (process.env.NODE_ENV === 'production') {
    console.log("[server] Running in production mode - using environment variables from hosting platform");
  } else {
    console.warn("[server] Warning: .env file not found:", result.error.message);
  }
} else {
  console.log("[server] ✓ Environment variables loaded from:", envPath);
}

console.log("[server] Environment check:");
console.log("  - NODE_ENV:", process.env.NODE_ENV || "development");
console.log("  - ADMIN_ADDRESS:", process.env.ADMIN_ADDRESS ? "✓ Set" : "✗ Not found");
console.log("  - MONGO_URI:", process.env.MONGO_URI ? "✓ Set" : "✗ Not found");
console.log("  - RPC_URL:", process.env.RPC_URL ? "✓ Set" : "✗ Not found");

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { ethers } = require("ethers");
const axios = require("axios");
const { body, validationResult } = require("express-validator");
const { randomUUID } = require("crypto");
const connectDB = require("./config/db");
const ProofVerifierABI = require("./abi/ProofVerifier.json");
const AuditorRegistryABI = require("./abi/AuditorRegistry.json");
const adminAuth = require("./middleware/adminAuth");
const credentialStore = require("./services/credentialStore");
const metricsService = require("./services/metricsService");
const reputationService = require("./services/reputationService");
const auditorsRouter = require("./routes/auditors");
const adminRouter = require("./routes/admin");
const applyRouter = require("./routes/apply");
const proofsRouter = require("./routes/proofs");
const Credential = require("./models/Credential");
const ProofRecord = require("./models/ProofRecord");

const app = express();

// Trust proxy - required for Render and other hosting platforms
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://auditviel-g5qb.vercel.app",
        "https://auditviel.vercel.app",
        "https://auditviel-git-main.vercel.app",
        "https://audi-tviel.vercel.app",
        process.env.FRONTEND_URL,
        process.env.NEXT_PUBLIC_WEBSITE_URL,
      ].filter(Boolean);

      // Allow project-specific Vercel deployments for both naming variants.
      if (
        /^https:\/\/auditviel(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin) ||
        /^https:\/\/audi-tviel(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin)
      ) {
        return callback(null, true);
      }

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.warn('[CORS] Blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/metrics" || req.path === "/health",
});

app.use(limiter);

// Connect to MongoDB once
(async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection failed", err);
    process.exit(1);
  }
})();

function requireEnv(key) {
  if (!process.env[key]) {
    console.error(`❌ Missing required env: ${key}`);
    process.exit(1);
  }
}

[
  "RPC_URL",
  "MONGO_URI",
  "ADMIN_JWT_SECRET",
  "PROOF_SIGNER_PRIVATE_KEY",
  "AUDITOR_REGISTRY_ADDRESS",
  "PROOF_VERIFIER_ADDRESS",
  "ZK_VERIFIER_ADDRESS"
].forEach(requireEnv);

const CHAIN_ID = Number(process.env.CHAIN_ID || 80002);
const PRIMARY_RPC_URL = (process.env.RPC_URL || "https://rpc-amoy.polygon.technology").trim();
const FALLBACK_RPC_URLS = (process.env.RPC_FALLBACK_URLS || "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);
const RPC_URLS = [PRIMARY_RPC_URL, ...FALLBACK_RPC_URLS];

function makeProvider(url) {
  return new ethers.JsonRpcProvider(url, CHAIN_ID);
}

async function getHealthyProvider() {
  const attempts = 3;
  let lastError = null;

  for (let round = 1; round <= attempts; round += 1) {
    for (const url of RPC_URLS) {
      try {
        const provider = makeProvider(url);
        await provider.getBlockNumber();
        console.log(`[RPC] Connected to ${url} (chainId=${CHAIN_ID})`);
        return { provider, url };
      } catch (err) {
        lastError = err;
        console.warn(`[RPC] Attempt ${round}/${attempts} failed for ${url}: ${err.message || err}`);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw lastError || new Error("Unable to connect to any configured RPC endpoint");
}

// Verify contract addresses are deployed on-chain
(async () => {
  try {
    const { provider } = await getHealthyProvider();

    const contracts = [
      { name: "PROOF_VERIFIER_ADDRESS", address: process.env.PROOF_VERIFIER_ADDRESS },
      { name: "AUDITOR_REGISTRY_ADDRESS", address: process.env.AUDITOR_REGISTRY_ADDRESS },
      { name: "ZK_VERIFIER_ADDRESS", address: process.env.ZK_VERIFIER_ADDRESS }
    ];

    for (const { name, address } of contracts) {
      const code = await provider.getCode(address);
      if (code === "0x" || code === "0x0") {
        console.error(`❌ ${name} has no code on-chain at ${address}`);
        process.exit(1);
      }
      console.log(`✓ ${name} verified on-chain`);
    }
  } catch (err) {
    console.error("❌ Contract validation failed:", err.message);
    process.exit(1);
  }
})();

const RPC_URL = PRIMARY_RPC_URL;
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const CONTRACT_ADDRESS =
  process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const ZK_VERIFIER_ADDRESS = (
  process.env.ZK_VERIFIER_ADDRESS ||
  process.env.NEXT_PUBLIC_ZK_VERIFIER_ADDRESS ||
  ""
)
  .trim()
  .toLowerCase();

const abiCoder = ethers.AbiCoder.defaultAbiCoder()

function normalizePrivateKey(raw, label = 'private key') {
  if (!raw) throw new Error(`Missing ${label}`)
  const trimmed = String(raw).trim()
  const withPrefix = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`
  if (withPrefix.length !== 66) {
    throw new Error(`Invalid ${label} length (expected 32 bytes / 64 hex chars)`)
  }
  return withPrefix
}

function normalizeOptionalPrivateKey(raw, label = 'private key') {
  if (!raw) return null
  return normalizePrivateKey(raw, label)
}

const OPTIONAL_PROOF_KEY = normalizeOptionalPrivateKey(
  process.env.PROOF_SIGNER_PRIVATE_KEY || process.env.ADMIN_PRIVATE_KEY,
  'PROOF_SIGNER_PRIVATE_KEY'
)

let proofSigner = null
let proofSignerAddress = null

if (OPTIONAL_PROOF_KEY) {
  proofSigner = new ethers.Wallet(OPTIONAL_PROOF_KEY)
  proofSignerAddress = proofSigner.address.toLowerCase()
} else {
  console.warn('⚠️  Proof signer private key not configured; proof generation and verification will fail.')
}

let signer
let proofVerifierContract

function getContract() {
  if (!CONTRACT_ADDRESS) throw new Error('Missing CONTRACT_ADDRESS')
  if (!signer) {
    const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID)
    signer = new ethers.Wallet(normalizePrivateKey(PRIVATE_KEY), provider)
  }
  if (!proofVerifierContract) {
    proofVerifierContract = new ethers.Contract(CONTRACT_ADDRESS, ProofVerifierABI, signer)
  }
  return proofVerifierContract
}

function handleValidation(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() })
  }
  next()
}

function buildProofDigest(credentialId, proofId, issuer, subject, proofHex, publicInputs) {
  if (!ZK_VERIFIER_ADDRESS) {
    throw new Error('ZK_VERIFIER_ADDRESS not configured')
  }
  const normalizedIssuer = ethers.getAddress(issuer)
  const normalizedSubject = ethers.getAddress(subject)
  const proofHash = ethers.keccak256(proofHex)
  const inputsHash = ethers.keccak256(abiCoder.encode(['uint256[]'], [publicInputs]))
  return ethers.keccak256(
    abiCoder.encode(
      ['address', 'bytes32', 'address', 'address', 'bytes32', 'bytes32'],
      [ethers.getAddress(ZK_VERIFIER_ADDRESS), proofId, normalizedIssuer, normalizedSubject, proofHash, inputsHash]
    )
  )
}

function verifySignedProof(signature, credentialId, proofId, issuer, subject, proofHex, publicInputs) {
  if (!signature || !proofSignerAddress) return false
  try {
    const digest = buildProofDigest(credentialId, proofId, issuer, subject, proofHex, publicInputs)
    const recovered = ethers.verifyMessage(ethers.getBytes(digest), signature)
    return recovered.toLowerCase() === proofSignerAddress
  } catch (err) {
    console.error('Proof signature verification failed:', err.message)
    return false
  }
}

// AIR Kit removed - using local credential generation

function logRoutes() {
  return [
    'GET /health',
    'GET /api',
    'POST /api/admin/login',
    'POST /api/issueCredential',
    'POST /api/proofs/generate',
    'POST /api/proofs/verify',
    'GET /api/proofs/status/:proofId',
    'GET /api/auditors',
    'GET /api/auditors/:address',
    'GET /api/auditors/:address/reputation',
    'POST /api/auditors/:address/refresh-reputation',
    'GET /api/auditors/:address/is-approved',
    'POST /api/apply',
    'GET /api/apply/pending',
    'GET /api/apply/:address',
    'GET /api/admin/applications',
    'POST /api/admin/approve-auditor',
    'POST /api/admin/reject-application',
    'GET /metrics'
  ]
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', network: 'polygon-amoy', rpc: RPC_URL, contract: CONTRACT_ADDRESS, verifier: ZK_VERIFIER_ADDRESS, adminAddress: adminAuth.adminAddress })
})

app.get('/api/admin/address', (_req, res) => {
  const adminAddress = adminAuth.adminAddress
  if (!adminAddress) {
    return res.status(500).json({ error: 'Admin address not configured' })
  }
  res.json({ adminAddress })
})

app.get('/', (_req, res) => {
  res.send('AuditViel backend running. See /health and /api')
})

app.get('/api', (_req, res) => {
  res.json({ ok: true, routes: logRoutes() })
})

app.post('/api/admin/login', [
  body('timestamp').isInt().withMessage('timestamp required'),
  body('signature').isString().withMessage('signature required')
], handleValidation, (req, res) => {
  const { timestamp, signature } = req.body
  const address = adminAuth.adminAddress

  console.log('[Admin Login] Request received:', { timestamp, hasSignature: !!signature, adminAddress: address })

  if (!address) {
    console.error('[Admin Login] Admin address not configured')
    return res.status(500).json({ error: 'Admin address not configured' })
  }

  const ts = Number(timestamp)
  const MAX_LOGIN_SKEW_MS = 5 * 60 * 1000
  if (Math.abs(Date.now() - ts) > MAX_LOGIN_SKEW_MS) {
    return res.status(401).json({ error: 'Stale login request timestamp' })
  }

  const messageHash = adminAuth.computeMessage('POST', '/api/admin/login', ts, {})
  console.log('[Admin Login] Message hash:', messageHash)

  try {
    const recovered = ethers.verifyMessage(ethers.getBytes(messageHash), signature)
    console.log('[Admin Login] Recovered address:', recovered, 'Expected:', address)

    if (recovered.toLowerCase() !== address.toLowerCase()) {
      console.error('[Admin Login] Address mismatch')
      return res.status(401).json({ error: 'Invalid admin signature' })
    }
    const token = adminAuth.issueToken(address)
    console.log('[Admin Login] Success, token issued')
    res.json({ token, admin: address })
  } catch (err) {
    console.error('[Admin Login] Error:', err.message)
    res.status(401).json({ error: err.message })
  }
})

function validateAddressParam(req, res, next) {
  if (req.params.address && !ethers.isAddress(req.params.address)) {
    return res.status(400).json({ success: false, error: 'Invalid address format' })
  }
  next()
}

app.use('/api/auditors', validateAddressParam, auditorsRouter)
app.use('/api/apply', applyRouter)
app.use('/api/admin', adminAuth.requireAdmin, adminRouter)
// Proof routes (/api/proofs/generate and /api/proofs/verify)
app.use('/api/proofs', proofsRouter)

app.get('/api/reputation/:address', validateAddressParam, async (req, res) => {
  const { address } = req.params
  try {
    const registryAddress = process.env.AUDITOR_REGISTRY_ADDRESS || process.env.NEXT_PUBLIC_AUDITOR_REGISTRY_ADDRESS
    if (!registryAddress) {
      return res.status(500).json({ error: 'Auditor registry is not configured' })
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID)
    const registry = new ethers.Contract(registryAddress, AuditorRegistryABI, provider)
    const info = await registry.getAuditorInfo(address)

    if (!info.isApproved) {
      return res.status(404).json({ error: 'Auditor not approved' })
    }

    const auditorInfo = {
      address,
      githubHandle: info.githubHandle,
      code4renaHandle: info.code4renaHandle,
      immunefiHandle: info.immunefiHandle,
      credentialCount: Number(info.credentialCount),
      approvedAt: Number(info.approvedAt) * 1000
    }

    const reputation = await reputationService.getAuditorReputation(auditorInfo)

    res.json({ success: true, reputation })
  } catch (err) {
    console.error('reputation endpoint error', err?.response?.data || err.message)
    res.status(500).json({ error: err?.response?.data?.message || err.message })
  }
})

app.get('/api/wallet', (_req, res) => {
  try {
    const wallet = new ethers.Wallet(normalizePrivateKey(PRIVATE_KEY))
    res.json({ address: wallet.address })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

const issueCredentialValidators = [
  body('issuer').isString().custom((value) => ethers.isAddress(value)).withMessage('issuer must be a valid address'),
  body('subject').isString().custom((value) => ethers.isAddress(value)).withMessage('subject must be a valid address'),
  body('summaryHash').isString().custom((value) => ethers.isHexString(value, 32)).withMessage('summaryHash must be 32-byte hex'),
  body('status').isString().isLength({ min: 3 }).withMessage('status is required'),
  body('issuerSignature').isString().isLength({ min: 130 }).withMessage('issuerSignature is required')
]

async function issueCredentialHandler(req, res) {
  try {
    const { issuer, subject, summaryHash, status, issuerSignature } = req.body

    const normalizedIssuer = ethers.getAddress(issuer)
    const normalizedSubject = ethers.getAddress(subject)

    const recovered = ethers.verifyMessage(ethers.getBytes(summaryHash), issuerSignature)
    if (recovered.toLowerCase() !== normalizedIssuer.toLowerCase()) {
      return res.status(401).json({ error: 'Issuer signature mismatch' })
    }

    try {
      const registryAddress = process.env.AUDITOR_REGISTRY_ADDRESS || process.env.NEXT_PUBLIC_AUDITOR_REGISTRY_ADDRESS
      if (registryAddress) {
        const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID)
        const registry = new ethers.Contract(registryAddress, AuditorRegistryABI, provider)
        const isApproved = await registry.isApprovedAuditor(normalizedIssuer)
        if (!isApproved) {
          return res.status(403).json({ error: 'Only approved auditors can issue credentials' })
        }
      }
    } catch (err) {
      console.warn('Could not verify auditor approval:', err.message)
    }

    // Generate credential locally (no external dependencies)
    const credentialId = `auditviel-${randomUUID()}`;
    const issuedAt = new Date().toISOString();

    console.log('[Credential] Issuing credential:', credentialId);
    console.log('[Credential] Issuer:', normalizedIssuer);
    console.log('[Credential] Subject:', normalizedSubject);
    console.log('[Credential] Status:', status);

    const onChainId = ethers.keccak256(ethers.toUtf8Bytes(credentialId))

    const record = await credentialStore.upsertCredential({
      credentialId,
      onChainId,
      issuer: normalizedIssuer,
      subject: normalizedSubject,
      summaryHash: ethers.hexlify(summaryHash),
      status,
      issuedAt
    })

    let serverSignature = null
    if (proofSigner && proofSignerAddress) {
      const digest = ethers.keccak256(
        abiCoder.encode(
          ['string', 'bytes32', 'address', 'address', 'bytes32'],
          ['auditviel:credential:v1', onChainId, record.issuer, record.subject, record.summaryHash]
        )
      )
      serverSignature = await proofSigner.signMessage(ethers.getBytes(digest))
    }

    res.json({
      success: true,
      credential_id: credentialId,
      on_chain_id: onChainId,
      issuer: normalizedIssuer,
      subject: normalizedSubject,
      summary_hash: summaryHash,
      status,
      issued_at: issuedAt,
      server_signature: serverSignature,
      type: 'SmartContractAudit'
    })
  } catch (err) {
    console.error('issueCredential error', err?.response?.data || err.message)
    const statusCode = err?.response?.status || 500
    res.status(statusCode).json({ error: err?.response?.data?.message || err.message })
  }
}

app.post('/api/issueCredential', issueCredentialValidators, handleValidation, issueCredentialHandler)
app.post('/api/issuecredential', issueCredentialValidators, handleValidation, issueCredentialHandler)
app.get('/api/issueCredential', (_req, res) => res.status(405).json({ error: 'Use POST /api/issueCredential' }))

app.get('/metrics', async (_req, res) => {
  try {
    const metrics = await metricsService.getMetrics()
    res.json(metrics)
  } catch (err) {
    console.error('metrics error', err)
    res.status(500).json({ error: 'Failed to load metrics' })
  }
})

const PORT = process.env.PORT || 10000
app.listen(PORT, () => console.log(`Backend listening on :${PORT}`))


