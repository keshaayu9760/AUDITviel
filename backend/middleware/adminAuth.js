/**
 * AuditViel — Polygon Amoy | Auditable Zero-Knowledge Verification Layer
 * 
 * Admin authentication middleware using EIP-191 signatures and JWT tokens.
 * Validates admin wallet signatures for protected routes.
 */

const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');

const SIGNING_DOMAIN = 'auditviel-admin';
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000; // 5 minutes

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
if (!ADMIN_JWT_SECRET || ADMIN_JWT_SECRET.length < 32) {
  throw new Error('ADMIN_JWT_SECRET must be set and at least 32 characters long');
}
const ADMIN_JWT_TTL = process.env.ADMIN_JWT_TTL || '30m';

function normalizeKey(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (trimmed.startsWith('0x')) return trimmed;
  return `0x${trimmed}`;
}

function resolveAdminAddress() {
  // Check ADMIN_ADDRESS first
  if (process.env.ADMIN_ADDRESS) {
    const addr = process.env.ADMIN_ADDRESS.trim();
    if (ethers.isAddress(addr)) {
      console.log('[adminAuth] Using ADMIN_ADDRESS from environment:', addr);
      return addr.toLowerCase();
    } else {
      console.error('[adminAuth] Invalid ADMIN_ADDRESS format:', addr);
    }
  }

  // Check ADMIN_PUBLIC_ADDRESS
  if (process.env.ADMIN_PUBLIC_ADDRESS) {
    const addr = process.env.ADMIN_PUBLIC_ADDRESS.trim();
    if (ethers.isAddress(addr)) {
      console.log('[adminAuth] Using ADMIN_PUBLIC_ADDRESS from environment:', addr);
      return addr.toLowerCase();
    } else {
      console.error('[adminAuth] Invalid ADMIN_PUBLIC_ADDRESS format:', addr);
    }
  }

  // Fallback to deriving from private key
  const key = normalizeKey(process.env.ADMIN_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY);
  if (!key) {
    console.error('[adminAuth] No ADMIN_ADDRESS, ADMIN_PUBLIC_ADDRESS, or ADMIN_PRIVATE_KEY found');
    console.error('[adminAuth] Available env vars:', Object.keys(process.env).filter(k => k.includes('ADMIN') || k.includes('DEPLOYER')).join(', '));
    return null;
  }
  try {
    const wallet = new ethers.Wallet(key);
    console.log('[adminAuth] Derived admin address from private key:', wallet.address);
    return wallet.address.toLowerCase();
  } catch (err) {
    console.error('[adminAuth] Error deriving address:', err.message);
    return null;
  }
}

const ADMIN_ADDRESS = resolveAdminAddress();
if (ADMIN_ADDRESS) {
  console.log('[adminAuth] ✓ Admin address loaded:', ADMIN_ADDRESS);
} else {
  console.error('[adminAuth] ✗ Admin address not configured!');
}

function computeMessage(method, path, timestamp, body) {
  const bodyHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(body || {})));
  return ethers.solidityPackedKeccak256(
    ['string', 'string', 'string', 'uint256', 'bytes32'],
    [SIGNING_DOMAIN, method.toUpperCase(), path, timestamp, bodyHash]
  );
}

function verifySignature(req) {
  const signature = req.headers['x-admin-signature'];
  const signerAddress = req.headers['x-admin-address'];
  const timestampHeader = req.headers['x-admin-timestamp'];

  if (!signature || !signerAddress || !timestampHeader) {
    return false;
  }

  const timestamp = Number(timestampHeader);
  if (Number.isNaN(timestamp)) return false;

  const now = Date.now();
  if (Math.abs(now - timestamp) > MAX_CLOCK_SKEW_MS) {
    return false;
  }

  const digest = computeMessage(req.method, req.originalUrl || req.path, timestamp, req.body || {});
  try {
    const recovered = ethers.verifyMessage(ethers.getBytes(digest), signature);
    return recovered.toLowerCase() === signerAddress.toLowerCase() && recovered.toLowerCase() === ADMIN_ADDRESS;
  } catch (err) {
    return false;
  }
}

function verifyJwt(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET);
    if (!payload || payload.sub?.toLowerCase() !== ADMIN_ADDRESS) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

function issueToken(address) {
  return jwt.sign(
    {
      sub: address.toLowerCase(),
      scope: 'admin',
    },
    ADMIN_JWT_SECRET,
    { expiresIn: ADMIN_JWT_TTL }
  );
}

function requireAdmin(req, res, next) {
  if (!ADMIN_ADDRESS) {
    return res.status(500).json({ error: 'Admin address not configured' });
  }

  const jwtPayload = verifyJwt(req);
  if (jwtPayload) {
    req.admin = { address: jwtPayload.sub };
    return next();
  }

  if (verifySignature(req)) {
    req.admin = { address: ADMIN_ADDRESS };
    return next();
  }

  return res.status(401).json({ error: 'Admin authentication required' });
}

module.exports = {
  requireAdmin,
  issueToken,
  adminAddress: ADMIN_ADDRESS,
  computeMessage,
};

