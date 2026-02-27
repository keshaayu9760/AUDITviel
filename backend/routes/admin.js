/**
 * AuditViel — Polygon Amoy | Auditable Zero-Knowledge Verification Layer
 * 
 * Admin API routes for auditor approval, rejection, and application management.
 * Requires admin authentication via middleware.
 */

const express = require('express');
const { ethers } = require('ethers');
const reputationService = require('../services/reputationService');
const credibilityCredential = require('../services/credibilityCredential');
const Application = require('../models/Application');

const router = express.Router();

async function updateApplicationStatus(walletAddress, status, adminNotes) {
  const normalized = ethers.getAddress(walletAddress).toLowerCase();
  return await Application.findOneAndUpdate(
    { wallet: normalized },
    { status, adminNotes },
    { new: true }
  );
}

// Contract ABIs and addresses
const AUDITOR_REGISTRY_ABI = require('../abi/AuditorRegistry.json');
const AUDITOR_REGISTRY_ADDRESS = process.env.AUDITOR_REGISTRY_ADDRESS || process.env.NEXT_PUBLIC_AUDITOR_REGISTRY_ADDRESS;

// Provider setup
const provider = new ethers.JsonRpcProvider(
  process.env.RPC_URL || 'https://testnet-rpc.mechain.tech'
);

// Normalize private key (same logic as server.js)
function normalizePrivateKey(raw) {
  if (!raw) throw new Error('Missing ADMIN_PRIVATE_KEY')
  // Remove all whitespace including newlines and carriage returns
  const cleaned = String(raw).replace(/\s/g, '').trim()
  const withPrefix = cleaned.startsWith('0x') ? cleaned : `0x${cleaned}`
  // Private key should be 64 hex chars + '0x' = 66 total
  if (withPrefix.length !== 66) {
    throw new Error(`Invalid ADMIN_PRIVATE_KEY length: ${withPrefix.length} (expected 66 with 0x prefix, got: "${withPrefix}")`)
  }
  return withPrefix
}

// Get admin wallet for on-chain operations
function getAdminWallet() {
  const adminKey = process.env.ADMIN_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  if (!adminKey) {
    throw new Error('ADMIN_PRIVATE_KEY not configured');
  }
  try {
    const normalizedKey = normalizePrivateKey(adminKey);
    return new ethers.Wallet(normalizedKey, provider);
  } catch (error) {
    console.error('Error creating admin wallet:', error.message);
    console.error('Private key (first 10 chars):', adminKey.substring(0, 10));
    throw new Error(`Failed to create admin wallet: ${error.message}`);
  }
}

function getAuditorRegistryContract() {
  const wallet = getAdminWallet();
  return new ethers.Contract(AUDITOR_REGISTRY_ADDRESS, AUDITOR_REGISTRY_ABI, wallet);
}

/**
 * POST /api/admin/approve-auditor
 * Approve an auditor and issue credibility credential
 */
