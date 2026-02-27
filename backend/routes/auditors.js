/**
 * AuditViel — Polygon Amoy | Auditable Zero-Knowledge Verification Layer
 * 
 * Auditor API routes for reputation queries, approval status, and profile management.
 */

const express = require('express');
const { ethers } = require('ethers');
const reputationService = require('../services/reputationService');
const contractDetector = require('../services/contractDetector');

const router = express.Router();
const Application = require('../models/Application');

// Contract ABIs and addresses
const AUDITOR_REGISTRY_ABI = require('../abi/AuditorRegistry.json');
const AUDITOR_REGISTRY_ADDRESS = process.env.AUDITOR_REGISTRY_ADDRESS || process.env.NEXT_PUBLIC_AUDITOR_REGISTRY_ADDRESS;

// Provider setup
const provider = new ethers.JsonRpcProvider(
  process.env.RPC_URL || 'https://testnet-rpc.mechain.tech'
);

// Get read-only contract instance
function getAuditorRegistryContract() {
  return new ethers.Contract(AUDITOR_REGISTRY_ADDRESS, AUDITOR_REGISTRY_ABI, provider);
}

async function getLocalApplicationStatus(walletAddress) {
  try {
    const normalized = ethers.getAddress(walletAddress).toLowerCase();
    const app = await Application.findOne({ wallet: normalized }).lean();
    return app?.status || null;
  } catch (_) {
    return null;
  }
}

/**
 * GET /api/auditors
 * List all approved auditors
 */
router.get('/', async (req, res) => {
  try {
    const contract = getAuditorRegistryContract();
    const auditorAddresses = await contract.getAllAuditors();

    const auditors = await Promise.all(
      auditorAddresses.map(async (address) => {
        const info = await contract.getAuditorInfo(address);
        return {
          address,
          isApproved: info.isApproved,
          approvedAt: Number(info.approvedAt) * 1000,
          credentialCount: Number(info.credentialCount),
          githubHandle: info.githubHandle,
          code4renaHandle: info.code4renaHandle,
          immunefiHandle: info.immunefiHandle,
          credibilityScore: Number(info.credibilityScore)
        };
      })
    );

    // Filter only approved auditors
    const approvedAuditors = auditors.filter(a => a.isApproved);

    res.json({
      success: true,
      auditors: approvedAuditors,
      count: approvedAuditors.length
    });
  } catch (error) {
    console.error('Error fetching auditors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch auditors',
      message: error.message
    });
  }
});

/**
 * GET /api/auditors/:address
 * Get specific auditor details
 */
router.get('/:address', async (req, res) => {
  try {
    const { address } = req.params;

    if (!ethers.isAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid address format'
      });
    }

    const contract = getAuditorRegistryContract();
    const info = await contract.getAuditorInfo(address);

    if (!info.isApproved) {
      return res.status(404).json({
        success: false,
        error: 'Auditor not found or not approved'
      });
    }

    const auditorData = {
      address,
      isApproved: info.isApproved,
      approvedAt: Number(info.approvedAt) * 1000,
      credentialCount: Number(info.credentialCount),
      githubHandle: info.githubHandle,
      code4renaHandle: info.code4renaHandle,
      immunefiHandle: info.immunefiHandle,
      credibilityScore: Number(info.credibilityScore)
    };

    res.json({
      success: true,
      auditor: auditorData
    });
  } catch (error) {
    console.error('Error fetching auditor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch auditor details',
      message: error.message
    });
  }
});

/**
 * GET /api/auditors/:address/reputation
 * Get auditor reputation from external platforms
 */
router.get('/:address/reputation', async (req, res) => {
  try {
    const { address } = req.params;

    if (!ethers.isAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid address format'
      });
    }

    const contract = getAuditorRegistryContract();
    const info = await contract.getAuditorInfo(address);

    if (!info.isApproved) {
      return res.status(404).json({
        success: false,
        error: 'Auditor not found or not approved'
      });
    }

    const auditorInfo = {
      address,
      githubHandle: info.githubHandle,
      code4renaHandle: info.code4renaHandle,
      immunefiHandle: info.immunefiHandle,
      credentialCount: Number(info.credentialCount),
      approvedAt: Number(info.approvedAt) * 1000
    };

    // Fetch reputation data from external platforms
    const reputation = await reputationService.getAuditorReputation(auditorInfo);

    // Auto-detect contracts worked on from work history
    const contractsWorkedOn = await contractDetector.getAuditorContracts(
      { githubHandle: info.githubHandle, code4renaHandle: info.code4renaHandle, immunefiHandle: info.immunefiHandle },
      reputation
    );

    // Enrich with verification status
    const verifiedContracts = await contractDetector.enrichContractAddresses(contractsWorkedOn);

    res.json({
      success: true,
      address,
      reputation: {
        ...reputation,
        contractsWorkedOn: verifiedContracts,
        contractCount: verifiedContracts.length
      }
    });
  } catch (error) {
    console.error('Error fetching reputation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reputation data',
      message: error.message
    });
  }
});

/**
 * POST /api/auditors/:address/refresh-reputation
 * Force refresh reputation data (clears cache)
 */
router.post('/:address/refresh-reputation', async (req, res) => {
  try {
    const { address } = req.params;

    if (!ethers.isAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid address format'
      });
    }

    const contract = getAuditorRegistryContract();
    const info = await contract.getAuditorInfo(address);

    if (!info.isApproved) {
      return res.status(404).json({
        success: false,
        error: 'Auditor not found or not approved'
      });
    }

    // Clear cache
    reputationService.clearCache(
      info.githubHandle,
      info.code4renaHandle,
      info.immunefiHandle
    );

    const auditorInfo = {
      address,
      githubHandle: info.githubHandle,
      code4renaHandle: info.code4renaHandle,
      immunefiHandle: info.immunefiHandle,
      credentialCount: Number(info.credentialCount),
      approvedAt: Number(info.approvedAt) * 1000
    };

    // Fetch fresh reputation data
    const reputation = await reputationService.getAuditorReputation(auditorInfo);

    res.json({
      success: true,
      address,
      reputation,
      message: 'Reputation data refreshed'
    });
  } catch (error) {
    console.error('Error refreshing reputation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh reputation data',
      message: error.message
    });
  }
});

/**
 * GET /api/auditors/:address/is-approved
 * Quick check if address is approved auditor
 */
router.get('/:address/is-approved', async (req, res) => {
  try {
    const { address } = req.params;

    if (!ethers.isAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid address format'
      });
    }

    const contract = getAuditorRegistryContract();
    let isApproved = await contract.isApprovedAuditor(address);

    // If not yet approved on-chain, check local admin-reviewed status for optimistic UI
    if (!isApproved) {
      const localStatus = await getLocalApplicationStatus(address);
      if (localStatus === 'approved') {
        return res.json({ success: true, address, isApproved: true, pendingOnChain: true });
      }
    }

    res.json({ success: true, address, isApproved });
  } catch (error) {
    console.error('Error checking approval:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check approval status',
      message: error.message
    });
  }
});

module.exports = router;
