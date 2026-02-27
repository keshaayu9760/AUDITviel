/**
 * AuditViel — Polygon Amoy | Auditable Zero-Knowledge Verification Layer
 * 
 * Reputation Fetcher: Automated script to periodically update auditor credibility scores
 * on-chain based on reputation data from external platforms.
 */

require('dotenv').config();
const { ethers } = require('ethers');
const reputationService = require('../services/reputationService');

// Configuration
const PROVIDER_URL = process.env.RPC_URL || 'https://polygon-amoy.infura.io/v3/5b88739e5f9d4b828d0c2237429f0524';
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const AUDITOR_REGISTRY_ADDRESS = process.env.AUDITOR_REGISTRY_ADDRESS;

// ABI for AuditorRegistry contract (only functions we need)
const AUDITOR_REGISTRY_ABI = [
  "function getAllAuditors() view returns (address[])",
  "function updateCredibilityScore(address auditor, uint256 score) external",
  "function getAuditorInfo(address auditor) view returns (bool isApproved, uint256 approvedAt, uint256 credibilityScore, uint256 credentialCount, string memory githubHandle, string memory code4renaHandle, string memory immunefiHandle)"
];

class ReputationFetcher {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(PROVIDER_URL);
    this.adminWallet = null;
    this.registryContract = null;

    if (ADMIN_PRIVATE_KEY) {
      this.adminWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, this.provider);
      this.registryContract = new ethers.Contract(
        AUDITOR_REGISTRY_ADDRESS,
        AUDITOR_REGISTRY_ABI,
        this.adminWallet
      );
    }
  }

  async initialize() {
    if (!ADMIN_PRIVATE_KEY || !AUDITOR_REGISTRY_ADDRESS) {
      throw new Error('Missing required environment variables: ADMIN_PRIVATE_KEY, AUDITOR_REGISTRY_ADDRESS');
    }

    console.log('🚀 Reputation Fetcher initialized');
    console.log('📍 Registry Address:', AUDITOR_REGISTRY_ADDRESS);
    console.log('👤 Admin Address:', this.adminWallet.address);
  }

  async fetchAllAuditors() {
    try {
      console.log('📋 Fetching all approved auditors...');
      const auditors = await this.registryContract.getAllAuditors();
      console.log(`✅ Found ${auditors.length} approved auditors`);
      return auditors;
    } catch (error) {
      console.error('❌ Error fetching auditors:', error.message);
      throw error;
    }
  }

  async updateAuditorReputation(auditorAddress) {
    try {
      console.log(`🔍 Updating reputation for ${auditorAddress}...`);

      // Get current auditor info
      const auditorInfo = await this.registryContract.getAuditorInfo(auditorAddress);
      const [isApproved, approvedAt, currentScore, credentialCount, githubHandle, code4renaHandle, immunefiHandle] = auditorInfo;

      if (!isApproved) {
        console.log(`⚠️  Auditor ${auditorAddress} is not approved, skipping`);
        return null;
      }

      // Fetch fresh reputation data
      const auditorInfoForReputation = {
        githubHandle,
        code4renaHandle,
        immunefiHandle,
        credentialCount: Number(credentialCount),
        approvedAt: Number(approvedAt) * 1000
      };
      const reputationData = await reputationService.getAuditorReputation(auditorInfoForReputation);
      const newScore = reputationData.credibilityScore;

      // Only update if score has changed significantly (difference > 5 points)
      const scoreDifference = Math.abs(newScore - Number(currentScore));
      if (scoreDifference <= 5) {
        console.log(`📊 Score unchanged for ${auditorAddress} (${newScore}), skipping update`);
        return {
          address: auditorAddress,
          oldScore: Number(currentScore),
          newScore: newScore,
          updated: false,
          reason: 'Score difference too small'
        };
      }

      // Update score on-chain
      console.log(`📈 Updating score: ${currentScore} → ${newScore} (Δ${scoreDifference})`);
      const tx = await this.registryContract.updateCredibilityScore(auditorAddress, newScore);
      const receipt = await tx.wait();

      console.log(`✅ Score updated for ${auditorAddress} in tx: ${receipt.hash}`);

      return {
        address: auditorAddress,
        oldScore: Number(currentScore),
        newScore: newScore,
        updated: true,
        transactionHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString()
      };

    } catch (error) {
      console.error(`❌ Error updating reputation for ${auditorAddress}:`, error.message);
      return {
        address: auditorAddress,
        error: error.message,
        updated: false
      };
    }
  }

  async runUpdate() {
    const startTime = Date.now();
    console.log(`\n🕐 Starting reputation update at ${new Date().toISOString()}`);

    try {
      await this.initialize();

      // Fetch all auditors
      const auditors = await this.fetchAllAuditors();

      if (auditors.length === 0) {
        console.log('ℹ️  No auditors found, exiting');
        return;
      }

      // Update each auditor's reputation
      const results = [];
      for (const auditor of auditors) {
        const result = await this.updateAuditorReputation(auditor);
        if (result) {
          results.push(result);
        }

        // Add delay between updates to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Summary
      const updated = results.filter(r => r.updated).length;
      const errors = results.filter(r => r.error).length;
      const skipped = results.filter(r => !r.updated && !r.error).length;

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log('\n📊 Update Summary:');
      console.log(`   ✅ Updated: ${updated}`);
      console.log(`   ⚠️  Skipped: ${skipped}`);
      console.log(`   ❌ Errors: ${errors}`);
      console.log(`   ⏱️  Duration: ${duration}s`);

      // Log detailed results
      if (results.length > 0) {
        console.log('\n📋 Detailed Results:');
        results.forEach(result => {
          if (result.updated) {
            console.log(`   ✅ ${result.address}: ${result.oldScore} → ${result.newScore} (${result.transactionHash})`);
          } else if (result.error) {
            console.log(`   ❌ ${result.address}: ${result.error}`);
          } else {
            console.log(`   ⚠️  ${result.address}: ${result.reason}`);
          }
        });
      }

      console.log(`\n🎉 Reputation update completed at ${new Date().toISOString()}`);

    } catch (error) {
      console.error('💥 Fatal error during reputation update:', error);
      process.exit(1);
    }
  }
}

// CLI execution
if (require.main === module) {
  const fetcher = new ReputationFetcher();

  fetcher.runUpdate()
    .then(() => {
      console.log('✨ Process completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Process failed:', error);
      process.exit(1);
    });
}

module.exports = ReputationFetcher;