router.post('/approve-auditor', async (req, res) => {
  try {
    const { wallet, auditorAddress, githubHandle, code4renaHandle, immunefiHandle, adminNotes } = req.body;
    const targetAddress = wallet || auditorAddress;

    if (!targetAddress || !ethers.isAddress(targetAddress)) {
      return res.status(400).json({ success: false, error: 'Invalid auditor address format' });
    }

    if (!AUDITOR_REGISTRY_ADDRESS) {
      return res.status(500).json({ success: false, error: 'AUDITOR_REGISTRY_ADDRESS not configured' });
    }

    const normalizedAddress = ethers.getAddress(targetAddress);
    const contract = getAuditorRegistryContract();

    const currentInfo = await contract.getAuditorInfo(normalizedAddress);
    if (currentInfo.isApproved) {
      await updateApplicationStatus(normalizedAddress, 'approved', adminNotes);
      return res.status(200).json({ success: true, message: 'Auditor already approved', auditor: { address: normalizedAddress, isApproved: true } });
    }

    console.log(`📝 Approving auditor ${normalizedAddress}...`);
    const approveTx = await contract.approveAuditor(normalizedAddress);
    console.log(`✅ approveAuditor tx sent: ${approveTx.hash}`);
    await updateApplicationStatus(normalizedAddress, 'approved', adminNotes);

    res.json({
      success: true,
      auditor: {
        address: normalizedAddress,
        isApproved: true,
        credibilityScore: null,
        credentialCount: 0
      },
      txHash: approveTx.hash,
      message: 'Approval submitted. Finalization will continue in the background.'
    });

    ; (async () => {
      let approvalConfirmed = false;
      try {
        await provider.waitForTransaction(approveTx.hash, 1, 60_000);
        console.log('✅ approveAuditor confirmed');
        approvalConfirmed = true;
      } catch (_) {
        console.warn('⏱ approveAuditor confirmation timed out; continuing');
      }

      if (githubHandle || code4renaHandle || immunefiHandle) {
        console.log('ℹ️  Profile handles provided. Auditor should call updateAuditorProfile() themselves.');
      }

      const auditorInfo = {
        address: normalizedAddress,
        githubHandle: githubHandle || '',
        code4renaHandle: code4renaHandle || '',
        immunefiHandle: immunefiHandle || '',
        credentialCount: 0,
        approvedAt: Date.now()
      };
      const reputation = await reputationService.getAuditorReputation(auditorInfo);

      console.log(`🎫 Issuing credibility credential for ${normalizedAddress}...`);
      await credibilityCredential.issueCredibilityCredential(
        normalizedAddress,
        auditorInfo,
        reputation
      );

      if (reputation.credibilityScore > 0) {
        const tryUpdateScore = async () => {
          try {
            const scoreTx = await contract.updateCredibilityScore(normalizedAddress, reputation.credibilityScore);
            console.log(`✅ updateCredibilityScore tx sent: ${scoreTx.hash}`);
            try {
              await provider.waitForTransaction(scoreTx.hash, 1, 60_000);
              console.log('✅ updateCredibilityScore confirmed');
            } catch (_) {
              console.warn('⏱ updateCredibilityScore confirmation timed out; continuing');
            }
          } catch (err) {
            console.warn('⚠️ updateCredibilityScore failed (background):', err?.shortMessage || err?.message);
          }
        };
        if (approvalConfirmed) {
          await tryUpdateScore();
        } else {
          setTimeout(tryUpdateScore, 30_000);
        }
      }
    })().catch((e) => console.warn('Background approval tasks failed:', e?.message));
  } catch (error) {
    console.error('Error approving auditor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve auditor',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/applications
 * Get all applications (pending, approved, rejected)
 */
router.get('/applications', async (req, res) => {
  try {
    const query = {};
    if (req.query.status && ['pending', 'approved', 'rejected'].includes(req.query.status)) {
      query.status = req.query.status;
    }
    const applications = await Application.find(query).sort({ createdAt: -1 }).lean();

    // Transform database fields to match frontend expectations
    const transformedApplications = applications.map(app => ({
      ...app,
      walletAddress: app.wallet,
      githubHandle: app.github,
      code4renaHandle: app.code4rena,
      immunefiHandle: app.immunefi,
      submittedAt: app.createdAt,
      reviewedAt: app.updatedAt
    }));

    res.json({ success: true, count: transformedApplications.length, applications: transformedApplications });
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch applications', message: error.message });
  }
});

/**
 * POST /api/admin/reject-application
 * Reject an application
 */
router.post('/reject-application', async (req, res) => {
  try {
    const { walletAddress, adminNotes } = req.body;

    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return res.status(400).json({ success: false, error: 'Invalid wallet address format' });
    }

    const updated = await updateApplicationStatus(walletAddress, 'rejected', adminNotes);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    res.json({ success: true, message: 'Application rejected', application: updated });
  } catch (error) {
    console.error('Error rejecting application:', error);
    res.status(500).json({ success: false, error: 'Failed to reject application', message: error.message });
  }
});

module.exports = router;

